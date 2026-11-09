import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from '../scripts/sources.mjs';
import { dayRange } from '../scripts/report.mjs';
import { signerTop10Query, summarizeSignerTop10 } from '../scripts/signer-top10.mjs';

test('top-ten extraction freezes the earlier ranking, reports overlap and hides unverified account names', () => {
  const sql = signerTop10Query('example-project.private_results.result_table');
  assert.match(sql, /ORDER BY mean_daily_signers DESC, receiver_account_id\s+LIMIT 10/);
  assert.match(sql, /r.grain = 'receiver_period'/);
  assert.doesNotMatch(sql, /crypto_near_mainnet_us|transactions/);
  assert.throws(() => signerTop10Query('unsafe`reference'), /Invalid/);
  const names = [...Array.from({ length: 9 }, (_, i) => `app${i}.near`), 'users.kaiching'];
  const rows = names.flatMap(receiver_account_id => [
    { grain: 'receiver_period', receiver_account_id, period_start: '2024-11-01', mean_daily_signers: '10' },
    { grain: 'receiver_period', receiver_account_id, period_start: '2025-11-01', mean_daily_signers: '5' }
  ]).reverse();
  const days = dayRange('2024-11-01', '2026-11-01').map(period_start => ({
    grain: 'day', period_start, top10: period_start < '2025-11-01' ? '10' : '5'
  }));
  const p = summarizeSignerTop10(rows, days, new Map([['users.kaiching', 'public app evidence']]));
  assert.equal(p.receivers[0].receiver, 'unnamed account');
  assert.equal(p.receivers[9].receiver, 'users.kaiching');
  assert.equal(p.receivers[9].change, -5);
  assert.equal(p.receivers[9].fractionalChange, -0.5);
  assert.deepEqual(p.comparisons.map(r => [r.receiverSum, r.dayLevelTop10Mean, r.difference]), [[100, 10, 90], [50, 5, 45]]);
  assert.equal(p.usersKaiching.amongFrozenTen, true);
  assert.equal(p.usersKaiching.breakDate, null);
  assert.equal(p.unnamedAccounts, 9);
  assert.doesNotMatch(JSON.stringify(p), /app0\.near/);
  assert.throws(() => summarizeSignerTop10(rows.slice(1), days), /twenty/);
  assert.throws(() => summarizeSignerTop10(rows, days.slice(1)), /730/);
  const overcount = days.map(d => ({ ...d, top10: '1000' }));
  assert.throws(() => summarizeSignerTop10(rows, overcount), /below/);
});

test('saved top-ten snapshot is ranked, internally consistent and names only verified contracts', async () => {
  const p = JSON.parse(await readFile(join(ROOT, 'data/public/signer-top10.json'), 'utf8'));
  assert.equal(p.receivers.length, 10);
  p.receivers.forEach((r, i) => {
    assert.equal(r.rank, i + 1);
    if (i) assert.ok(r.earlierMeanDailySigners <= p.receivers[i - 1].earlierMeanDailySigners);
    assert.ok(Math.abs(r.change - (r.laterMeanDailySigners - r.earlierMeanDailySigners)) < 1e-9);
    assert.equal(r.receiver === 'unnamed account', r.appEvidence === null);
  });
  p.comparisons.forEach((c, i) => {
    const sum = p.receivers.reduce((s, r) => s + (i ? r.laterMeanDailySigners : r.earlierMeanDailySigners), 0);
    assert.ok(Math.abs(c.receiverSum - sum) < 1e-6);
    assert.ok(Math.abs(c.difference - (c.receiverSum - c.dayLevelTop10Mean)) < 1e-6 && c.difference >= 0);
  });
  assert.equal(p.usersKaiching.amongFrozenTen, false);
  assert.equal(p.usersKaiching.breakDate, null);
  assert.ok(!JSON.stringify(p).includes('reserve.kaiching'));
});
