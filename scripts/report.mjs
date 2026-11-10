import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROOT, hash, QUERIES, EXPLORER, PRICE_SOURCE, explorerParams, literalDateFilters } from './sources.mjs';
import { savedPages, readPage } from './swaps.mjs';
import { loadPositionEvidence, positionMetricValues } from './position-evidence.mjs';

export const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const fmt = (n, digits = 2) => n == null || !Number.isFinite(n) ? 'Unavailable' : new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(n);
const pct = (n, digits = 1) => n == null || !Number.isFinite(n) ? 'Unavailable' : `${n >= 0 ? '+' : ''}${fmt(n * 100, digits)}%`;
const share = (n, digits = 1) => n == null || !Number.isFinite(n) ? 'Unavailable' : `${fmt(n * 100, digits)}%`;
const DAY = 86400000;
export const addDays = (d, n) => new Date(Date.parse(d) + n * DAY).toISOString().slice(0, 10);
export function dayRange(start, end) { const out = []; for (let d = start; d < end; d = addDays(d, 1)) out.push(d); return out; }
export function weekStart(date) {
  const d = new Date(String(date).slice(0, 10)), dow = (d.getUTCDay() + 6) % 7;
  return addDays(d.toISOString().slice(0, 10), -dow);
}

// Fixed analysis calendar, chosen before results were inspected.
export const CAL = {
  t1: { previous: ['2024-11-01', '2025-11-01'], latest: ['2025-11-01', '2026-11-01'] },
  sampleDays: Array.from({ length: 104 }, (_, k) => addDays('2024-11-04', 7 * k)),
  coverage: ['2024-11-01', '2026-11-02'],
  t2: { firstWeek: '2025-03-03', lastWeek: '2026-10-26', minSwaps: 7000, minChanges: 52, lags: [1, 2, 4, 8], block: 4, resamples: 10000, seed: 20261108 },
  t3: { firstWeek: '2025-11-03', weeks: 52 },
  swapWindow: { start: '2025-03-01', end: '2026-11-02' },
  priceWindow: { start: '2025-03-01', end: '2026-11-02' }
};
export const weeksBetween = (first, last) => { const out = []; for (let w = first; w <= last; w = addDays(w, 7)) out.push(w); return out; };

function count(v) {
  if (!/^\d+$/.test(String(v)) || !Number.isSafeInteger(Number(v))) throw new Error('Invalid or unsafe count in source data.');
  return Number(v);
}
function float(v) {
  const n = Number(v);
  if (v == null || v === '' || !Number.isFinite(n)) throw new Error('Invalid floating-point value in source data.');
  return n;
}

// Fixed-point arithmetic preserves up to 18 decimal places, with no float summation.
export function usdUnits(value) {
  if (typeof value !== 'string' || !/^\d+(\.\d{1,18})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'));
}
export function usdString(units) {
  const text = units.toString().padStart(19, '0');
  return `${text.slice(0, -18)}.${text.slice(-18)}`.replace(/0+$/, '').replace(/\.$/, '');
}

// ---------- source validation ----------
export function parseSigners(rows) {
  const days = new Map(), months = new Map(), periods = new Map();
  for (const r of rows) {
    const key = r.period_start;
    if (r.grain === 'day') {
      if (days.has(key)) throw new Error('Duplicate signer day.');
      const out = { date: key, transactions: count(r.transactions), signers: count(r.signers) };
      if (out.signers > out.transactions) throw new Error('More signers than transactions.');
      days.set(key, out);
    } else if (r.grain === 'month') {
      if (months.has(key)) throw new Error('Duplicate signer month.');
      const out = { month: key, signers: count(r.signers), accounts2: count(r.accounts_2plus_days) };
      if (out.accounts2 > out.signers) throw new Error('Invalid monthly account count.');
      months.set(key, out);
    } else if (r.grain === 'period') {
      if (periods.has(key)) throw new Error('Duplicate signer period.');
      const out = { start: key, transactions: count(r.transactions), signers: count(r.signers), top10: count(r.top10_transactions) };
      if (out.top10 > out.transactions) throw new Error('Invalid top-10 transaction count.');
      periods.set(key, out);
    } else throw new Error('Unknown signer grain.');
  }
  for (const d of days.keys()) if (d < CAL.coverage[0] || d >= CAL.coverage[1]) throw new Error('Signer day outside window.');
  return { days, months, periods };
}
export function parseContracts(rows) {
  const valid = new Set(CAL.sampleDays), out = new Map();
  for (const r of rows) {
    if (!valid.has(r.block_date) || out.has(r.block_date)) throw new Error('Unexpected or duplicate contract sample day.');
    out.set(r.block_date, { date: r.block_date, receivers: count(r.receiver_accounts), actions: count(r.function_call_actions) });
  }
  return out;
}
export function parseCoverage(rows) {
  const out = new Map();
  for (const r of rows) {
    if (out.has(r.block_date) || r.block_date < CAL.coverage[0] || r.block_date >= CAL.coverage[1]) throw new Error('Unexpected coverage day.');
    const blocks = count(r.block_count), distinct = count(r.distinct_block_count);
    const midnight = Date.parse(r.block_date), first = Date.parse(r.first_block_utc), last = Date.parse(r.last_block_utc);
    const truncated = !Number.isFinite(first) || !Number.isFinite(last) || first > midnight + 600000 || last < midnight + DAY - 600000;
    out.set(r.block_date, { date: r.block_date, blocks, distinct, duplicates: blocks - distinct, truncated });
  }
  return out;
}
export function parseSupply(rows) {
  const out = new Map();
  for (const r of rows) {
    if (out.has(r.week_start)) throw new Error('Duplicate supply week.');
    out.set(r.week_start, { week: r.week_start, blocks: count(r.blocks), unlinked: count(r.unlinked_blocks), rising: count(r.rising_blocks),
      falls: float(r.supply_falls_yocto), rises: float(r.supply_rises_yocto), opening: float(r.opening_supply_yocto), closing: float(r.closing_supply_yocto) });
  }
  return out;
}
export function parseBurn(rows) {
  const out = new Map();
  for (const r of rows) {
    if (out.has(r.week_start)) throw new Error('Duplicate burn week.');
    out.set(r.week_start, { week: r.week_start, outcome: float(r.outcome_burn_yocto), conversion: float(r.conversion_burn_yocto),
      nulls: count(r.outcome_null_rows) + count(r.conversion_null_rows) });
  }
  return out;
}

// ---------- swaps ----------
const WALLET_KEYS = new Set(['depositAddress', 'depositMemo', 'depositAddressAndMemo', 'recipient', 'senders', 'refundTo',
  'intentHashes', 'nearTxHashes', 'originChainTxHashes', 'destinationChainTxHashes', 'signer_account_id', 'receipt_predecessor_account_id']);
// Public files must hold aggregates only; any wallet-level key anywhere in the tree is refused.
export function assertNoWalletFields(value, path = '$') {
  if (Array.isArray(value)) value.forEach((v, i) => assertNoWalletFields(v, `${path}[${i}]`));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (WALLET_KEYS.has(k)) throw new Error(`Wallet-level field ${k} at ${path}; refusing to publish.`);
      assertNoWalletFields(v, `${path}.${k}`);
    }
  }
}
export function newSwapAggregate(window) {
  return { window, days: new Map(), seen: new Set(), rows: 0 };
}
export function addSwapRows(agg, rows) {
  const start = Date.parse(agg.window.start), end = Date.parse(agg.window.end);
  for (const row of rows) {
    const ts = Date.parse(row.createdAt);
    if (!Number.isFinite(ts) || ts < start || ts >= end || row.status !== 'SUCCESS') throw new Error('Invalid raw swap.');
    const key = hash(JSON.stringify([row.depositAddress, row.depositMemo ?? null, row.createdAt])).slice(0, 24);
    if (agg.seen.has(key)) throw new Error('Invalid raw swap: duplicate address/memo/createdAt.');
    agg.seen.add(key);
    const date = new Date(ts).toISOString().slice(0, 10);
    const d = agg.days.get(date) || { date, swaps: 0, missingUsd: 0, units: 0n };
    d.swaps++; agg.rows++;
    const units = usdUnits(row.amountInUsd);
    if (units == null) d.missingUsd++; else d.units += units;
    agg.days.set(date, d);
  }
  return agg;
}
// Every UTC day of the pull window, zero-filled: the pull is exhaustive, so a day without swaps had none.
export function swapDays(agg) {
  return dayRange(agg.window.start, agg.window.end).map(date => {
    const d = agg.days.get(date) || { swaps: 0, missingUsd: 0, units: 0n };
    return { date, swaps: d.swaps, missing_usd: d.missingUsd, volume_usd_exact: d.missingUsd ? null : usdString(d.units) };
  });
}
export function parseSwapDays(pub) {
  if (pub.window?.start !== CAL.swapWindow.start || pub.window?.end !== CAL.swapWindow.end) throw new Error('Unexpected 1Click pull window.');
  const expected = dayRange(pub.window.start, pub.window.end);
  if (!Array.isArray(pub.days) || pub.days.length !== expected.length) throw new Error('1Click daily totals do not cover the pull window.');
  let rows = 0;
  const days = pub.days.map((d, i) => {
    if (d.date !== expected[i]) throw new Error('1Click daily totals are out of order or have gaps.');
    const swaps = count(d.swaps), missing = count(d.missing_usd);
    if (missing > swaps || (missing ? d.volume_usd_exact !== null : usdUnits(d.volume_usd_exact) == null)) throw new Error('Invalid 1Click daily volume.');
    rows += swaps;
    return { date: d.date, swaps, missingUsd: missing, volumeExact: d.volume_usd_exact };
  });
  if (rows !== pub.rows) throw new Error('1Click daily totals do not add up to the pulled rows.');
  return days;
}
export function weeklyFromDaily(days) {
  const weeks = new Map();
  for (const d of days) {
    const week = weekStart(d.date);
    const w = weeks.get(week) || { week, swaps: 0, missingUsd: 0, units: 0n, days: 0 };
    w.swaps += d.swaps; w.missingUsd += d.missingUsd; w.days++;
    if (d.volumeExact != null) w.units += usdUnits(d.volumeExact);
    weeks.set(week, w);
  }
  return new Map([...weeks.values()].filter(w => w.days === 7).map(w => [w.week, { week: w.week, swaps: w.swaps, missingUsd: w.missingUsd,
    volumeExact: w.missingUsd ? null : usdString(w.units), volume: w.missingUsd ? null : Number(usdString(w.units)) }]));
}
export async function loadSwapDir(dir, expected) {
  let done;
  try { done = JSON.parse(await readFile(resolve(dir, 'complete.json'), 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') throw new Error('Incomplete 1Click pull: no completion record.'); throw e; }
  if (done.complete !== true) throw new Error('Incomplete 1Click pull.');
  const pages = await savedPages(dir);
  if (pages.length !== done.pages) throw new Error('Saved 1Click pages do not match the completion record.');
  const agg = newSwapAggregate(done.window), hashes = [];
  for (const name of pages) {
    hashes.push(hash(await readFile(resolve(dir, 'pages', name))));
    addSwapRows(agg, (await readPage(dir, name)).rows);
  }
  if (agg.rows !== done.rows) throw new Error('Saved 1Click rows do not match the completion record.');
  const pagesSha256 = hash(hashes.join('\n'));
  if (expected && expected !== pagesSha256) throw new Error('Raw 1Click page hash mismatch.');
  return { days: swapDays(agg), window: done.window, params: done.params, pages: pages.length, rows: agg.rows, pagesSha256, completedAt: done.completedAt };
}
// ---------- statistics ----------
export function pearson(x, y) {
  const n = x.length;
  if (n < 3 || y.length !== n) return null;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += x[i]; my += y[i]; }
  mx /= n; my /= n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const a = x[i] - mx, b = y[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// Paired moving-block bootstrap of r(volume, usage) - r(price, usage); returns the 90% percentile interval.
export function bootstrapAdvantage(pairs, { block = 4, resamples = 10000, seed = 1 } = {}) {
  const n = pairs.length;
  if (n < block * 2) return null;
  const rand = mulberry32(seed), starts = n - block + 1, stats = [];
  for (let b = 0; b < resamples; b++) {
    const v = [], p = [], u = [];
    while (v.length < n) {
      const s = Math.floor(rand() * starts);
      for (let k = 0; k < block && v.length < n; k++) { const q = pairs[s + k]; v.push(q.dv); p.push(q.dp); u.push(q.du); }
    }
    const rv = pearson(v, u), rp = pearson(p, u);
    if (rv == null || rp == null) continue;
    stats.push(rv - rp);
  }
  if (stats.length < resamples * 0.95) return null;
  stats.sort((a, b) => a - b);
  const q = f => stats[Math.min(stats.length - 1, Math.max(0, Math.round(f * (stats.length - 1))))];
  return { low: q(0.05), high: q(0.95), draws: stats.length };
}

// ---------- T1 ----------
export function t1Test(signers, contracts, coverage) {
  const reasons = [];
  if (!signers || !contracts) return { verdict: "CAN'T TELL", reasons: ['Signer or contract source unavailable.'], measures: null };
  const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  const periodDays = ([s, e]) => dayRange(s, e);
  const measures = {};
  const dailySigners = range => { const ds = periodDays(range); const vals = ds.map(d => signers.days.get(d)?.signers); return vals.every(v => v != null) ? mean(vals) : null; };
  const monthly = range => { const ms = [...signers.months.values()].filter(m => m.month >= range[0] && m.month < range[1]); return ms.length === 12 ? mean(ms.map(m => m.accounts2)) : null; };
  const sample = range => { const ds = CAL.sampleDays.filter(d => d >= range[0] && d < range[1]); const vals = ds.map(d => contracts.get(d)?.receivers); return vals.length === 52 && vals.every(v => v != null) ? mean(vals) : null; };
  const top = start => { const p = signers.periods.get(start); return p && p.transactions ? p.top10 / p.transactions : null; };
  for (const [key, fn] of [['signers', dailySigners], ['receivers', sample], ['accounts2', monthly]]) {
    const previous = fn(CAL.t1.previous), latest = fn(CAL.t1.latest);
    measures[key] = { previous, latest, change: previous ? latest / previous - 1 : null };
  }
  const tp = top(CAL.t1.previous[0]), tl = top(CAL.t1.latest[0]);
  measures.top10 = { previous: tp, latest: tl, changePp: tp != null && tl != null ? (tl - tp) * 100 : null };
  if (coverage) {
    const missing = dayRange(...CAL.coverage).filter(d => !coverage.get(d) || coverage.get(d).truncated);
    if (missing.length) reasons.push(`${missing.length} days lack full block coverage.`);
  }
  const breadth = ['signers', 'receivers', 'accounts2'].map(k => measures[k].change);
  if (breadth.some(c => c == null) || measures.top10.changePp == null) reasons.push('A T1 measure could not be computed from complete periods.');
  let verdict = "CAN'T TELL";
  if (!reasons.length) {
    if (breadth.some(c => c <= -0.10) || measures.top10.changePp >= 5) verdict = 'FAIL';
    else if (breadth.every(c => c >= 0.20) && measures.top10.changePp <= -5) verdict = 'PASS';
  }
  return { verdict, reasons, measures };
}

// ---------- T2 ----------
export function t2Series(swaps, signers, prices) {
  const weeks = weeksBetween(CAL.t2.firstWeek, CAL.t2.lastWeek);
  const priceByDay = prices ? new Map(prices.days.map(d => [d.date, d.close])) : new Map();
  const rows = weeks.map(week => {
    const days = dayRange(week, addDays(week, 7));
    const s = swaps?.get(week) || (swaps ? { swaps: 0, volume: 0, volumeExact: '0', missingUsd: 0 } : null);
    const usageVals = days.map(d => signers?.days.get(d)?.signers);
    const priceVals = days.map(d => priceByDay.get(d));
    return { week, swaps: s?.swaps ?? null, missingUsd: s?.missingUsd ?? null, volume: s?.volume ?? null, volumeExact: s?.volumeExact ?? null,
      usage: usageVals.every(v => v != null) ? usageVals.reduce((a, b) => a + b, 0) / 7 : null,
      price: priceVals.every(v => v != null) ? priceVals.reduce((a, b) => a + b, 0) / 7 : null };
  });
  const startIndex = swaps ? rows.findIndex(r => r.swaps >= CAL.t2.minSwaps) : -1;
  return { rows: t2Changes(rows, startIndex), start: startIndex >= 0 ? rows[startIndex].week : null };
}
// Shared by the official series and the sensitivity check so both use identical weekly changes.
function t2Changes(rows, startIndex) {
  const change = (a, b) => a != null && b != null && a > 0 ? b / a - 1 : null;
  return rows.map((r, i) => {
    const prev = rows[i - 1], inTest = startIndex >= 0 && i > startIndex;
    return { ...r, excluded: startIndex < 0 || i < startIndex,
      dv: inTest ? change(prev.volume, r.volume) : null,
      dp: inTest ? change(prev.price, r.price) : null,
      du: inTest ? change(prev.usage, r.usage) : null };
  });
}
// Sensitivity check, added after the official T2 result was seen; it never feeds the official verdict.
// Design fixed before computing: start at 2025-08-04, otherwise the official method and t2Test unchanged.
export const T2_SENSITIVITY_START = '2025-08-04';
export function t2SensitivitySeries(series, start = T2_SENSITIVITY_START) {
  const i = series.rows.findIndex(r => r.week === start);
  const hasSwaps = i >= 0 && series.rows[i].swaps != null;
  return { rows: t2Changes(series.rows, hasSwaps ? i : -1), start: hasSwaps ? start : null };
}
export function t2Test(series, options = CAL.t2) {
  const { rows, start } = series;
  if (!start) return { verdict: "CAN'T TELL", reasons: ['No complete week reached 7,000 successful 1Click swaps, or 1Click data is unavailable.'], lags: [], changes: 0, start };
  const changes = rows.filter(r => r.dv != null && r.dp != null && r.du != null).length;
  const lags = options.lags.map(lag => {
    const pairs = [];
    for (let i = 0; i + lag < rows.length; i++) {
      const a = rows[i], b = rows[i + lag];
      if (a.dv != null && a.dp != null && b.du != null) pairs.push({ week: a.week, dv: a.dv, dp: a.dp, du: b.du });
    }
    const col = (ps, k) => ps.map(p => p[k]);
    const rv = pearson(col(pairs, 'dv'), col(pairs, 'du')), rp = pearson(col(pairs, 'dp'), col(pairs, 'du'));
    const half = Math.floor(pairs.length / 2), halves = [pairs.slice(0, half), pairs.slice(half)].map(ps => ({
      rv: pearson(col(ps, 'dv'), col(ps, 'du')), rp: pearson(col(ps, 'dp'), col(ps, 'du')) }));
    const ci = bootstrapAdvantage(pairs, { block: options.block, resamples: options.resamples, seed: options.seed + lag });
    const ok = rv != null && rp != null && ci && halves.every(h => h.rv != null && h.rp != null);
    const volumeWins = ok && rv >= 0.30 && rv - rp >= 0.15 && halves.every(h => h.rv > h.rp) && ci.low > 0;
    const priceWins = ok && rp - rv >= 0.15 && halves.every(h => h.rp > h.rv) && ci.high < 0;
    return { lag, pairs: pairs.length, rv, rp, advantage: ok ? rv - rp : null, halves, ci, volumeWins, priceWins };
  });
  const reasons = [];
  if (changes < options.minChanges) reasons.push(`Only ${changes} weekly changes from ${start}; at least ${options.minChanges} are required.`);
  let verdict = "CAN'T TELL";
  if (!reasons.length) {
    if (lags.filter(l => l.volumeWins).length >= 2) verdict = 'PASS';
    else if (lags.filter(l => l.priceWins).length >= 2) verdict = 'FAIL';
  }
  return { verdict, reasons, lags, changes, start };
}

// ---------- T3 ----------
export const YOCTO = 1e24;
// Through protocol 86 nearcore paid 30% of function-call gas to the called contract after copying the gross
// amount into the outcome's tokens_burnt, so supply falls may sit up to 30% below the burn fields.
// Protocol 87 (first mainnet block 223,012,337 at 2026-11-04T11:46:29Z) sets the reward to 0, so from then on
// falls and fields should agree within the original 5% check.
export const REWARD_SHARE = 0.30;
export const PROTOCOL_87 = { height: 223012337, at: '2026-11-04T11:46:29.014Z' };
export const gapBand = week => {
  const end = Date.parse(addDays(week, 7)), from = Date.parse(week), p87 = Date.parse(PROTOCOL_87.at);
  if (end <= p87) return { low: -REWARD_SHARE, high: 0.05, label: 'before protocol 87' };
  if (from >= p87) return { low: -0.05, high: 0.05, label: 'protocol 87 or later' };
  return null;
};
export function t3Test(supply, burn) {
  if (!supply || !burn) return { verdict: "CAN'T TELL", reasons: ['Supply or burn source unavailable.'], weeks: [] };
  const reasons = [];
  const weeks = weeksBetween(CAL.t3.firstWeek, addDays(CAL.t3.firstWeek, 7 * (CAL.t3.weeks - 1))).map(week => {
    const s = supply.get(week), b = burn.get(week);
    if (!s || !b) return { week, missing: true };
    const burnt = s.falls / YOCTO, issued = s.rises / YOCTO, fields = (b.outcome + b.conversion) / YOCTO;
    const delta = issued - burnt, gross = delta + burnt;
    return { week, burnt, issued, fields, delta, gross, offset: gross > 0 ? burnt / gross : null,
      fieldOffset: delta + fields > 0 ? fields / (delta + fields) : null, unlinked: s.unlinked, nulls: b.nulls,
      opening: s.opening == null ? null : s.opening / YOCTO, closing: s.closing == null ? null : s.closing / YOCTO,
      gap: fields > 0 ? (burnt - fields) / fields : null };
  });
  if (weeks.some(w => w.missing)) reasons.push('Missing supply or burn weeks.');
  const ok = weeks.filter(w => !w.missing);
  const unlinked = ok.reduce((a, w) => a + w.unlinked, 0);
  if (unlinked > 1) reasons.push(`${unlinked - 1} blocks have no parent inside the window; supply changes are incomplete.`);
  if (ok.some(w => w.nulls > 0)) reasons.push('Null burn values present.');
  const sum = k => ok.reduce((a, w) => a + w[k], 0);
  const totals = { burnt: sum('burnt'), issued: sum('issued'), fields: sum('fields'), delta: sum('delta'), gross: sum('gross') };
  totals.offset = totals.gross > 0 ? totals.burnt / totals.gross : null;
  totals.fieldOffset = totals.delta + totals.fields > 0 ? totals.fields / (totals.delta + totals.fields) : null;
  totals.gap = totals.fields > 0 ? (totals.burnt - totals.fields) / totals.fields : null;
  if (ok.length && ok[0].opening != null && ok.at(-1).closing != null) totals.endpointDelta = ok.at(-1).closing - ok[0].opening;
  const groups = new Map();
  for (const w of ok) {
    const band = gapBand(w.week);
    if (!band) { reasons.push(`Week ${w.week} spans the protocol 87 upgrade; its burn check cannot use one band.`); continue; }
    const g = groups.get(band.label) || { ...band, burnt: 0, fields: 0, weeks: 0 };
    g.burnt += w.burnt; g.fields += w.fields; g.weeks++;
    groups.set(band.label, g);
  }
  totals.bands = [...groups.values()].map(g => ({ ...g, gap: g.fields > 0 ? (g.burnt - g.fields) / g.fields : null }));
  for (const g of totals.bands) {
    if (g.gap == null || g.gap > g.high || g.gap < g.low) {
      reasons.push(`Supply falls differ from the burn fields by ${pct(g.gap)} ${g.label}, outside the explained range (${pct(g.low, 0)} to ${pct(g.high, 0)}).`);
    }
  }
  const atLeast10 = ok.filter(w => w.offset != null && w.offset >= 0.10).length;
  const atMost5 = ok.filter(w => w.offset != null && w.offset <= 0.05).length;
  let verdict = "CAN'T TELL";
  if (!reasons.length && totals.offset != null) {
    if (totals.offset >= 0.20 && atLeast10 >= 39) verdict = 'PASS';
    else if (totals.offset <= 0.05 && atMost5 >= 39) verdict = 'FAIL';
  }
  return { verdict, reasons, weeks, totals, atLeast10, atMost5 };
}

// ---------- loading (data/public only) ----------
export const PUBLIC_MANIFEST = 'data/public/manifest.json';
const PUBLIC_PATH = /^data\/public\/(bigquery\/)?[a-z0-9_-]+\.json$/;
export async function loadPublicManifest(root = ROOT) {
  try { return JSON.parse(await readFile(resolve(root, PUBLIC_MANIFEST), 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') throw e; return null; }
}
async function readPublic(root, entry, name) {
  if (!entry?.path || !PUBLIC_PATH.test(entry.path)) throw new Error(`Invalid public data path for ${name}.`);
  const body = await readFile(resolve(root, entry.path), 'utf8');
  if (hash(body) !== entry.sha256) throw new Error(`Public data hash mismatch: ${name}.`);
  const data = JSON.parse(body);
  assertNoWalletFields(data);
  return data;
}
export function parsePrices(p) {
  if (!Array.isArray(p.days)) throw new Error('Invalid price file.');
  p.days.forEach((d, i) => {
    if (!validDay(d.date) || !(d.close > 0) || (i && d.date <= p.days[i - 1].date)) throw new Error('Invalid or unordered price day.');
  });
  return p;
}
const validDay = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(d).toISOString().slice(0, 10) === d;
export async function loadSources(root = ROOT) {
  const manifest = await loadPublicManifest(root) || { snapshot: 'not-fetched', fetchedAt: null, files: {}, unavailable: {} };
  const files = manifest.files || {}, why = name => manifest.unavailable?.[name] || `No ${name} file in data/public/.`;
  assertNoWalletFields(manifest);
  const sources = {};
  for (const name of Object.keys(QUERIES)) {
    if (!files[name]) { sources[name] = { reason: why(name) }; continue; }
    const raw = await readPublic(root, files[name], name);
    const currentSql = await readFile(resolve(root, `sql/${name}.sql`), 'utf8');
    if (currentSql !== raw.sql || JSON.stringify(literalDateFilters(currentSql)) !== JSON.stringify(raw.filters)) {
      throw new Error(`SQL changed since ${name} was fetched. Refresh before rebuilding.`);
    }
    const parse = { signers: parseSigners, contracts: parseContracts, coverage: parseCoverage, supply: parseSupply, burn: parseBurn }[name];
    sources[name] = { data: parse(raw.rows), entry: files[name], raw: { jobId: raw.jobId, billedBytes: raw.billedBytes, fetchedAt: raw.fetchedAt } };
  }
  sources.prices = files.prices ? { data: parsePrices(await readPublic(root, files.prices, 'prices')), entry: files.prices } : { reason: why('prices') };
  if (files.swaps) {
    const pub = await readPublic(root, files.swaps, 'swaps'), days = parseSwapDays(pub);
    sources.swaps = { data: { days, weeks: weeklyFromDaily(days), rows: pub.rows, pages: pub.pages, completedAt: pub.completedAt }, entry: files.swaps };
  } else sources.swaps = { reason: why('swaps') };
  if (files.position_results) {
    const evidence = await loadPositionEvidence(manifest, root);
    const saved = await readPublic(root, files.position_section, 'position_section');
    if (JSON.stringify(saved) !== JSON.stringify(evidence.section)) throw new Error('Position section differs from its public inputs.');
    assertNoWalletFields(evidence);
    sources.position = { data: evidence };
  }
  return { manifest, sources };
}

export function analyse(sources) {
  const d = name => sources[name]?.data || null;
  const t1 = t1Test(d('signers'), d('contracts'), d('coverage'));
  const series = t2Series(d('swaps')?.weeks || null, d('signers'), d('prices'));
  const t2 = t2Test(series);
  if (sources.swaps?.reason) t2.reasons.unshift(sources.swaps.reason);
  if (sources.prices?.reason) t2.reasons.unshift(sources.prices.reason);
  if (!d('prices') || !d('signers')) t2.verdict = "CAN'T TELL";
  const sensitivitySeries = t2SensitivitySeries(series);
  const t2sens = t2Test(sensitivitySeries);
  if (!d('prices') || !d('signers')) t2sens.verdict = "CAN'T TELL";
  t2sens.weeksBelowMin = sensitivitySeries.start ? sensitivitySeries.rows.filter(r => !r.excluded && r.swaps < CAL.t2.minSwaps).length : null;
  const t3 = t3Test(d('supply'), d('burn'));
  const coverage = d('coverage');
  const duplicates = coverage ? [...coverage.values()].filter(c => c.duplicates > 0) : [];
  return { t1, t2, t2sens, series, t3, duplicates, position: d('position') };
}
// ---------- charts ----------
// points: [{ x, v, v2?, excluded? }]; gaps (null) break the line.
export function seriesSVG({ title, unit, points, lines = [], second, note }) {
  if (!points.some(p => p.v != null)) return null;
  const vals = points.flatMap(p => [p.v, second ? p.v2 : null]).filter(v => v != null && Number.isFinite(v));
  const max = unit === 'share' ? Math.max(0.3, ...vals) : Math.max(...vals, ...lines.map(l => l.value), 1) * 1.05;
  const x = i => 80 + i * 760 / Math.max(1, points.length - 1), y = v => 220 - Math.max(0, v) / max * 180;
  const label = n => unit === 'share' ? share(n, 0) : fmt(n, n >= 100 ? 0 : 2);
  // Full digits overflow the 80px left margin; axis ticks use compact notation, tooltips and tables stay exact.
  const tick = n => unit !== 'share' && max >= 1e5 ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n) : label(n);
  const path = key => { let s = '', on = false; points.forEach((p, i) => { const v = p[key]; if (v == null) { on = false; return; } s += `${on ? 'L' : 'M'}${x(i).toFixed(2)},${y(v).toFixed(2)} `; on = true; }); return s; };
  const dots = points.map((p, i) => p.v == null ? '' : `<circle cx="${x(i).toFixed(2)}" cy="${y(p.v).toFixed(2)}" r="${p.excluded ? 3 : 2.5}" fill="${p.excluded ? '#ffffff' : '#171717'}" stroke="${p.excluded ? '#9ca3af' : '#171717'}"><title>${escape(p.x)}: ${escape(label(p.v))}${p.excluded ? ' (excluded from test)' : ''}</title></circle>`).join('');
  const excludedCount = points.filter(p => p.excluded).length;
  const shade = excludedCount ? `<rect x="80" y="40" width="${(x(excludedCount - 1) - 80 + 380 / Math.max(1, points.length - 1)).toFixed(2)}" height="180" fill="#f3f4f6"/><text x="84" y="34" font-family="system-ui,sans-serif" font-size="12" fill="#6b7280">Excluded from T2 test</text>` : '';
  const ref = lines.map(l => `<path d="M80 ${y(l.value).toFixed(2)}H840" stroke="#b91c1c" stroke-dasharray="4 4"/><text x="838" y="${(y(l.value) - 4).toFixed(2)}" text-anchor="end" font-size="12" fill="#b91c1c">${escape(l.label)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 280" role="img" aria-label="${escape(title)}">
  <title>${escape(title)}</title><desc>${escape(note || '')} Gaps represent missing values. Exact values are in the adjacent table.</desc>
  ${shade}<g fill="none" stroke="#e5e5e5"><path d="M80 40H840 M80 130H840 M80 220H840"/></g>
  <g fill="#374151" font-family="system-ui,sans-serif" font-size="13"><text x="72" y="44" text-anchor="end">${tick(max)}</text>
  <text x="72" y="134" text-anchor="end">${tick(max / 2)}</text><text x="72" y="224" text-anchor="end">0</text>
  <text x="80" y="252">${escape(points[0].x)}</text><text x="840" y="252" text-anchor="end">${escape(points.at(-1).x)}</text><text x="80" y="20">${escape(unit)}</text></g>
  <g font-family="system-ui,sans-serif">${ref}</g>
${second ? `<path d="${path('v2')}" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="6 3"/><text x="840" y="20" text-anchor="end" font-family="system-ui,sans-serif" font-size="12" fill="#2563eb">dashed: ${escape(second)}</text>` : ''}
  <path d="${path('v')}" fill="none" stroke="#171717" stroke-width="2"/>${dots}</svg>`;
}

function chartDefs(sources, a) {
  const sig = sources.signers?.data, con = sources.contracts?.data, cov = sources.coverage?.data;
  const days = dayRange(...CAL.coverage);
  const sqlOf = name => `sql/${name}.sql`;
  const t2rows = a.series.rows;
  return [
    { id: 'signers', test: 'T1', title: 'Daily transaction signers', unit: 'accounts', source: 'signers', method: sqlOf('signers'),
      text: 'Distinct signer accounts per UTC day. An activity proxy: bots, relayers and several accounts per person all count.',
      points: days.slice(0, -1).map(d => ({ x: d, v: sig?.days.get(d)?.signers ?? null })) },
    { id: 'accounts2', test: 'T1', title: 'Accounts signing on 2 or more days in a month', unit: 'accounts', source: 'signers', method: sqlOf('signers'),
      text: 'Signer accounts active on at least two distinct UTC days in each complete calendar month.',
      points: [...(sig?.months.values() || [])].sort((p, q) => p.month.localeCompare(q.month)).map(m => ({ x: m.month.slice(0, 7), v: m.accounts2 })) },
    { id: 'receivers', test: 'T1', title: 'Accounts receiving function calls (one-day-a-week sample)', unit: 'accounts', source: 'contracts', method: sqlOf('contracts'),
      text: 'One-day-a-week sample: distinct receivers of FUNCTION_CALL actions on 104 Mondays. Not a daily series; days between samples are not measured.',
      points: CAL.sampleDays.map(d => ({ x: d, v: con?.get(d)?.receivers ?? null })) },
    { id: 'swaps', test: 'T2', title: 'Successful 1Click swaps per week', unit: 'swaps', source: 'swaps', method: 'explorer',
      text: 'Successful 1Click swaps per Monday-start UTC week, by creation time. Shaded weeks come before the first complete week with at least 7,000 swaps and are excluded from the T2 test. 1Click only, not all NEAR Intents.',
      lines: [{ value: CAL.t2.minSwaps, label: '7,000 swaps' }],
      points: t2rows.map(r => ({ x: r.week, v: r.swaps, excluded: r.excluded })) },
    { id: 'volume', test: 'T2', title: 'Weekly 1Click input USD volume', unit: 'USD', source: 'swaps', method: 'explorer',
      text: 'Sum of amountInUsd once per successful 1Click swap. Shaded weeks are excluded from the T2 test.',
      points: t2rows.map(r => ({ x: r.week, v: r.volume, excluded: r.excluded, exact: r.volumeExact })) },
    { id: 'price', test: 'T2', title: 'NEAR/USD, weekly mean of daily closes', unit: 'USD', source: 'prices', method: 'prices',
      text: 'Coinbase Exchange NEAR-USD daily candles (UTC). Shaded weeks are excluded from the T2 test.',
      points: t2rows.map(r => ({ x: r.week, v: r.price, excluded: r.excluded })) },
    { id: 'usage', test: 'T2', title: 'Weekly mean of daily signers', unit: 'accounts', source: 'signers', method: sqlOf('signers'),
      text: 'Usage series for T2: the mean of the seven daily signer counts in each week.',
      points: t2rows.map(r => ({ x: r.week, v: r.usage, excluded: r.excluded })) },
    { id: 'burn', test: 'T3', title: 'Weekly burn vs gross new supply', unit: 'NEAR', source: 'supply', method: `${sqlOf('supply')} + ${sqlOf('burn')}`,
      text: 'Solid: burn, measured as block-to-block falls in total_supply. Dashed: gross new supply (change in total_supply + burn, which equals the rises, i.e. issuance). The burn fields (tokens_burnt + receipt_conversion_tokens_burnt) are only a comparison, because they include the 30% function-call reward paid to contracts.',
      second: 'gross new supply', points: a.t3.weeks.map(w => ({ x: w.week, v: w.burnt ?? null, v2: w.gross ?? null })) },
    { id: 'offset', test: 'T3', title: 'Share of gross new supply offset by burn', unit: 'share', source: 'supply', method: `${sqlOf('burn')} + ${sqlOf('supply')}`,
      text: 'Weekly burn (supply falls) divided by gross new supply. Pass needs at least 10% in 39 or more weeks; fail needs at most 5% in 39 or more weeks.',
      lines: [{ value: 0.10, label: '10%' }, { value: 0.05, label: '5%' }],
      points: a.t3.weeks.map(w => ({ x: w.week, v: w.offset ?? null })) },
    { id: 'coverage', test: 'Quality', title: 'Indexed blocks per day', unit: 'blocks', source: 'coverage', method: sqlOf('coverage'),
      text: 'Data-quality screen. Missing days, truncated days or duplicate block rows are listed below the chart.',
      points: days.map(d => ({ x: d, v: cov?.get(d)?.blocks ?? null })) }
  ];
}

const VERDICT_CLASS = { PASS: 'pass', FAIL: 'fail', "CAN'T TELL": 'unclear' };

export function metricValues(a) {
  const values = {};
  for (const t of ['t1', 't2', 't3']) values[`${t}.verdict`] = a[t].verdict;
  for (const [key, m] of Object.entries(a.t1.measures || {})) {
    for (const [field, value] of Object.entries(m)) {
      values[`t1.${key}.${field}`] = key === 'top10' && field !== 'changePp' ? share(value, 2)
        : field === 'change' ? pct(value) : field === 'changePp' ? `${fmt(value, 2)} pp` : fmt(value, 0);
    }
  }
  values['presentation.signersDecline'] = share(Math.abs(a.t1.measures?.signers?.change), 1);
  values['presentation.top10Decline'] = `${fmt(Math.abs(a.t1.measures?.top10?.changePp), 2)} pp`;
  values['t2.start'] = a.t2.start || 'none';
  values['t2.changes'] = String(a.t2.changes);
  const inTest = (a.series?.rows || []).filter(r => !r.excluded), sum = (rs, k) => rs.some(r => r[k] == null) ? null : rs.reduce((s, r) => s + r[k], 0);
  values['t2.weeks'] = String(inTest.length);
  values['t2.startSwaps'] = fmt(inTest[0]?.swaps, 0);
  const next = inTest.slice(1).findIndex(r => r.swaps >= CAL.t2.minSwaps);
  values['t2.weeksBelowMinAfterStart'] = inTest.length ? String(next < 0 ? inTest.length - 1 : next) : 'Unavailable';
  values['t2.nextWeekAtMin'] = next < 0 ? 'none' : inTest[next + 1].week;
  const noUsd = inTest.filter(r => r.volume == null);
  values['t2.volumeUnavailable.weeks'] = noUsd.map(r => r.week).join(', ') || 'none';
  values['t2.volumeUnavailable.missingUsd'] = fmt(sum(noUsd, 'missingUsd'), 0);
  values['t2.volumeUnavailable.swaps'] = fmt(sum(noUsd, 'swaps'), 0);
  // Descriptive 1Click growth, not a test: the latest 13 complete weeks against the same 13 weeks a year earlier.
  const span = from => (a.series?.rows || []).filter(r => r.week >= from && r.week < addDays(from, 7 * 13));
  const [prev, last] = [span('2025-08-04'), span('2026-08-03')];
  for (const k of ['swaps', 'volume']) {
    const p = prev.length === 13 ? sum(prev, k) : null, l = last.length === 13 ? sum(last, k) : null;
    values[`oneClick.previous.${k}`] = fmt(p, 0);
    values[`oneClick.latest.${k}`] = fmt(l, 0);
    values[`oneClick.${k}.change`] = p > 0 && l != null ? pct(l / p - 1) : 'Unavailable';
  }
  for (const l of a.t2.lags) {
    for (const k of ['pairs', 'rv', 'rp', 'advantage']) values[`t2.lag${l.lag}.${k}`] = fmt(l[k], k === 'pairs' ? 0 : 3);
    for (const [i, h] of l.halves.entries()) for (const k of ['rv', 'rp']) values[`t2.lag${l.lag}.half${i + 1}.${k}`] = fmt(h[k], 3);
    for (const k of ['low', 'high']) values[`t2.lag${l.lag}.ci.${k}`] = fmt(l.ci?.[k], 3);
    values[`t2.lag${l.lag}.favours`] = l.volumeWins ? 'volume' : l.priceWins ? 'price' : 'neither';
  }
  const s = a.t2sens || { lags: [], changes: 0 };
  values['t2sens.start'] = s.start || 'none';
  values['t2sens.weeksBelowMin'] = String(s.weeksBelowMin ?? 'Unavailable');
  values['t2sens.changes'] = String(s.changes);
  values['t2sens.ruleOutcome'] = s.verdict ?? "CAN'T TELL";
  for (const l of s.lags) {
    for (const k of ['pairs', 'rv', 'rp', 'advantage']) values[`t2sens.lag${l.lag}.${k}`] = fmt(l[k], k === 'pairs' ? 0 : 3);
    for (const [i, h] of l.halves.entries()) for (const k of ['rv', 'rp']) values[`t2sens.lag${l.lag}.half${i + 1}.${k}`] = fmt(h[k], 3);
    for (const k of ['low', 'high']) values[`t2sens.lag${l.lag}.ci.${k}`] = fmt(l.ci?.[k], 3);
    values[`t2sens.lag${l.lag}.favours`] = l.volumeWins ? 'volume' : l.priceWins ? 'price' : 'neither';
  }
  for (const k of ['burnt', 'issued', 'delta', 'endpointDelta', 'gross', 'fields', 'offset', 'fieldOffset', 'gap']) {
    const v = a.t3.totals?.[k];
    values[`t3.${k}`] = k === 'gap' ? pct(v, 2) : ['offset', 'fieldOffset'].includes(k) ? share(v, 2) : fmt(v);
  }
  values['t3.atLeast10'] = String(a.t3.atLeast10 ?? 'Unavailable');
  values['t3.atMost5'] = String(a.t3.atMost5 ?? 'Unavailable');
  if (a.position) Object.assign(values, positionMetricValues(a.position));
  return values;
}
export function numberTables(a) {
  return '| Metric | Value |\n|---|---|\n' + Object.entries(metricValues(a)).map(([k, v]) => `| ${k} | ${v} |`).join('\n') + '\n';
}
const CSP = "default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'";
// Minimal Markdown for THESIS.md only: headings, paragraphs, "- " lists, pipe tables, `code` and **bold**. Everything is escaped.
const inlineMd = s => escape(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
export function thesisHTML(md) {
  const lines = md.replace(/<!--[\s\S]*?-->/g, '').split('\n'), out = [];
  let para = [], list = [];
  const flush = () => {
    if (para.length) out.push(`<p>${inlineMd(para.join(' '))}</p>`);
    if (list.length) out.push(`<ul>${list.map(i => `<li>${inlineMd(i)}</li>`).join('')}</ul>`);
    para = []; list = [];
  };
  const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], h = line.match(/^(#{1,3})\s+(.*)$/), li = line.match(/^- (.*)$/);
    if (h) { flush(); out.push(`<h${h[1].length}>${inlineMd(h[2])}</h${h[1].length}>`); }
    else if (line.startsWith('|') && /^\|[\s|:-]+\|$/.test(lines[i + 1] || '')) {
      flush();
      const head = cells(line), body = [];
      for (i++; lines[i + 1]?.startsWith('|'); ) body.push(cells(lines[++i]));
      out.push(`<div class="table-wrap" tabindex="0"><table><thead><tr>${head.map(c => `<th scope="col">${inlineMd(c)}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${r.map(c => `<td>${inlineMd(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    } else if (li) { if (para.length) { const l = list; list = []; flush(); list = l; } list.push(li[1]); }
    else if (!line.trim()) flush();
    else if (list.length && /^\s+/.test(line)) list[list.length - 1] += ' ' + line.trim();
    else { if (list.length) flush(); para.push(line.trim()); }
  }
  flush();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="${CSP}">
    <title>NEAR / Thesis</title><link rel="icon" href="favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="style.css"></head><body>
    <a class="skip" href="#main">Skip to thesis</a>
    <nav aria-label="Research navigation"><a class="brand" href="index.html">NEAR / Evidence ledger</a><a href="index.html">Dashboard</a></nav>
    <main id="main"><article class="thesis">${out.join('\n')}</article></main></body></html>\n`;
}
export const EVIDENCE_START = '<!-- evidence:begin -->';
export const EVIDENCE_END = '<!-- evidence:end -->';
export function verifyThesis(text, a) {
  const expected = `${EVIDENCE_START}\n${numberTables(a)}${EVIDENCE_END}`;
  if (text.split(EVIDENCE_START).length !== 2 || text.split(EVIDENCE_END).length !== 2 ||
      !text.includes(expected)) throw new Error('THESIS.md evidence metrics differ from data/public/. Review dashboard/NUMBERS.md and update the thesis by hand.');
  const values = metricValues(a);
  for (const m of text.matchAll(/<!-- metric:([a-zA-Z0-9.]+) -->(.*?)<!-- \/metric -->/g)) {
    if (!(m[1] in values) || m[2] !== values[m[1]]) throw new Error(`THESIS.md metric mismatch: ${m[1]}.`);
  }
}
export async function render(manifest, sources, write, root = ROOT) {
  const a = analyse(sources), defs = chartDefs(sources, a), artifact = [], sections = [];
  const explorerMethod = `GET ${EXPLORER}\n${new URLSearchParams(explorerParams(CAL.swapWindow))}\nAuthorization: Bearer [read locally from .env, never included here]\n\nPaginate with endTimestamp = previous oldest createdAt + 1 ms; every HTTP attempt is at least 5.2 s apart.\nSkip known swaps only at the previous boundary timestamp; reject other duplicates or broken timestamp continuity.\nStop on an empty response or a short response with no new rows; a full 1,000-row response with no new rows is an error.\nIdentity is depositAddress+depositMemo+createdAt (addresses can repeat); sum amountInUsd once; group by Monday-start UTC week of createdAt.`;
  const priceMethod = `GET ${PRICE_SOURCE}?granularity=86400&start=…&end=…\nDaily UTC candles [time, low, high, open, close, volume]; weekly value = mean of the 7 daily closes.`;
  for (const def of defs) {
    const svg = seriesSVG(def);
    if (svg) { await write(`charts/${def.id}.svg`, svg); artifact.push(`charts/${def.id}.svg`); }
    const reason = sources[def.source]?.reason;
    const method = def.method === 'explorer' ? explorerMethod : def.method === 'prices' ? priceMethod
      : (await Promise.all(def.method.split(' + ').map(p => readFile(resolve(root, p), 'utf8')))).join('\n');
    const rows = def.points.map(p => `<tr${p.excluded ? ' class="excluded"' : ''}><td>${escape(p.x)}</td><td>${escape(p.exact ?? (p.v == null ? 'Unavailable' : def.unit === 'share' ? share(p.v, 2) : fmt(p.v)))}</td>${def.second ? `<td>${escape(p.v2 == null ? 'Unavailable' : fmt(p.v2))}</td>` : ''}${def.test === 'T2' ? `<td>${p.excluded ? 'Excluded' : 'In test'}</td>` : ''}</tr>`).join('');
    sections.push(`<section id="${def.id}" class="chart-section"><header><h2>${escape(def.title)}</h2><span class="source">${escape(def.test)}</span></header>
      <p>${escape(def.text)}</p>
      ${svg ? `<img src="charts/${def.id}.svg" alt="${escape(def.title)}; exact values in the table below" width="880" height="280">` : `<div class="empty"><strong>Data unavailable</strong><p>${escape(reason || 'No observed values.')}</p><span>No synthetic series or zero-filled history.</span></div>`}
      <details><summary>Query &amp; method</summary><pre><code>${escape(method)}</code></pre></details>
      <details><summary>Values &amp; gaps</summary><div class="table-wrap" tabindex="0"><table><caption>${escape(def.title)} (${escape(def.unit)})</caption><thead><tr><th scope="col">Period</th><th scope="col">Value</th>${def.second ? `<th scope="col">${escape(def.second)}</th>` : ''}${def.test === 'T2' ? '<th scope="col">T2 status</th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div></details>
      </section>`);
  }
  const report = '# Generated evidence tables\n\n' + numberTables(a);
  const verdictRow = (id, label, r) => `<dt>${escape(id)}. ${escape(label)}</dt><dd><strong class="${VERDICT_CLASS[r.verdict]}">${escape(r.verdict)}</strong>${r.reasons.length ? `<p>${escape(r.reasons.join(' '))}</p>` : ''}</dd>`;
  const values = metricValues(a);
  const position = a.position;
  values['presentation.publicDate'] = 'November 1, 2026';
  const dataStatus = result => result ? (result.pass ? 'Pass' : 'Fail') : 'Unavailable';
  const checkCard = ({ id, title, value, description, result, valueNow, max, threshold, passLine = false }) => {
    const status = dataStatus(result);
    return `<article class="check-card"><div class="check-card-head"><h2>${escape(title)}</h2><span class="status status-${status.toLowerCase()}" data-status="${status}">${status}</span></div>
      <p class="check-value"><strong data-metric="${id}">${escape(value)}</strong><span>${escape(description)}</span></p>
      <div class="measurebar measurebar--pass"><meter min="0" max="${max}" value="${valueNow ?? 0}" aria-label="${escape(title)} measure"></meter><span class="threshold" aria-hidden="true"></span></div>
      <p class="measure-caption"><span data-metric="${passLine ? 'position.rules.passBar' : 'position.rules.signedGrowthBar'}">${escape(threshold)} pass bar</span></p>
      ${id === 'position.check1.coverage' ? `<p class="check-note">Without three accounts: <strong data-metric="position.concentration.withoutTopNetBuyers.3.coverage">${escape(values['position.concentration.withoutTopNetBuyers.3.coverage'] || 'Unavailable')}</strong></p>` : ''}</article>`;
  };
  const checkCards = position ? `<div class="check-cards">
      ${checkCard({ id: 'position.check1.coverage', title: "Net buying on 1Click, NEAR's swap service", value: values['position.check1.coverage'],
        description: 'of the value of new NEAR', result: position.results.check1, valueNow: position.results.check1.final.shareOfIssuanceValue * 100,
        max: 100, threshold: '20%', passLine: true })}
      ${checkCard({ id: 'position.check2.coveragePercent', title: 'Burn plus buybacks', value: values['position.check2.coveragePercent'],
        description: 'of new NEAR', result: position.results.check2, valueNow: position.results.check2.coverage * 100,
        max: 100, threshold: '20%', passLine: true })}
      ${checkCard({ id: 'position.check3.signedGrowth', title: 'Usage outside the ten biggest apps', value: values['position.check3.signedGrowth'],
        description: 'in a year', result: position.results.check3, valueNow: Math.max(0, position.results.check3.growth * 100),
        max: 100, threshold: '+20%' })}</div>` : '<p class="unavailable-note">Position evidence unavailable. No position verdict or check results are shown.</p>';
  const concentrationChart = position ? `<section id="concentration" class="concentration-chart" aria-labelledby="concentration-title"><h2 id="concentration-title">How much net buying remains?</h2>
      <p>Share of issuance value covered by observed net buying. The <span data-metric="position.rules.passBar">${escape(values['position.rules.passBar'])}</span> line is the locked pass bar. Removing accounts is a descriptive cut, not a revised test.</p>
      <div class="concentration-list">
        <div class="concentration-row"><span>All accounts</span><div><div class="measurebar measurebar--pass"><meter min="0" max="100" value="${position.results.check1.final.shareOfIssuanceValue * 100}" aria-label="All accounts net-buying coverage"></meter><span class="threshold" aria-hidden="true"></span></div><strong data-metric="position.check1.coverage">${escape(values['position.check1.coverage'])}</strong></div></div>
        <div class="concentration-row"><span>Top buyer removed</span><div><div class="measurebar measurebar--pass"><meter min="0" max="100" value="${position.results.descriptive.concentration.withoutTopNetBuyers['1'].share * 100}" aria-label="Coverage after removing the top buyer"></meter><span class="threshold" aria-hidden="true"></span></div><strong data-metric="position.concentration.withoutTopNetBuyers.1.coverage">${escape(values['position.concentration.withoutTopNetBuyers.1.coverage'])}</strong></div></div>
        <div class="concentration-row"><span>Top <span data-metric="position.topBuyerCount">${escape(values['position.topBuyerCount'])}</span> removed</span><div><div class="measurebar measurebar--pass"><meter min="0" max="100" value="${position.results.descriptive.concentration.withoutTopNetBuyers['3'].share * 100}" aria-label="Coverage after removing the top three buyers"></meter><span class="threshold" aria-hidden="true"></span></div><strong data-metric="position.concentration.withoutTopNetBuyers.3.coverage">${escape(values['position.concentration.withoutTopNetBuyers.3.coverage'])}</strong></div></div>
      </div><p class="source">The first three accounts supplied <span data-metric="position.top3Share">${escape(values['position.top3Share'])}</span> of net buying in the passing check. Concentration is measured after the fact.</p></section>` :
      '<section id="concentration" class="concentration-chart"><h2>Net-buying concentration</h2><p>Position evidence unavailable.</p></section>';
  const lagTable = a.t2.lags.length ? `<div class="table-wrap" tabindex="0"><table><caption>T2 correlations by lag (weekly % changes, from ${escape(a.t2.start)})</caption><thead><tr><th>Lag</th><th>Pairs</th><th>correlation with volume</th><th>correlation with price</th><th>Advantage</th><th>90% interval</th><th>Favours</th></tr></thead><tbody>${a.t2.lags.map(l => `<tr><td>${l.lag}</td><td>${l.pairs}</td><td>${fmt(l.rv, 3)}</td><td>${fmt(l.rp, 3)}</td><td>${fmt(l.advantage, 3)}</td><td>${l.ci ? `${fmt(l.ci.low, 3)} to ${fmt(l.ci.high, 3)}` : 'Unavailable'}</td><td>${l.volumeWins ? 'volume' : l.priceWins ? 'price' : 'neither'}</td></tr>`).join('')}</tbody></table></div>` : '';
  const sens = a.t2sens;
  const sensTable = sens?.lags.length ? `<div class="table-wrap" tabindex="0"><table><caption>Sensitivity check, not official: T2 method from ${escape(sens.start)}, added after the official result was seen. It does not change the official T2 result, which stays ${escape(a.t2.verdict)}. Same lines on this window would give ${escape(sens.verdict)} (not official).</caption><thead><tr><th>Lag</th><th>Pairs</th><th>correlation with volume</th><th>correlation with price</th><th>Advantage</th><th>First half (correlation with volume / correlation with price)</th><th>Second half (correlation with volume / correlation with price)</th><th>90% interval</th><th>Favours</th></tr></thead><tbody>${sens.lags.map(l => `<tr><td>${l.lag}</td><td>${l.pairs}</td><td>${fmt(l.rv, 3)}</td><td>${fmt(l.rp, 3)}</td><td>${fmt(l.advantage, 3)}</td>${l.halves.map(h => `<td>${fmt(h.rv, 3)} / ${fmt(h.rp, 3)}</td>`).join('')}<td>${l.ci ? `${fmt(l.ci.low, 3)} to ${fmt(l.ci.high, 3)}` : 'Unavailable'}</td><td>${l.volumeWins ? 'volume' : l.priceWins ? 'price' : 'neither'}</td></tr>`).join('')}</tbody></table></div>` : '';
  const statusRows = Object.entries(sources).map(([name, s]) => `<tr><th scope="row">${escape(name)}</th><td>${escape(s.reason || (s.entry?.reused ? 'Cached result reused' : 'Fetched'))}</td></tr>`).join('');
  await write('NUMBERS.md', report);
  await write('index.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="${CSP}">
    <title>NEAR investment thesis · public data through November 1, 2026</title><link rel="icon" href="favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="style.css"></head><body>
    <a class="skip" href="#main">Skip to evidence</a>
    <nav aria-label="Research navigation"><a class="brand" href="#main">NEAR / Evidence ledger</a><a href="model.html">Model</a><a href="thesis.html">Thesis</a><a href="VERIFY.md">Verify</a><a href="#signers">Usage</a><a href="#swaps">Swaps</a><a href="#burn">Fee burn</a></nav>
    <main id="main"><header class="first-screen">
    <p class="edition">NEAR investment thesis · public data through <time datetime="2026-11-01" data-metric="presentation.publicDate">${escape(values['presentation.publicDate'])}</time></p>
    <h1>Does public data support holding NEAR through <span data-metric="position.holdHorizon">${escape(values['position.holdHorizon'] || '2031')}</span>?</h1>
    ${position ? `<p class="answer">Not yet.</p><p class="summary-line"><span data-metric="position.call.passingWords">${escape(values['position.call.passingWords'])}</span> of <span data-metric="position.call.totalWords">${escape(values['position.call.totalWords'])}</span> locked tests passed, and <span data-metric="position.topBuyerCountWords">${escape(values['position.topBuyerCountWords'])}</span> accounts made up <span data-metric="position.top3Share">${escape(values['position.top3Share'])}</span> of that pass.</p>${checkCards}` : checkCards}
    <div class="first-actions"><a class="evidence-button" href="model.html">Test the issuance cut</a><a href="thesis.html">Read the thesis</a><a href="VERIFY.md">How to verify</a></div>
    <p class="advice-note">General research opinion, not personal advice.</p>
    </header><!-- first-screen:end -->
    ${concentrationChart}
    <section class="plain-claims"><h2>The original three claims, separate from the call above</h2><p>These are the T1 to T3 tests. 1Click is the NEAR Intents swap service; this sample is not all Intents activity.</p>
    <ul><li><span>More accounts are using NEAR, across more apps.</span><strong>${escape(a.t1.verdict)}</strong></li>
    <li><span>1Click swap volume leads account activity better than NEAR’s price does.</span><strong>${escape(a.t2.verdict)}</strong></li>
    <li><span>Fees destroy enough NEAR to meaningfully offset new supply.</span><strong>${escape(a.t3.verdict)}</strong></li></ul></section>
    <section class="hypotheses"><h2>Rules and detailed results</h2><p>The T1–T3 pass/fail rules were fixed before their metrics were computed. Checks 1–3 were written later, as disclosed in the thesis. A later fee-burn reconciliation rule is also disclosed there. Each original test can pass, fail or end as “can’t tell”.</p>
    <p class="window">Snapshot ${escape(manifest.id)}${manifest.fetchedAt ? ` · fetched ${escape(manifest.fetchedAt)}` : ' · no data fetched'}</p>
    <dl>${verdictRow('T1', 'Usage is broadening', a.t1)}${verdictRow('T2', '1Click volume leads usage better than NEAR price', a.t2)}${verdictRow('T3', 'Usage reaches holders through burn', a.t3)}</dl>${lagTable}${sensTable}</section>
    <section id="status"><h2>Source status</h2><div class="table-wrap" tabindex="0"><table><thead><tr><th>Source</th><th>Status</th></tr></thead><tbody>${statusRows}</tbody></table></div>${a.duplicates.length ? `<p>Duplicate block rows: ${escape(a.duplicates.map(d => `${d.date} (${d.duplicates})`).join(', '))}.</p>` : ''}</section>
    ${sections.join('')}
    <section><h2>What this cannot tell you</h2><p>Accounts are not people. 1Click is not all of NEAR Intents. Correlation is not causation. None of this sets a fair NEAR price.</p><a href="thesis.html">Rules, limits and sources</a></section>
    <footer>Rebuild all charts offline: <code>npm run rebuild</code><br>Refresh sources and rebuild: <code>npm run refresh</code><br>No browser credentials. No external scripts. No fabricated data.</footer></main></body></html>`);
  await write('charts.json', JSON.stringify({ snapshot: manifest.id, files: artifact }, null, 2) + '\n');
  return { report, analysis: a };
}
