import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, PRICE_SOURCE, EXPLORER, hash, environment, sleep } from './sources.mjs';
import { updateFlow } from './live-flow.mjs';
import { NEAR_RPC } from './staking.mjs';
import { fetchWalletControls, REVENUE_WALLETS } from './wallet-controls.mjs';
import { atomic } from './store.mjs';

const SCALE = 10n ** 24n;
const requireValue = condition => { if (!condition) throw new Error('Invalid live source value.'); };
const unsigned = value => {
  requireValue(typeof value === 'string' && /^(0|[1-9]\d{0,59})$/.test(value));
  return BigInt(value);
};
function units(value) {
  requireValue(typeof value === 'string' && /^(0|[1-9]\d{0,35})(\.\d{1,24})?$/.test(value));
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(24, '0'));
}
function near(value) {
  const sign = value < 0n ? '-' : '';
  const digits = (value < 0n ? -value : value).toString().padStart(25, '0');
  const fraction = digits.slice(-24).replace(/0+$/, '');
  return sign + digits.slice(0, -24) + (fraction ? `.${fraction}` : '');
}
function scientificInteger(value) {
  requireValue(typeof value === 'string');
  const match = value.match(/^(\d+)(?:\.(\d+))?(?:e\+?(\d{1,2}))?$/i);
  requireValue(match);
  const fraction = match[2] || '', shift = Number(match[3] || 0) - fraction.length;
  requireValue(shift >= 0 && shift <= 60);
  return unsigned(match[1] + fraction) * 10n ** BigInt(shift);
}
const blockSource = { url: NEAR_RPC, methods: ['block'] };
// Contract identifiers are intentionally omitted from the public live file.
const walletSource = { url: NEAR_RPC, methods: ['view_account', 'ft_balance_of', 'mt_balance_of'] };
const priceSource = { url: PRICE_SOURCE, method: 'GET', product: 'NEAR-USD', granularity: 86400 };
function block(value) {
  requireValue(value && Number.isSafeInteger(value.height) && value.height > 0 &&
    typeof value.hash === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.hash) &&
    typeof value.timeUtc === 'string' && new Date(value.timeUtc).toISOString() === value.timeUtc);
  return { height: value.height, hash: value.hash, timeUtc: value.timeUtc };
}
function balances(value) {
  const native = units(value?.nativeNear), wrapped = units(value?.wrappedNear), intents = units(value?.intentsNear);
  return { nativeNear: near(native), wrappedNear: near(wrapped), intentsNear: near(intents),
    totalNear: near(native + wrapped + intents) };
}
function measurement(candidate, previous, source, validate) {
  const parse = entry => {
    requireValue(entry && typeof entry.observedAt === 'string' &&
      new Date(entry.observedAt).toISOString() === entry.observedAt);
    return { value: validate(entry.value), observedAt: entry.observedAt,
      block: entry.block ? block(entry.block) : null };
  };
  try { return { status: 'ok', ...parse(candidate), source }; }
  catch {
    try {
      requireValue(previous && ['ok', 'stale'].includes(previous.status));
      return { status: 'stale', ...parse(previous), source,
        reason: 'Source failed or returned malformed data; last good value retained.' };
    } catch {
      return { status: 'unavailable', value: null, observedAt: null, block: null, source,
        reason: 'Source failed or returned malformed data; no last good value is available.' };
    }
  }
}
function difference(current, baseline, source, wallet = false) {
  if (current.value === null) return { ...current, source };
  const value = wallet ? Object.fromEntries(['nativeNear', 'wrappedNear', 'intentsNear', 'totalNear']
    .map(key => [key, near(units(current.value[key]) - units(baseline[key]))]))
    : near(units(current.value) - units(baseline));
  return { ...current, value, source };
}
async function latestClose(request, asOf) {
  const today = new Date(asOf.slice(0, 10)).getTime();
  const url = new URL(PRICE_SOURCE);
  url.search = new URLSearchParams({ granularity: '86400',
    start: new Date(today - 3 * 86400000).toISOString(), end: new Date(today).toISOString() });
  const response = await request(url.toString(), { headers: { 'User-Agent': 'near-evidence-thesis' },
    redirect: 'error', signal: AbortSignal.timeout(30000) });
  requireValue(response.ok);
  const rows = await response.json();
  requireValue(Array.isArray(rows));
  const days = new Map();
  for (const row of rows) {
    requireValue(Array.isArray(row) && row.length === 6 && row.every(Number.isFinite) &&
      Number.isSafeInteger(row[0]) && row[0] % 86400 === 0 && row[1] > 0 &&
      row[2] >= row[1] && row[3] >= row[1] && row[3] <= row[2] &&
      row[4] >= row[1] && row[4] <= row[2] && row[5] >= 0);
    const timestamp = row[0] * 1000;
    if (timestamp >= today || timestamp < today - 3 * 86400000) continue;
    requireValue(!days.has(timestamp));
    days.set(timestamp, row[4]);
  }
  const close = days.get(today - 86400000);
  requireValue(typeof close === 'number' && close > 0);
  return { value: { closeUsd: close, date: new Date(today - 86400000).toISOString().slice(0, 10) },
    observedAt: new Date(today).toISOString() };
}

export const ARCHIVAL_RPC = 'https://archival-rpc.mainnet.fastnear.com';
export const T3_END = '2026-11-02T00:00:00.000Z';
const COVERAGE_METHOD = 'Coverage = (net 1Click flow in USD + revenue-wallet NEAR change × latest close) ÷ (supply change × latest close). ' +
  'Wallet and supply changes run from the first block at or after the T3 end to the first block at or after the latest UTC midnight.';
const T3_REASON = 'Archival read at the T3 end failed; the baseline is retried next run.';

async function rpcBody(request, url, method, params) {
  const response = await request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'live', method, params }), redirect: 'error', signal: AbortSignal.timeout(30000) });
  requireValue(response.ok);
  return response.json();
}
async function headerAt(request, url, params) {
  const body = await rpcBody(request, url, 'block', params);
  if (body?.error) {
    requireValue(JSON.stringify(body.error).includes('UNKNOWN_BLOCK'));
    return null;
  }
  const h = body?.result?.header;
  requireValue(h && Number.isSafeInteger(h.height) && h.height > 0 &&
    typeof h.hash === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(h.hash));
  const timeMs = Number(unsigned(h.timestamp_nanosec) / 1000000n);
  requireValue(Number.isSafeInteger(timeMs));
  return { height: h.height, hash: h.hash, timeMs, totalSupply: unsigned(h.total_supply) };
}
// Heights can be skipped; returns the first produced block in [height, limit).
async function firstBlock(request, url, height, limit) {
  for (let h = height; h < limit; h++) {
    requireValue(h < height + 50);
    const found = await headerAt(request, url, { block_id: h });
    if (found) return found;
  }
  return null;
}
export async function blockAtOrAfter(request, url, targetMs) {
  const final = await headerAt(request, url, { finality: 'final' });
  requireValue(final && final.timeMs >= targetMs);
  let low = null;
  for (let span = Math.ceil((final.timeMs - targetMs) / 1000 * 3) + 100, i = 0; i < 6 && !low; i++, span *= 2) {
    const found = await firstBlock(request, url, Math.max(1, final.height - span), final.height);
    if (found && found.timeMs < targetMs) low = found;
  }
  requireValue(low);
  // Invariant: no produced block lies in [limit, best.height).
  let best = final, limit = final.height;
  while (limit - low.height > 1) {
    const mid = Math.floor((low.height + limit) / 2);
    const found = await firstBlock(request, url, mid, limit);
    if (!found) limit = mid;
    else if (found.timeMs >= targetMs) { best = found; limit = mid; }
    else low = found;
  }
  return best;
}
async function walletBalancesAt(request, url, hash) {
  const query = async params => {
    const body = await rpcBody(request, url, 'query', { ...params, block_id: hash });
    requireValue(!body?.error && body?.result && body.result.block_hash === hash && !body.result.error);
    return body.result;
  };
  const view = async (account_id, method_name, args) => {
    const result = await query({ request_type: 'call_function', account_id, method_name,
      args_base64: Buffer.from(JSON.stringify(args)).toString('base64') });
    requireValue(Array.isArray(result.result) && result.result.every(b => Number.isInteger(b) && b >= 0 && b <= 255));
    return near(unsigned(JSON.parse(Buffer.from(result.result).toString('utf8'))));
  };
  const out = [];
  for (const wallet of REVENUE_WALLETS) {
    const account = await query({ request_type: 'view_account', account_id: wallet });
    out.push({ wallet, ...balances({ nativeNear: near(unsigned(account.amount)),
      wrappedNear: await view('wrap.near', 'ft_balance_of', { account_id: wallet }),
      intentsNear: await view('intents.near', 'mt_balance_of', { account_id: wallet, token_id: 'nep141:wrap.near' }) }) });
  }
  return out;
}
async function snapshotAt(request, url, targetMs) {
  const found = await blockAtOrAfter(request, url, targetMs);
  return { block: { height: found.height, hash: found.hash, timeUtc: new Date(found.timeMs).toISOString() },
    totalSupplyNear: near(found.totalSupply), wallets: await walletBalancesAt(request, url, found.hash), source: { url } };
}
// Rebuilds a saved snapshot from validated fields only.
function savedSnapshot(value, url, targetMs) {
  requireValue(value?.status === 'ok' && value.source?.url === url);
  const b = block(value.block);
  requireValue(Date.parse(b.timeUtc) >= targetMs && units(value.totalSupplyNear) > 0n &&
    Array.isArray(value.wallets) && value.wallets.length === REVENUE_WALLETS.length);
  return { status: 'ok', block: b, totalSupplyNear: near(units(value.totalSupplyNear)),
    wallets: REVENUE_WALLETS.map((wallet, i) => {
      requireValue(value.wallets[i]?.wallet === wallet);
      return { wallet, ...balances(value.wallets[i]) };
    }), source: { url } };
}
const walletTotal = snapshot => snapshot.wallets.reduce((sum, w) => sum + units(w.totalNear), 0n);
const nearNumber = value => Number(units(value.replace(/^-/, ''))) / 1e24 * (value.startsWith('-') ? -1 : 1);

async function coverageSinceT3({ previous, request, asOf, flow, price }) {
  const old = previous?.coverageSinceT3;
  const t3Ms = Date.parse(T3_END), today = asOf.slice(0, 10), closeMs = Date.parse(today);
  const closeDate = new Date(closeMs - 86400000).toISOString().slice(0, 10);
  let baseline;
  try { baseline = savedSnapshot(old?.baseline, ARCHIVAL_RPC, t3Ms); }
  catch {
    try { baseline = { status: 'ok', ...await snapshotAt(request, ARCHIVAL_RPC, t3Ms) }; }
    catch { baseline = { status: 'unavailable', reason: T3_REASON }; }
  }
  let close;
  try {
    close = savedSnapshot(old?.close, old?.close?.source?.url === ARCHIVAL_RPC ? ARCHIVAL_RPC : NEAR_RPC, closeMs);
    requireValue(old.closeDate === closeDate && Date.parse(close.block.timeUtc) < closeMs + 3600000);
  } catch {
    close = null;
    for (const url of [NEAR_RPC, ARCHIVAL_RPC]) {
      try { close = { status: 'ok', ...await snapshotAt(request, url, closeMs) }; break; } catch { /* try the next host */ }
    }
    close ??= { status: 'unavailable', reason: 'Block reads at the latest close failed; retried next run.' };
  }
  const both = baseline.status === 'ok' && close.status === 'ok';
  const walletChange = both ? near(walletTotal(close) - walletTotal(baseline)) : null;
  const supplyChange = both ? near(units(close.totalSupplyNear) - units(baseline.totalSupplyNear)) : null;
  const priceOk = price.status === 'ok' && price.value?.date === closeDate;
  const flowOk = flow.value !== null && flow.through === closeDate;
  let coverage = null, reason = null;
  if (baseline.status !== 'ok') reason = baseline.reason;
  else if (close.status !== 'ok') reason = close.reason;
  else if (!flowOk) reason = flow.reason === 'pending' ? 'pending' : `Net 1Click flow is not recorded through ${closeDate}.`;
  else if (!priceOk) reason = `No NEAR-USD close for ${closeDate}.`;
  else if (units(supplyChange.replace(/^-/, '')) === 0n || supplyChange.startsWith('-')) reason = 'Supply did not rise; coverage is undefined.';
  else {
    const closeUsd = price.value.closeUsd;
    coverage = (Number(flow.value) + nearNumber(walletChange) * closeUsd) / (nearNumber(supplyChange) * closeUsd);
  }
  return { status: coverage === null ? 'unavailable' : 'ok', provisional: true, label: 'Provisional, not a locked test.',
    closeDate, netFlowUsd: flowOk ? flow.value : null, walletBalanceChangeNear: walletChange, supplyChangeNear: supplyChange,
    nearUsdClose: priceOk ? price.value.closeUsd : null, coverage, reason, method: COVERAGE_METHOD, baseline, close };
}

export function assertLivePrivacy(data) {
  const body = JSON.stringify(data).replaceAll(NEAR_RPC, '').replaceAll(PRICE_SOURCE, '')
    .replaceAll(ARCHIVAL_RPC, '').replaceAll(EXPLORER, '');
  requireValue(!/ed25519:|secp256k1:|public_key|account_id|args_base64/.test(body));
  requireValue(!/\b(?:0x[a-fA-F0-9]{40}|[a-fA-F0-9]{64})\b/.test(body));
  for (const account of body.match(/\b[a-z0-9][a-z0-9._-]*\.near\b/g) || []) {
    requireValue(REVENUE_WALLETS.includes(account));
  }
}

export async function buildLive({ baselineSupply, baselineWallets, previous = null,
  request = fetch, now = () => new Date(), jwt = null, pause = sleep, clock = Date.now }) {
  const asOf = now().toISOString();
  requireValue(Array.isArray(baselineSupply?.rows) && baselineSupply.rows.length === 52);
  const rows = [...baselineSupply.rows].sort((a, b) => a.week_start.localeCompare(b.week_start));
  requireValue(rows.at(-1).week_start === '2026-10-26');
  const t3Supply = near(scientificInteger(rows.at(-1).closing_supply_yocto));
  requireValue(units(t3Supply) > 0n);
  const baselineBlock = block(baselineWallets?.block);
  const baseBalances = REVENUE_WALLETS.map(wallet => {
    const matches = baselineWallets.wallets.filter(row => row.wallet === wallet);
    requireValue(matches.length === 1);
    const row = matches[0];
    requireValue(['nativeNear', 'wrapNear', 'intentsNear'].every(key => row[key]?.status === 'ok'));
    return balances({ nativeNear: row.nativeNear.value, wrappedNear: row.wrapNear.value, intentsNear: row.intentsNear.value });
  });
  const pricePromise = latestClose(request, asOf).catch(() => null);
  let header, controls;
  try {
    controls = await fetchWalletControls({ now, request: async (url, init) => {
      const response = await request(url, init);
      if (url === NEAR_RPC && JSON.parse(init.body).method === 'block') {
        const body = await response.json();
        header = body?.result?.header;
        return { ok: response.ok, status: response.status, json: async () => body };
      }
      return response;
    } });
  } catch { /* Keep independent last-good measurements, never remote error text. */ }
  const currentBlock = controls ? block(controls.block) : null;
  const candidate = value => currentBlock ? { value, observedAt: currentBlock.timeUtc, block: currentBlock } : null;
  const finalBlock = measurement(candidate(currentBlock), previous?.finalBlock, blockSource, block);
  let supply;
  try {
    requireValue(currentBlock && unsigned(header.total_supply) > 0n);
    supply = candidate(near(unsigned(header.total_supply)));
  } catch { supply = null; }
  const totalSupplyNear = measurement(supply, previous?.totalSupplyNear, blockSource, value => {
    requireValue(units(value) > 0n);
    return near(units(value));
  });
  const wallets = REVENUE_WALLETS.map((wallet, index) => {
    const row = controls?.wallets.find(entry => entry.wallet === wallet);
    const complete = row && ['nativeNear', 'wrapNear', 'intentsNear'].every(key => row[key]?.status === 'ok');
    const old = previous?.wallets?.find(entry => entry.wallet === wallet);
    const current = measurement(complete ? candidate({ nativeNear: row.nativeNear.value,
      wrappedNear: row.wrapNear.value, intentsNear: row.intentsNear.value }) : null,
    old?.balances, walletSource, balances);
    return { wallet, balances: current,
      changeSinceBaseline: difference(current, baseBalances[index],
        { current: 'balances', baseline: 'data/public/wallet-controls.json', baselineBlock }, true) };
  });
  const price = measurement(await pricePromise, previous?.nearUsdClose, priceSource, value => {
    requireValue(value && typeof value.closeUsd === 'number' && Number.isFinite(value.closeUsd) && value.closeUsd > 0 &&
      typeof value.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.date) &&
      new Date(value.date).toISOString().slice(0, 10) === value.date);
    return { closeUsd: value.closeUsd, date: value.date };
  });
  const net1ClickFlow = await updateFlow({ previous: previous?.net1ClickFlow, jwt, request, now, pause, clock });
  const coverage = await coverageSinceT3({ previous, request, asOf, flow: net1ClickFlow, price });
  const data = { version: 1, asOf: now().toISOString(), finalBlock, totalSupplyNear,
    supplyChangeSinceT3: difference(totalSupplyNear, t3Supply,
      { current: 'totalSupplyNear', baseline: 'data/public/bigquery/supply.json', endExclusive: '2026-11-02' }),
    nearUsdClose: price, wallets, net1ClickFlow, coverageSinceT3: coverage,
    baselines: { t3SupplyNear: t3Supply, t3EndExclusive: '2026-11-02', walletBlock: baselineBlock },
    notes: [
      'Balance and supply changes describe holdings, not net buying or revenue.',
      'Coverage since the T3 end is provisional and is not a locked test. Only daily aggregates are stored; swap addresses never leave memory.',
      'Native balances include storage reserve and exclude locked stake. Wallet totals add native, wrapped and Intents NEAR.',
      'All three wallet balance components must succeed together; otherwise the last complete wallet snapshot is stale.',
      'T3 closing supply comes from rounded FLOAT64 research data; its precision limits the reported supply change.'
    ] };
  assertLivePrivacy(data);
  return data;
}

export async function writeLive({ root = ROOT, request = fetch, now = () => new Date(), jwt = null, pause, clock } = {}) {
  const manifest = JSON.parse(await readFile(resolve(root, 'data/public/manifest.json'), 'utf8'));
  const verified = async (name, path) => {
    const body = await readFile(resolve(root, path), 'utf8');
    requireValue(manifest.files[name]?.path === path && manifest.files[name].sha256 === hash(body));
    return JSON.parse(body);
  };
  const baselineSupply = await verified('supply', 'data/public/bigquery/supply.json');
  const baselineWallets = await verified('wallet_controls', 'data/public/wallet-controls.json');
  const path = resolve(root, 'dashboard/live.json');
  let previous = null;
  try { previous = JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('Existing live snapshot is unreadable; refusing to overwrite it.'); }
  const data = await buildLive({ baselineSupply, baselineWallets, previous, request, now, jwt, pause, clock });
  await atomic(path, JSON.stringify(data, null, 2) + '\n');
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  environment().then(env => writeLive({ jwt: env.NEAR_INTENTS_JWT || null }))
    .then(data => console.log(`Updated dashboard/live.json: flow ${data.net1ClickFlow.status}, coverage ${data.coverageSinceT3.status}.`))
    .catch(() => { console.error('Live update stopped; existing file preserved.'); process.exitCode = 1; });
}
