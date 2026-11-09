import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { ROOT, literalDateFilters } from '../scripts/sources.mjs';
import { dayRange } from '../scripts/report.mjs';
import { checkSignerSplit, verifyOptionalSignerSplit } from '../scripts/signer-split.mjs';

const fixture = () => {
  const rows = dayRange('2024-11-01', '2026-11-01').map(period_start => ({ grain: 'day', period_start, top10: '2', everyone_else: '3' }));
  return { rows, signers: { days: new Map(rows.map(r => [r.period_start, { signers: 5 }])) } };
};
test('signer split has one bounded table reference and freezes ranking before the later year', async () => {
  const sql = await readFile(resolve(ROOT, 'sql/signer_split.sql'), 'utf8');
  assert.deepEqual(literalDateFilters(sql), [{ table: 'transactions', start: '2024-11-01', end: '2026-11-01' }]);
  assert.match(sql, /COUNTIF\(block_date < DATE '2025-11-01'\)/);
  assert.match(sql, /WHERE earlier_signer_days > 0\s+ORDER BY earlier_signer_days DESC, receiver_account_id LIMIT 10/);
  assert.match(sql, /LOGICAL_OR\(is_top10\)/);
  assert.doesNotMatch(sql.replace(/--[^\n]*/g, ''), /OVER \(ORDER BY/);
  assert.throws(() => literalDateFilters(sql.replace("'2026-11-01'", "'2027-11-01'")), /800 days/);
});
test('split check requires both exclusive groups to sum to signers on every day', () => {
  const { rows, signers } = fixture();
  checkSignerSplit(rows, signers);
  assert.throws(() => checkSignerSplit(rows.slice(1), signers), /do not sum/);
  assert.throws(() => checkSignerSplit([...rows, rows[0]], signers), /duplicate/);
  rows[0].top10 = '3';
  assert.throws(() => checkSignerSplit(rows, signers), /do not sum/);
  rows[0].top10 = '-1';
  assert.throws(() => checkSignerSplit(rows, signers), /Invalid/);
});
test('optional split snapshot is absent-safe and rejects mismatched saved totals', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'split-test-'));
  try {
    await verifyOptionalSignerSplit(undefined, root);
    await mkdir(resolve(root, 'sql'));
    await mkdir(resolve(root, 'data/public/bigquery'), { recursive: true });
    const sql = await readFile(resolve(ROOT, 'sql/signer_split.sql'), 'utf8');
    await writeFile(resolve(root, 'sql/signer_split.sql'), sql);
    const { rows, signers } = fixture();
    const save = () => writeFile(resolve(root, 'data/public/bigquery/signer_split.json'), JSON.stringify({ sql, filters: literalDateFilters(sql), rows }));
    await save();
    await verifyOptionalSignerSplit(signers, root);
    rows[0].everyone_else = '4';
    await save();
    await assert.rejects(verifyOptionalSignerSplit(signers, root), /do not sum/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
