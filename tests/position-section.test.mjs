import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { positionSection } from '../scripts/position-section.mjs';

const day = (start, offset) => new Date(Date.parse(start) + offset * 86400000).toISOString().slice(0, 10);
const close = (a, b, tolerance = 1e-10) =>
  assert.ok(Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(b)), `${a} != ${b}`);
function fixture() {
  const weeks = Array.from({ length: 52 }, (_, i) => ({
    week: day('2025-11-03', i * 7), openingSupply: 100_000 + i * 9,
    closingSupply: 100_000 + (i + 1) * 9, issuedNear: 10, burnedNear: 1,
    meanClose: i < 26 ? 2 : 4
  }));
  return {
    weeks, latestClose: 4, modelStartMonth: 2027 * 12, activationMonth: 2027 * 12,
    stakingSnapshot: { total_stake_yocto: '2000000000000000000000000000', block_height: 123,
      block_time_utc: '2026-11-09T00:00:00Z', fetched_at_utc: '2026-11-09T00:00:01Z' },
    treasuryShare: { value: 0.1, source: 'synthetic treasury-share source' },
    check1Final: { netBuyingUsd: 520, weeks: weeks.map(w => ({ week: w.week, netBuyingUsd: 10 })) },
    check2: { coverage: 0.3, weeks: weeks.slice(16).map(w => ({ week: w.week, receivedNear: 2, sentNear: 0.5 })),
      currentBalanceNear: 60 },
    check3Growth: 0.25
  };
}
test('holder ledger separates actual and annualized receipts, dated USD and wallet outflows', () => {
  const report = positionSection(fixture()), ledger = report.holderLedger;
  assert.equal(ledger.issued.near.value, 520);
  assert.equal(ledger.issued.usd.value, 1560);
  close(ledger.issued.shareOfOpeningSupply.value, 0.0052);
  assert.equal(ledger.burned.near.value, 52);
  assert.equal(ledger.burned.usd.value, 156);
  close(ledger.burned.shareOfOpeningSupply.value, 0.00052);
  assert.equal(ledger.walletReceived.observed.near.value, 72);
  assert.equal(ledger.walletReceived.observed.usd.value, 248);
  assert.equal(ledger.walletReceived.annualized.near.value, 104);
  close(ledger.walletReceived.annualized.usd.value, 248 * 52 / 36);
  assert.equal(ledger.wallets.sent.near.value, 18);
  assert.equal(ledger.wallets.sent.usd.value, 62);
  assert.equal(ledger.wallets.currentBalance.near.value, 60);
  assert.equal(ledger.wallets.currentBalance.usd.value, 240);
  assert.equal(ledger.wallets.netRetained.near.value, 54);
  assert.equal(ledger.netFloatChange.near.value, 414);
  assert.equal(ledger.netFloatChange.usd.value, 1218);
  close(ledger.nonStakerLossOfShare.value, 1 - 100000 / 100468);
  close(ledger.staking.grossYield.value, 520 * 0.9 / 2000);
  assert.equal(ledger.staking.treasuryShare.source, 'synthetic treasury-share source');
  assert.equal(ledger.wallets.boughtNearBurned.value, null);
  assert.match(ledger.wallets.boughtNearBurned.reason, /not identifiable/);
});
test('review calendar uses exact non-overlapping eligibility, 52-week windows and partial Check 2 start', () => {
  const calendar = positionSection(fixture()).reviewCalendar;
  assert.equal(calendar[0].date, '2026-11-16');
  assert.equal(calendar[0].window, null);
  assert.deepEqual(calendar[0].checks, []);
  assert.deepEqual(calendar.slice(1).map(r => [r.date, r.window.start, r.window.endExclusive, r.ownEligible]), [
    ['2027-02-01', '2026-02-02', '2027-02-01', false],
    ['2027-05-03', '2026-05-04', '2027-05-03', false],
    ['2027-08-02', '2026-08-03', '2027-08-02', false],
    ['2027-11-01', '2026-11-02', '2027-11-01', true]
  ]);
  assert.equal(calendar[1].check2Window.start, '2026-02-23');
  assert.deepEqual(calendar[1].usageComparison, {
    earlier: { start: '2025-02-03', endExclusive: '2026-02-02' },
    later: { start: '2026-02-02', endExclusive: '2027-02-01' }
  });
  for (const rerun of calendar.slice(1)) {
    assert.deepEqual(rerun.checks.map(c => c.threshold.value), [0.2, 0.2, 0.2]);
    close(rerun.checks[0].today.value, 520 / 1560);
    assert.equal(rerun.checks[1].today.value, 0.3);
    assert.equal(rerun.checks[2].today.value, 0.25);
    assert.equal(rerun.broken.bothBelow.value, 0.1);
    assert.equal(rerun.broken.lastReceiptWeeks.value, 13);
  }
});

test('2031 buying needs use three specified prices, two cap rules and final measured buying only', () => {
  const report = positionSection(fixture()).whatYouMustBelieve;
  assert.deepEqual(Object.values(report.prices).map(p => p.value), [3, 4, 2]);
  // Equal issuance at $2/$4 makes the issuance-weighted price $3.
  // Off-cap issuance also has an independent closed-form monthly annuity check.
  const r = 520 / 100234 / 12, burn = 52 / 12;
  const start2031 = (100468 - burn / r) * (1 + r) ** 48 + burn / r;
  const offNew = (start2031 - burn / r) * ((1 + r) ** 12 - 1) + 52;
  close(offNew, 532.1911211056977);
  // HSP-029 reference: midpoint rates for months 0..23, then 1.6%.
  const cutNew = 338.40804516645267;
  for (const [i, rule] of report.rules.entries()) {
    assert.equal(rule.cut, i);
    for (const row of rule.prices) {
      const needed = ((i ? cutNew : offNew) - 52) * row.price.value;
      close(row.buyingNeededUsd.value, needed);
      close(row.multipleOfMeasuredBuying.value, needed / 520);
    }
  }
});
test('price assumptions use dated capture USD, a constant current market cap and input yield targets', () => {
  const report = positionSection(fixture()).priceAssumes, capture = 4628 / 9, cap = 401872;
  assert.equal(report.marketCap.value, cap);
  close(report.yearlyHolderCapture.value, capture); // $156 burn + $248 × 52/36.
  close(report.multiple.value, cap / capture);
  close(report.yield.value, capture / cap);
  assert.deepEqual(report.targets.map(t => t.targetYield.value), [0.016, 0.025, 0.05]);
  for (const target of report.targets) {
    assert.equal(target.label, 'inputs, not findings');
    assert.equal(target.yearsTo2031.value, 5);
    close(target.requiredCapture.value, cap * target.targetYield.value);
    close(target.compoundYearlyGrowth.value, (cap * target.targetYield.value / capture) ** 0.2 - 1);
  }
  const input = fixture();
  input.latestClose = capture * 32 / (0.016 * 100468);
  close(positionSection(input).priceAssumes.targets[0].compoundYearlyGrowth.value, 1);
});
test('scenarios return model inputs and calendar coverage, float and break-even values without probabilities', () => {
  const scenarios = positionSection(fixture()).scenarios;
  for (const [name, row] of Object.entries(scenarios)) {
    assert.equal(row.inputs.yearlyNetBuying, 520);
    assert.equal(row.inputs.yearlyBuybacks, 416); // 72 NEAR × 52/36 × $4.
    assert.equal(row.inputs.yearlyBurn, 52);
    assert.equal(row.inputs.price, 4);
    assert.equal(row.inputs.yearlyBuyingGrowth, 0);
    assert.equal(row.inputs.cut, name === 'bear' ? 0 : 1);
    assert.deepEqual(row.years.map(y => y.year), [2027, 2028, 2029, 2030, 2031]);
    const issued = name === 'bear' ? 532.1911211056977 : 338.40804516645267;
    close(row.years[4].coverage.value, 286 / issued);
    close(row.years[4].netFloatChange.value, issued - 286);
    close(row.years[4].breakEvenPrice.value, 936 / (issued - 52));
  }
  assert.doesNotMatch(JSON.stringify(scenarios), /probabilit/i);
});
test('bear and bull use independent rolling 13-week extrema, not single weeks or whole-window extrema', () => {
  const input = fixture();
  input.check1Final.weeks.forEach((w, i) => { w.netBuyingUsd = i < 13 ? -1 : i < 39 ? 10 : 30; });
  input.check1Final.netBuyingUsd = 637;
  input.check2.weeks.forEach((w, i) => { w.receivedNear = i < 13 ? 1 : i < 23 ? 2 : 3; });
  const s = positionSection(input).scenarios;
  assert.equal(s.bear.inputs.yearlyNetBuying, -52);
  assert.equal(s.bull.inputs.yearlyNetBuying, 1560);
  assert.equal(s.base.inputs.yearlyNetBuying, 637);
  assert.equal(s.bear.inputs.yearlyBuybacks, 208);
  assert.equal(s.bull.inputs.yearlyBuybacks, 624);
  assert.equal(s.base.inputs.yearlyBuybacks, 416);
  assert.equal(s.bear.buyingWindow.start, '2025-11-03');
  assert.equal(s.bull.buyingWindow.start, day('2025-11-03', 39 * 7));
});
test('an omitted activation month retains the model March 2027 assumption', () => {
  const input = fixture();
  delete input.activationMonth;
  assert.equal(positionSection(input).scenarios.base.inputs.activationMonth, 2027 * 12 + 2);
});

function signerFixture() {
  const rows = Array.from({ length: 730 }, (_, i) => ({
    grain: 'day', period_start: day('2024-11-01', i),
    top10: i < 365 ? '100' : '40', everyone_else: i < 365 ? '50' : '40'
  }));
  for (let i = 0; i < 10; i++) for (const later of [false, true]) {
    rows.push({ grain: 'receiver_period', period_start: later ? '2025-11-01' : '2024-11-01',
      receiver_account_id: `app-${i}.near`, mean_daily_signers: String((20 - i) / (later ? 2 : 1)) });
  }
  // A huge later-year app ties the earlier 10th receiver, but sorts after it.
  rows.push({ grain: 'receiver_period', period_start: '2024-11-01', receiver_account_id: 'z-new.near', mean_daily_signers: '11' },
    { grain: 'receiver_period', period_start: '2025-11-01', receiver_account_id: 'z-new.near', mean_daily_signers: '9999' });
  return rows;
}
test('usage decline freezes receiver ranking and attributes the drop using exclusive daily groups', () => {
  const input = fixture();
  input.signerSplitRows = signerFixture();
  const usage = positionSection(input).usageDecline;
  assert.equal(usage.receivers.length, 10);
  assert.deepEqual(usage.receivers.map(r => r.receiver), Array.from({ length: 10 }, (_, i) => `app-${i}.near`));
  assert.equal(usage.receivers[0].earlierMean.value, 20);
  assert.equal(usage.receivers[0].laterMean.value, 10);
  assert.equal(usage.receivers[9].earlierMean.value, 11);
  assert.equal(usage.receivers[9].laterMean.value, 5.5);
  assert.equal(usage.top10.earlier.value, 100);
  assert.equal(usage.top10.later.value, 40);
  assert.equal(usage.everyoneElse.earlier.value, 50);
  assert.equal(usage.everyoneElse.later.value, 40);
  assert.equal(usage.totalDrop.value, 70);
  assert.equal(usage.top10Drop.value, 60);
  close(usage.shareOfDropExplained.value, 6 / 7);
  // Per-receiver earlier means sum to 155, not the exclusive top10 group's 100.
  assert.equal(usage.receivers.reduce((s, r) => s + r.earlierMean.value, 0), 155);
});
test('absent check inputs remain pending and never become numeric placeholders', () => {
  const input = fixture();
  for (const key of ['check1Final', 'check2', 'check3Growth', 'stakingSnapshot', 'treasuryShare']) delete input[key];
  const out = positionSection(input);
  const pending = [
    out.holderLedger.walletReceived.observed.near,
    out.holderLedger.walletReceived.annualized.usd, out.holderLedger.netFloatChange.near,
    out.holderLedger.wallets.currentBalance.near, out.holderLedger.staking.grossYield,
    out.holderLedger.staking.treasuryShare, out.priceAssumes.yearlyHolderCapture,
    out.priceAssumes.multiple, out.priceAssumes.yield, out.priceAssumes.targets[0].compoundYearlyGrowth,
    out.scenarios.bear, out.scenarios.base, out.scenarios.bull, out.usageDecline,
    ...out.reviewCalendar[1].checks.map(c => c.today),
    ...out.whatYouMustBelieve.rules.flatMap(r => r.prices.map(p => p.multipleOfMeasuredBuying))
  ];
  for (const item of pending) {
    assert.equal(item.value, null);
    assert.equal(item.reason, 'pending');
    assert.ok(item.inputs.length > 0);
  }
  assert.equal(out.holderLedger.issued.near.value, 520);
  assert.equal(out.priceAssumes.marketCap.value, 401872);
  assert.ok(out.whatYouMustBelieve.rules[0].prices[0].buyingNeededUsd.value > 0);
  assert.equal(out.inputs.check1Final, undefined);
  assert.doesNotMatch(JSON.stringify(out), /NaN|Infinity/);
});
test('missing wallet balance, coverage or weekly flows is not replaced by a different known wallet field', () => {
  const input = fixture();
  delete input.check2.currentBalanceNear;
  delete input.check2.coverage;
  let out = positionSection(input);
  assert.equal(out.holderLedger.wallets.currentBalance.near.reason, 'pending');
  assert.equal(out.reviewCalendar[1].checks[1].today.reason, 'pending');
  assert.equal(out.holderLedger.wallets.received.near.value, 72);
  delete input.check2.weeks;
  input.check2.currentBalanceNear = 60;
  out = positionSection(input);
  assert.equal(out.holderLedger.wallets.received.near.reason, 'pending');
  assert.equal(out.priceAssumes.yearlyHolderCapture.reason, 'pending');
  assert.equal(out.scenarios.base.reason, 'pending');
  assert.equal(out.holderLedger.wallets.currentBalance.near.value, 60);
});
test('known zeros stay known zeros, and zero denominators have explicit non-pending reasons', () => {
  const input = fixture();
  input.check1Final.netBuyingUsd = 0;
  input.check1Final.weeks.forEach(w => { w.netBuyingUsd = 0; });
  input.check2.coverage = 0;
  input.check2.currentBalanceNear = 0;
  input.check2.weeks.forEach(w => { w.receivedNear = 0; w.sentNear = 0; });
  let out = positionSection(input);
  assert.equal(out.holderLedger.walletReceived.observed.near.value, 0);
  assert.equal(out.holderLedger.walletReceived.annualized.usd.value, 0);
  assert.equal(out.reviewCalendar[1].checks[1].today.value, 0);
  assert.equal(out.whatYouMustBelieve.rules[0].prices[0].multipleOfMeasuredBuying.value, null);
  assert.equal(out.whatYouMustBelieve.rules[0].prices[0].multipleOfMeasuredBuying.reason, 'nonpositive denominator');
  assert.equal(out.scenarios.base.years[0].breakEvenPrice.reason, 'no positive break-even price');
  input.weeks.forEach((w, i) => {
    w.burnedNear = 0; w.openingSupply = 100_000 + i * 10; w.closingSupply = 100_000 + (i + 1) * 10;
  });
  out = positionSection(input);
  assert.equal(out.priceAssumes.yearlyHolderCapture.value, 0);
  assert.equal(out.priceAssumes.yield.value, 0);
  assert.equal(out.priceAssumes.multiple.reason, 'nonpositive denominator');
  assert.equal(out.priceAssumes.targets[0].compoundYearlyGrowth.reason, 'no positive starting capture');
});
test('staking yield uses the supplied sourced treasury share, not a hard-coded split', () => {
  const input = fixture();
  input.treasuryShare = { value: 0.25, source: 'second synthetic source' };
  const staking = positionSection(input).holderLedger.staking;
  assert.equal(staking.totalStakeNear.value, 2000);
  close(staking.grossYield.value, 0.195);
  assert.equal(staking.treasuryShare.source, 'second synthetic source');
  delete input.treasuryShare;
  assert.equal(positionSection(input).holderLedger.staking.grossYield.reason, 'pending');
  input.treasuryShare = { value: 0.1 };
  assert.throws(() => positionSection(input), /requires its source/);
});
test('individual wallet receipts, outflows and balances stay separate and reconcile with totals', () => {
  const input = fixture();
  input.check2.wallets = [0, 1, 2].map((i) => ({
    name: `synthetic-wallet-${i}`, currentBalanceNear: [30, 20, 10][i],
    weeks: input.check2.weeks.map(w => ({ week: w.week, receivedNear: i < 2 ? 1 : 0, sentNear: i < 2 ? 0.25 : 0 }))
  }));
  let wallets = positionSection(input).holderLedger.wallets.perWallet;
  assert.equal(wallets[0].received.near.value, 36);
  assert.equal(wallets[0].received.usd.value, 124);
  assert.equal(wallets[0].sent.near.value, 9);
  assert.equal(wallets[0].currentBalance.near.value, 30);
  assert.equal(wallets[0].currentBalance.usd.value, 120);
  assert.equal(wallets[2].received.near.value, 0);
  assert.equal(wallets[2].boughtNearBurned.value, null);
  delete input.check2.wallets[0].currentBalanceNear;
  wallets = positionSection(input).holderLedger.wallets.perWallet;
  assert.equal(wallets[0].currentBalance.near.reason, 'pending');
  input.check2.wallets[0].weeks[0].receivedNear++;
  assert.throws(() => positionSection(input), /do not match aggregate/);
});
test('known individual balances remain reportable while their transfer histories are pending', () => {
  const input = fixture();
  delete input.check2.weeks;
  input.check2.wallets = [0, 1, 2].map(i => ({ name: `synthetic-wallet-${i}`, currentBalanceNear: 20 }));
  const rows = positionSection(input).holderLedger.wallets.perWallet;
  for (const row of rows) {
    assert.equal(row.currentBalance.near.value, 20);
    assert.equal(row.currentBalance.usd.value, 80);
    assert.equal(row.received.near.value, null);
    assert.equal(row.received.near.reason, 'pending');
    assert.equal(row.sent.near.reason, 'pending');
    assert.equal(row.boughtNearBurned.reason, 'pending');
  }
});
test('zero issuance has no weighted price; burn greater than issuance requires negative equilibrium buying', () => {
  const input = fixture();
  input.weeks.forEach((w, i) => {
    w.issuedNear = 0; w.openingSupply = 100_000 - i; w.closingSupply = 100_000 - i - 1;
  });
  const out = positionSection(input);
  assert.equal(out.whatYouMustBelieve.prices.issuanceWeightedMean.value, null);
  assert.equal(out.whatYouMustBelieve.prices.issuanceWeightedMean.reason, 'nonpositive denominator');
  close(out.whatYouMustBelieve.rules[0].prices[1].buyingNeededUsd.value, -208);
  assert.equal(out.scenarios.base.years[0].coverage.value, null);
  assert.equal(out.scenarios.base.years[0].coverage.reason, 'no issuance');
  assert.ok(out.holderLedger.nonStakerLossOfShare.value < 0);
});
test('drop attribution is not clamped, and is undefined rather than invented when total usage did not fall', () => {
  const input = fixture();
  input.signerSplitRows = signerFixture();
  input.signerSplitRows.filter(r => r.grain === 'day' && r.period_start >= '2025-11-01')
    .forEach(r => { r.top10 = '120'; r.everyone_else = '10'; });
  let out = positionSection(input).usageDecline;
  assert.equal(out.totalDrop.value, 20);
  assert.equal(out.top10Drop.value, -20);
  assert.equal(out.shareOfDropExplained.value, -1);
  input.signerSplitRows.filter(r => r.grain === 'day' && r.period_start >= '2025-11-01')
    .forEach(r => { r.everyone_else = '50'; });
  out = positionSection(input).usageDecline;
  assert.equal(out.shareOfDropExplained.value, null);
  assert.equal(out.shareOfDropExplained.reason, 'no total decline');
});
test('incomplete, conflicting and malformed source inputs fail rather than silently becoming zero', () => {
  let input = fixture();
  input.weeks.pop();
  assert.throws(() => positionSection(input), /Incomplete weeks/);
  input = fixture();
  input.check2.weeks[0].receivedNear = -1;
  assert.throws(() => positionSection(input), /Invalid/);
  input = fixture();
  input.check1Final.netBuyingUsd++;
  assert.throws(() => positionSection(input), /do not match/);
  input = fixture();
  input.latestClose = Infinity;
  assert.throws(() => positionSection(input), /Invalid/);
  input = fixture();
  input.stakingSnapshot.total_stake_yocto = '0';
  assert.throws(() => positionSection(input), /Invalid/);
  input = fixture();
  input.signerSplitRows = signerFixture().slice(1);
  assert.throws(() => positionSection(input), /Incomplete signer split/);
  input.signerSplitRows = signerFixture();
  input.signerSplitRows.push(input.signerSplitRows[0]);
  assert.throws(() => positionSection(input), /Duplicate/);
  input.signerSplitRows = signerFixture();
  input.signerSplitRows[0].top10 = '0.5';
  assert.throws(() => positionSection(input), /daily counts/);
});
test('every result metric has named input traces and output is repeatable, immutable-input and JSON safe', async () => {
  const input = fixture();
  input.signerSplitRows = signerFixture();
  const freeze = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  };
  const before = JSON.stringify(input), out = positionSection(freeze(input));
  assert.deepEqual(positionSection(input), out);
  assert.equal(JSON.stringify(input), before);
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (Object.hasOwn(value, 'value')) {
      assert.ok(value.value === null || Number.isFinite(value.value));
      assert.ok(Array.isArray(value.inputs) && value.inputs.length > 0);
      assert.ok(value.inputs.every(name => typeof name === 'string' && name.length > 0));
      if (value.reason === 'pending') assert.equal(value.value, null);
    }
    Object.values(value).forEach(visit);
  };
  visit(out.holderLedger);
  visit(out.whatYouMustBelieve);
  visit(out.priceAssumes);
  visit(out.scenarios);
  visit(out.reviewCalendar);
  visit(out.usageDecline);
  for (const scenario of Object.values(out.scenarios)) {
    assert.deepEqual(Object.keys(scenario.inputs).sort(), Object.keys(scenario.inputSources).sort());
  }
  assert.deepEqual(JSON.parse(JSON.stringify(out)), out);
  const source = await readFile(new URL('../scripts/position-section.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /node:|\bfetch\s*\(|\b(?:process|require|Buffer)\b/);
});
