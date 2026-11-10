import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, hash } from './sources.mjs';
import { atomic } from './store.mjs';

// Pinned once under addendum 3. Saved responses are reused, never refetched.
export const PEER_RAW = 'data/raw/peers/addendum-3';
export const PEER_WINDOW = { start: '2025-11-03', end: '2026-11-01' };
export const URLS = {
  config: 'https://api.llama.fi/config',
  overview: 'https://api.llama.fi/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyRevenue',
  mcaps: 'https://coins.llama.fi/mcaps',
  revenue: slug => `https://api.llama.fi/summary/fees/${encodeURIComponent(slug)}?dataType=dailyRevenue`,
  intents: 'https://api.llama.fi/summary/fees/near-intents?dataType=dailyHoldersRevenue'
};

export async function saved(name, root = ROOT) {
  try { return JSON.parse(await readFile(resolve(root, PEER_RAW, `${name}.json`), 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
export async function pull(name, url, { body, root = ROOT, request = fetch } = {}) {
  const prior = await saved(name, root);
  if (prior) return prior;
  const response = await request(url, { method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(90000),
    ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const text = await response.text();
  const record = { url, method: body ? 'POST' : 'GET', requestBody: body ?? null, retrievedAt: new Date().toISOString(), status: response.status, body: text };
  await mkdir(resolve(root, PEER_RAW), { recursive: true });
  await atomic(resolve(root, PEER_RAW, `${name}.json`), JSON.stringify(record) + '\n');
  if (!response.ok) throw new Error(`DefiLlama HTTP ${response.status} for ${name}.`);
  return record;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const mode = process.argv[2];
  if (mode === 'index') {
    for (const k of ['config', 'overview']) { const r = await pull(k, URLS[k]); console.log(k, r.status, r.retrievedAt, r.body.length); }
  }
}

const DAY = 86400000;
const days = ({ start, end }) => { const out = []; for (let t = Date.parse(start + 'T00:00:00Z'); t <= Date.parse(end + 'T00:00:00Z'); t += DAY) out.push(new Date(t).toISOString().slice(0, 10)); return out; };
const json = record => JSON.parse(record.body);

export function candidates(config, overview) {
  const records = config.chainCoingeckoIds, out = [], unmatched = [];
  for (const p of overview.protocols.filter(p => p.category === 'Chain')) {
    const record = records[p.name];
    if (!record) { unmatched.push(p.name); continue; }
    if (record.geckoId && record.geckoId === record.gasTokenGeckoId) out.push({ name: p.name, displayName: p.displayName || p.name, slug: p.slug, geckoId: record.geckoId });
  }
  return { list: out, unmatched, chainEntries: overview.protocols.filter(p => p.category === 'Chain').length };
}
export function ranked(list, mcaps) {
  return list.map(c => ({ ...c, mcapUsd: mcaps[`coingecko:${c.geckoId}`]?.mcap ?? null, mcapTimestamp: mcaps[`coingecko:${c.geckoId}`]?.timestamp ?? null }))
    .filter(c => Number.isFinite(c.mcapUsd) && c.mcapUsd > 0).sort((a, b) => b.mcapUsd - a.mcapUsd);
}
// Sum the window's daily values; null unless every day has exactly one finite value.
export function windowSum(summary, window = PEER_WINDOW) {
  const want = days(window), byDay = new Map();
  for (const [ts, v] of summary.totalDataChart || []) {
    const d = new Date(Number(ts) * 1000).toISOString().slice(0, 10);
    if (byDay.has(d)) return { complete: false, reason: `duplicate day ${d}` };
    byDay.set(d, v);
  }
  const missing = want.filter(d => !Number.isFinite(byDay.get(d)));
  if (missing.length) return { complete: false, days: want.length - missing.length, missing: missing.length, firstMissing: missing[0] };
  return { complete: true, days: want.length, sumUsd: want.reduce((s, d) => s + byDay.get(d), 0) };
}

async function pullAll() {
  const config = json(await pull('config', URLS.config)), overview = json(await pull('overview', URLS.overview));
  const c = candidates(config, overview);
  const coins = c.list.map(x => `coingecko:${x.geckoId}`);
  const mcaps = json(await pull('mcaps', URLS.mcaps, { body: { coins } }));
  const order = ranked(c.list, mcaps), at = order.findIndex(x => x.slug === 'near');
  if (at < 0) throw new Error('NEAR has no candidate market cap.');
  const series = async x => windowSum(json(await pull(`revenue-${x.slug}`, URLS.revenue(x.slug))));
  const pick = async step => { for (let i = at + step; i >= 0 && i < order.length; i += step) { const s = await series(order[i]); console.log(order[i].name, JSON.stringify(s)); if (s.complete) return order[i]; } return null; };
  console.log('candidates', c.list.length, 'unmatched', c.unmatched.length, 'ranked', order.length, 'near rank', at + 1);
  console.log(order.slice(Math.max(0, at - 4), at + 5).map(x => `${x.name} ${Math.round(x.mcapUsd)}`).join('\n'));
  console.log('near', JSON.stringify(await series(order[at])));
  console.log('above', (await pick(-1))?.name, 'below', (await pick(1))?.name);
  console.log('intents', JSON.stringify(windowSum(json(await pull('intents', URLS.intents)))));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href && process.argv[2] === 'pull') await pullAll();

const compact = n => new Intl.NumberFormat('en-US', { notation: 'compact', minimumSignificantDigits: 3, maximumSignificantDigits: 3 }).format(n);
const whole = n => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
const multiple = (mcap, revenue) => revenue > 0 ? `${whole(mcap / revenue)}×` : 'Not defined, zero revenue';
export function peerMetricValues(p) {
  const v = { 'peers.pulledAt': p.rows[1].mcapAt.slice(0, 16).replace('T', ' ') + ' UTC', 'peers.withMarketCap': String(p.candidates.withMarketCap),
    'peers.nearRank': String(p.candidates.nearRank), 'peers.skipped': String(p.skipped.above.length + p.skipped.below.length) };
  for (const [key, r] of [['above', p.rows[0]], ['near', p.rows[1]], ['below', p.rows[2]]]) {
    v[`peers.${key}.name`] = r.displayName;
    v[`peers.${key}.rank`] = String(r.rank);
    v[`peers.${key}.mcapCompact`] = compact(r.mcapUsd);
    v[`peers.${key}.revenueUsd`] = whole(r.yearlyRevenueUsd);
    v[`peers.${key}.multiple`] = multiple(r.mcapUsd, r.yearlyRevenueUsd);
  }
  const intents = p.nearIntentsHoldersRevenue.yearlyUsd, withIntents = p.rows[1].yearlyRevenueUsd + intents;
  v['peers.nearIntents.revenueUsd'] = whole(intents);
  v['peers.nearWithIntents.revenueUsd'] = whole(withIntents);
  v['peers.nearWithIntents.multiple'] = multiple(p.rows[1].mcapUsd, withIntents);
  return v;
}
const PEER_PUBLIC = 'data/public/peers.json';
export async function buildPeers(root = ROOT) {
  const names = (await readdir(resolve(root, PEER_RAW))).filter(n => n.endsWith('.json')).map(n => n.slice(0, -5)).sort();
  const records = Object.fromEntries(await Promise.all(names.map(async n => [n, await saved(n, root)])));
  const config = json(records.config), overview = json(records.overview), mcaps = json(records.mcaps);
  const c = candidates(config, overview), order = ranked(c.list, mcaps), at = order.findIndex(x => x.slug === 'near');
  const series = x => records[`revenue-${x.slug}`] ? windowSum(json(records[`revenue-${x.slug}`])) : null;
  const pick = step => { const tried = []; for (let i = at + step; i >= 0 && i < order.length; i += step) {
    const s = series(order[i]); if (!s) break; tried.push(order[i].name); if (s.complete) return { chain: order[i], tried }; } throw new Error('Peer pick has no saved complete revenue series.'); };
  const row = (x, role) => { const s = series(x); return { role, name: x.name, displayName: x.displayName, slug: x.slug, geckoId: x.geckoId, rank: order.indexOf(x) + 1,
    mcapUsd: x.mcapUsd, mcapAt: new Date(x.mcapTimestamp * 1000).toISOString(), yearlyRevenueUsd: s.sumUsd, revenueDays: s.days }; };
  const above = pick(-1), below = pick(1), intents = windowSum(json(records.intents));
  if (!intents.complete) throw new Error('NEAR Intents holders revenue is incomplete for the window.');
  return {
    rule: 'docs/position-rule-addendum-3.md', window: PEER_WINDOW, official: false,
    requests: names.map(n => ({ name: n, url: records[n].url, method: records[n].method, requestBody: records[n].requestBody,
      retrievedAt: records[n].retrievedAt, status: records[n].status, sha256: hash(records[n].body) })),
    candidates: { chainEntries: c.chainEntries, unmatchedChainEntries: c.unmatched, nativeGasCandidates: c.list.length, withMarketCap: order.length, nearRank: at + 1 },
    neighbourhood: order.slice(Math.max(0, at - 2), at + 3).map(x => ({ name: x.name, rank: order.indexOf(x) + 1, mcapUsd: x.mcapUsd })),
    rows: [row(above.chain, 'nearest above'), row(order[at], 'NEAR'), row(below.chain, 'nearest below')],
    skipped: { above: above.tried.slice(0, -1), below: below.tried.slice(0, -1) },
    nearIntentsHoldersRevenue: { slug: 'near-intents', dataType: 'dailyHoldersRevenue', yearlyUsd: intents.sumUsd, days: intents.days }
  };
}
export function verifyPeers(p) {
  if (p?.official !== false || p.rows?.length !== 3 || p.rows[1].slug !== 'near' || p.window?.start !== PEER_WINDOW.start || p.window?.end !== PEER_WINDOW.end)
    throw new Error('Peer table file does not match addendum 3.');
  for (const r of [...p.rows, { yearlyRevenueUsd: p.nearIntentsHoldersRevenue.yearlyUsd, mcapUsd: 1, revenueDays: p.nearIntentsHoldersRevenue.days }])
    if (!Number.isFinite(r.mcapUsd) || !Number.isFinite(r.yearlyRevenueUsd) || r.revenueDays !== 364) throw new Error('Peer table values are incomplete.');
  if (!(p.rows[0].mcapUsd > p.rows[1].mcapUsd && p.rows[1].mcapUsd > p.rows[2].mcapUsd)) throw new Error('Peer picks are not ranked around NEAR.');
  return p;
}
async function exportPeers() {
  const body = JSON.stringify(verifyPeers(await buildPeers()), null, 2) + '\n';
  const mpath = resolve(ROOT, 'data/public/manifest.json'), manifest = JSON.parse(await readFile(mpath, 'utf8'));
  await atomic(resolve(ROOT, PEER_PUBLIC), body);
  manifest.files.peers = { path: PEER_PUBLIC, sha256: hash(body) };
  await atomic(mpath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(body);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href && process.argv[2] === 'export') await exportPeers();
