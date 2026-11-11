import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, hash } from './sources.mjs';
import { atomic } from './store.mjs';
import { loadParticipantSwaps, finalKeep, usd, assertAggregateOnly } from './position-results.mjs';

// An exact balance at a known block could single out an account: publish 0.01 NEAR and no block height.
export const publicBalance = b => b.status === 'ok' && Number.isFinite(b.near)
  ? { status: 'ok', near: Math.round(b.near * 100) / 100 } : { status: b.status, near: null };

// Identifiers exist only in this private in-memory map, never in the returned object.
export async function buyerProfiles(rows, balanceOf) {
  const accounts = new Map();
  for (const r of rows.filter(finalKeep)) {
    if (r.units == null) continue;
    const id = r.side === 'buy' ? r.recipient : r.senders[0] ?? r.refundTo;
    if (!id) continue;
    if (!accounts.has(id)) accounts.set(id, { bought: 0n, sold: 0n, swaps: 0, weeks: new Set(), zec: 0n, rally: 0n });
    const a = accounts.get(id);
    if (r.side === 'sell') { a.sold += r.units; continue; }
    a.bought += r.units; a.swaps++; a.weeks.add(r.week);
    if (r.originAsset === 'nep141:zec.omft.near') a.zec += r.units;
    if (r.day >= '2026-05-22' && r.day < '2026-05-28') a.rally += r.units;
  }
  const top = [...accounts].filter(([, a]) => a.bought > a.sold)
    .sort(([, a], [, b]) => a.bought - a.sold > b.bought - b.sold ? -1
      : a.bought - a.sold < b.bought - b.sold ? 1 : 0).slice(0, 3);
  const profiles = [];
  for (const [id, a] of top) profiles.push({
    rank: profiles.length + 1,
    kind: /^[0-9a-f]{64}$/.test(id) ? '64-hex implicit' : /^0x[0-9a-fA-F]{40}$/.test(id) ? '0x' : 'named',
    boughtUsd: usd(a.bought), soldUsd: usd(a.sold), netUsd: usd(a.bought - a.sold),
    buySwaps: a.swaps, activeBuyWeeks: a.weeks.size,
    zecPaidUsdShare: Number(a.zec) / Number(a.bought),
    may22Through27UsdShare: Number(a.rally) / Number(a.bought),
    nativeBalance: publicBalance(await balanceOf(id))
  });
  assertAggregateOnly(profiles);
  return profiles;
}

export async function rpcBalance(id, request = fetch) {
  try {
    const response = await request('https://rpc.mainnet.near.org', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, redirect: 'error',
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({ jsonrpc: '2.0', id: 'balance', method: 'query',
        params: { request_type: 'view_account', finality: 'final', account_id: id } })
    });
    if (!response.ok) throw new Error();
    const { result, error } = await response.json();
    if (error?.cause?.name === 'UNKNOWN_ACCOUNT') return { status: 'unknown_account', near: null };
    if (!/^\d+$/.test(result?.amount) || !Number.isSafeInteger(result.block_height)) throw new Error();
    return { status: 'ok', near: Number(BigInt(result.amount)) / 1e24, blockHeight: result.block_height };
  } catch { throw new Error('Buyer balance RPC failed; private details omitted.'); }
}

export async function exportBuyerProfiles({ root = ROOT, rows, balanceOf = rpcBalance } = {}) {
  const profiles = await buyerProfiles(rows ?? (await loadParticipantSwaps(root)).rows, balanceOf);
  if (profiles.length !== 3) throw new Error('Expected three net buyers.');
  const data = { version: 1, observedAt: new Date().toISOString(),
    balanceSource: 'https://rpc.mainnet.near.org', balanceMethod: 'view_account, final',
    window: { start: '2025-11-03', endExclusive: '2026-11-02' },
    notes: [
      'After-the-fact description; changes no check. Rank by Check 1 final net USD.',
      'Buyer = recipient; seller = first sender, else refundTo. Missing USD excluded.',
      'Payment and May 22 through May 27 shares are USD-weighted buys; active weeks are UTC Monday buy weeks.',
      'ZEC origin asset is the public ZEC bridged-token contract. Balances are native NEAR only, rounded to 0.01 NEAR, not token balances or proof of retention.',
      'Account identifiers remain private. These data cannot identify exchanges, market makers or long-term buyers.'
    ], profiles };
  assertAggregateOnly(data);
  const body = JSON.stringify(data, null, 2) + '\n', path = 'data/public/buyer-profiles.json';
  const manifestPath = resolve(root, 'data/public/manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.files.buyer_profiles = { path, sha256: hash(body) };
  await atomic(resolve(root, path), body);
  await atomic(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv[2] !== 'export') throw new Error();
    console.log(JSON.stringify(await exportBuyerProfiles(), null, 2));
  } catch { console.error('Buyer aggregate export failed; private details omitted.'); process.exitCode = 1; }
}
