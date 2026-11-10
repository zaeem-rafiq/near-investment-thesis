import { EXPLORER, explorerParams, sleep } from './sources.mjs';
import { addDays, weekStart, usdUnits, usdString } from './report.mjs';
import { cleanRows, fetchPage, PACE_MS } from './swaps.mjs';
import { NEAR_ASSET_IDS, PARTICIPANT_RETRIES } from './position-config.mjs';
import { normalizeSwaps, netFlow, finalKeep } from './position-results.mjs';

export const FLOW_START = '2026-11-02';
// Late swaps can reach SUCCESS after midnight; a day is fetched only after it has settled.
export const FLOW_SETTLE_MS = 2 * 3600000;
// Keeps a catch-up run inside the workflow timeout; remaining days are fetched next run.
export const MAX_FLOW_DAYS_PER_RUN = 14;
const PAGE_SIZE = 1000;
const FLOW_METHOD = 'Check 1 final rules per UTC day: same NEAR asset IDs, one single-asset Explorer filter per asset and side, ' +
  'NEAR-to-NEAR and duplicate swaps dropped, buys excluded when the recipient is a revenue wallet, sells excluded when any sender is one. ' +
  'Swaps without a USD value are left out and counted. Only daily totals are stored.';

export const signedUsd = units => units < 0n ? `-${usdString(-units)}` : usdString(units);
export function parseSignedUsd(value) {
  const negative = typeof value === 'string' && value.startsWith('-');
  const units = usdUnits(negative ? value.slice(1) : value);
  if (units == null) throw new Error('Invalid live flow value.');
  return negative ? -units : units;
}
const count = value => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid live flow value.');
  return value;
};
const validDate = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && addDays(d, 0) === d;

// Rebuilds each saved day from known fields only, so nothing else can be carried forward.
export function sanitizeDays(days) {
  if (!Array.isArray(days)) return [];
  const out = new Map();
  for (const d of days) {
    try {
      if (!validDate(d?.date) || d.date < FLOW_START || out.has(d.date)) continue;
      const buys = parseSignedUsd(d.buysUsd), sells = parseSignedUsd(d.sellsUsd);
      if (buys < 0n || sells < 0n || parseSignedUsd(d.netUsd) !== buys - sells) continue;
      out.set(d.date, { date: d.date, netUsd: signedUsd(buys - sells), buysUsd: usdString(buys), sellsUsd: usdString(sells),
        buyRows: count(d.buyRows), sellRows: count(d.sellRows), missingUsdRows: count(d.missingUsdRows) });
    } catch { /* Drop malformed saved days; they are fetched again. */ }
  }
  return [...out.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function flowDaysDue(days, now, start = FLOW_START) {
  const recorded = new Set(days.map(d => d.date)), due = [];
  for (let day = start; Date.parse(addDays(day, 1)) + FLOW_SETTLE_MS <= now.getTime(); day = addDays(day, 1)) {
    if (!recorded.has(day)) due.push(day);
  }
  return due;
}

export function pacedRequest(request, { pause = sleep, clock = Date.now } = {}) {
  let previous = null;
  return async (url, init) => {
    if (previous != null) {
      const wait = previous + PACE_MS - clock();
      if (wait > 0) await pause(wait);
    }
    previous = clock();
    return request(url, init);
  };
}

// Raw rows, including addresses, memos and participants, stay inside this function.
export async function pullFlowDay(day, jwt, request, pause = sleep) {
  const window = { start: day, end: addDays(day, 1) }, raw = [];
  for (const side of ['toTokenId', 'fromTokenId']) for (const id of NEAR_ASSET_IDS) {
    const tokenFilter = { side, ids: [id] }, params = { ...explorerParams(window), [side]: id };
    const seen = new Set();
    let last = null;
    for (;;) {
      const rows = await fetchPage(`${EXPLORER}?${new URLSearchParams(params)}`, jwt, request, pause, () => {}, PARTICIPANT_RETRIES);
      const clean = cleanRows(rows, window, seen, last, tokenFilter, true);
      if (!clean.length && rows.length >= PAGE_SIZE) throw new Error('Explorer timestamp pagination stalled.');
      raw.push(...clean);
      if (!clean.length || rows.length < PAGE_SIZE) break;
      last = clean.at(-1).createdAt;
      params.endTimestamp = new Date(Date.parse(last) + 1).toISOString();
    }
  }
  const { rows } = normalizeSwaps(raw, NEAR_ASSET_IDS, window);
  const f = netFlow(rows, finalKeep, [weekStart(day)]);
  return { date: day, netUsd: signedUsd(f.net), buysUsd: usdString(f.buys), sellsUsd: usdString(f.sells),
    buyRows: f.buyRows, sellRows: f.sellRows, missingUsdRows: f.missingUsd };
}

export function contiguousFlow(days, start = FLOW_START) {
  const byDate = new Map(days.map(d => [d.date, d]));
  let total = 0n, through = null;
  for (let day = start; byDate.has(day); day = addDays(day, 1)) {
    total += parseSignedUsd(byDate.get(day).netUsd);
    through = day;
  }
  return { through, units: total };
}

export async function updateFlow({ previous = null, jwt, request = fetch, now = () => new Date(), pause = sleep, clock = Date.now } = {}) {
  const days = sanitizeDays(previous?.days);
  const base = { start: FLOW_START, method: FLOW_METHOD };
  if (!jwt) return { ...base, value: null, status: 'pending', reason: 'pending', through: null, source: null, days };
  const paced = pacedRequest(request, { pause, clock });
  let reason = null;
  for (const day of flowDaysDue(days, now()).slice(0, MAX_FLOW_DAYS_PER_RUN)) {
    try { days.push(await pullFlowDay(day, jwt, paced, pause)); }
    catch (error) {
      reason = /^Explorer (HTTP \d{3}|network|timestamp|returned|schema)/.test(error.message || '')
        ? `${error.message.replace(/;.*$/, '')}; fetch stopped, recorded days kept.` : 'Explorer fetch failed; details omitted; recorded days kept.';
      break;
    }
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  const remaining = flowDaysDue(days, now()).length;
  const { through, units } = contiguousFlow(days);
  return { ...base, value: through ? signedUsd(units) : null,
    status: reason ? 'stale' : remaining ? 'partial' : through ? 'ok' : 'pending',
    reason: reason || (remaining ? `${remaining} settled days not yet recorded.` : through ? null : 'No settled day yet.'),
    through, source: { url: EXPLORER, paceMs: PACE_MS, settleHours: FLOW_SETTLE_MS / 3600000 }, days };
}
