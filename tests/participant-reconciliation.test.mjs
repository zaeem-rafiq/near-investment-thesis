import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { participantTotals, participantPulls, compareParticipantTotals, reconcileParticipants } from '../scripts/participants.mjs';
import { NEAR_ASSET_IDS, POSITION_WINDOW, RECIPIENT_DIR } from '../scripts/position-config.mjs';
import { atomic } from '../scripts/store.mjs';

const row = (depositAddress, originAsset, destinationAsset, amountInUsd = '10', rest = {}) => ({
  depositAddress, depositMemo: null, createdAt: '2026-10-01T12:00:00Z', status: 'SUCCESS',
  originAsset, destinationAsset, amountInUsd, ...rest
});
const totals = rows => { const a = participantTotals(['near-a', 'near-b']); a.add(rows); return a.finish(); };

test('participant totals deduplicate across pulls by address, memo and timestamp, excluding NEAR-to-NEAR', () => {
  const buy = row('synthetic-a', 'usd', 'near-a');
  const internal = row('synthetic-internal', 'near-a', 'near-b', '1000');
  const result = totals([buy, buy, { ...buy, depositMemo: 'other' },
    { ...buy, createdAt: '2026-10-02T12:00:00Z' }, internal, internal,
    row('synthetic-sell', 'near-b', 'usd', '7'), row('synthetic-missing', 'usd', 'near-a', null),
    row('synthetic-outside', 'usd', 'near-a', '200', { createdAt: '2026-11-02T00:00:00Z' })]);
  assert.equal(result.buys.usd, '30');
  assert.equal(result.buys.rows, 4);
  assert.equal(result.buys.missing_usd, 1);
  assert.equal(result.sells.usd, '7');
  assert.equal(result.near_to_near, 1);
  assert.equal(result.duplicate_rows, 2);
  assert.throws(() => totals([buy, { ...buy, amountInUsd: '11' }]), /Conflicting duplicate/);
});

test('every asset and total must reconcile, including zero and the exact 0.1% boundary', () => {
  const saved = totals([row('a', 'usd', 'near-a', '1000'), row('b', 'usd', 'near-b', '1000')]);
  const atLimit = totals([row('a', 'usd', 'near-a', '999'), row('b', 'usd', 'near-b', '999')]);
  assert.equal(compareParticipantTotals(saved, atLimit).pass, true);
  const outside = totals([row('a', 'usd', 'near-a', '998.999999999999999999'), row('b', 'usd', 'near-b', '1001.000000000000000001')]);
  const report = compareParticipantTotals(saved, outside);
  assert.equal(report.comparisons.find(c => c.side === 'buys' && c.asset === 'TOTAL').within_0_1_percent, true);
  assert.equal(report.pass, false);
  const unexpectedSell = totals([row('c', 'near-a', 'usd', '0.000000000000000001')]);
  assert.equal(compareParticipantTotals(totals([]), unexpectedSell).pass, false);
});

test('all eight saved pull directories reconcile offline and refuse wrong metadata or page counts', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'participant-reconciliation-'));
  try {
    const [a, b] = NEAR_ASSET_IDS;
    const rows = [row('synthetic-buy', 'usd', a, '50'), row('synthetic-sell', b, 'usd', '20'),
      row('synthetic-near-near', a, b, '900')];
    const save = async (dir, data, extra = {}) => {
      await atomic(resolve(dir, 'pages/page-000001.json.gz'), gzipSync(JSON.stringify({ rows: data })));
      await atomic(resolve(dir, 'complete.json'), JSON.stringify({
        complete: true, window: POSITION_WINDOW, pages: 1, rows: data.length, ...extra
      }));
    };
    const baselineDir = resolve(root, 'baseline');
    await save(baselineDir, rows);
    const pulls = participantPulls();
    assert.equal(pulls.length, 8);
    assert.equal(new Set(pulls.map(p => p.directory)).size, 8);
    for (const p of pulls) await save(resolve(root, RECIPIENT_DIR, p.directory),
      rows.filter(r => r[p.side === 'buys' ? 'destinationAsset' : 'originAsset'] === p.asset),
      { params: { [p.filter]: [p.asset] }, retainParticipants: true });
    const report = await reconcileParticipants({ root, baselineDir });
    assert.equal(report.pass, true);
    assert.equal(report.comparisons.length, 10);
    assert.equal(report.filtered.duplicate_rows, 1);
    assert.equal(report.filtered.near_to_near, 1);
    assert.equal(JSON.stringify(report).includes('synthetic-'), false);
    const first = pulls[0], dir = resolve(root, RECIPIENT_DIR, first.directory);
    await save(dir, [], { params: { [first.filter]: [a, b] }, retainParticipants: true });
    await assert.rejects(reconcileParticipants({ root, baselineDir }), /metadata/);
    await save(dir, [], { params: { [first.filter]: [a] }, retainParticipants: true, pages: 2 });
    await assert.rejects(reconcileParticipants({ root, baselineDir }), /page count/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
