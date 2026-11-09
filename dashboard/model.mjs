// Calendar months are integers: year * 12 + month - 1. Rates are decimal fractions.
export const DEFAULT_ACTIVATION_MONTH = 2027 * 12 + 2;
export const ACTIVATION_ASSUMPTION = '2027-03-01 is an assumption, not a confirmed activation: '
  + 'the veto window runs to November 16, 2026; activation is one full quarter after '
  + 'ratification and still requires validator adoption.';

function finite(name, value, min = -Infinity, max = Infinity) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`Invalid ${name}.`);
  }
}
function monthNumber(name, value) {
  finite(name, value, 0, 9999 * 12 + 11);
  if (!Number.isInteger(value)) throw new RangeError(`Invalid ${name}.`);
}
function cutFlag(cut) {
  if (cut !== 0 && cut !== 1) throw new RangeError('Invalid cut; use 0 or 1.');
}

// HSP-029: https://gov.near.org/t/42644. Negative elapsed months are pre-activation.
export function capAtMonth(elapsedMonths, cut = 1) {
  finite('elapsedMonths', elapsedMonths);
  cutFlag(cut);
  return 0.025 - (cut ? 0.009 * Math.min(Math.max(elapsedMonths, 0), 24) / 24 : 0);
}

export function simulateMonths(input, months) {
  const {
    startingSupply, startMonth, realizedShare, yearlyBurn, price,
    yearlyNetBuying, yearlyBuybacks, yearlyBuyingGrowth, cut,
    activationMonth = DEFAULT_ACTIVATION_MONTH
  } = input;
  finite('startingSupply', startingSupply, 0);
  monthNumber('startMonth', startMonth);
  monthNumber('activationMonth', activationMonth);
  finite('realizedShare', realizedShare, 0, 1);
  finite('yearlyBurn', yearlyBurn, 0);
  finite('price', price, Number.MIN_VALUE);
  finite('yearlyNetBuying', yearlyNetBuying);
  finite('yearlyBuybacks', yearlyBuybacks, 0);
  finite('yearlyBuyingGrowth', yearlyBuyingGrowth, -1);
  cutFlag(cut);
  monthNumber('months', months);
  monthNumber('endMonth', startMonth + months);
  const rows = [];
  let supply = startingSupply;
  for (let i = 0; i < months; i++) {
    const month = startMonth + i, year = Math.floor(month / 12);
    const cap = capAtMonth(month + 0.5 - activationMonth, cut);
    const newNear = supply * cap * realizedShare / 12, burnedNear = yearlyBurn / 12;
    // Buying grows each January, relative to the starting calendar year's annual input.
    // Buybacks are constant and additive; neither buying nor buybacks destroys supply.
    const netBuyingUsd = yearlyNetBuying * (1 + yearlyBuyingGrowth) ** (year - Math.floor(startMonth / 12)) / 12;
    const buybacksUsd = yearlyBuybacks / 12, buyingUsd = netBuyingUsd + buybacksUsd;
    const absorbedNear = buyingUsd / price, endSupply = supply + newNear - burnedNear;
    for (const value of [newNear, buyingUsd, absorbedNear, endSupply]) finite('model result', value);
    if (endSupply < 0) throw new RangeError('Burn exceeds available supply.');
    rows.push({ month, year, cap, startSupply: supply, newNear, burnedNear,
      netBuyingUsd, buybacksUsd, absorbedNear, endSupply });
    supply = endSupply;
  }
  return rows;
}

// Coverage is a ratio (1 = 100%). A null means no defined ratio or no positive
// break-even price: there is no remaining issuance, or buying is not positive.
// A start after January produces partial years; months before the start are not modeled.
export function projectModel(input) {
  const activationMonth = input.activationMonth ?? DEFAULT_ACTIVATION_MONTH;
  const rows = simulateMonths(input, Math.max(0, 2032 * 12 - input.startMonth));
  const years = Array.from({ length: 5 }, (_, i) => ({
    year: 2027 + i, months: 0, newNear: 0, burnedNear: 0, absorbedNear: 0, buyingUsd: 0
  }));
  for (const row of rows) {
    if (row.year < 2027) continue;
    const year = years[row.year - 2027];
    year.months++;
    year.newNear += row.newNear;
    year.burnedNear += row.burnedNear;
    year.absorbedNear += row.absorbedNear;
    year.buyingUsd += row.netBuyingUsd + row.buybacksUsd;
  }
  return {
    activationMonth,
    activationAssumption: activationMonth === DEFAULT_ACTIVATION_MONTH ? ACTIVATION_ASSUMPTION
      : 'User-supplied activation assumption; validator adoption is still required.',
    years: years.map(({ buyingUsd, ...year }) => {
      const remaining = year.newNear - year.burnedNear;
      const coverage = year.newNear > 0 ? (year.absorbedNear + year.burnedNear) / year.newNear : null;
      const netFloatChange = remaining - year.absorbedNear;
      const breakEvenPrice = remaining > 0 && buyingUsd > 0 ? buyingUsd / remaining : null;
      for (const value of [coverage, netFloatChange, breakEvenPrice]) {
        if (value !== null) finite('model result', value);
      }
      return { ...year, coverage, netFloatChange, breakEvenPrice };
    })
  };
}
