import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, hash } from '../scripts/sources.mjs';
import { PEER_RAW, PEER_WINDOW, candidates, ranked, windowSum, pull, buildPeers, verifyPeers, peerMetricValues } from '../scripts/peers.mjs';

// Synthetic fixtures only; never DefiLlama data.
const day = d => Date.parse(d + 'T00:00:00Z') / 1000;
const daily = (value = 1, skip = null) => {
  const out = [];
  for (let t = day(PEER_WINDOW.start); t <= day(PEER_WINDOW.end); t += 86400) if (t !== skip) out.push([t, value]);
  return { totalDataChart: [[day('2025-11-02'), 99], ...out, [day('2026-11-02'), 99]] };
};
const record = (url, body) => ({ url, method: 'GET', requestBody: null, retrievedAt: '2026-11-10T00:00:00.000Z', status: 200, body: JSON.stringify(body) });

test('window sums need one finite value on each of the 364 days, inclusive of both ends', () => {
  assert.deepEqual(windowSum(daily(2)), { complete: true, days: 364, sumUsd: 728 });
  assert.equal(windowSum(daily(0)).sumUsd, 0);
  assert.equal(windowSum(daily(1, day(PEER_WINDOW.end))).complete, false);
  const dup = daily(); dup.totalDataChart.push([day('2026-01-01'), 1]);
  assert.equal(windowSum(dup).complete, false);
});
test('candidates need a chain record whose geckoId equals its gas token, and rank by market cap', () => {
  const config = { chainCoingeckoIds: { A: { geckoId: 'a', gasTokenGeckoId: 'a' }, L2: { geckoId: 'l2', gasTokenGeckoId: 'ethereum' }, N: { gasTokenGeckoId: 'n' } } };
  const overview = { protocols: [{ name: 'A', slug: 'a', category: 'Chain' }, { name: 'L2', slug: 'l2', category: 'Chain' },
    { name: 'N', slug: 'n', category: 'Chain' }, { name: 'X', slug: 'x', category: 'Chain' }, { name: 'D', slug: 'd', category: 'Dexs' }] };
  const c = candidates(config, overview);
  assert.deepEqual(c.list.map(x => x.slug), ['a']);
  assert.deepEqual(c.unmatched, ['X']);
  assert.deepEqual(ranked([{ geckoId: 'a' }, { geckoId: 'b' }, { geckoId: 'c' }], { 'coingecko:a': { mcap: 1 }, 'coingecko:b': { mcap: 3 } }).map(x => x.geckoId), ['b', 'a']);
});
test('peer picks skip an incomplete series on the same side and read only saved responses', async () => {
  const root = await mkdtemp(join(tmpdir(), 'near-peers-test-'));
  try {
    const dir = join(root, PEER_RAW);
    await mkdir(dir, { recursive: true });
    const chains = { up2: 5, up1: 4, near: 3, down1: 2, down2: 1 };
    const config = { chainCoingeckoIds: Object.fromEntries(Object.keys(chains).map(k => [k, { geckoId: k, gasTokenGeckoId: k }])) };
    const overview = { protocols: Object.keys(chains).map(k => ({ name: k, displayName: k.toUpperCase(), slug: k, category: 'Chain' })) };
    const mcaps = Object.fromEntries(Object.entries(chains).map(([k, v]) => [`coingecko:${k}`, { mcap: v * 1e9, timestamp: 1794274083 }]));
    const files = { config, overview, mcaps, intents: daily(5), 'revenue-near': daily(1), 'revenue-up1': daily(1, day('2026-03-01')),
      'revenue-up2': daily(2), 'revenue-down1': daily(0) };
    for (const [n, b] of Object.entries(files)) await writeFile(join(dir, `${n}.json`), JSON.stringify(record(`https://example.invalid/${n}`, b)));
    const never = () => { throw new Error('network'); };
    assert.equal((await pull('config', 'https://example.invalid/config', { root, request: never })).url, 'https://example.invalid/config');
    const p = verifyPeers(await buildPeers(root));
    assert.deepEqual(p.rows.map(r => r.slug), ['up2', 'near', 'down1']);
    assert.deepEqual(p.skipped, { above: ['up1'], below: [] });
    assert.equal(p.requests.find(r => r.name === 'config').sha256, hash(JSON.stringify(config)));
    const v = peerMetricValues(p);
    assert.equal(v['peers.below.multiple'], 'Not defined, zero revenue');
    assert.equal(v['peers.near.multiple'], '8,241,758×');
    assert.equal(v['peers.nearWithIntents.revenueUsd'], '2,184');
    assert.throws(() => verifyPeers({ ...p, official: true }), /addendum 3/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('saved peer table is unofficial, pinned and changes no position result', async () => {
  const p = JSON.parse(await readFile(join(ROOT, 'data/public/peers.json'), 'utf8'));
  verifyPeers(p);
  assert.ok(p.requests.every(r => /^https:\/\/(api|coins)\.llama\.fi\//.test(r.url) && r.retrievedAt && /^[0-9a-f]{64}$/.test(r.sha256)));
  assert.ok(p.requests.every(r => r.retrievedAt > '2026-11-10T01:27:03Z'), 'peer pull follows the addendum 3 proof commit');
  const results = JSON.parse(await readFile(join(ROOT, 'data/public/position-results.json'), 'utf8'));
  assert.equal(JSON.stringify(results).includes('peers'), false);
});
