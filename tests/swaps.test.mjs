import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pullSwapsResumable, savedPages, readPage } from '../scripts/swaps.mjs';

// Synthetic protocol fixtures only.
const window = { start: '2026-10-01', end: '2026-10-02' };
const swap = (address, memo = null) => ({ depositAddress: address, depositMemo: memo, createdAt: '2026-10-01T12:00:00.000Z',
  status: 'SUCCESS', originAsset: 'a', destinationAsset: 'b', amountInUsd: '1.5', recipient: 'private' });
const ok = rows => ({ ok: true, status: 200, json: async () => rows });
function server(pages) {
  const urls = [];
  const request = async url => {
    const u = new URL(url); urls.push(u);
    const after = u.searchParams.get('lastDepositAddress');
    const i = after ? pages.findIndex(p => p.at(-1)?.depositAddress === after) + 1 : 0;
    return ok(pages[i] || []);
  };
  return { request, urls };
}
const tempDir = () => mkdtemp(join(tmpdir(), 'swaps-test-'));

test('swap pull saves each page and resumes from the last saved cursor without refetching', async () => {
  const dir = await tempDir();
  try {
    const pages = [[swap('a'), swap('b', 'm1')], [swap('c')], [swap('d')]];
    const first = server(pages);
    const partial = await pullSwapsResumable(window, 'test-only', { dir, request: first.request, pause: async () => {}, maxPages: 2 });
    assert.equal(partial.complete, false);
    assert.equal((await savedPages(dir)).length, 2);
    const second = server(pages);
    const done = await pullSwapsResumable(window, 'test-only', { dir, request: second.request, pause: async () => {} });
    assert.equal(done.complete, true);
    assert.equal(done.rows, 4);
    assert.equal(second.urls[0].searchParams.get('lastDepositAddress'), 'c');
    assert.equal(second.urls.length, 2);
    const page1 = await readPage(dir, 'page-000001.json.gz');
    assert.equal(page1.rows[0].recipient, undefined);
    assert.equal(page1.cursor.depositMemo, 'm1');
    const again = server(pages);
    assert.equal((await pullSwapsResumable(window, 'test-only', { dir, request: again.request })).complete, true);
    assert.equal(again.urls.length, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('swap pull memo cursor, duplicates across a restart, and parameter changes fail closed', async () => {
  const dir = await tempDir();
  try {
    const pages = [[swap('a', 'm1')], [swap('a', 'm1')]];
    await pullSwapsResumable(window, 'test-only', { dir, request: server(pages).request, pause: async () => {}, maxPages: 1 });
    const s = server(pages);
    await assert.rejects(pullSwapsResumable(window, 'test-only', { dir, request: s.request, pause: async () => {} }), /Duplicate|cursor/);
    assert.equal(s.urls[0].searchParams.get('lastDepositMemo'), 'm1');
    assert.equal((await readdir(join(dir, 'pages'))).length, 1);
    await assert.rejects(pullSwapsResumable({ ...window, end: '2026-10-03' }, 'test-only', { dir }), /different parameters/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('swap pull retries 429 and 5xx with pacing, and stops on 401 without the body', async () => {
  const dir = await tempDir();
  try {
    let calls = 0; const waits = [];
    const request = async () => [ { status: 429, ok: false, headers: new Headers({ 'retry-after': '9' }) },
      { status: 503, ok: false, headers: new Headers() }][calls++] || ok([]);
    const done = await pullSwapsResumable(window, 'test-only', { dir, request, pause: async ms => waits.push(ms) });
    assert.equal(done.complete, true);
    assert.deepEqual(waits, [9000, 10400]);
    const dir2 = await tempDir();
    await assert.rejects(pullSwapsResumable(window, 'test-only', { dir: dir2, request: async () => ({ ok: false, status: 401 }) }), /^Error: Explorer HTTP 401; response body omitted\.$/);
    await rm(dir2, { recursive: true, force: true });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
