import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, PRICE_SOURCE, hash } from './sources.mjs';
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

export function assertLivePrivacy(data) {
  const body = JSON.stringify(data).replaceAll(NEAR_RPC, '').replaceAll(PRICE_SOURCE, '');
  requireValue(!/ed25519:|secp256k1:|public_key|account_id|args_base64/.test(body));
  requireValue(!/\b(?:0x[a-fA-F0-9]{40}|[a-fA-F0-9]{64})\b/.test(body));
  for (const account of body.match(/\b[a-z0-9][a-z0-9._-]*\.near\b/g) || []) {
    requireValue(REVENUE_WALLETS.includes(account));
  }
}

export async function buildLive({ baselineSupply, baselineWallets, previous = null,
  request = fetch, now = () => new Date() }) {
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
  const data = { version: 1, asOf: now().toISOString(), finalBlock, totalSupplyNear,
    supplyChangeSinceT3: difference(totalSupplyNear, t3Supply,
      { current: 'totalSupplyNear', baseline: 'data/public/bigquery/supply.json', endExclusive: '2026-11-02' }),
    nearUsdClose: price, wallets, net1ClickFlow: { value: null, status: 'pending', reason: 'pending', source: null },
    baselines: { t3SupplyNear: t3Supply, t3EndExclusive: '2026-11-02', walletBlock: baselineBlock },
    notes: [
      'Changes describe balances and supply, not net buying or revenue. Net 1Click flow is pending.',
      'Native balances include storage reserve and exclude locked stake. Wallet totals add native, wrapped and Intents NEAR.',
      'All three wallet balance components must succeed together; otherwise the last complete wallet snapshot is stale.',
      'T3 closing supply comes from rounded FLOAT64 research data; its precision limits the reported supply change.'
    ] };
  assertLivePrivacy(data);
  return data;
}

export async function writeLive({ root = ROOT, request = fetch, now = () => new Date() } = {}) {
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
  const data = await buildLive({ baselineSupply, baselineWallets, previous, request, now });
  await atomic(path, JSON.stringify(data, null, 2) + '\n');
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  writeLive().then(() => console.log('Updated dashboard/live.json from public sources.'))
    .catch(() => { console.error('Live update stopped; existing file preserved.'); process.exitCode = 1; });
}
