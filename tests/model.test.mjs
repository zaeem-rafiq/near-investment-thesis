import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  capAtMonth, simulateMonths, projectModel, DEFAULT_ACTIVATION_MONTH, ACTIVATION_ASSUMPTION
} from '../scripts/model.mjs';

const startMonth = 2027 * 12;
const base = {
  startingSupply: 1_306_946_399, startMonth, realizedShare: 1,
  yearlyBurn: 0, price: 4.3, yearlyNetBuying: 0, yearlyBuybacks: 0,
  yearlyBuyingGrowth: 0, cut: 1, activationMonth: startMonth
};
const close = (actual, expected, tolerance = 1e-12) =>
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)),
    `${actual} != ${expected}`);

for (const [month, cap] of [[6, 0.02275], [12, 0.02050], [18, 0.01825], [24, 0.01600]]) {
  test(`HSP-029 published cap anchor at month ${month}`, () => close(capAtMonth(month), cap));
}
test('cap is unchanged before activation and with the cut off, and stays at target after month 24', () => {
  close(capAtMonth(-12), 0.025);
  close(capAtMonth(0), 0.025);
  close(capAtMonth(100), 0.016);
  close(capAtMonth(12, 0), 0.025);
});
for (const [months, published] of [[24, 11_800_000], [36, 24_500_000], [72, 66_100_000]]) {
  test(`avoided issuance at ${months} months is within 5% of the published ${published} NEAR`, () => {
    const cut = simulateMonths(base, months);
    const uncut = simulateMonths({ ...base, cut: 0 }, months);
    const avoided = uncut.at(-1).endSupply - cut.at(-1).endSupply;
    close(avoided, published, 0.05);
  });
}
test('monthly issuance uses the midpoint cap and compounds remaining supply after burn', () => {
  const rows = simulateMonths({ ...base, yearlyBurn: 12_000 }, 2);
  const firstNew = base.startingSupply * (0.025 - 0.009 * 0.5 / 24) / 12;
  close(rows[0].newNear, firstNew);
  close(rows[0].burnedNear, 1000);
  close(rows[0].endSupply, base.startingSupply + firstNew - 1000);
  close(rows[1].newNear, rows[0].endSupply * (0.025 - 0.009 * 1.5 / 24) / 12);
});
test('calendar output covers exactly 2027–2031 and agrees with constant-cap closed-form issuance', () => {
  const result = projectModel({ ...base, cut: 0, yearlyNetBuying: 12_000, yearlyBuybacks: 6000, price: 3 });
  assert.deepEqual(result.years.map(row => row.year), [2027, 2028, 2029, 2030, 2031]);
  for (const [i, row] of result.years.entries()) {
    const supply = base.startingSupply * (1 + 0.025 / 12) ** (12 * i);
    const issuance = supply * ((1 + 0.025 / 12) ** 12 - 1);
    assert.equal(row.months, 12);
    close(row.newNear, issuance);
    close(row.burnedNear, 0);
    close(row.absorbedNear, 6000);
    close(row.coverage, 6000 / issuance);
    close(row.netFloatChange, issuance - 6000);
    close(row.breakEvenPrice, 18_000 / issuance);
  }
});
test('default March activation is labeled an assumption and January/February remain at 2.5%', () => {
  const input = { ...base };
  delete input.activationMonth;
  const result = projectModel(input), rows = simulateMonths(input, 4);
  assert.equal(DEFAULT_ACTIVATION_MONTH, 2027 * 12 + 2);
  assert.equal(result.activationMonth, DEFAULT_ACTIVATION_MONTH);
  assert.equal(result.activationAssumption, ACTIVATION_ASSUMPTION);
  assert.match(result.activationAssumption, /assumption.*veto window.*November 16.*quarter.*validator adoption/);
  close(rows[0].cap, 0.025);
  close(rows[1].cap, 0.025);
  close(rows[2].cap, 0.025 - 0.009 * 0.5 / 24);
});
test('burn reduces subsequent supply; buying and buybacks only reduce float and count once', () => {
  const input = { ...base, yearlyBurn: 12_000, yearlyNetBuying: 24_000, yearlyBuybacks: 12_000, price: 2 };
  const months = simulateMonths(input, 12), row = projectModel(input).years[0];
  close(row.newNear, months.reduce((sum, m) => sum + m.newNear, 0));
  close(row.burnedNear, 12_000);
  close(row.absorbedNear, 18_000);
  close(row.coverage, 30_000 / row.newNear);
  close(row.netFloatChange, row.newNear - 30_000);
  close(row.breakEvenPrice, 36_000 / (row.newNear - 12_000));
  const noBuying = simulateMonths({ ...input, yearlyNetBuying: 0, yearlyBuybacks: 0 }, 12);
  close(months.at(-1).endSupply, noBuying.at(-1).endSupply);
  const atBreakEven = projectModel({ ...input, price: row.breakEvenPrice }).years[0];
  close(atBreakEven.coverage, 1);
  close(atBreakEven.netFloatChange, 0, 1e-7);
});
test('growth compounds by calendar year; constant buybacks do not grow and partial years are prorated', () => {
  const input = { ...base, startMonth: 2026 * 12 + 10, yearlyNetBuying: 12_000,
    yearlyBuybacks: 6000, yearlyBuyingGrowth: 0.5, price: 2 };
  const rows = simulateMonths(input, 15);
  close(rows[0].netBuyingUsd, 1000);
  close(rows[2].netBuyingUsd, 1500);
  close(rows[14].netBuyingUsd, 2250);
  close(rows[14].buybacksUsd, 500);
  const annual = projectModel({ ...input, startMonth: 2027 * 12 + 6 }).years;
  assert.equal(annual[0].months, 6);
  close(annual[0].absorbedNear, 4500);
  close(annual[1].absorbedNear, 12_000);
  assert.equal(projectModel({ ...base, startMonth: 2032 * 12 }).years[0].months, 0);
});
test('zero issuance and no positive break-even solution are explicit nulls, not NaN', () => {
  const zero = projectModel({ ...base, realizedShare: 0 }).years[0];
  assert.equal(zero.coverage, null);
  assert.equal(zero.breakEvenPrice, null);
  close(zero.netFloatChange, 0);
  assert.equal(projectModel(base).years[0].breakEvenPrice, null);
  const burned = projectModel({ ...base, realizedShare: 0, yearlyBurn: 12_000, yearlyNetBuying: 100 }).years[0];
  assert.equal(burned.breakEvenPrice, null);
  close(burned.netFloatChange, -12_000 - 100 / base.price);
});
test('negative net buying increases float and has no positive break-even price', () => {
  const row = projectModel({ ...base, yearlyNetBuying: -12_000, price: 2 }).years[0];
  close(row.absorbedNear, -6000);
  close(row.netFloatChange, row.newNear + 6000);
  assert.ok(row.coverage < 0);
  assert.equal(row.breakEvenPrice, null);
});
test('minus 100% buying growth removes later net buying but not buybacks', () => {
  const years = projectModel({ ...base, yearlyNetBuying: 1200, yearlyBuybacks: 120, yearlyBuyingGrowth: -1, price: 1 }).years;
  close(years[0].absorbedNear, 1320);
  close(years[1].absorbedNear, 120);
  close(years[4].absorbedNear, 120);
});

function seeded(seed) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}
function randomInput(random) {
  return {
    ...base, startingSupply: 1e8 + random() * 2e9, realizedShare: 0.2 + random() * 0.8,
    yearlyBurn: random() * 500_000, price: 0.1 + random() * 100,
    yearlyNetBuying: 1000 + random() * 1e8, yearlyBuybacks: random() * 1e7,
    yearlyBuyingGrowth: -0.5 + random(), activationMonth: startMonth - 36 + Math.floor(random() * 96)
  };
}
test('seeded cap checks stay between 1.6% and 2.5%, including before activation and after the ramp', () => {
  const random = seeded(2901);
  for (let i = 0; i < 1000; i++) {
    const elapsed = random() * 240 - 60, cap = capAtMonth(elapsed);
    assert.ok(cap >= 0.016 && cap <= 0.025);
    close(capAtMonth(elapsed, 0), 0.025);
  }
});
test('seeded monthly supply never falls when issuance exceeds burn', () => {
  const random = seeded(2902);
  for (let i = 0; i < 100; i++) {
    for (const row of simulateMonths(randomInput(random), 60)) {
      if (row.newNear >= row.burnedNear) assert.ok(row.endSupply >= row.startSupply);
      close(row.endSupply - row.startSupply, row.newNear - row.burnedNear, 1e-9);
    }
  }
});
test('seeded annual coverage rises with buying', () => {
  const random = seeded(2903);
  for (let i = 0; i < 100; i++) {
    const input = randomInput(random), original = projectModel(input).years;
    const more = projectModel({ ...input, yearlyNetBuying: input.yearlyNetBuying * 2 }).years;
    for (let j = 0; j < 5; j++) assert.ok(more[j].coverage > original[j].coverage);
  }
});
test('seeded annual coverage falls as price rises', () => {
  const random = seeded(2904);
  for (let i = 0; i < 100; i++) {
    const input = randomInput(random), original = projectModel(input).years;
    const dearer = projectModel({ ...input, price: input.price * 2 }).years;
    for (let j = 0; j < 5; j++) assert.ok(dearer[j].coverage < original[j].coverage);
  }
});
test('seeded cut-on issuance never exceeds cut-off issuance in any month or calendar year', () => {
  const random = seeded(2905);
  for (let i = 0; i < 100; i++) {
    const input = randomInput(random), on = simulateMonths(input, 60);
    const off = simulateMonths({ ...input, cut: 0 }, 60);
    on.forEach((row, j) => assert.ok(row.newNear <= off[j].newNear));
    const annualOn = projectModel(input).years, annualOff = projectModel({ ...input, cut: 0 }).years;
    annualOn.forEach((row, j) => assert.ok(row.newNear <= annualOff[j].newNear));
  }
});
test('custom activation before or after the horizon uses elapsed months, not time since simulation start', () => {
  const early = simulateMonths({ ...base, activationMonth: startMonth - 24 }, 1);
  close(early[0].cap, 0.016);
  const late = projectModel({ ...base, activationMonth: 2032 * 12 }).years;
  assert.deepEqual(late, projectModel({ ...base, cut: 0 }).years);
});
test('invalid numbers, units and flags are refused rather than coerced', () => {
  for (const [field, value] of [
    ['startingSupply', -1], ['startingSupply', Infinity], ['startMonth', '2027-01-01'],
    ['startMonth', 2027.5], ['startMonth', -1], ['realizedShare', 1.01],
    ['realizedShare', -0.1], ['realizedShare', NaN], ['yearlyBurn', -1],
    ['price', 0], ['price', -1], ['price', '4.3'], ['yearlyNetBuying', Infinity],
    ['yearlyBuybacks', -1], ['yearlyBuyingGrowth', -1.01], ['cut', 2],
    ['activationMonth', null], ['activationMonth', 1.5]
  ]) {
    assert.throws(() => projectModel({ ...base, [field]: value }), RangeError, field);
  }
  assert.throws(() => capAtMonth(Infinity), RangeError);
  assert.throws(() => capAtMonth(1, 2), RangeError);
  assert.throws(() => simulateMonths(base, -1), RangeError);
  assert.throws(() => simulateMonths(base, 0.5), RangeError);
  assert.throws(() => simulateMonths({ ...base, startingSupply: 0, yearlyBurn: 12 }, 1), /Burn/);
  assert.throws(() => projectModel({ ...base, yearlyNetBuying: Number.MAX_VALUE, yearlyBuyingGrowth: 100 }), RangeError);
});
test('pure functions are repeatable, leave inputs unchanged and load as an import-free browser module', async () => {
  const input = Object.freeze({ ...base });
  assert.deepEqual(projectModel(input), projectModel(input));
  const source = await readFile(new URL('../scripts/model.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bimport\s*(?:\(|['"{*]|\w)|\b(?:process|require|Buffer)\b/);
  const browserModule = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  assert.deepEqual(browserModule.projectModel(input), projectModel(input));
});
