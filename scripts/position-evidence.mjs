import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROOT, hash } from './sources.mjs';
import { positionSection } from './position-section.mjs';

const paths = {
  position_results: 'position-results.json', signer_top10: 'signer-top10.json',
  wallet_controls: 'wallet-controls.json', position_inputs: 'position-inputs.json',
  staking: 'staking.json', protocol_share: 'protocol-share.json',
  supply: 'bigquery/supply.json', prices: 'prices.json', near_flows: 'near_flows.json',
  signers: 'bigquery/signers.json'
};
const close = (a, b) => {
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > Math.max(1, Math.abs(b)) * 1e-10) {
    throw new Error('Position evidence does not reconcile.');
  }
};

// Recompute from hashed public evidence, never from saved model outputs or private data.
export async function loadPositionEvidence(manifest, root = ROOT) {
  const data = {};
  for (const [name, file] of Object.entries(paths)) {
    const path = `data/public/${file}`, entry = manifest.files?.[name];
    if (entry?.path !== path) throw new Error(`Missing position source: ${name}.`);
    const body = await readFile(resolve(root, path), 'utf8');
    if (hash(body) !== entry.sha256) throw new Error(`Position source hash mismatch: ${name}.`);
    data[name] = JSON.parse(body);
  }
  const p = data.position_results, extra = data.position_inputs;
  const prices = new Map(data.prices.days.map(d => [d.date, d.close]));
  const weeks = data.supply.rows.map(w => {
    const days = Array.from({ length: 7 }, (_, i) =>
      prices.get(new Date(Date.parse(w.week_start) + i * 86400000).toISOString().slice(0, 10)));
    if (days.some(d => !(d > 0))) throw new Error('Missing position price.');
    return { week: w.week_start, openingSupply: Number(w.opening_supply_yocto) / 1e24,
      closingSupply: Number(w.closing_supply_yocto) / 1e24, issuedNear: Number(w.supply_rises_yocto) / 1e24,
      burnedNear: Number(w.supply_falls_yocto) / 1e24, meanClose: days.reduce((a, b) => a + b, 0) / 7 };
  }).sort((a, b) => a.week.localeCompare(b.week));
  const wallets = extra.wallets.map(w => {
    const control = data.wallet_controls.wallets.find(c => c.wallet === w.name);
    const balance = key => {
      if (control?.[key]?.status !== 'ok') throw new Error('Missing wallet balance.');
      return Number(control[key].value);
    };
    const result = p.check2.perWallet.find(c => c.wallet === w.name);
    close(w.weeks.reduce((s, r) => s + r.receivedNear, 0), result.receivedNear);
    close(w.weeks.reduce((s, r) => s + r.receivedNear * weeks.find(x => x.week === r.week).meanClose, 0), result.receivedUsd);
    return { ...w, currentBalanceNear: balance('nativeNear') + balance('wrapNear') };
  });
  const walletWeeks = p.check2.weeks.map((w, i) => {
    close(wallets.reduce((s, x) => s + x.weeks[i].receivedNear, 0), w.receivedNear);
    return { week: w.week, receivedNear: w.receivedNear,
      sentNear: wallets.reduce((s, x) => s + x.weeks[i].sentNear, 0) };
  });
  const signerCounts = new Map(data.signers.rows.filter(r => r.grain === 'day').map(r => [r.period_start, Number(r.signers)]));
  for (const row of extra.signerDays) close(Number(row.top10) + Number(row.everyone_else), signerCounts.get(row.period_start));
  const receiverRows = data.signer_top10.receivers.flatMap(r => [
    { grain: 'receiver_period', period_start: '2024-11-01', receiver_account_id: r.receiver, mean_daily_signers: r.earlierMeanDailySigners },
    { grain: 'receiver_period', period_start: '2025-11-01', receiver_account_id: r.receiver, mean_daily_signers: r.laterMeanDailySigners }
  ]);
  const protocol = data.protocol_share, [n, d] = protocol.protocol_reward_rate;
  if (!Number.isInteger(n) || !Number.isInteger(d) || d <= 0 || n < 0 || n > d
    || protocol.block_height !== data.staking.block_height) throw new Error('Invalid pinned protocol share.');
  const section = positionSection({
    weeks, latestClose: data.prices.days.at(-1).close, modelStartMonth: 2026 * 12 + 10,
    check1Final: { netBuyingUsd: p.check1.final.netUsd,
      weeks: p.check1.weeklyFinalNetUsd.map(w => ({ week: w.week, netBuyingUsd: w.netUsd })) },
    check2: { coverage: p.check2.coverage, weeks: walletWeeks, wallets,
      currentBalanceNear: wallets.reduce((s, w) => s + w.currentBalanceNear, 0) },
    check3Growth: p.check3.growth, stakingSnapshot: data.staking,
    treasuryShare: { value: n / d,
      source: `${protocol.source} ${protocol.method}, block ${protocol.block_height}, protocol ${protocol.protocol_version}, protocol_reward_rate=${n}/${d}` },
    signerSplitRows: [...extra.signerDays, ...receiverRows]
  });
  close(section.holderLedger.issued.near.value, p.issuance.issuedNear);
  close(section.holderLedger.issued.usd.value, p.issuance.issuanceValueUsd);
  close(section.usageDecline.everyoneElse.earlier.value, p.check3.prior.mean);
  close(section.usageDecline.everyoneElse.later.value, p.check3.latest.mean);
  for (const [i, comparison] of data.signer_top10.comparisons.entries()) {
    close(section.usageDecline.top10[i ? 'later' : 'earlier'].value, comparison.dayLevelTop10Mean);
  }
  const totalVolume = data.near_flows.weeks.reduce((s, w) => s + Number(w.total_usd), 0);
  const nearVolume = p.check1.provisional.buysUsd + p.check1.provisional.sellsUsd;
  return { section, results: p, top10: data.signer_top10, audit: extra.audit, oneClick: {
    totalUsd: totalVolume, nearUsd: nearVolume, nearShare: nearVolume / totalVolume
  } };
}

// Stable decimal formatting for tagged prose. Percentages are explicit extra keys.
export function positionMetricValues({ section, results: p, oneClick, audit }) {
  const values = {}, fmt = n => n == null ? 'Unavailable'
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
  function walk(value, key) {
    if (value && typeof value === 'object' && Object.hasOwn(value, 'value')) {
      values[key] = value.unit.includes('share') || value.unit.includes('fraction') || value.unit === 'ratio'
        || value.unit.includes('yield') ? `${fmt(value.value == null ? null : value.value * 100)}%` : fmt(value.value);
    } else if (typeof value === 'number') values[key] = fmt(value);
    else if (typeof value === 'string' && ['position.call.result', 'position.descriptive.leadOrFollow.result'].includes(key)) values[key] = value;
    else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) if (!['inputs', 'inputSources', 'sources', 'notes', 'weeks', 'weeklyFinalNetUsd'].includes(k)) walk(v, `${key}.${k}`);
    }
  }
  walk({ holderLedger: section.holderLedger, whatYouMustBelieve: section.whatYouMustBelieve,
    priceAssumes: section.priceAssumes, scenarios: section.scenarios, usageDecline: section.usageDecline }, 'position');
  walk({ call: p.call, check1: p.check1, check2: p.check2, check3: p.check3, descriptive: p.descriptive }, 'position');
  const percent = (key, n, digits = 2) => {
    values[key] = `${new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(n * 100)}%`;
  };
  percent('position.top3Share', 1 - p.descriptive.concentration.withoutTopNetBuyers['3'].netUsd / p.check1.final.netUsd, 1);
  percent('position.check1.coverage', p.check1.final.shareOfIssuanceValue);
  percent('position.check1.latestPriceCoverage', p.check1.final.netUsd / (p.issuance.issuedNear * section.inputs.latestClose));
  percent('position.check2.coveragePercent', p.check2.coverage);
  percent('position.check3.growthPercent', p.check3.growth);
  percent('position.sender.rowsPercent', p.check1.senderCoverage.share);
  percent('position.sender.usdPercent', p.check1.senderCoverage.usdShare);
  walk(oneClick, 'position.oneClick');
  walk(audit, 'position.audit');
  percent('position.oneClick.nearPercent', oneClick.nearShare);
  values['position.oneClick.nearMillions'] = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(oneClick.nearUsd / 1e6);
  values['position.latestClose'] = String(section.inputs.latestClose);
  values['position.oneClick.totalBillions'] = fmt(oneClick.totalUsd / 1e9);
  for (const [name, scenario] of Object.entries(section.scenarios)) {
    walk(scenario.inputs, `position.scenarios.${name}.inputs`);
  }
  for (const [name, result] of Object.entries(p.descriptive)) {
    if (result?.shareOfIssuanceValue != null) percent(`position.descriptive.${name}.coverage`, result.shareOfIssuanceValue);
  }
  for (const [cut, group] of Object.entries(p.descriptive.concentration)) {
    if (cut.startsWith('withoutTop')) for (const [n, row] of Object.entries(group)) {
      percent(`position.concentration.${cut}.${n}.coverage`, row.share);
    }
  }
  return values;
}
