import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ROOT, QUERIES, literalDateFilters, explorerParams, decodeRows, pullPrices } from '../scripts/sources.mjs';

const T = t => '`bigquery-public-data.crypto_near_mainnet_us.' + t + '`';
const addDays = (d, n) => new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10);

test('every SQL file reads only its tables, each behind a literal block_date filter', async () => {
  for (const [name, tables] of Object.entries(QUERIES)) {
    const sql = await readFile(`${ROOT}/sql/${name}.sql`, 'utf8');
    const filters = literalDateFilters(sql);
    assert.deepEqual([...new Set(filters.map(f => f.table))].sort(), [...tables].sort(), name);
    assert.doesNotMatch(sql, /SELECT \*\s+FROM\s+`/);
  }
});
test('query windows match the approved scan plan', async () => {
  const f = async name => literalDateFilters(await readFile(`${ROOT}/sql/${name}.sql`, 'utf8'));
  assert.deepEqual(await f('signers'), [{ table: 'transactions', start: '2024-11-01', end: '2026-11-02' }]);
  assert.deepEqual(await f('coverage'), [{ table: 'blocks', start: '2024-11-01', end: '2026-11-02' }]);
  assert.deepEqual(await f('supply'), [{ table: 'blocks', start: '2025-11-03', end: '2026-11-02' }]);
  assert.deepEqual((await f('burn')).map(x => [x.table, x.start, x.end]),
    [['execution_outcomes', '2025-11-03', '2026-11-02'], ['transactions', '2025-11-03', '2026-11-02']]);
  const [sample] = await f('contracts');
  assert.equal(sample.dates.length, 104);
  sample.dates.forEach((d, i) => assert.equal(d, addDays('2024-11-04', 7 * i)));
  assert.equal(sample.dates.at(-1), '2026-10-26');
});
test('literal filter guard rejects unfiltered, parameterised and indirect scans', () => {
  const bad = [
    `SELECT MIN(block_date) AS min_date FROM ${T('blocks')}`,
    `SELECT COUNT(*) FROM ${T('blocks')} WHERE block_date >= @start_date AND block_date < @end_date`,
    `SELECT COUNT(*) FROM ${T('blocks')} WHERE block_height > 5`,
    `SELECT COUNT(*) FROM ${T('blocks')} WHERE block_date >= DATE '2026-01-01' AND block_date < DATE '2026-01-02'
     UNION ALL SELECT COUNT(*) FROM ${T('transactions')}`,
    `SELECT COUNT(*) FROM ${T('blocks')} WHERE block_date >= DATE '2020-01-01' AND block_date < DATE '2026-01-01'`,
    `SELECT COUNT(*) FROM ${T('blocks')} WHERE block_date >= DATE '2026-01-02' AND block_date < DATE '2026-01-01'`,
    'SELECT * FROM `bigquery-public-data.crypto_near_mainnet_us.INFORMATION_SCHEMA.PARTITIONS`',
    `SELECT COUNT(*) FROM \`other-project.data.blocks\` WHERE block_date >= DATE '2026-01-01' AND block_date < DATE '2026-01-02'`,
    `-- WHERE block_date >= DATE '2026-01-01' AND block_date < DATE '2026-01-02'\nSELECT COUNT(*) FROM ${T('blocks')}`
  ];
  for (const sql of bad) assert.throws(() => literalDateFilters(sql), undefined, sql);
  assert.deepEqual(literalDateFilters(`SELECT 1 FROM ${T('blocks')} AS b WHERE block_date IN (DATE '2026-01-05', DATE '2026-01-12') AND x = 1`),
    [{ table: 'blocks', dates: ['2026-01-05', '2026-01-12'] }]);
});
test('exclusive API start is widened by exactly one millisecond', () => {
  assert.equal(explorerParams({ start: '2026-10-01', end: '2026-10-02' }).startTimestamp, '2026-09-30T23:59:59.999Z');
});
test('BigQuery REST decoding preserves nested records and exact numeric strings', () => {
  const fields = [{ name: 'count', type: 'INTEGER' }, { name: 'top', mode: 'REPEATED', type: 'RECORD', fields: [{ name: 'contract', type: 'STRING' }] }, { name: 't', type: 'TIMESTAMP' }];
  assert.deepEqual(decodeRows(fields, [{ f: [{ v: '9007199254740993' }, { v: [{ v: { f: [{ v: 'example.near' }] } }] }, { v: '0.123' }] }]),
    [{ count: '9007199254740993', top: [{ contract: 'example.near' }], t: '1970-01-01T00:00:00.123Z' }]);
});
test('prices come from daily candles in the window and reject malformed candles', async () => {
  const urls = [];
  const fetcher = async url => { urls.push(new URL(url)); return { ok: true, json: async () => [[Date.parse('2026-01-02') / 1000, 1, 2, 1.5, 1.8, 10], [Date.parse('2026-01-01') / 1000, 1, 2, 1.5, 1.7, 10]] }; };
  const p = await pullPrices({ start: '2026-01-01', end: '2026-01-03' }, fetcher, async () => {});
  assert.deepEqual(p.days, [{ date: '2026-01-01', close: 1.7 }, { date: '2026-01-02', close: 1.8 }]);
  assert.equal(urls[0].searchParams.get('granularity'), '86400');
  await assert.rejects(pullPrices({ start: '2026-01-01', end: '2026-01-03' }, async () => ({ ok: true, json: async () => [[1, 2]] }), async () => {}), /Invalid price/);
  await assert.rejects(pullPrices({ start: '2026-01-01', end: '2026-01-03' },
    async () => ({ ok: true, json: async () => [[1767225600, 1, 2, 1, '1.5', 9]] }), async () => {}), /Invalid price/);
});
