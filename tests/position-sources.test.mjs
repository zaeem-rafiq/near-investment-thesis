import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { literalDateFilters, ROOT, LEDGER } from '../scripts/sources.mjs';
import { pullPositionSources, POSITION_SCAN_LIMIT, POSITION_QUERIES } from '../scripts/position-sources.mjs';
import { atomic } from '../scripts/store.mjs';
import { RECIPIENT_DIR } from '../scripts/position-config.mjs';

test('only signer_split is permitted in the position BigQuery run path', async () => {
  assert.deepEqual(POSITION_QUERIES, { signer_split: ['transactions'] });
  const sql = await readFile(resolve(ROOT, 'sql/wallet_flows.sql'), 'utf8');
  assert.match(sql.split('\n')[0], /NOT RUN.*1,053 GB/);
});

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

test('native unwraps and system refunds remain visible but never enter Check 2 received totals', async () => {
  const sql = await readFile(resolve(ROOT, 'sql/wallet_flows.sql'), 'utf8');
  // Execute the actual classification and weekly inclusion predicate locally.
  // These expressions are standard SQL; no BigQuery request or emulated CASE logic.
  const direction = sql.match(/CASE\b[^]*?END AS direction/)[0];
  const weeklyWhere = sql.slice(sql.lastIndexOf('\nWHERE')).split('\nGROUP BY')[0];
  const wallet = 'buybacks.multisignature.near', db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE transfers (
      asset TEXT, sender TEXT, receiver TEXT, amount INTEGER,
      sender_is_wallet INTEGER, receiver_is_wallet INTEGER
    )`);
    const insert = db.prepare('INSERT INTO transfers VALUES (?, ?, ?, ?, ?, ?)');
    for (const row of [
      ['NEAR', 'wrap.near', wallet, 11, 0, 1],
      ['NEAR', 'system', wallet, 13, 0, 1],
      ['NEAR', 'synthetic-outside', wallet, 17, 0, 1],
      ['wNEAR', 'synthetic-outside', wallet, 19, 0, 1],
      ['wNEAR', 'wrap.near', wallet, 23, 0, 1],
      ['NEAR', wallet, 'wrap.near', 29, 1, 0],
      ['NEAR', wallet, 'system', 31, 1, 0],
      ['NEAR', 'fefundsadmin.sputnik-dao.near', wallet, 37, 1, 1]
    ]) insert.run(...row);
    const rows = db.prepare(`WITH expanded AS (
      SELECT *, wallet IS NULL AS audit, ${direction}
      FROM transfers CROSS JOIN (SELECT ? AS wallet)
    )
    SELECT direction, asset, SUM(amount) AS amount
    FROM expanded ${weeklyWhere}
    GROUP BY direction, asset ORDER BY direction, asset`).all(wallet);
    assert.deepEqual(rows.map(row => ({ ...row })), [
      { direction: 'in', asset: 'NEAR', amount: 17 },
      { direction: 'in', asset: 'wNEAR', amount: 42 },
      { direction: 'not_received', asset: 'NEAR', amount: 24 },
      { direction: 'out', asset: 'NEAR', amount: 60 }
    ]);
    // Check 2 adds only external receipts to burn, never 'out' or 'not_received'.
    assert.equal(rows.filter(row => row.direction === 'in').reduce((sum, row) => sum + row.amount, 0), 59);
  } finally { db.close(); }
});
