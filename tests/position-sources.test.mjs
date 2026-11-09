import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { literalDateFilters, ROOT, LEDGER } from '../scripts/sources.mjs';
import { pullPositionSources, POSITION_SCAN_LIMIT } from '../scripts/position-sources.mjs';
import { atomic } from '../scripts/store.mjs';
import { RECIPIENT_DIR } from '../scripts/position-config.mjs';

test('position source requests are blocked before reconciliation and at 900 GB', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'position-source-gate-'));
  try {
    let calls = 0;
    const fetcher = async () => { calls++; throw new Error('Unexpected source request.'); };
    const store = { read: async path => path === LEDGER ? JSON.stringify({ preLedgerBilledBytes: POSITION_SCAN_LIMIT, entries: [] }) : null };
    const run = () => pullPositionSources({}, store, { root, fetcher });
    await assert.rejects(run(), /reconciliation has not passed/);
    const path = resolve(root, RECIPIENT_DIR, 'reconciliation.json');
    await atomic(path, JSON.stringify({ pass: false, comparisons: [] }));
    await assert.rejects(run(), /reconciliation has not passed/);
    await atomic(path, JSON.stringify({ pass: true, comparisons: Array.from({ length: 10 }, () => ({ within_0_1_percent: true })) }));
    await assert.rejects(run(), /900 GB cumulative gate/);
    assert.equal(calls, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('wallet SQL bounds both table scans, joins receipt outcomes and exports no counterparties', async () => {
  const sql = await readFile(resolve(ROOT, 'sql/wallet_flows.sql'), 'utf8');
  assert.deepEqual(literalDateFilters(sql), [
    { table: 'receipt_actions', start: '2026-02-23', end: '2026-11-02' },
    { table: 'execution_outcomes', start: '2026-02-23', end: '2026-11-04' }
  ]);
  assert.match(sql, /LEFT JOIN outcomes USING \(receipt_id\)/);
  assert.match(sql, /SUCCESS_VALUE.*SUCCESS_RECEIPT_ID/);
  assert.match(sql, /'ft_transfer', 'ft_transfer_call'/);
  assert.match(sql, /receipt_predecessor_account_id AS sender/);
  assert.match(sql, /NOT COALESCE\(sender_is_wallet AND receiver_is_wallet, FALSE\)/);
  assert.doesNotMatch(sql.slice(sql.lastIndexOf('\nSELECT')), /SELECT[^]*\b(?:sender|receiver|receipt_id)\s*,/);
});
