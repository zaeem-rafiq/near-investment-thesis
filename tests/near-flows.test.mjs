import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { aggregateNearFlows, exportNearFlows } from '../scripts/near-flows.mjs';
import { assertNoWalletFields } from '../scripts/report.mjs';

const ids = ['nep141:wrap.near', 'synthetic-native-near'];
const row = (originAsset, destinationAsset, amountInUsd, createdAt = '2025-11-03T00:00:00Z') =>
  ({ originAsset, destinationAsset, amountInUsd, createdAt });
test('flows use exact NEAR IDs, exclude NEAR-to-NEAR and missing USD, and total other pairs', () => {
  const result = aggregateNearFlows([
    row('usd', ids[0], '0.1'), row('usd', ids[1], '0.2'),
    row(ids[0], 'usd', '2'), row(ids[0], ids[1], '100'),
    row('other', 'usd', '3'), row('not-near-but-name-matches', 'usd', '4'),
    row('usd', ids[0], null), row(ids[0], 'usd', ''),
    row(ids[0], ids[1], null), row('usd', ids[0], '0')
  ], ids);
  assert.equal(result.weeks.length, 52);
  assert.deepEqual(result.weeks[0], { week: '2025-11-03', total_usd: '9.3', buys_usd: '0.3', sells_usd: '2', missing_usd: 3 });
  assert.deepEqual(result.weeks[1], { week: '2025-11-10', total_usd: '0', buys_usd: '0', sells_usd: '0', missing_usd: 0 });
  assert.equal(result.weeks.at(-1).week, '2026-10-26');
  assertNoWalletFields(result);
});
test('flow weeks enforce UTC boundaries, include the final Sunday, and preserve 18 decimals', () => {
  const result = aggregateNearFlows([
    row('usd', ids[0], '50', '2025-11-02T23:59:59.999Z'),
    row('usd', ids[0], '1', '2025-11-10T00:30:00+01:00'),
    row(ids[0], 'usd', '2', '2025-11-10T00:00:00Z'),
    row('usd', ids[0], '0.000000000000000001', '2026-11-01T23:59:59.999Z'),
    row('usd', ids[0], '50', '2026-11-02T00:00:00Z')
  ], ids);
  assert.equal(result.weeks[0].buys_usd, '1');
  assert.equal(result.weeks[1].sells_usd, '2');
  assert.equal(result.weeks.at(-1).buys_usd, '0.000000000000000001');
});
test('flows reject guessed classifications and malformed input rather than treating it as zero', () => {
  assert.throws(() => aggregateNearFlows([], []), /explicit/);
  assert.throws(() => aggregateNearFlows([], [ids[0], ids[0]]), /distinct/);
  for (const value of ['NaN', '-1', '1e3', 3, '0.0000000000000000001']) {
    assert.throws(() => aggregateNearFlows([row('usd', ids[0], value)], ids), /USD/);
  }
  assert.throws(() => aggregateNearFlows([row('usd', ids[0], '1', 'bad')], ids), /timestamp/);
  assert.throws(() => aggregateNearFlows([row(null, ids[0], '1')], ids), /asset/);
});
test('saved-page export requires completion and writes weekly totals only, not raw identifiers', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'flows-test-')), dir = resolve(root, 'private-swaps');
  try {
    await mkdir(resolve(dir, 'pages'), { recursive: true });
    await assert.rejects(exportNearFlows(dir, ids, { root }), /complete/);
    const rows = [{ ...row('usd', ids[0], '5'), depositAddress: 'synthetic-private-value', depositMemo: 'synthetic-memo' }];
    await writeFile(resolve(dir, 'pages/page-000001.json.gz'), gzipSync(JSON.stringify({ rows })));
    const completion = { complete: true, window: { start: '2025-03-01', end: '2026-11-02' }, pages: 1, rows: 1 };
    const save = () => writeFile(resolve(dir, 'complete.json'), JSON.stringify(completion));
    await save();
    await exportNearFlows(dir, ids, { root });
    const body = await readFile(resolve(root, 'data/public/near_flows.json'), 'utf8');
    const result = JSON.parse(body);
    assert.equal(result.weeks[0].total_usd, '5');
    assert.deepEqual(Object.keys(result), ['weeks']);
    assertNoWalletFields(result);
    assert.ok(!/synthetic-private-value|synthetic-memo|wrap\.near|originAsset|destinationAsset/.test(body));
    completion.rows = 2; await save();
    await assert.rejects(exportNearFlows(dir, ids, { root }), /row count/);
    completion.pages = 2; await save();
    await assert.rejects(exportNearFlows(dir, ids, { root }), /page count/);
    completion.window.start = '2025-11-04'; await save();
    await assert.rejects(exportNearFlows(dir, ids, { root }), /covering/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
