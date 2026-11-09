import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ROOT } from '../scripts/sources.mjs';
import { mulberry32 } from '../scripts/report.mjs';
import { normalizeSwaps, check1, twoWayCut, exchangeCut, leadFollow, concentration, check3, check2 } from '../scripts/position-results.mjs';

const NEAR = 'nep141:wrap.near', USDC = 'other:usdc', FE = 'fefundsadmin.sputnik-dao.near', BB = 'buybacks.multisignature.near';
let n = 0;
const swap = (side, usd, { recipient = 'r.near', senders = [], refundTo = 's.near', at = '2026-03-04T00:00:00Z', memo } = {}) => ({
  depositAddress: `d${n++}`, depositMemo: memo ?? null, createdAt: at, status: 'SUCCESS',
  originAsset: side === 'buy' ? USDC : NEAR, destinationAsset: side === 'buy' ? NEAR : USDC,
  amountInUsd: usd, recipient, senders, refundTo
});

test('normalization drops NEAR-to-NEAR and identical duplicates, keeps missing USD for counting', () => {
  const a = swap('buy', '10');
  const { rows, nearToNear, duplicates } = normalizeSwaps([a, { ...a }, { ...swap('buy', '5'), originAsset: NEAR }, swap('sell', null)]);
  assert.equal(rows.length, 2); assert.equal(nearToNear, 1); assert.equal(duplicates, 1);
  assert.equal(rows[0].week, '2026-03-02'); assert.equal(rows[1].units, null);
  assert.throws(() => normalizeSwaps([a, { ...a, amountInUsd: '11' }]), /Conflicting/);
});

test('Check 1 final excludes revenue-wallet recipients and sell senders, reports refundTo-only sells', () => {
  const { rows } = normalizeSwaps([
    swap('buy', '100'), swap('buy', '40', { recipient: FE }),
    swap('sell', '30', { senders: ['x.near'] }), swap('sell', '20', { senders: [BB] }),
    swap('sell', '7', { senders: [], refundTo: FE }), swap('sell', null, { senders: ['x.near'] })
  ]);
  const c = check1(rows, 200);
  assert.equal(c.provisional.netUsd, 140 - 57);
  assert.equal(c.final.netUsd, 100 - 37); assert.equal(c.final.missingUsdRows, 1);
  assert.equal(c.final.shareOfIssuanceValue, 63 / 200); assert.equal(c.pass, true);
  assert.deepEqual(c.excluded, { buyRows: 1, buysUsd: 40, sellRows: 1, sellsUsd: 20 });
  assert.deepEqual(c.refundToRevenueWalletNotSender, { sells: 1, usd: 7 });
  assert.equal(c.senderCoverage.withSenders, 3); assert.equal(c.senderCoverage.sells, 4);
  assert.equal(check1(rows, 400).pass, false);
});

test('two-way accounts leave both sides; refundTo variant and exchange cut are applied to final rows', () => {
  const { rows } = normalizeSwaps([
    swap('buy', '50', { recipient: 'a.near' }), swap('sell', '20', { senders: ['a.near'] }),
    swap('buy', '30', { recipient: 'b.near' }), swap('sell', '5', { senders: [], refundTo: 'b.near' }),
    swap('buy', '9', { recipient: 'ex.near' })
  ]);
  const senders = twoWayCut(rows, 100);
  assert.equal(senders.accounts, 1); assert.equal(senders.netUsd, 39 - 5);
  const refund = twoWayCut(rows, 100, r => [...r.senders, r.refundTo]);
  assert.equal(refund.accounts, 2); assert.equal(refund.netUsd, 9);
  const ex = exchangeCut(rows, ['ex.near'], 100);
  assert.equal(ex.netUsd, 80 - 25); assert.equal(ex.removedBuyRows, 1);
});

test('lead or follow needs two lags at 0.30 that beat the reverse by 0.15', () => {
  const rand = mulberry32(7), flows = Array.from({ length: 52 }, () => rand() - 0.5);
  const change = flows.map((_, t) => (t >= 2 ? 0.5 * flows[t - 1] + 0.5 * flows[t - 2] : 0) * 0.1);
  const closes = []; let p = 10;
  for (const c of change) { p *= 1 + c; closes.push(p); }
  const r = leadFollow(flows, closes, 10);
  assert.equal(r.result, 'flow leads'); assert.ok(r.flowLeadLags >= 2);
  assert.equal(leadFollow(flows, flows.map(() => 10), 10).result, "can't tell");
});

test('concentration counts net buyers and sellers and removes the largest from the total', () => {
  const { rows } = normalizeSwaps([
    swap('buy', '100', { recipient: 'a.near' }), swap('buy', '10', { recipient: 'b.near' }), swap('buy', '4', { recipient: 'c.near' }),
    swap('sell', '3', { recipient: 'z', senders: ['c.near'] }), swap('sell', '50', { senders: [], refundTo: 'd.near' }),
    swap('buy', '1', { recipient: FE })
  ]);
  const c = concentration(rows, 100);
  assert.equal(c.netBuyers, 3); assert.equal(c.netSellers, 1);
  assert.equal(c.netUsd, 61);
  assert.equal(c.withoutTopNetBuyers[1].netUsd, -39);
  assert.equal(c.withoutTopNetBuyers[3].netUsd, 61 - 111);
  assert.equal(c.withoutTopNetBuyersAndSellers[3].netUsd, 61 - 111 + 50);
  assert.equal(c.medianBuyerTotalUsd, 10); assert.equal(c.buyersWithAnyBuy, 3);
});

test('concentration handles no buyers', () => {
  const c = concentration([], 100);
  assert.equal(c.netUsd, 0);
  assert.equal(c.medianBuyerTotalUsd, null);
});

test('aggregate guard allows only named revenue wallets, source hosts and hash fields', async () => {
  const { assertAggregateOnly } = await import('../scripts/position-results.mjs');
  assert.doesNotThrow(() => assertAggregateOnly({ wallet: FE, sqlSha256: 'a'.repeat(64), source: 'https://api.nearblocks.io' }));
  for (const value of [{ note: 'private.near' }, { note: '0x' + 'a'.repeat(40) }, { note: 'b'.repeat(64) }, { recipient: 'private' }]) {
    assert.throws(() => assertAggregateOnly(value));
  }
});

test('position export registers its hash, preserves existing entries and rejects private data before writing', async () => {
  const { exportPositionResults } = await import('../scripts/position-results.mjs');
  const root = await mkdtemp(join(tmpdir(), 'near-position-export-'));
  try {
    await mkdir(join(root, 'data/public'), { recursive: true });
    const manifestPath = join(root, 'data/public/manifest.json');
    const original = { files: { existing: { path: 'data/public/existing.json', sha256: 'unchanged' } } };
    await writeFile(manifestPath, JSON.stringify(original));
    const entry = await exportPositionResults({ root, results: { check1: { pass: true } } });
    const body = await readFile(join(root, entry.path), 'utf8');
    assert.equal(entry.sha256, createHash('sha256').update(body).digest('hex'));
    const saved = await readFile(manifestPath, 'utf8');
    assert.deepEqual(JSON.parse(saved).files.existing, original.files.existing);
    await assert.rejects(exportPositionResults({ root, results: { note: 'private.near' } }), /Account-like/);
    assert.equal(await readFile(manifestPath, 'utf8'), saved);
    assert.equal(await readFile(join(root, entry.path), 'utf8'), body);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('saved aggregate snapshot matches independently reconciled totals and preserves the balance stop gate', async () => {
  const { assertAggregateOnly } = await import('../scripts/position-results.mjs');
  const p = JSON.parse(await readFile(join(ROOT, 'data/public/position-results.json'), 'utf8'));
  assertAggregateOnly(p);
  const close = (actual, expected, tolerance) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
  close(p.issuance.issuanceValueUsd, 66987430.78, 0.005);
  close(p.check1.final.netUsd, 52082185.45, 0.005);
  close(p.check2.receivedNear, 3125552.769, 0.001);
  close(p.check2.receivedUsd, 7547226.28, 0.005);
  close(p.check3.growth, 0.14578239, 1e-8);
  assert.deepEqual([p.check1.pass, p.check2.pass, p.check3.pass], [true, false, false]);
  assert.equal(p.call.result, 'Not yet');
  assert.equal(p.check1.weeklyFinalNetUsd.length, 52);
  assert.equal(p.check2.weeks.length, 36);
  close(p.check1.weeklyFinalNetUsd.reduce((s, w) => s + w.netUsd, 0), p.check1.final.netUsd, 1e-6);
  close(p.check2.weeks.reduce((s, w) => s + w.receivedNear, 0), p.check2.receivedNear, 1e-8);
  close(p.walletReconciliation.movesAmongRevenueWallets.reduce((s, m) => s + m.near, 0), 510068, 1e-8);
  assert.equal(p.walletReconciliation.movesAmongRevenueWallets.length, 3);
  for (const w of p.walletReconciliation.rows) {
    assert.ok(Math.abs(w.gapWithMoves.percent) < 0.41);
    assert.equal(w.missingOutcomes, 0);
    assert.equal(w.failedTransfers, 0);
    assert.equal(w.wnearTransferRows, 0);
  }
});

test('Check 3 compares everyone_else daily means and requires exclusive groups to sum to signers', () => {
  const rows = [], signers = new Map();
  for (let t = Date.parse('2024-11-01'); t < Date.parse('2026-11-01'); t += 86400000) {
    const d = new Date(t).toISOString().slice(0, 10), rest = d < '2025-11-01' ? 100 : 125;
    rows.push({ grain: 'day', period_start: d, top10: '5', everyone_else: String(rest) }); signers.set(d, { signers: rest + 5 });
  }
  const c = check3(rows, signers);
  assert.equal(c.prior.days, 365); assert.equal(c.growth, 0.25); assert.equal(c.pass, true);
  signers.set('2025-01-01', { signers: 1 });
  assert.throws(() => check3(rows, signers), /does not sum/);
});

test('Check 2 adds burn and outside receipts over issuance for the listed weeks', () => {
  const weeks = ['2026-02-23', '2026-03-02'];
  const ledger = { weeks: weeks.map(week => ({ week, inNear: 10n ** 24n, inWnear: 0n })) };
  const c = check2(weeks.map(week => ({ week, burnt: 1, issued: 20 })), [ledger, ledger], weeks);
  assert.equal(c.receivedNear, 4); assert.equal(c.coverage, 6 / 40); assert.equal(c.pass, false);
});
