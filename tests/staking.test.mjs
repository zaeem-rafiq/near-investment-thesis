import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { NEAR_RPC, fetchStakingSnapshot, saveStakingSnapshot } from '../scripts/staking.mjs';
import { assertNoWalletFields } from '../scripts/report.mjs';

const header = { height: 12345, epoch_id: 'synthetic-epoch', timestamp_nanosec: '1762128000123456789' };
const validators = {
  current_validators: [
    { account_id: 'synthetic-a', stake: '1000000000000000000000001', public_key: 'synthetic-key' },
    { account_id: 'synthetic-b', stake: '2000000000000000000000002' }
  ],
  next_validators: [{ account_id: 'synthetic-next', stake: '9999999999999999999999999' }],
  current_proposals: [{ stake: '9999999999999999999999999' }]
};
const response = result => ({ ok: true, json: async () => ({ result }) });
const now = () => new Date('2025-11-03T00:01:00Z');
const fake = (block = header, stakes = validators) => async (url, init) => {
  assert.equal(url, NEAR_RPC);
  assert.equal(init.method, 'POST');
  assert.equal(init.redirect, 'error');
  assert.ok(init.signal instanceof AbortSignal);
  const body = JSON.parse(init.body);
  assert.equal(body.jsonrpc, '2.0');
  if (body.method === 'block') {
    assert.deepEqual(body.params, { finality: 'final' });
    return response({ header: block });
  }
  assert.equal(body.method, 'validators');
  assert.deepEqual(body.params, { epoch_id: block.epoch_id });
  return response(stakes);
};
test('staking sums only current validators exactly and pins the snapshot to the finalized block epoch', async () => {
  assert.deepEqual(await fetchStakingSnapshot({ request: fake(), now }), {
    total_stake_yocto: '3000000000000000000000003', block_height: 12345,
    block_time_utc: '2025-11-03T00:00:00.123Z', fetched_at_utc: '2025-11-03T00:01:00.000Z'
  });
});
test('staking rejects malformed or duplicate stakes, missing validators and unsafe block metadata', async () => {
  for (const current_validators of [[], null,
    [{ account_id: 'a', stake: '-1' }], [{ account_id: 'a', stake: 1 }],
    [{ account_id: 'a', stake: '1.2' }], [{ account_id: 'a', stake: '0' }],
    [{ account_id: 'a', stake: '1' }, { account_id: 'a', stake: '2' }]
  ]) {
    await assert.rejects(fetchStakingSnapshot({ request: fake(header, { current_validators }), now }), /stake/);
  }
  for (const block of [
    { ...header, height: Number.MAX_SAFE_INTEGER + 1 }, { ...header, epoch_id: null },
    { ...header, timestamp_nanosec: 'bad' }, { ...header, timestamp_nanosec: '9'.repeat(40) }
  ]) {
    await assert.rejects(fetchStakingSnapshot({ request: fake(block), now }), /block/);
  }
});
test('staking failures omit remote response bodies and do not publish a snapshot', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'staking-failure-'));
  try {
    for (const request of [
      async () => { throw new Error('synthetic-private-error'); },
      async () => ({ ok: false, status: 503, json: async () => { throw new Error('must not read'); } }),
      async () => ({ ok: true, json: async () => ({ error: { message: 'synthetic-private-error' } }) }),
      async () => ({ ok: true, json: async () => { throw new Error('synthetic-private-error'); } })
    ]) {
      await assert.rejects(saveStakingSnapshot({ root, request, now }), error => {
        assert.ok(!error.message.includes('synthetic-private-error'));
        return /NEAR RPC/.test(error.message);
      });
    }
    await assert.rejects(access(resolve(root, 'data/public/staking.json')), { code: 'ENOENT' });
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('staking saver publishes only total stake, height and UTC times', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'staking-test-'));
  try {
    const expected = await saveStakingSnapshot({ root, request: fake(), now });
    const body = await readFile(resolve(root, 'data/public/staking.json'), 'utf8');
    assert.deepEqual(JSON.parse(body), expected);
    assertNoWalletFields(expected);
    assert.ok(!/synthetic-a|synthetic-key|account_id|current_validators/.test(body));
  } finally { await rm(root, { recursive: true, force: true }); }
});
