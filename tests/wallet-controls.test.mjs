import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchWalletControls, saveWalletControls, REVENUE_WALLETS } from '../scripts/wallet-controls.mjs';
import { NEAR_RPC } from '../scripts/staking.mjs';
import { ROOT, hash } from '../scripts/sources.mjs';
import { assertNoWalletFields } from '../scripts/report.mjs';

const header = { height: 12345, hash: '11111111111111111111111111111111',
  timestamp_nanosec: '1794259633336330898' };
const rule = { weight_kind: 'RoleWeight', quorum: '0', threshold: [1, 2] };
const policy = { default_vote_policy: rule, roles: [
  { name: 'private-member.near', kind: { Group: ['private-member.near', 'other-member.near'] },
    permissions: ['transfer:VoteApprove'], vote_policy: { transfer: { ...rule, threshold: '2' } } },
  { name: 'all', kind: 'Everyone', permissions: ['*:AddProposal'], vote_policy: {} }
] };
const now = () => new Date('2026-11-09T21:28:00Z');
const encoded = value => [...Buffer.from(JSON.stringify(value))];
const fake = (change = () => {}) => async (url, init) => {
  assert.equal(url, NEAR_RPC);
  assert.equal(init.method, 'POST');
  assert.equal(init.redirect, 'error');
  assert.ok(init.signal instanceof AbortSignal);
  const { method, params } = JSON.parse(init.body);
  if (method === 'block') {
    assert.deepEqual(params, { finality: 'final' });
    return { ok: true, json: async () => ({ result: { header } }) };
  }
  assert.equal(method, 'query');
  assert.equal(params.block_id, header.hash);
  let result = { block_height: header.height, block_hash: header.hash };
  if (params.request_type === 'view_account') Object.assign(result, {
    amount: '1234567890123456789012345678', locked: '0', code_hash: header.hash
  });
  else if (params.request_type === 'view_access_key_list') result.keys = [
    { public_key: 'ed25519:PRIVATE_KEY_A', access_key: { permission: 'FullAccess' } },
    { public_key: 'ed25519:PRIVATE_KEY_B', access_key: { permission: { FunctionCall: {
      receiver_id: params.account_id, method_names: ['confirm'] } } } }
  ];
  else {
    assert.equal(params.request_type, 'call_function');
    const args = JSON.parse(Buffer.from(params.args_base64, 'base64').toString());
    if (params.method_name === 'ft_balance_of') {
      assert.equal(params.account_id, 'wrap.near');
      assert.ok(REVENUE_WALLETS.includes(args.account_id));
      result.result = encoded('0');
    } else if (params.method_name === 'mt_balance_of') {
      assert.equal(params.account_id, 'intents.near');
      assert.deepEqual(args, { account_id: args.account_id, token_id: 'nep141:wrap.near' });
      assert.ok(REVENUE_WALLETS.includes(args.account_id));
      result.result = encoded('1000100010001000100010');
    } else if (params.method_name === 'get_policy') result.result = encoded(policy);
    else if (params.method_name === 'get_num_confirmations') result.result = encoded(2);
    else if (params.method_name === 'get_members') result.error = 'MethodResolveError(MethodNotFound): private-member.near';
    else assert.fail('Unexpected method');
  }
  change(result, params);
  return { ok: true, json: async () => ({ result }) };
};
test('wallet reads share one finalized block, retain exact balances and redact members and keys', async () => {
  const data = await fetchWalletControls({ request: fake(), now });
  assert.equal(data.block.height, header.height);
  assert.equal(data.block.timeUtc, '2026-11-09T21:27:13.336Z');
  assert.equal(data.rpcSource, NEAR_RPC);
  assert.deepEqual(data.wallets.map(w => w.wallet), REVENUE_WALLETS);
  for (const wallet of data.wallets) {
    assert.equal(wallet.nativeNear.value, '1234.567890123456789012345678');
    assert.equal(wallet.wrapNear.value, '0');
    assert.equal(wallet.intentsNear.value, '0.00100010001000100010001');
    assert.equal(wallet.contractDeployed.value, false);
    assert.equal(wallet.fullAccessKeys.value, 1);
    assert.equal(wallet.functionCallKeys.value, 1);
  }
  const roles = data.wallets[0].policy.value.roles;
  assert.equal(roles[0].name, 'Role 1');
  assert.equal(roles[0].memberCount, 2);
  assert.deepEqual(roles[0].votePolicyOverrides[0], { proposal: 'transfer', weightKind: 'RoleWeight', quorum: '0', threshold: '2' });
  assert.equal(roles[1].memberCount, null);
  assert.match(roles[1].memberCountReason, /Not measurable/);
  const multisig = data.wallets[2];
  assert.equal(multisig.requiredConfirmations.value, 2);
  assert.equal(multisig.multisigConfirmKeys.value, 1);
  assert.equal(multisig.contractMemberCount.status, 'not_measurable');
  assert.match(multisig.contractMemberCount.reason, /MethodNotFound/);
  assert.doesNotMatch(JSON.stringify(data), /private-member|other-member|PRIVATE_KEY|public_key|receiver_id|args_base64/i);
});
test('wrong-block, malformed and failed values are not measurable, never zero or remote error text', async () => {
  const data = await fetchWalletControls({ now, request: fake((result, params) => {
    if (params.request_type === 'view_account') result.block_height++;
    if (params.method_name === 'ft_balance_of') result.result = encoded('-1');
    if (params.method_name === 'mt_balance_of') result.error = 'private-member.near ed25519:PRIVATE_KEY';
    if (params.method_name === 'get_policy') result.result = encoded({ ...policy, roles: [
      { ...policy.roles[0], permissions: ['private-member.near:VoteApprove'] }
    ] });
  }) });
  for (const wallet of data.wallets) {
    for (const key of ['nativeNear', 'contractDeployed', 'wrapNear', 'intentsNear']) {
      assert.equal(wallet[key].status, 'not_measurable');
      assert.equal(wallet[key].value, null);
      assert.ok(wallet[key].reason);
    }
  }
  assert.equal(data.wallets[0].policy.status, 'not_measurable');
  assert.doesNotMatch(JSON.stringify(data), /private-member|PRIVATE_KEY|ed25519:/);
});
test('wallet saver exports sanitized JSON, and a failed finalized-block request writes nothing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'near-wallet-controls-'));
  try {
    await assert.rejects(saveWalletControls({ root, request: async () => { throw Error('PRIVATE_KEY'); } }), /RPC/);
    await assert.rejects(readFile(join(root, 'data/public/wallet-controls.json')), { code: 'ENOENT' });
    const data = await saveWalletControls({ root, request: fake(), now });
    const body = await readFile(join(root, 'data/public/wallet-controls.json'), 'utf8');
    assert.deepEqual(JSON.parse(body), data);
    assert.doesNotMatch(body, /private-member|PRIVATE_KEY|public_key/i);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('saved public wallet-control format has only permitted accounts, counts, policies and balances', async () => {
  const body = await readFile(join(ROOT, 'data/public/wallet-controls.json'), 'utf8');
  const data = JSON.parse(body);
  assert.deepEqual(Object.keys(data).sort(), ['block', 'fetchedAt', 'notes', 'rpcSource', 'version', 'wallets']);
  assert.equal(data.version, 1);
  assert.equal(data.rpcSource, NEAR_RPC);
  assert.equal(data.block.finality, 'final');
  assert.equal(data.block.method, 'block');
  assert.ok(Number.isSafeInteger(data.block.height) && data.block.height > 0);
  assert.equal(new Date(Number(BigInt(data.block.timestampNanosec) / 1000000n)).toISOString(), data.block.timeUtc);
  assert.ok(Date.parse(data.fetchedAt) >= Date.parse(data.block.timeUtc));
  assert.deepEqual(data.wallets.map(w => w.wallet), REVENUE_WALLETS);
  const common = ['wallet', 'nativeNear', 'wrapNear', 'intentsNear', 'contractDeployed', 'fullAccessKeys', 'functionCallKeys'];
  for (const wallet of data.wallets) {
    const dao = wallet.wallet.endsWith('.sputnik-dao.near');
    assert.deepEqual(Object.keys(wallet).sort(), [...common, ...(dao ? ['policy'] :
      ['requiredConfirmations', 'contractMemberCount', 'multisigConfirmKeys'])].sort());
    for (const [name, measurement] of Object.entries(wallet)) {
      if (name === 'wallet') continue;
      assert.ok(['ok', 'not_measurable'].includes(measurement.status));
      assert.deepEqual(Object.keys(measurement).sort(), measurement.status === 'ok' ?
        ['method', 'status', 'value'] : ['method', 'reason', 'status', 'value']);
      assert.match(measurement.method, /^query:(view_account|view_access_key_list|call_function:[a-z0-9._-]+\.[a-z_]+)$/);
      if (measurement.status === 'not_measurable') {
        assert.equal(measurement.value, null);
        assert.ok(measurement.reason);
      } else if (name.endsWith('Near')) assert.match(measurement.value, /^(0|[1-9]\d*)(\.\d{1,24})?$/);
      else if (name.endsWith('Keys') || ['requiredConfirmations', 'contractMemberCount'].includes(name)) {
        assert.ok(Number.isSafeInteger(measurement.value) && measurement.value >= 0);
      } else if (name === 'contractDeployed') assert.equal(typeof measurement.value, 'boolean');
    }
  }
  assertNoWalletFields(data);
  assert.doesNotMatch(body, /ed25519:|secp256k1:|public_key|account_id|args_base64/);
  // The approved RPC hostname contains ".near.org", not a member account.
  for (const account of body.replaceAll(NEAR_RPC, '').match(/\b[a-z0-9][a-z0-9._-]*\.near\b/g) || []) {
    assert.ok([...REVENUE_WALLETS, 'wrap.near', 'intents.near'].includes(account), 'Unexpected member account in public snapshot');
  }
  const manifest = JSON.parse(await readFile(join(ROOT, 'data/public/manifest.json'), 'utf8'));
  assert.deepEqual(manifest.files.wallet_controls, { path: 'data/public/wallet-controls.json', sha256: hash(body) });
});
test('a supported member view exports only its count, independent of access-key counts', async () => {
  const data = await fetchWalletControls({ now, request: fake((result, params) => {
    if (params.method_name === 'get_members') {
      delete result.error;
      result.result = encoded([{ account_id: 'private-member.near' }, { public_key: 'ed25519:PRIVATE_KEY_C' }]);
    }
  }) });
  assert.equal(data.wallets[2].contractMemberCount.value, 2);
  assert.equal(data.wallets[2].multisigConfirmKeys.value, 1);
  assert.doesNotMatch(JSON.stringify(data), /private-member|other-member|PRIVATE_KEY|public_key/);
});
