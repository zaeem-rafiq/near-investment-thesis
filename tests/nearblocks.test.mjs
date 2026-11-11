import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { collectNearblocks, RAW_NEARBLOCKS } from '../scripts/nearblocks.mjs';
import { REVENUE_WALLETS } from '../scripts/position-config.mjs';

test('collector saves full ascending cursor histories, wrap-only pages, resumes and globally paces requests', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'nearblocks-'));
  let clock = 20000, requests = [];
  const counts = [1543, 3304, 547];
  const request = async raw => {
    const url = new URL(raw), wallet = url.pathname.split('/')[3], index = REVENUE_WALLETS.indexOf(wallet);
    assert.ok(index >= 0);
    assert.equal(url.searchParams.get('per_page'), '100'); assert.equal(url.searchParams.get('order'), 'asc');
    requests.push({ raw, at: clock });
    const ft = url.pathname.endsWith('ft-txns');
    if (ft) assert.equal(url.searchParams.get('contract'), 'wrap.near');
    const offset = Number(url.searchParams.get('cursor') || 0), length = ft ? 0 : Math.min(100, counts[index] - offset);
    return { ok: true, text: async () => JSON.stringify({ cursor: String(offset + length), txns: Array.from({ length }, (_, i) => ({ id: String(offset + i), block_timestamp: String(offset + i) })) }) };
  };
  const options = { root, request, now: () => clock, pause: async ms => { clock += ms; } };
  try {
    const histories = await collectNearblocks(options);
    assert.deepEqual(histories.filter(h => h.kind === 'receipts').map(h => h.rows), counts);
    for (let i = 1; i < requests.length; i++) assert.ok(requests[i].at - requests[i - 1].at >= 12000);
    const count = requests.length; assert.equal(count, 59);
    assert.deepEqual(await collectNearblocks(options), histories); assert.equal(requests.length, count);
    assert.equal(JSON.parse(await readFile(resolve(root, RAW_NEARBLOCKS, 'complete.json'), 'utf8')).complete, true);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('collector refuses a full page without a cursor rather than silently truncating', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'nearblocks-bad-'));
  try {
    await assert.rejects(collectNearblocks({ root, now: () => 20000, pause: async () => {}, request: async () => ({ ok: true, text: async () => JSON.stringify({ txns: Array.from({ length: 100 }, (_, i) => ({ id: String(i), block_timestamp: String(i) })) }) }) }), /no new cursor/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('server errors without Retry-After back off exponentially', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'nearblocks-backoff-'));
  const waits = [];
  try {
    await assert.rejects(collectNearblocks({ root, now: () => 0, pause: async ms => { if (ms > 0) waits.push(ms); },
      request: async () => ({ ok: false, status: 503, headers: new Headers() }) }), /HTTP 503/);
    // Five retries wait 12.5 s, then double, capped at two minutes.
    for (const ms of [25000, 50000, 100000, 120000]) assert.ok(waits.includes(ms), `missing ${ms} ms wait`);
  } finally { await rm(root, { recursive: true, force: true }); }
});
