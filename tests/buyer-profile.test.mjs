import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ROOT } from '../scripts/sources.mjs';
import { normalizeSwaps } from '../scripts/position-results.mjs';
import { buyerProfiles, rpcBalance, exportBuyerProfiles } from '../scripts/buyer-profile.mjs';
import { loadPositionEvidence } from '../scripts/position-evidence.mjs';

const NEAR = 'nep141:wrap.near', ZEC = 'nep141:zec.omft.near', USDC = 'other:usdc';
const A = 'a'.repeat(64), B = '0x' + 'b'.repeat(40), C = 'carol.near', FE = 'fefundsadmin.sputnik-dao.near';
let n = 0;
const swap = (side, usd, at, { recipient, senders = [], refundTo = null, origin } = {}) => ({
  depositAddress: `d${n++}`, depositMemo: null, createdAt: at, status: 'SUCCESS',
  originAsset: side === 'buy' ? origin ?? USDC : NEAR, destinationAsset: side === 'buy' ? NEAR : USDC,
  amountInUsd: usd, recipient, senders, refundTo
});
const rows = () => normalizeSwaps([
  swap('buy', '60', '2026-05-22T01:00:00Z', { recipient: A, origin: ZEC }),
  swap('buy', '40', '2026-05-28T00:00:00Z', { recipient: A }),
  swap('buy', '50', '2026-03-04T00:00:00Z', { recipient: B }),
  swap('buy', '30', '2026-03-11T00:00:00Z', { recipient: B }),
  swap('sell', '20', '2026-03-12T00:00:00Z', { senders: [B] }),
  swap('buy', '10', '2026-04-01T00:00:00Z', { recipient: C }),
  swap('sell', '5', '2026-04-02T00:00:00Z', { senders: [], refundTo: C }),
  swap('buy', '999', '2026-04-01T00:00:00Z', { recipient: FE }),
  swap('buy', '1', '2026-04-01T00:00:00Z', { recipient: 'tiny.near' })
]).rows;

test('buyer profiles rank Check 1 final net buyers and publish only rank-level aggregates', async () => {
  const seen = [];
  const p = await buyerProfiles(rows(), async id => { seen.push(id); return { status: 'ok', near: 3.0471, blockHeight: 1 }; });
  assert.deepEqual(seen, [A, B, C], 'revenue wallets are excluded and ranking is by net USD');
  assert.deepEqual(p.map(x => x.kind), ['64-hex implicit', '0x', 'named']);
  assert.deepEqual(p.map(x => x.netUsd), [100, 60, 5]);
  assert.equal(p[0].zecPaidUsdShare, 0.6);
  assert.equal(p[0].may22Through27UsdShare, 0.6, 'May 28 lies outside the window');
  assert.equal(p[0].activeBuyWeeks, 2);
  assert.equal(p[1].soldUsd, 20);
  assert.equal(p[2].soldUsd, 5, 'refundTo stands in when a sell has no sender');
  // An exact balance with its block height could single out the account; publish 0.01 NEAR and no height.
  assert.deepEqual(p[0].nativeBalance, { status: 'ok', near: 3.05 });
  const text = JSON.stringify(p);
  for (const id of [A, B, C]) assert.ok(!text.includes(id));
});

test('balance lookup reports unknown accounts and hides RPC failure details', async () => {
  const reply = body => async () => ({ ok: true, json: async () => body });
  assert.deepEqual(await rpcBalance(A, reply({ error: { cause: { name: 'UNKNOWN_ACCOUNT' } } })), { status: 'unknown_account', near: null });
  assert.deepEqual(await rpcBalance(A, reply({ result: { amount: '3000000000000000000000000', block_height: 7 } })),
    { status: 'ok', near: 3, blockHeight: 7 });
  await assert.rejects(rpcBalance(A, reply({ error: { cause: { name: 'TIMEOUT', info: A } } })), e => !e.message.includes(A));
});

test('buyer export registers its hash and the evidence loader verifies it', async () => {
  const root = await mkdtemp(join(tmpdir(), 'near-buyers-'));
  try {
    await mkdir(join(root, 'data/public'), { recursive: true });
    await writeFile(join(root, 'data/public/manifest.json'), JSON.stringify({ files: {} }));
    await exportBuyerProfiles({ root, rows: rows(), balanceOf: async () => ({ status: 'unknown_account', near: null }) });
    const manifest = JSON.parse(await readFile(join(root, 'data/public/manifest.json'), 'utf8'));
    const body = await readFile(join(root, manifest.files.buyer_profiles.path), 'utf8');
    assert.equal(manifest.files.buyer_profiles.sha256, createHash('sha256').update(body).digest('hex'));
    for (const id of [A, B, C]) assert.ok(!body.includes(id));
  } finally { await rm(root, { recursive: true, force: true }); }
  const real = JSON.parse(await readFile(join(ROOT, 'data/public/manifest.json'), 'utf8'));
  const bad = structuredClone(real);
  bad.files.buyer_profiles.sha256 = 'bad';
  await assert.rejects(loadPositionEvidence(bad), /hash mismatch: buyer_profiles/);
  const evidence = await loadPositionEvidence(real);
  const c = evidence.results.descriptive.concentration;
  const top3 = evidence.buyers.profiles.reduce((s, b) => s + b.netUsd, 0);
  for (const b of evidence.buyers.profiles) {
    assert.ok(!Object.hasOwn(b.nativeBalance, 'blockHeight'), 'no block height is published');
    if (b.nativeBalance.near != null) assert.equal(b.nativeBalance.near, Math.round(b.nativeBalance.near * 100) / 100);
  }
  assert.ok(Math.abs(top3 - (c.netUsd - c.withoutTopNetBuyers['3'].netUsd)) < 0.01, 'top three match the concentration cut');
});
