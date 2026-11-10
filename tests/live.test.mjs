import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, cp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { buildLive, writeLive, assertLivePrivacy, ARCHIVAL_RPC } from '../scripts/live.mjs';
import { NEAR_ASSET_IDS } from '../scripts/position-config.mjs';
import { EXPLORER } from '../scripts/sources.mjs';
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
  assert.equal(data.net1ClickFlow.value, null);
  assert.equal(data.net1ClickFlow.status, 'pending');
  assert.equal(data.net1ClickFlow.reason, 'pending');
  assert.equal(data.coverageSinceT3.coverage, null);
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
    for (const path of ['scripts', 'sql', 'web', 'data/public', 'docs', 'THESIS.md', 'package.json']) {
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

// Synthetic chain: 1 s blocks from 2026-11-01, heights with h % 7 === 6 skipped,
// and the regular RPC pruned beyond three days.
const CHAIN_BASE = Date.parse('2026-11-01T00:00:00Z'), JWT = 'TEST_JWT_SECRET_VALUE';
const PRIVATE = /private-buyer|private-seller|DEPOSITSECRET|MEMOSECRET|TEST_JWT_SECRET_VALUE/;
const hashes = new Map();
const hashOf = h => { const v = String(h).replaceAll('0', 'z').padStart(40, '1') + 'A'; hashes.set(v, h); return v; };
const chainSupply = h => (1000000n + BigInt(h)) * scale;
const chainNative = h => BigInt(h) * scale / 100n;
function explorerRows() {
  const rows = [], usdc = 'nep141:usdc.test';
  for (let day = Date.parse('2026-11-02'); day < Date.parse('2026-11-10'); day += 86400000) {
    const at = hours => new Date(day + hours * 3600000).toISOString(), id = `${day}`;
    const row = (hours, extra) => ({ createdAt: at(hours), status: 'SUCCESS', depositAddress: `DEPOSITSECRET-${id}-${hours}`,
      depositMemo: 'MEMOSECRET', recipient: 'private-buyer.near', senders: ['private-seller.near'], refundTo: null, ...extra });
    rows.push(row(1, { originAsset: usdc, destinationAsset: NEAR_ASSET_IDS[0], amountInUsd: '100' }),
      row(2, { originAsset: usdc, destinationAsset: NEAR_ASSET_IDS[0], amountInUsd: '50', recipient: REVENUE_WALLETS[0] }),
      row(3, { originAsset: NEAR_ASSET_IDS[0], destinationAsset: usdc, amountInUsd: '30' }),
      row(4, { originAsset: NEAR_ASSET_IDS[0], destinationAsset: usdc, amountInUsd: '20', senders: [REVENUE_WALLETS[2], 'private-seller.near'] }),
      row(5, { originAsset: NEAR_ASSET_IDS[0], destinationAsset: NEAR_ASSET_IDS[1], amountInUsd: '999' }),
      row(6, { originAsset: usdc, destinationAsset: NEAR_ASSET_IDS[2], amountInUsd: null }));
    if (id === String(Date.parse('2026-11-03'))) for (let i = 0; i < 1200; i++) rows.push({ ...row(7, {
      originAsset: usdc, destinationAsset: NEAR_ASSET_IDS[3], amountInUsd: '0.01' }),
      createdAt: new Date(day + 7 * 3600000 + i * 1000).toISOString(), depositAddress: `DEPOSITSECRET-filler-${i}` });
  }
  return rows;
}
function chainMock({ inner = mock(), failArchive = false, log = { explorer: [], archive: 0 }, clock = () => 0, jwt = JWT } = {}) {
  const rows = explorerRows();
  const finalHeight = Math.floor((now().getTime() - CHAIN_BASE) / 1000);
  return async (url, init) => {
    if (url.startsWith(EXPLORER)) {
      assert.equal(init.headers.Authorization, `Bearer ${jwt}`);
      assert.equal(init.redirect, 'error');
      log.explorer.push(clock());
      const q = new URL(url).searchParams, side = q.has('toTokenId') ? 'toTokenId' : 'fromTokenId', id = q.get(side);
      const after = Date.parse(q.get('startTimestamp')), before = Date.parse(q.get('endTimestamp'));
      const body = rows.filter(r => (side === 'toTokenId' ? r.destinationAsset : r.originAsset) === id &&
        Date.parse(r.createdAt) > after && Date.parse(r.createdAt) < before)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 1000);
      return { ok: true, status: 200, json: async () => body };
    }
    const body = init?.body ? JSON.parse(init.body) : null;
    if (body?.id !== 'live') return inner(url, init);
    assert.ok([NEAR_RPC, ARCHIVAL_RPC].includes(url));
    if (url === ARCHIVAL_RPC) { log.archive++; if (failArchive) throw Error('PRIVATE_MEMBER.near'); }
    const unknown = { ok: true, status: 200, json: async () => ({ error: { cause: { name: 'UNKNOWN_BLOCK' } } }) };
    const { method, params } = body;
    if (method === 'block') {
      const h = params.finality === 'final' ? finalHeight : params.block_id;
      if (h > finalHeight || (params.block_id && h % 7 === 6) || (url === NEAR_RPC && h < finalHeight - 3 * 86400)) return unknown;
      return response({ header: { height: h, hash: hashOf(h), total_supply: chainSupply(h).toString(),
        timestamp_nanosec: (BigInt(CHAIN_BASE + h * 1000) * 1000000n).toString() } });
    }
    const h = hashes.get(params.block_id);
    assert.ok(h);
    const result = { block_height: h, block_hash: params.block_id };
    if (params.request_type === 'view_account') result.amount = chainNative(h).toString();
    else result.result = encoded((params.method_name === 'ft_balance_of' ? 2n : 3n) * scale + '');
    return response(result);
  };
}
const fakeTime = () => {
  let t = 0;
  return { clock: () => t, pause: async ms => { t += ms; } };
};

test('daily flow follows Check 1 rules, paginates, paces Explorer requests and pins archival and close blocks', async () => {
  const log = { explorer: [], archive: 0 }, time = fakeTime();
  const data = await build({ jwt: JWT, ...time, request: chainMock({ log, clock: time.clock }) });
  const flow = data.net1ClickFlow;
  assert.equal(flow.status, 'ok');
  assert.equal(flow.through, '2026-11-08');
  assert.deepEqual(flow.days.map(d => d.date), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
  assert.deepEqual(flow.days[0], { date: '2026-11-02', netUsd: '70', buysUsd: '100', sellsUsd: '30', buyRows: 1, sellRows: 1, missingUsdRows: 1 });
  assert.deepEqual(flow.days[1], { date: '2026-11-03', netUsd: '82', buysUsd: '112', sellsUsd: '30', buyRows: 1201, sellRows: 1, missingUsdRows: 1 });
  assert.equal(flow.value, '502');
  // 8 single-asset pulls per day, plus one extra page for the 1,200-row asset.
  assert.equal(log.explorer.length, 7 * 8 + 1);
  for (let i = 1; i < log.explorer.length; i++) assert.ok(log.explorer[i] - log.explorer[i - 1] >= 5200);
  const c = data.coverageSinceT3;
  assert.equal(c.baseline.source.url, ARCHIVAL_RPC);
  assert.equal(c.baseline.block.height, 86401);
  assert.equal(c.baseline.block.timeUtc, '2026-11-02T00:00:01.000Z');
  assert.equal(c.close.source.url, NEAR_RPC);
  assert.equal(c.close.block.height, 691201);
  assert.equal(c.supplyChangeNear, '604800');
  assert.equal(c.walletBalanceChangeNear, '18144');
  assert.equal(c.closeDate, '2026-11-08');
  assert.equal(c.netFlowUsd, '502');
  assert.ok(Math.abs(c.coverage - (502 + 18144 * 4.2) / (604800 * 4.2)) < 1e-12);
  assert.equal(c.provisional, true);
  assert.match(c.label, /not a locked test/);
  assert.doesNotMatch(JSON.stringify(data), PRIVATE);
});
test('later runs fetch only unrecorded days and never replace the fixed T3 baseline', async () => {
  const first = await build({ jwt: JWT, ...fakeTime(), request: chainMock() });
  const log = { explorer: [], archive: 0 };
  const again = await build({ previous: first, jwt: JWT, ...fakeTime(), request: chainMock({ log, failArchive: true }) });
  assert.equal(log.explorer.length, 0);
  assert.equal(log.archive, 0);
  assert.deepEqual(again.coverageSinceT3.baseline, first.coverageSinceT3.baseline);
  assert.deepEqual(again.net1ClickFlow.days, first.net1ClickFlow.days);
  const later = new Date('2026-11-10T21:00:00Z');
  const partial = { ...first, net1ClickFlow: { ...first.net1ClickFlow, days: first.net1ClickFlow.days.filter(d => d.date !== '2026-11-05') } };
  const next = await buildLive({ baselineSupply, baselineWallets, previous: partial, jwt: JWT, ...fakeTime(), now: () => later,
    request: chainMock({ log, failArchive: true }) });
  assert.equal(log.explorer.length, 2 * 8);
  assert.deepEqual(next.net1ClickFlow.days.map(d => d.date).slice(-3), ['2026-11-07', '2026-11-08', '2026-11-09']);
  assert.deepEqual(next.coverageSinceT3.baseline, first.coverageSinceT3.baseline);
});
test('without a JWT the flow stays null with reason pending, while wallet and supply changes are still measured', async () => {
  const log = { explorer: [], archive: 0 };
  const data = await build({ jwt: null, request: chainMock({ log }) });
  assert.equal(log.explorer.length, 0);
  assert.equal(data.net1ClickFlow.value, null);
  assert.equal(data.net1ClickFlow.reason, 'pending');
  assert.equal(data.coverageSinceT3.coverage, null);
  assert.equal(data.coverageSinceT3.reason, 'pending');
  assert.equal(data.coverageSinceT3.walletBalanceChangeNear, '18144');
  assert.equal(data.coverageSinceT3.supplyChangeNear, '604800');
});
test('archival failure leaves coverage null with a reason and no remote text', async () => {
  const data = await build({ jwt: JWT, ...fakeTime(), request: chainMock({ failArchive: true }) });
  assert.equal(data.coverageSinceT3.baseline.status, 'unavailable');
  assert.equal(data.coverageSinceT3.coverage, null);
  assert.match(data.coverageSinceT3.reason, /Archival read at the T3 end failed/);
  assert.equal(data.net1ClickFlow.status, 'ok');
  assert.doesNotMatch(JSON.stringify(data), /PRIVATE_MEMBER/);
});
test('an Explorer 401 keeps recorded days, stores no body, and malformed saved days are dropped', async () => {
  const first = await build({ jwt: JWT, ...fakeTime(), request: chainMock() });
  const days = first.net1ClickFlow.days.slice(0, 3);
  days.push({ ...days[0], date: '2026-11-06', netUsd: '1', leak: 'private-buyer.near' });
  const inner = chainMock();
  const data = await build({ previous: { ...first, net1ClickFlow: { days } }, jwt: JWT, ...fakeTime(), request: async (url, init) =>
    url.startsWith(EXPLORER) ? { ok: false, status: 401, json: async () => ({ error: 'private-buyer.near' }) } : inner(url, init) });
  assert.equal(data.net1ClickFlow.status, 'stale');
  assert.match(data.net1ClickFlow.reason, /^Explorer HTTP 401; fetch stopped/);
  assert.deepEqual(data.net1ClickFlow.days.map(d => d.date), ['2026-11-02', '2026-11-03', '2026-11-04']);
  assert.equal(data.net1ClickFlow.through, '2026-11-04');
  assert.equal(data.coverageSinceT3.coverage, null);
  assert.doesNotMatch(JSON.stringify(data), PRIVATE);
});
test('the written live.json holds daily aggregates only, and no other file is written', async () => {
  const root = await mkdtemp(join(tmpdir(), 'near-live-flow-'));
  try {
    await cp(join(ROOT, 'data/public'), join(root, 'data/public'), { recursive: true });
    const { readdir } = await import('node:fs/promises');
    const list = async () => (await readdir(root, { recursive: true })).sort();
    const before = await list();
    await writeLive({ root, jwt: JWT, now, ...fakeTime(), request: chainMock() });
    const body = await readFile(join(root, 'dashboard/live.json'), 'utf8');
    assert.doesNotMatch(body, PRIVATE);
    assert.doesNotMatch(body, /"(depositAddress|depositMemo|recipient|senders|refundTo)"|Bearer/);
    assert.deepEqual(await list(), [...before, 'dashboard', 'dashboard/live.json'].sort());
  } finally { await rm(root, { recursive: true, force: true }); }
});
async function runLiveScript(fetchResult) {
  const { runInNewContext } = await import('node:vm');
  const line = { hidden: true, textContent: '' }, calls = [];
  const fetch = async (url, init) => { calls.push([url, init]); return fetchResult(); };
  runInNewContext(await readFile(join(ROOT, 'web/live.js'), 'utf8'),
    { document: { getElementById: id => (id === 'live-line' ? line : null) }, fetch });
  await new Promise(resolve => setTimeout(resolve, 10));
  return { line, calls };
}
test('first-screen live line reads same-origin live.json and hides when it is unavailable', async () => {
  const data = await build({ jwt: JWT, ...fakeTime(), request: chainMock() });
  const ok = await runLiveScript(() => ({ ok: true, json: async () => JSON.parse(JSON.stringify(data)) }));
  assert.equal(JSON.stringify(ok.calls), JSON.stringify([['live.json', { credentials: 'same-origin', cache: 'no-store' }]]));
  assert.equal(ok.line.hidden, false);
  const share = ((502 + 18144 * 4.2) / (604800 * 4.2) * 100).toFixed(1);
  assert.equal(ok.line.textContent, `Since November 2: net 1Click buying $502, revenue-wallet balances +18,144 NEAR, NEAR supply +604,800 NEAR. Provisional coverage ${share}%, not a locked test. Updated November 9, 2026.`);
  const pending = await build({ request: chainMock() });
  const pend = await runLiveScript(() => ({ ok: true, json: async () => pending }));
  assert.match(pend.line.textContent, /net 1Click buying pending, .*Provisional coverage pending, not a locked test/);
  for (const result of [() => ({ ok: false, json: async () => ({}) }), () => { throw Error('offline'); },
    () => ({ ok: true, json: async () => { throw Error('bad JSON'); } }), () => ({ ok: true, json: async () => ({ asOf: 'x' }) })]) {
    const { line } = await runLiveScript(result);
    assert.equal(line.hidden, true);
    assert.equal(line.textContent, '');
  }
  const source = await readFile(join(ROOT, 'web/live.js'), 'utf8');
  assert.doesNotMatch(source, /innerHTML|insertAdjacentHTML|eval\(|https?:/);
});
test('workflow passes the Intents JWT as a secret to the live step only', async () => {
  const workflow = await readFile(join(ROOT, '.github/workflows/live.yml'), 'utf8');
  assert.equal((workflow.match(/NEAR_INTENTS_JWT: \$\{\{ secrets\.NEAR_INTENTS_JWT \}\}/g) || []).length, 1);
  assert.match(workflow, /NEAR_INTENTS_JWT: \$\{\{ secrets\.NEAR_INTENTS_JWT \}\}\n\s+run: node scripts\/live\.mjs/);
  assert.equal((workflow.match(/NEAR_INTENTS_JWT/g) || []).length, 2);
  assert.doesNotMatch(workflow, /echo|set -x|::add-mask::/);
});
