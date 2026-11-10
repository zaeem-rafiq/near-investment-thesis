import { projectModel, DEFAULT_ACTIVATION_MONTH } from './model.mjs';

// Pure, normalized inputs. No I/O or live check execution.
// weeks: 52 T3 rows {week, openingSupply, closingSupply, issuedNear, burnedNear, meanClose}.
// check1Final: {netBuyingUsd, weeks?: [{week, netBuyingUsd}]} after locked exclusions.
// check2: {coverage?, weeks?: [{week, receivedNear, sentNear}], currentBalanceNear?}.
// Optional check2.wallets: three {name, weeks, currentBalanceNear?} entries.
// Wallet weeks are the 36 locked weeks, aggregated across all three wallets:
// external successful NEAR/wNEAR only; exclude internal transfers and not_received.
// stakingSnapshot is the scripts/staking.mjs aggregate snapshot, not validator rows.
// treasuryShare: {value, source}, read by the caller from its actual source, never guessed.
// check3Growth is supplied separately; signerSplitRows uses sql/signer_split.sql grains.
const RULE_INPUTS = {
  source: 'docs/position-rule.md and docs/position-rule-addendum-2.md; owner calculation instructions',
  annualWeeks: 52, walletWeeks: 36, rollingWeeks: 13, baselineCap: 0.025,
  passThreshold: 0.2, brokenThreshold: 0.1, brokenConsecutiveReruns: 2,
  reviewDates: ['2027-02-01', '2027-05-03', '2027-08-02', '2027-11-01'],
  vetoReviewDate: '2026-11-16', firstWindowEndExclusive: '2026-11-02',
  captureYieldTargets: [0.016, 0.025, 0.05], captureTargetLabel: 'inputs, not findings',
  horizonEndExclusive: '2032-01-01', scenarioGrowth: 0,
  defaultActivationMonth: DEFAULT_ACTIVATION_MONTH,
  halfLatestFactor: 0.5, scenarioRules: { bear: 0, base: 1, bull: 1 },
  noOutsideReceiptThreshold: 0, projectionYear: 2031,
  frozenReceiverCount: 10, usageYearDays: 365,
  usagePeriodStarts: ['2024-11-01', '2025-11-01'],
  modelFormulaSource: 'scripts/model.mjs, HSP-029 monthly midpoint schedule',
  captureMarketCapAssumption: 'hold current market cap constant; targets are not forecasts',
  receiptAnnualization: '52/36, descriptive only; does not change Check 2',
  floatDefinition: 'issued - burned - received + sent; 52-week supply changes and 36-week observed wallet flows',
  captureGrowthAssumption: 'constant current market cap; years from model start to end of 2031',
  scenarioReceiptValuation: 'annualized received NEAR × latest close; independent rolling extrema',
  boughtTokenDisposition: 'aggregate transfers and balances cannot identify whether purchased tokens were held or burned'
};
const addDays = (date, n) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
const absent = value => value == null;
function number(value, name, min = -Infinity, max = Infinity) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`Invalid ${name}.`);
  }
  return value;
}
function metric(value, unit, inputs, reason = null) {
  if (value !== null) number(value, 'calculation result');
  return { value, unit, inputs, reason: value === null ? reason || 'pending' : null };
}
const pending = inputs => ({ value: null, reason: 'pending', inputs });
const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
function fraction(numerator, denominator, unit, inputs) {
  return metric(denominator > 0 ? numerator / denominator : null, unit, inputs, 'nonpositive denominator');
}
function amounts(near, usd, opening, inputs, reason = null) {
  return {
    near: metric(near, 'NEAR', inputs, reason),
    usd: metric(usd, 'USD at each week mean close', inputs, reason),
    shareOfOpeningSupply: metric(near === null ? null : near / opening, 'share', [...inputs, 'weeks[0].openingSupply'], reason)
  };
}
function validateWeeks(rows, expected, fields, path) {
  if (!Array.isArray(rows) || rows.length !== expected.length) throw new Error(`Incomplete ${path}.`);
  rows.forEach((row, i) => {
    if (row.week !== expected[i]) throw new Error(`Invalid or unordered ${path} dates.`);
    for (const field of fields) number(row[field], `${path}[${i}].${field}`,
      field === 'netBuyingUsd' ? -Infinity : field.includes('Supply') || field === 'meanClose' ? Number.MIN_VALUE : 0);
  });
}
function context(input) {
  const expected = Array.from({ length: 52 }, (_, i) => addDays('2025-11-03', 7 * i));
  validateWeeks(input.weeks, expected,
    ['openingSupply', 'closingSupply', 'issuedNear', 'burnedNear', 'meanClose'], 'weeks');
  number(input.latestClose, 'latestClose', Number.MIN_VALUE);
  number(input.modelStartMonth, 'modelStartMonth', 0, 2031 * 12);
  if (!Number.isInteger(input.modelStartMonth)) throw new Error('Invalid modelStartMonth.');
  if (!absent(input.check1Final?.netBuyingUsd)) number(input.check1Final.netBuyingUsd, 'check1Final.netBuyingUsd');
  if (!absent(input.check1Final?.weeks)) {
    validateWeeks(input.check1Final.weeks, expected, ['netBuyingUsd'], 'check1Final.weeks');
    if (!absent(input.check1Final.netBuyingUsd) && Math.abs(sum(input.check1Final.weeks, 'netBuyingUsd')
      - input.check1Final.netBuyingUsd) > Math.max(1, Math.abs(input.check1Final.netBuyingUsd)) * 1e-10) {
      throw new Error('Check 1 weekly values do not match its total.');
    }
  }
  const wallet = input.check2?.weeks ?? null;
  if (wallet) validateWeeks(wallet, expected.slice(16), ['receivedNear', 'sentNear'], 'check2.weeks');
  if (!absent(input.check2?.wallets)) {
    const entries = input.check2.wallets;
    if (!Array.isArray(entries) || entries.length !== 3 || new Set(entries.map(w => w.name)).size !== 3) {
      throw new Error('Expected three distinct named revenue wallets.');
    }
    entries.forEach((entry, i) => {
      if (typeof entry.name !== 'string' || !entry.name.trim()) throw new Error('Invalid wallet name.');
      if (!absent(entry.weeks)) validateWeeks(entry.weeks, expected.slice(16),
        ['receivedNear', 'sentNear'], `check2.wallets[${i}].weeks`);
      if (!absent(entry.currentBalanceNear)) number(entry.currentBalanceNear, 'wallet balance', 0);
    });
    if (wallet && entries.every(w => !absent(w.weeks))) wallet.forEach((row, i) => {
      for (const field of ['receivedNear', 'sentNear']) {
        if (Math.abs(entries.reduce((s, w) => s + w.weeks[i][field], 0) - row[field]) > Math.max(1, row[field]) * 1e-10) {
          throw new Error('Per-wallet flows do not match aggregate flows.');
        }
      }
    });
    if (entries.every(w => !absent(w.currentBalanceNear)) && !absent(input.check2.currentBalanceNear)
      && Math.abs(sum(entries, 'currentBalanceNear') - input.check2.currentBalanceNear)
        > Math.max(1, input.check2.currentBalanceNear) * 1e-10) throw new Error('Wallet balances do not match their total.');
  }
  if (!absent(input.check2?.coverage)) number(input.check2.coverage, 'check2.coverage', 0);
  if (!absent(input.check2?.currentBalanceNear)) number(input.check2.currentBalanceNear, 'check2.currentBalanceNear', 0);
  if (!absent(input.check3Growth)) number(input.check3Growth, 'check3Growth', -1);
  const weeks = input.weeks, opening = weeks[0].openingSupply, closing = weeks.at(-1).closingSupply;
  const issued = sum(weeks, 'issuedNear'), burned = sum(weeks, 'burnedNear');
  const issuedUsd = weeks.reduce((s, w) => s + w.issuedNear * w.meanClose, 0);
  const burnedUsd = weeks.reduce((s, w) => s + w.burnedNear * w.meanClose, 0);
  const prices = new Map(weeks.map(w => [w.week, w.meanClose]));
  const received = wallet ? sum(wallet, 'receivedNear') : null;
  const sent = wallet ? sum(wallet, 'sentNear') : null;
  const receivedUsd = wallet ? wallet.reduce((s, w) => s + w.receivedNear * prices.get(w.week), 0) : null;
  const sentUsd = wallet ? wallet.reduce((s, w) => s + w.sentNear * prices.get(w.week), 0) : null;
  return { input, weeks, wallet, opening, closing, issued, burned, issuedUsd, burnedUsd, received, sent, receivedUsd, sentUsd };
}
function perWalletLedger(c) {
  if (absent(c.input.check2?.wallets)) return pending(['check2.wallets']);
  const prices = new Map(c.weeks.map(w => [w.week, w.meanClose]));
  return c.input.check2.wallets.map((wallet, i) => {
    const refs = [`check2.wallets[${i}].weeks`, 'weeks[].meanClose'];
    const received = absent(wallet.weeks) ? null : sum(wallet.weeks, 'receivedNear');
    const sent = absent(wallet.weeks) ? null : sum(wallet.weeks, 'sentNear');
    const receivedUsd = absent(wallet.weeks) ? null : wallet.weeks.reduce((s, w) => s + w.receivedNear * prices.get(w.week), 0);
    const sentUsd = absent(wallet.weeks) ? null : wallet.weeks.reduce((s, w) => s + w.sentNear * prices.get(w.week), 0);
    const balance = wallet.currentBalanceNear ?? null;
    return {
      name: wallet.name,
      received: amounts(received, receivedUsd, c.opening, refs),
      sent: amounts(sent, sentUsd, c.opening, refs),
      netRetained: amounts(absent(wallet.weeks) ? null : received - sent,
        absent(wallet.weeks) ? null : receivedUsd - sentUsd, c.opening, refs),
      currentBalance: {
        near: metric(balance, 'NEAR + wNEAR equivalent at balance snapshot', [`check2.wallets[${i}].currentBalanceNear`]),
        usd: metric(balance === null ? null : balance * c.input.latestClose, 'USD at latest close',
          [`check2.wallets[${i}].currentBalanceNear`, 'latestClose']),
        shareOfOpeningSupply: metric(balance === null ? null : balance / c.opening, 'share',
          [`check2.wallets[${i}].currentBalanceNear`, 'weeks[0].openingSupply'])
      },
      boughtNearBurned: metric(null, 'NEAR', refs, absent(wallet.weeks) ? 'pending' : 'not identifiable from aggregate flows and balances')
    };
  });
}
function holderLedger(c) {
  const { input, opening, closing, wallet } = c, refs = ['check2.weeks', 'weeks[].meanClose'];
  const balance = input.check2?.currentBalanceNear ?? null;
  let stake = null;
  if (!absent(input.stakingSnapshot)) {
    const raw = input.stakingSnapshot.total_stake_yocto;
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) throw new Error('Invalid stakingSnapshot.total_stake_yocto.');
    stake = number(Number(raw) / 1e24, 'total stake', Number.MIN_VALUE);
  }
  const treasury = input.treasuryShare?.value ?? null;
  if (treasury !== null) {
    number(treasury, 'treasuryShare.value', 0, 1);
    if (typeof input.treasuryShare.source !== 'string' || !input.treasuryShare.source.trim()) {
      throw new Error('Treasury share requires its source.');
    }
  }
  return {
    window: { start: c.weeks[0].week, endExclusive: addDays(c.weeks.at(-1).week, 7) },
    issued: amounts(c.issued, c.issuedUsd, opening, ['weeks[].issuedNear', 'weeks[].meanClose']),
    burned: amounts(c.burned, c.burnedUsd, opening, ['weeks[].burnedNear', 'weeks[].meanClose']),
    walletReceived: {
      window: { start: '2026-02-23', endExclusive: '2026-11-02' },
      observed: amounts(c.received, c.receivedUsd, opening, refs),
      annualized: amounts(wallet ? c.received * 52 / 36 : null, wallet ? c.receivedUsd * 52 / 36 : null,
        opening, [...refs, 'assumptions.annualWeeks', 'assumptions.walletWeeks']),
      annualizationLabel: RULE_INPUTS.receiptAnnualization
    },
    netFloatChange: { ...amounts(wallet ? c.issued - c.burned - c.received + c.sent : null,
      wallet ? c.issuedUsd - c.burnedUsd - c.receivedUsd + c.sentUsd : null, opening,
      ['weeks', 'check2.weeks', 'assumptions.floatDefinition']), basis: RULE_INPUTS.floatDefinition },
    nonStakerLossOfShare: metric(1 - opening / closing, '52-week fractional loss of ownership share',
      ['weeks[0].openingSupply', 'weeks[51].closingSupply']),
    staking: {
      totalStakeNear: metric(stake, 'NEAR', ['stakingSnapshot.total_stake_yocto']),
      treasuryShare: { ...metric(treasury, 'share', ['treasuryShare.value']), source: input.treasuryShare?.source ?? null },
      grossYield: metric(stake !== null && treasury !== null ? c.issued * (1 - treasury) / stake : null,
        'trailing 52-week gross yield at snapshot stake; before validator commission',
        ['weeks[].issuedNear', 'stakingSnapshot.total_stake_yocto', 'treasuryShare.value', 'treasuryShare.source'])
    },
    wallets: {
      perWallet: perWalletLedger(c),
      received: amounts(c.received, c.receivedUsd, opening, refs),
      sent: amounts(c.sent, c.sentUsd, opening, refs),
      netRetained: amounts(wallet ? c.received - c.sent : null, wallet ? c.receivedUsd - c.sentUsd : null, opening, refs),
      currentBalance: {
        near: metric(balance, 'NEAR + wNEAR equivalent at balance snapshot', ['check2.currentBalanceNear']),
        usd: metric(balance === null ? null : balance * input.latestClose, 'USD at latest close', ['check2.currentBalanceNear', 'latestClose']),
        shareOfOpeningSupply: metric(balance === null ? null : balance / opening, 'share', ['check2.currentBalanceNear', 'weeks[0].openingSupply'])
      },
      boughtNearBurned: metric(null, 'NEAR', ['check2.weeks', 'check2.currentBalanceNear'],
        wallet ? 'not identifiable from aggregate flows and balances' : 'pending'),
      disposition: RULE_INPUTS.boughtTokenDisposition
    }
  };
}
export function reviewCalendar(c) {
  const today1 = absent(c.input.check1Final?.netBuyingUsd) ? metric(null, 'ratio', ['check1Final.netBuyingUsd'])
    : fraction(c.input.check1Final.netBuyingUsd, c.issuedUsd, 'ratio', ['check1Final.netBuyingUsd', 'weeks[].issuedNear', 'weeks[].meanClose']);
  const checks = [
    { name: 'Check 1 final', metric: 'net buying / issuance value', today: today1 },
    { name: 'Check 2', metric: '(burn + outside wallet receipts) / issuance',
      today: metric(c.input.check2?.coverage ?? null, 'ratio', ['check2.coverage']) },
    { name: 'Check 3', metric: 'growth in mean daily everyone_else signers',
      today: metric(c.input.check3Growth ?? null, 'fractional growth', ['check3Growth']) }
  ].map(check => ({ ...check, threshold: metric(0.2, 'at least', ['assumptions.passThreshold']),
    todayLabel: 'supplied original-window value, not a future re-run result' }));
  return [
    { date: RULE_INPUTS.vetoReviewDate, action: 'record HSP-029 veto status; no checks run', window: null, checks: [],
      inputs: ['assumptions.vetoReviewDate'] },
    ...RULE_INPUTS.reviewDates.map(date => {
      const start = addDays(date, -364);
      return {
        date, window: { start, endExclusive: date }, checks: structuredClone(checks),
        check2Window: { start: start < '2026-02-23' ? '2026-02-23' : start, endExclusive: date },
        usageComparison: { earlier: { start: addDays(start, -364), endExclusive: start }, later: { start, endExclusive: date } },
        ownEligible: start >= RULE_INPUTS.firstWindowEndExclusive,
        broken: {
          bothBelow: metric(0.1, 'Check 1 final and Check 2, strictly below', ['assumptions.brokenThreshold']),
          consecutiveReruns: metric(2, 're-runs', ['assumptions.brokenConsecutiveReruns']),
          lastReceiptWeeks: metric(13, 'weeks with no outside wallet receipts', ['assumptions.rollingWeeks']),
          noOutsideReceipts: metric(0, 'NEAR or wNEAR received from outside', ['assumptions.noOutsideReceiptThreshold']),
          persistsUntil: 'new rule written and time-stamped'
        },
        missingData: 'not measurable; counts as not passing',
        inputs: ['assumptions.reviewDates', 'assumptions.annualWeeks', 'assumptions.firstWindowEndExclusive']
      };
    })
  ];
}

function modelInputs(c, cut, price, buying, buybacks) {
  const meanSupply = c.weeks.reduce((s, w) => s + (w.openingSupply + w.closingSupply) / 2, 0) / 52;
  return {
    startingSupply: c.closing, startMonth: c.input.modelStartMonth,
    realizedShare: c.issued / (RULE_INPUTS.baselineCap * meanSupply), yearlyBurn: c.burned,
    price, yearlyNetBuying: buying, yearlyBuybacks: buybacks, yearlyBuyingGrowth: 0, cut,
    activationMonth: c.input.activationMonth ?? DEFAULT_ACTIVATION_MONTH
  };
}
function whatYouMustBelieve(c) {
  const prices = {
    issuanceWeightedMean: fraction(c.issuedUsd, c.issued, 'USD/NEAR', ['weeks[].issuedNear', 'weeks[].meanClose']),
    latest: metric(c.input.latestClose, 'USD/NEAR', ['latestClose']),
    halfLatest: metric(c.input.latestClose * RULE_INPUTS.halfLatestFactor, 'USD/NEAR', ['latestClose', 'assumptions.halfLatestFactor'])
  };
  const measured = c.input.check1Final?.netBuyingUsd ?? null;
  return {
    prices,
    interpretation: 'negative required buying means net selling balances burn exceeding issuance; wallet buybacks are included in total buying needed',
    rules: [0, 1].map(cut => ({
      cut, label: cut ? 'HSP-029' : '2.5% cap',
      prices: Object.entries(prices).map(([name, price]) => {
        // Demand does not affect supply. Zero demand isolates issuance here only;
        // it is never substituted for measured buying in returned values.
        const projection = price.value === null ? null
          : projectModel(modelInputs(c, cut, price.value, 0, 0)).years.at(-1);
        const required = projection ? (projection.newNear - projection.burnedNear) * price.value : null;
        const refs = ['weeks', 'modelStartMonth', 'assumptions.modelFormulaSource',
          absent(c.input.activationMonth) ? 'assumptions.defaultActivationMonth' : 'activationMonth', ...price.inputs];
        return {
          name, year: RULE_INPUTS.projectionYear, price,
          buyingNeededUsd: metric(required, 'USD/year in calendar 2031', refs, price.reason),
          multipleOfMeasuredBuying: measured === null
            ? metric(null, 'multiple', [...refs, 'check1Final.netBuyingUsd'])
            : required === null ? metric(null, 'multiple', refs, price.reason)
              : fraction(required, measured, 'multiple', [...refs, 'check1Final.netBuyingUsd']),
          inputs: { supplyAndBurn: 'weeks', startMonth: 'modelStartMonth', rule: cut ? 'HSP-029' : '2.5% cap' }
        };
      })
    }))
  };
}
function priceAssumes(c) {
  const refs = ['weeks[].burnedNear', 'weeks[].meanClose', 'check2.weeks',
    'assumptions.annualWeeks', 'assumptions.walletWeeks'];
  const marketCap = c.closing * c.input.latestClose;
  const capture = c.wallet ? c.burnedUsd + c.receivedUsd * 52 / 36 : null;
  const years = (2032 * 12 - c.input.modelStartMonth) / 12;
  return {
    marketCap: metric(marketCap, 'USD', ['weeks[51].closingSupply', 'latestClose']),
    yearlyHolderCapture: metric(capture, 'USD/year; burn plus annualized gross outside receipts, not proof of retention', refs),
    multiple: capture === null ? metric(null, 'multiple', refs)
      : fraction(marketCap, capture, 'multiple', [...refs, 'weeks[51].closingSupply', 'latestClose']),
    yield: capture === null ? metric(null, 'share/year', refs)
      : fraction(capture, marketCap, 'share/year', [...refs, 'weeks[51].closingSupply', 'latestClose']),
    marketCapAssumption: RULE_INPUTS.captureMarketCapAssumption,
    targets: RULE_INPUTS.captureYieldTargets.map(target => ({
      label: RULE_INPUTS.captureTargetLabel,
      targetYield: metric(target, 'share/year input', ['assumptions.captureYieldTargets']),
      yearsTo2031: metric(years, 'years', ['modelStartMonth', 'assumptions.horizonEndExclusive']),
      requiredCapture: metric(marketCap * target, 'USD/year', ['weeks[51].closingSupply', 'latestClose', 'assumptions.captureYieldTargets']),
      compoundYearlyGrowth: metric(capture === null || capture <= 0 ? null
        : (marketCap * target / capture) ** (1 / years) - 1, 'fraction/year',
      [...refs, 'weeks[51].closingSupply', 'latestClose', 'modelStartMonth', 'assumptions.captureYieldTargets'],
      capture === null ? 'pending' : 'no positive starting capture')
    }))
  };
}
function rolling(rows, field, highest) {
  let chosen = null;
  for (let i = 0; i <= rows.length - 13; i++) {
    const window = rows.slice(i, i + 13), total = sum(window, field);
    if (!chosen || (highest ? total > chosen.total : total < chosen.total)) {
      chosen = { total, start: window[0].week, endExclusive: addDays(window.at(-1).week, 7),
        inputs: [field === 'netBuyingUsd' ? 'check1Final.weeks[].netBuyingUsd' : 'check2.weeks[].receivedNear',
          'assumptions.rollingWeeks'] };
    }
  }
  return chosen;
}
function scenarios(c) {
  const refs = ['check1Final', 'check2.weeks'];
  const scenario = (name, cut, highest) => {
    if (!c.wallet || (name === 'base' ? absent(c.input.check1Final?.netBuyingUsd) : !c.input.check1Final?.weeks)) {
      return pending(refs);
    }
    const buyingWindow = name === 'base' ? null : rolling(c.input.check1Final.weeks, 'netBuyingUsd', highest);
    const receiptsWindow = name === 'base' ? null : rolling(c.wallet, 'receivedNear', highest);
    const buying = buyingWindow ? buyingWindow.total * 52 / 13 : c.input.check1Final.netBuyingUsd;
    const received = receiptsWindow ? receiptsWindow.total * 52 / 13 : c.received * 52 / 36;
    const inputs = modelInputs(c, cut, c.input.latestClose, buying, received * c.input.latestClose);
    const inputSources = {
      startingSupply: ['weeks[51].closingSupply'], startMonth: ['modelStartMonth'],
      realizedShare: ['weeks[].issuedNear', 'weeks[].openingSupply', 'weeks[].closingSupply', 'assumptions.baselineCap'],
      yearlyBurn: ['weeks[].burnedNear'], price: ['latestClose'],
      yearlyNetBuying: ['check1Final', 'assumptions.rollingWeeks', 'assumptions.annualWeeks'],
      yearlyBuybacks: ['check2.weeks', 'latestClose', 'assumptions.walletWeeks', 'assumptions.rollingWeeks', 'assumptions.annualWeeks'],
      yearlyBuyingGrowth: ['assumptions.scenarioGrowth'], cut: ['assumptions.scenarioRules'],
      activationMonth: [absent(c.input.activationMonth) ? 'assumptions.defaultActivationMonth' : 'activationMonth']
    };
    const modelRefs = [...new Set(Object.values(inputSources).flat())];
    return {
      inputs, inputSources, buyingWindow, receiptsWindow,
      receiptValuation: RULE_INPUTS.scenarioReceiptValuation,
      years: projectModel(inputs).years.map(row => ({
        year: row.year,
        coverage: metric(row.coverage, 'share', modelRefs, 'no issuance'),
        netFloatChange: metric(row.netFloatChange, 'NEAR/year', modelRefs),
        breakEvenPrice: metric(row.breakEvenPrice, 'USD/NEAR', modelRefs, 'no positive break-even price')
      }))
    };
  };
  return { bear: scenario('bear', 0, false), base: scenario('base', 1, false), bull: scenario('bull', 1, true) };
}

function usageDecline(rows) {
  if (absent(rows)) return pending(['signerSplitRows']);
  if (!Array.isArray(rows)) throw new Error('Invalid signerSplitRows.');
  const days = new Map(), receivers = new Map();
  const numeric = (raw, name) => {
    if (typeof raw === 'string' && !/^\d+(?:\.\d+)?$/.test(raw)) throw new Error(`Invalid ${name}.`);
    return number(typeof raw === 'string' ? Number(raw) : raw, name, 0);
  };
  for (const row of rows) {
    if (row.grain === 'day') {
      if (days.has(row.period_start)) throw new Error('Duplicate signer split day.');
      days.set(row.period_start, {
        top10: numeric(row.top10, 'top10'), everyoneElse: numeric(row.everyone_else, 'everyone_else')
      });
      if (!Number.isSafeInteger(days.get(row.period_start).top10)
        || !Number.isSafeInteger(days.get(row.period_start).everyoneElse)) throw new Error('Invalid signer split daily counts.');
    } else if (row.grain === 'receiver_period') {
      if (typeof row.receiver_account_id !== 'string' || !row.receiver_account_id
        || !['2024-11-01', '2025-11-01'].includes(row.period_start)) throw new Error('Invalid receiver period.');
      const key = row.receiver_account_id, value = numeric(row.mean_daily_signers, 'mean_daily_signers');
      if (!receivers.has(key)) receivers.set(key, {});
      const pair = receivers.get(key);
      if (Object.hasOwn(pair, row.period_start)) throw new Error('Duplicate receiver period.');
      pair[row.period_start] = value;
    } else throw new Error('Unknown signer split grain.');
  }
  const cohort = [...receivers.entries()].filter(([, p]) => p['2024-11-01'] > 0)
    .sort(([a, x], [b, y]) => y['2024-11-01'] - x['2024-11-01'] || (a < b ? -1 : a > b ? 1 : 0)).slice(0, RULE_INPUTS.frozenReceiverCount);
  if (!cohort.length) throw new Error('Missing frozen receiver cohort.');
  const periods = RULE_INPUTS.usagePeriodStarts;
  const means = periods.map(start => {
    let top10 = 0, everyoneElse = 0;
    for (let i = 0; i < RULE_INPUTS.usageYearDays; i++) {
      const d = days.get(addDays(start, i));
      if (!d) throw new Error('Incomplete signer split days.');
      top10 += d.top10; everyoneElse += d.everyoneElse;
    }
    return { top10: top10 / RULE_INPUTS.usageYearDays, everyoneElse: everyoneElse / RULE_INPUTS.usageYearDays };
  });
  if (days.size !== 730) throw new Error('Unexpected signer split days.');
  const refs = ['signerSplitRows[grain=day].top10', 'signerSplitRows[grain=day].everyone_else', 'assumptions.usageYearDays'];
  const group = key => ({
    earlier: metric(means[0][key], 'mean daily signers', refs),
    later: metric(means[1][key], 'mean daily signers', refs)
  });
  const totalDrop = means[0].top10 + means[0].everyoneElse - means[1].top10 - means[1].everyoneElse;
  const top10Drop = means[0].top10 - means[1].top10;
  return {
    periods: { earlier: { start: periods[0], endExclusive: periods[1] }, later: { start: periods[1], endExclusive: '2026-11-01' } },
    receivers: cohort.map(([receiver, pair]) => {
      if (absent(pair[periods[1]])) throw new Error('Missing later mean for a frozen receiver.');
      const source = [`signerSplitRows[grain=receiver_period,receiver=${receiver}].mean_daily_signers`];
      return { receiver, earlierMean: metric(pair[periods[0]], 'mean daily signers', source),
        laterMean: metric(pair[periods[1]], 'mean daily signers', source) };
    }),
    top10: group('top10'), everyoneElse: group('everyoneElse'),
    totalDrop: metric(totalDrop, 'mean daily signers', refs),
    top10Drop: metric(top10Drop, 'mean daily signers', refs),
    shareOfDropExplained: metric(totalDrop > 0 ? top10Drop / totalDrop : null, 'share of total drop', refs, 'no total decline'),
    method: 'frozen by earlier receiver means, ties by receiver ID; drop attribution uses exclusive daily groups, not overlapping per-receiver sums'
  };
}

export function positionSection(input) {
  const c = context(input);
  return {
    inputs: { ...structuredClone(input), assumptions: structuredClone(RULE_INPUTS) },
    holderLedger: holderLedger(c),
    whatYouMustBelieve: whatYouMustBelieve(c),
    priceAssumes: priceAssumes(c),
    scenarios: scenarios(c),
    reviewCalendar: reviewCalendar(c),
    usageDecline: usageDecline(input.signerSplitRows)
  };
}
