import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pullSwapsResumable, readPage, savedPages } from '../scripts/swaps.mjs';

const window = { start: '2025-11-03', end: '2025-11-04' };
const row = {
  depositAddress: 'synthetic-deposit', createdAt: '2025-11-03T12:00:00Z', status: 'SUCCESS',
  originAsset: 'usd', destinationAsset: 'near-a', amountInUsd: '1', recipient: 'synthetic-recipient',
  senders: ['synthetic-sender'], refundTo: 'synthetic-refund', referral: 'synthetic-referral',
  appFees: [{ recipient: 'synthetic-affiliate', fee: 5 }]
};
test('single-asset filtered pulls retain private fields only when requested and resume safely', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'participants-'));
  try {
    const options = { dir, retainParticipants: true, tokenFilter: { side: 'toTokenId', ids: ['near-a'] }, maxPages: 1 };
    const partial = await pullSwapsResumable(window, 'synthetic-token', { ...options, request: async url => {
      const params = new URL(url).searchParams;
      assert.deepEqual(params.getAll('toTokenId'), ['near-a']);
      assert.equal(params.has('fromTokenId'), false);
      return { ok: true, json: async () => [row] };
    } });
    assert.equal(partial.complete, false);
    assert.deepEqual((await readPage(dir, 'page-000001.json.gz')).rows[0].senders, row.senders);
    assert.deepEqual((await readPage(dir, 'page-000001.json.gz')).rows[0].appFees, row.appFees);
    const done = await pullSwapsResumable(window, 'synthetic-token', { ...options, request: async () => ({ ok: true, json: async () => [] }) });
    assert.equal(done.rows, 1);
    await assert.rejects(pullSwapsResumable(window, 'synthetic-token', { ...options, retainParticipants: false }), /different parameters/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('multi-value token filters are refused before any request or saved page', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'participants-multi-'));
  try {
    for (const side of ['toTokenId', 'fromTokenId']) {
      let requests = 0;
      await assert.rejects(pullSwapsResumable(window, 'synthetic-token', {
        dir, tokenFilter: { side, ids: ['near-a', 'near-b'] },
        request: async () => { requests++; return { ok: true, json: async () => [] }; }
      }), /exactly one token ID/);
      assert.equal(requests, 0);
      assert.deepEqual(await savedPages(dir), []);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('filtered pulls refuse ignored token filters and malformed senders', async () => {
  for (const change of [{ destinationAsset: 'other' }, { senders: 'not-an-array' }]) {
    const dir = await mkdtemp(resolve(tmpdir(), 'participants-bad-'));
    try {
      await assert.rejects(pullSwapsResumable(window, 'synthetic-token', {
        dir, retainParticipants: true, tokenFilter: { side: 'toTokenId', ids: ['near-a'] },
        request: async () => ({ ok: true, json: async () => [{ ...row, ...change }] })
      }), /outside|Invalid private/);
    } finally { await rm(dir, { recursive: true, force: true }); }
  }
});

test('participant retry cap stops a persistent HTTP 500 after six retries with every wait at most 60 s', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'participants-retry-'));
  try {
    let attempts = 0; const waits = [];
    await assert.rejects(pullSwapsResumable(window, 'synthetic-token', {
      dir, tokenFilter: { side: 'toTokenId', ids: ['near-a'] }, maxRetries: 6, maxBackoffMs: 60000,
      request: async () => { attempts++; return { ok: false, status: 500, headers: new Headers({ 'retry-after': '600' }) }; },
      pause: async ms => { waits.push(ms); }
    }), /HTTP 500 repeatedly/);
    assert.equal(attempts, 7);
    assert.ok(Math.max(...waits) <= 60000);
    assert.ok(waits.reduce((a, b) => a + b, 0) <= 8 * 60000);
    assert.deepEqual(await savedPages(dir), []);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('a page shorter than the requested size ends its window without another request', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'participants-short-'));
  try {
    let requests = 0;
    const done = await pullSwapsResumable(window, 'synthetic-token', {
      dir, retainParticipants: true, tokenFilter: { side: 'toTokenId', ids: ['near-a'] }, shortPageEnds: true,
      pause: async () => {}, request: async () => { requests++; return { ok: true, json: async () => [row] }; }
    });
    assert.equal(done.complete, true);
    assert.equal(done.rows, 1);
    assert.equal(done.pages, 1);
    assert.equal(requests, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
