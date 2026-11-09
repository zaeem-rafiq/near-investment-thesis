import { resolve } from 'node:path';
import { ROOT } from './sources.mjs';
import { atomic } from './store.mjs';
import { NEAR_RPC } from './staking.mjs';

export const REVENUE_WALLETS = [
  'fefundsadmin.sputnik-dao.near', '1csfundsadmin.sputnik-dao.near', 'buybacks.multisignature.near'
];
const EMPTY_CODE = '11111111111111111111111111111111';
const PROPOSALS = new Set(['*', 'config', 'policy', 'add_member_to_role', 'remove_member_from_role',
  'call', 'transfer', 'stake', 'vote', 'add_bounty', 'bounty_done', 'upgrade_self', 'upgrade_remote',
  'factory_info_update', 'policy_add_or_update_role', 'policy_remove_role',
  'policy_update_default_vote_policy', 'policy_update_parameters', 'set_vote_token']);
const ACTIONS = new Set(['*', 'AddProposal', 'RemoveProposal', 'VoteApprove', 'VoteReject',
  'VoteRemove', 'Finalize', 'MoveToHub']);
const ok = (value, method) => ({ status: 'ok', value, method });
const missing = (reason, method) => ({ status: 'not_measurable', value: null, reason, method });
const requireValue = condition => { if (!condition) throw new Error('Malformed RPC value; details omitted.'); };
const uint = value => {
  requireValue(typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value));
  return value;
};
const count = value => {
  requireValue(Number.isSafeInteger(value) && value >= 0);
  return value;
};
const near = value => {
  const digits = uint(value).padStart(25, '0');
  const fraction = digits.slice(-24).replace(/0+$/, '');
  return digits.slice(0, -24) + (fraction ? `.${fraction}` : '');
};
function votePolicy(policy) {
  requireValue(policy && ['RoleWeight', 'TokenWeight'].includes(policy.weight_kind));
  const threshold = policy.threshold;
  if (Array.isArray(threshold)) {
    requireValue(threshold.length === 2);
    threshold.forEach(count);
    requireValue(threshold[1] > 0);
  } else uint(threshold);
  return { weightKind: policy.weight_kind, quorum: uint(policy.quorum),
    threshold: Array.isArray(threshold) ? [...threshold] : threshold };
}
function daoPolicy(policy) {
  requireValue(Array.isArray(policy?.roles));
  return {
    defaultVotePolicy: votePolicy(policy.default_vote_policy),
    roles: policy.roles.map((role, index) => {
      let kind, memberCount, memberCountReason = null;
      if (Array.isArray(role.kind?.Group)) {
        kind = 'Group';
        requireValue(role.kind.Group.every(member => typeof member === 'string' && member.length > 0));
        requireValue(new Set(role.kind.Group).size === role.kind.Group.length);
        memberCount = role.kind.Group.length;
      } else {
        requireValue(role.kind === 'Everyone' || role.kind?.Member !== undefined);
        kind = role.kind === 'Everyone' ? 'Everyone' : 'Member';
        if (kind === 'Member') uint(role.kind.Member);
        memberCount = null;
        memberCountReason = 'Not measurable: this role is not an enumerated account group.';
      }
      requireValue(Array.isArray(role.permissions) && role.vote_policy && typeof role.vote_policy === 'object');
      const permissions = role.permissions.map(permission => {
        requireValue(typeof permission === 'string');
        const parts = permission.split(':');
        const [proposal, action] = parts;
        requireValue(parts.length === 2 && PROPOSALS.has(proposal) && ACTIONS.has(action));
        return permission;
      }).sort();
      const votePolicyOverrides = Object.entries(role.vote_policy).sort(([a], [b]) => a.localeCompare(b))
        .map(([proposal, rule]) => {
          requireValue(PROPOSALS.has(proposal));
          return { proposal, ...votePolicy(rule) };
        });
      // Never copy arbitrary display names: a role can be named after a member.
      const name = ['Requestor', 'Admin', 'Approver', 'all', 'council'].includes(role.name)
        ? role.name : `Role ${index + 1}`;
      return { index, name, kind, memberCount, memberCountReason, permissions, votePolicyOverrides };
    })
  };
}
function keyCounts(result, wallet) {
  requireValue(Array.isArray(result.keys));
  const seen = new Set();
  let fullAccess = 0, functionCall = 0, multisigConfirm = 0;
  for (const key of result.keys) {
    requireValue(typeof key.public_key === 'string' && key.public_key.length > 0 && !seen.has(key.public_key));
    seen.add(key.public_key);
    const permission = key.access_key?.permission;
    if (permission === 'FullAccess') fullAccess++;
    else {
      const fc = permission?.FunctionCall;
      requireValue(fc && typeof fc.receiver_id === 'string' && Array.isArray(fc.method_names) &&
        fc.method_names.every(name => typeof name === 'string'));
      functionCall++;
      if (fc.receiver_id === wallet && (!fc.method_names.length || fc.method_names.includes('confirm'))) multisigConfirm++;
    }
  }
  return { fullAccess, functionCall, multisigConfirm };
}

// Read-only and opt-in. Never loaded by rebuild, refresh or the participant pull.
export async function fetchWalletControls({ request = fetch, now = () => new Date() } = {}) {
  const rpc = async (method, params) => {
    let response, body;
    try {
      response = await request(NEAR_RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 'wallet-controls', method, params }),
        redirect: 'error', signal: AbortSignal.timeout(30000) });
    } catch { throw new Error('NEAR RPC request failed or timed out; details omitted.'); }
    if (!response.ok) throw new Error(`NEAR RPC HTTP ${count(response.status)}; body omitted.`);
    try { body = await response.json(); }
    catch { throw new Error('Invalid NEAR RPC JSON; body omitted.'); }
    if (body?.error || !body?.result) throw new Error('NEAR RPC error or missing result; body omitted.');
    return body.result;
  };
  const { header } = await rpc('block', { finality: 'final' });
  requireValue(header && Number.isSafeInteger(header.height) && header.height > 0 &&
    typeof header.hash === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(header.hash));
  const timestamp = BigInt(uint(header.timestamp_nanosec));
  const time = Number(timestamp / 1000000n);
  requireValue(Number.isSafeInteger(time) && Number.isFinite(new Date(time).getTime()));
  const query = async (params, parse) => {
    const method = `query:${params.request_type}` +
      (params.method_name ? `:${params.account_id}.${params.method_name}` : '');
    try {
      const result = await rpc('query', { ...params, block_id: header.hash });
      if (result.block_height !== header.height || result.block_hash !== header.hash) {
        return missing('RPC result does not match the pinned finalized block.', method);
      }
      if (result.error) return missing(
        String(result.error).includes('MethodNotFound') ? 'Contract view is not exported (MethodNotFound).' :
          'Contract view failed; remote details omitted.', method);
      return ok(parse(result), method);
    } catch (error) {
      // Only our fixed local errors may leave this boundary, never remote messages.
      const reason = error.message.startsWith('NEAR RPC') || error.message.startsWith('Invalid NEAR RPC')
        ? error.message : 'Malformed RPC value; details omitted.';
      return missing(reason, method);
    }
  };
  const view = (account_id, method_name, args, parse) => query({
    request_type: 'call_function', account_id, method_name,
    args_base64: Buffer.from(JSON.stringify(args)).toString('base64')
  }, result => {
    requireValue(Array.isArray(result.result) && result.result.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255));
    return parse(JSON.parse(Buffer.from(result.result).toString('utf8')));
  });
  const field = (measurement, key) => measurement.status === 'ok'
    ? ok(measurement.value[key], measurement.method) : { ...measurement };
  const wallets = [];
  for (const wallet of REVENUE_WALLETS) {
    const account = await query({ request_type: 'view_account', account_id: wallet }, result => {
      requireValue(typeof result.code_hash === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(result.code_hash));
      return { nativeNear: near(result.amount), contractDeployed: result.code_hash !== EMPTY_CODE };
    });
    const keys = await query({ request_type: 'view_access_key_list', account_id: wallet }, result => keyCounts(result, wallet));
    const row = { wallet, nativeNear: field(account, 'nativeNear'),
      wrapNear: await view('wrap.near', 'ft_balance_of', { account_id: wallet }, near),
      intentsNear: await view('intents.near', 'mt_balance_of',
        { account_id: wallet, token_id: 'nep141:wrap.near' }, near),
      contractDeployed: field(account, 'contractDeployed'),
      fullAccessKeys: field(keys, 'fullAccess'), functionCallKeys: field(keys, 'functionCall') };
    if (wallet.endsWith('.sputnik-dao.near')) row.policy = await view(wallet, 'get_policy', {}, daoPolicy);
    else {
      row.requiredConfirmations = await view(wallet, 'get_num_confirmations', {}, count);
      row.contractMemberCount = await view(wallet, 'get_members', {}, members => {
        requireValue(Array.isArray(members));
        requireValue(members.every(member => member && typeof member === 'object' &&
          Object.keys(member).length === 1 && (typeof member.account_id === 'string' || typeof member.public_key === 'string')));
        requireValue(new Set(members.map(member => JSON.stringify(member))).size === members.length);
        return members.length;
      });
      row.multisigConfirmKeys = field(keys, 'multisigConfirm');
    }
    wallets.push(row);
  }
  return {
    version: 1, rpcSource: NEAR_RPC, fetchedAt: now().toISOString(),
    block: { height: header.height, hash: header.hash, timestampNanosec: header.timestamp_nanosec,
      timeUtc: new Date(time).toISOString(), finality: 'final', method: 'block' },
    notes: [
      'Native NEAR is view_account.amount; it excludes locked stake and includes storage reserve, not a spendable-balance estimate.',
      'All balances are exact decimal NEAR strings (24 decimals). Intents NEAR is token nep141:wrap.near inside intents.near.',
      'DAO permissions are proposal-kind:action. An override applies to that kind; otherwise the default vote policy applies.',
      'Sputnik RoleWeight ratio threshold: min(floor(numerator * group size / denominator) + 1, group size), then max with quorum.',
      'Role counts may overlap and do not establish independent people. Admin policy/upgrade permissions can change fund controls.',
      'Any full-access key can bypass contract voting. Function-call key counts are not a contract-reported member count.',
      'Multisig confirm keys count self-scoped function-call keys permitting confirm. Key custody and Intents signer authorization are not audited.'
    ],
    wallets
  };
}

export async function saveWalletControls({ root = ROOT, ...options } = {}) {
  const snapshot = await fetchWalletControls(options);
  await atomic(resolve(root, 'data/public/wallet-controls.json'), JSON.stringify(snapshot, null, 2) + '\n');
  return snapshot;
}
