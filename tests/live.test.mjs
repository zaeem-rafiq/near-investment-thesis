import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, cp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { buildLive, writeLive, assertLivePrivacy } from '../scripts/live.mjs';
import { REVENUE_WALLETS } from '../scripts/wallet-controls.mjs';
import { NEAR_RPC } from '../scripts/staking.mjs';
import { ROOT, PRICE_SOURCE } from '../scripts/sources.mjs';

const now = () => new Date('2026-11-09T21:00:00Z');
const scale = 10n ** 24n;
const header = { height: 12345, hash: '11111111111111111111111111111111',
  timestamp_nanosec: '1794225600000000000', total_supply: (2000n * scale + 1n).toString() };
const baselineSupply = { rows: Array.from({ length: 52 }, (_, index) => ({
  week_start: new Date(Date.parse('2025-11-03') + index * 7 * 86400000).toISOString().slice(0, 10),
  closing_supply_yocto: '1e+27'
})) };
const baselineWallets = { block: { height: 1, hash: header.hash, timeUtc: '2026-11-08T12:00:00.000Z' },
  wallets: REVENUE_WALLETS.map(wallet => ({ wallet, nativeNear: { status: 'ok', value: '1' },
    wrapNear: { status: 'ok', value: '2' }, intentsNear: { status: 'ok', value: '3' } })) };
const encoded = value => [...Buffer.from(JSON.stringify(value))];
const response = result => ({ ok: true, status: 200, json: async () => ({ result }) });
const mock = ({ failPrice = false, failRpc = false, change = () => {}, candle = null, native = 10n } = {}) =>
  async (url, init) => {
    assert.equal(init.redirect, 'error');
    assert.ok(init.signal instanceof AbortSignal);
    if (url.startsWith(PRICE_SOURCE)) {
      assert.equal(new URL(url).searchParams.get('granularity'), '86400');
      if (failPrice) throw Error('PRIVATE_MEMBER.near ed25519:PRIVATE_KEY');
      return { ok: true, json: async () => candle || [
        [Date.parse('2026-11-09') / 1000, 1, 999, 4, 999, 10],
        [Date.parse('2026-11-08') / 1000, 4, 5, 4.1, 4.2, 100]
      ] };
    }
    assert.equal(url, NEAR_RPC);
    assert.equal(init.method, 'POST');
    if (failRpc) throw Error('PRIVATE_MEMBER.near ed25519:PRIVATE_KEY');
    const { method, params } = JSON.parse(init.body);
    if (method === 'block') {
      assert.deepEqual(params, { finality: 'final' });
      const result = { header: { ...header }, ignored: 'PRIVATE_MEMBER.near' };
      change(result, params, method);
      return response(result);
    }
    assert.equal(params.block_id, header.hash);
    const result = { block_height: header.height, block_hash: header.hash };
    if (params.request_type === 'view_account') Object.assign(result, {
      amount: (native * scale + 1n).toString(), code_hash: header.hash, locked: '0',
      ignored: 'PRIVATE_MEMBER.near'
    });
    else if (params.request_type === 'view_access_key_list') result.keys = [
      { public_key: 'ed25519:PRIVATE_KEY', access_key: { permission: 'FullAccess' } }
    ];
    else if (params.method_name === 'ft_balance_of') result.result = encoded((20n * scale).toString());
    else if (params.method_name === 'mt_balance_of') result.result = encoded((30n * scale).toString());
    else if (params.method_name === 'get_policy') result.result = encoded({
      roles: [], default_vote_policy: { weight_kind: 'RoleWeight', quorum: '0', threshold: '1' }
    });
    else if (params.method_name === 'get_num_confirmations') result.result = encoded(2);
    else result.error = 'MethodNotFound PRIVATE_MEMBER.near';
    change(result, params, method);
    return response(result);
  };
const build = options => buildLive({ baselineSupply, baselineWallets, now, request: mock(), ...options });

test('live success uses one finalized block, exact supply and wallet deltas, and only the latest completed close', async () => {
  const data = await build();
  assert.equal(data.asOf, now().toISOString());
  assert.equal(data.finalBlock.status, 'ok');
  assert.equal(data.finalBlock.value.height, header.height);
  assert.equal(data.totalSupplyNear.value, '2000.000000000000000000000001');
  assert.equal(data.supplyChangeSinceT3.value, '1000.000000000000000000000001');
  assert.deepEqual(data.nearUsdClose.value, { closeUsd: 4.2, date: '2026-11-08' });
  assert.equal(data.nearUsdClose.source.url, PRICE_SOURCE);
  for (const row of data.wallets) {
    assert.equal(row.balances.status, 'ok');
    assert.equal(row.balances.block.height, header.height);
    assert.deepEqual(row.balances.value, { nativeNear: '10.000000000000000000000001',
      wrappedNear: '20', intentsNear: '30', totalNear: '60.000000000000000000000001' });
    assert.deepEqual(row.changeSinceBaseline.value, { nativeNear: '9.000000000000000000000001',
      wrappedNear: '18', intentsNear: '27', totalNear: '54.000000000000000000000001' });
  }
  assert.deepEqual(data.net1ClickFlow, { value: null, status: 'pending', reason: 'pending', source: null });
  assert.doesNotMatch(JSON.stringify(data), /PRIVATE_MEMBER|PRIVATE_KEY|wrap\.near|intents\.near|public_key|account_id/);
});
test('one failed balance keeps the whole last-good wallet snapshot while other values update', async () => {
  const previous = await build();
  const data = await build({ previous, request: mock({ native: 100n, change: (result, params) => {
    if (params.method_name === 'ft_balance_of') {
      const args = JSON.parse(Buffer.from(params.args_base64, 'base64'));
      if (args.account_id === REVENUE_WALLETS[0]) result.error = 'PRIVATE_MEMBER.near';
    }
  } }) });
  assert.equal(data.wallets[0].balances.status, 'stale');
  assert.deepEqual(data.wallets[0].balances.value, previous.wallets[0].balances.value);
  assert.deepEqual(data.wallets[0].changeSinceBaseline.value, previous.wallets[0].changeSinceBaseline.value);
  assert.equal(data.wallets[1].balances.status, 'ok');
  assert.equal(data.wallets[1].balances.value.nativeNear, '100.000000000000000000000001');
  assert.equal(data.totalSupplyNear.status, 'ok');
  assert.equal(data.nearUsdClose.status, 'ok');
  assert.doesNotMatch(JSON.stringify(data), /PRIVATE_MEMBER/);
});
test('price failure and repeated RPC failures retain last-good values and original observation times, then recover', async () => {
  const previous = await build();
  const priceFailed = await build({ previous, request: mock({ failPrice: true }) });
  assert.equal(priceFailed.nearUsdClose.status, 'stale');
  assert.deepEqual(priceFailed.nearUsdClose.value, previous.nearUsdClose.value);
  assert.equal(priceFailed.totalSupplyNear.status, 'ok');
  let old = previous;
  for (let index = 0; index < 2; index++) {
    const data = await build({ previous: old, request: mock({ failRpc: true }) });
    for (const key of ['finalBlock', 'totalSupplyNear', 'supplyChangeSinceT3']) {
      assert.equal(data[key].status, 'stale');
      assert.deepEqual(data[key].value, previous[key].value);
      assert.equal(data[key].observedAt, previous[key].observedAt);
    }
    assert.equal(data.nearUsdClose.status, 'ok');
    assert.ok(data.wallets.every(w => w.balances.status === 'stale'));
    old = data;
  }
  const recovered = await build({ previous: old });
  assert.equal(recovered.totalSupplyNear.status, 'ok');
  assert.ok(recovered.wallets.every(w => w.balances.status === 'ok'));
  const firstFailure = await build({ request: mock({ failRpc: true, failPrice: true }) });
  assert.equal(firstFailure.totalSupplyNear.status, 'unavailable');
  assert.equal(firstFailure.totalSupplyNear.value, null);
  assert.ok(firstFailure.wallets.every(w => w.balances.value === null && w.changeSinceBaseline.value === null));
});
test('malformed supply, price, balance and wrong-block responses cannot overwrite good measurements', async () => {
  const previous = await build();
  for (const total_supply of ['-1', '1.2', 100, null, '0', 'PRIVATE_MEMBER.near']) {
    const data = await build({ previous, request: mock({ change: (result, params, method) => {
      if (method === 'block') result.header.total_supply = total_supply;
    } }) });
    assert.equal(data.totalSupplyNear.status, 'stale');
    assert.equal(data.totalSupplyNear.value, previous.totalSupplyNear.value);
    assert.equal(data.supplyChangeSinceT3.value, previous.supplyChangeSinceT3.value);
  }
  for (const close of [-1, 0, Infinity, NaN, '4.2', null]) {
    const data = await build({ previous, request: mock({ candle: [
      [Date.parse('2026-11-08') / 1000, 1, 10, 4, close, 1]
    ] }) });
    assert.equal(data.nearUsdClose.status, 'stale');
    assert.equal(data.nearUsdClose.value.closeUsd, 4.2);
  }
  for (const change of [
    (result, params) => { if (params.method_name === 'mt_balance_of') result.result = encoded('1.5'); },
    (result, params) => { if (params.request_type === 'view_account') result.block_height++; }
  ]) {
    const data = await build({ previous, request: mock({ change }) });
    assert.ok(data.wallets.every(w => w.balances.status === 'stale'));
    assert.deepEqual(data.wallets.map(w => w.balances.value), previous.wallets.map(w => w.balances.value));
  }
});
test('only the three named wallets may appear, including when carrying previous values forward', async () => {
  const previous = await build();
  assertLivePrivacy(previous);
  for (const attack of ['private-member.near', 'wrap.near', 'intents.near', 'a'.repeat(64),
    '0x' + 'a'.repeat(40), 'ed25519:PRIVATE_KEY']) {
    assert.throws(() => assertLivePrivacy({ ...previous, attack }));
  }
  previous.notes.push('private-member.near');
  previous.wallets[0].balances.source = { leaked: 'ed25519:PRIVATE_KEY' };
  const data = await build({ previous, request: mock({ failRpc: true }) });
  assert.doesNotMatch(JSON.stringify(data), /private-member|PRIVATE_KEY/);
});
test('live writer uses verified public baselines only, writes complete JSON atomically, and preserves corrupt prior files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'near-live-write-'));
  try {
    await cp(join(ROOT, 'data/public'), join(root, 'data/public'), { recursive: true });
    await writeFile(join(root, '.env'), 'INVALID ENV SYNTAX MUST NOT BE READ');
    const data = await writeLive({ root, request: mock(), now });
    const path = join(root, 'dashboard/live.json');
    assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), data);
    await writeFile(path, 'not JSON');
    await assert.rejects(writeLive({ root, request: mock(), now }), /refusing to overwrite/);
    assert.equal(await readFile(path, 'utf8'), 'not JSON');
    await rm(path);
    await writeFile(join(root, 'data/public/bigquery/supply.json'), '{}');
    await assert.rejects(writeLive({ root, request: mock(), now }), /Invalid live source/);
    await assert.rejects(readFile(path), { code: 'ENOENT' });
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('real offline rebuild neither reads, creates nor deletes live.json', async () => {
  const root = await mkdtemp(join(tmpdir(), 'near-live-rebuild-'));
  try {
    for (const path of ['scripts', 'sql', 'web', 'data/public', 'THESIS.md', 'package.json']) {
      await cp(join(ROOT, path), join(root, path), { recursive: true });
    }
    const guard = join(root, 'no-network.cjs');
    await writeFile(guard, "globalThis.fetch = () => { throw Error('Network forbidden'); }; require('node:net').Socket.prototype.connect = () => { throw Error('Network forbidden'); };");
    const rebuild = () => spawnSync(process.execPath, ['scripts/run.mjs', 'build'], {
      cwd: root, encoding: 'utf8', timeout: 15000, env: { ...process.env, NODE_OPTIONS: `--require=${guard}` }
    });
    let result = rebuild();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const path = join(root, 'dashboard/live.json');
    await assert.rejects(readFile(path), { code: 'ENOENT' });
    const sentinel = 'INVALID JSON: live.json must never be read by rebuild';
    await writeFile(path, sentinel);
    result = rebuild();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(path, 'utf8'), sentinel);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('supply and native balance changes can be negative without rounding or clamping', async () => {
  const data = await build({ request: mock({ native: 0n, change: (result, params, method) => {
    if (method === 'block') result.header.total_supply = (999n * scale).toString();
  } }) });
  assert.equal(data.supplyChangeSinceT3.value, '-1');
  assert.equal(data.wallets[0].changeSinceBaseline.value.nativeNear, '-0.999999999999999999999999');
});
test('workflow is daily/manual and scoped to one file without changing Git identity or pushing', async () => {
  const workflow = await readFile(join(ROOT, '.github/workflows/live.yml'), 'utf8');
  assert.match(workflow, /cron: '17 6 \* \* \*'/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /github\.ref == format/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /run: node scripts\/live\.mjs/);
  assert.match(workflow, /const path = 'dashboard\/live\.json'/);
  assert.match(workflow, /Buffer\.from\(remote\.content, 'base64'\)\.equals\(content\)/);
  assert.match(workflow, /remote\?\.sha \?\? null/);
  assert.match(workflow, /method: 'PUT'/);
  assert.doesNotMatch(workflow, /git push|git config|GIT_AUTHOR_|GIT_COMMITTER_|npm run refresh|pull-swaps|pull-near-participants/);
});
test('asOf records completion rather than the start of a multi-request update', async () => {
  let tick = 0, last;
  const clock = () => {
    last = new Date(Date.parse('2026-11-09T21:00:00Z') + tick++ * 1000);
    return last;
  };
  const data = await build({ now: clock });
  assert.equal(data.asOf, last.toISOString());
});
