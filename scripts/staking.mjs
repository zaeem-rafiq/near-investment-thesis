import { resolve } from 'node:path';
import { ROOT } from './sources.mjs';
import { atomic } from './store.mjs';

export const NEAR_RPC = 'https://rpc.mainnet.near.org';

// Read-only JSON-RPC. A finalized block pins the validators request to its epoch.
// Reference: https://docs.near.org/api-reference/post-validators
export async function fetchStakingSnapshot({ request = fetch, now = () => new Date() } = {}) {
  const rpc = async (method, params) => {
    let response, body;
    try {
      response = await request(NEAR_RPC, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 'staking-snapshot', method, params }),
        redirect: 'error', signal: AbortSignal.timeout(30000)
      });
    } catch { throw new Error('NEAR RPC request failed or timed out; details omitted.'); }
    if (!response.ok) throw new Error(`NEAR RPC HTTP ${response.status}; response body omitted.`);
    try { body = await response.json(); }
    catch { throw new Error('Invalid NEAR RPC JSON; response body omitted.'); }
    if (body?.error || !body?.result) throw new Error('NEAR RPC error or missing result; response body omitted.');
    return body.result;
  };
  const { header } = await rpc('block', { finality: 'final' });
  if (!Number.isSafeInteger(header?.height) || header.height <= 0 ||
      typeof header.epoch_id !== 'string' || !header.epoch_id ||
      typeof header.timestamp_nanosec !== 'string' || !/^\d+$/.test(header.timestamp_nanosec)) {
    throw new Error('Invalid finalized NEAR block header.');
  }
  const milliseconds = Number(BigInt(header.timestamp_nanosec) / 1000000n);
  const blockTime = new Date(milliseconds);
  if (!Number.isSafeInteger(milliseconds) || !Number.isFinite(blockTime.getTime())) throw new Error('Invalid NEAR block timestamp.');
  const validators = await rpc('validators', { epoch_id: header.epoch_id });
  if (!Array.isArray(validators.current_validators) || !validators.current_validators.length) throw new Error('Missing current validator stakes.');
  const seen = new Set();
  let total = 0n;
  for (const validator of validators.current_validators) {
    if (typeof validator.account_id !== 'string' || !validator.account_id || seen.has(validator.account_id) ||
        typeof validator.stake !== 'string' || !/^\d+$/.test(validator.stake)) throw new Error('Invalid or duplicate current validator stake.');
    seen.add(validator.account_id);
    total += BigInt(validator.stake);
  }
  if (total <= 0n) throw new Error('Total current validator stake must be positive.');
  // Deliberate allowlist: no validator accounts, keys, proposals or next-epoch stakes.
  return {
    total_stake_yocto: total.toString(), block_height: header.height,
    block_time_utc: blockTime.toISOString(), fetched_at_utc: now().toISOString()
  };
}

// Not wired into rebuild or refresh. Call only after owner approval to collect it.
export async function saveStakingSnapshot({ root = ROOT, ...options } = {}) {
  const snapshot = await fetchStakingSnapshot(options);
  await atomic(resolve(root, 'data/public/staking.json'), JSON.stringify(snapshot, null, 2) + '\n');
  return snapshot;
}
