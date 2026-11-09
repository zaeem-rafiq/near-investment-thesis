import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pullSwapsResumable, savedPages, readPage, PACE_MS } from '../scripts/swaps.mjs';

// Synthetic protocol fixtures only.
const window = { start: '2026-10-01', end: '2026-10-02' };
const swap = (address, memo = null, at = '2026-10-01T12:00:00.000Z') => ({ depositAddress: address, depositMemo: memo, createdAt: at,
  status: 'SUCCESS', originAsset: 'a', destinationAsset: 'b', amountInUsd: '1.5', recipient: 'private' });
const ok = rows => ({ ok: true, status: 200, json: async () => rows });
function server(pages) {
  const urls = [];
  const request = async url => {
    const u = new URL(url); urls.push(u);
    assert.equal(u.searchParams.has('lastDepositAddress'), false);
    assert.equal(u.searchParams.has('lastDepositMemo'), false);
    const end = u.searchParams.get('endTimestamp');
    const previous = pages.findIndex(p => new Date(Date.parse(p.at(-1).createdAt) + 1).toISOString() === end);
    const i = end === window.end + 'T00:00:00.000Z' ? 0 : previous + 1;
    assert.ok(i === 0 ? end === window.end + 'T00:00:00.000Z' : previous >= 0);
    return ok([...(i ? [pages[i - 1].at(-1)] : []), ...(pages[i] || [])]);
  };
  return { request, urls };
}
const tempDir = () => mkdtemp(join(tmpdir(), 'swaps-test-'));
// Fake clock: pause() advances Date.now, so pacing can be checked without real sleeps.
async function withFakeClock(fn) {
  const realNow = Date.now;
  let t = 1_800_000_000_000;
  Date.now = () => t;
  try { return await fn({ now: () => t, pause: async ms => { t += ms; } }); } finally { Date.now = realNow; }
}

test('swap pull saves each page and resumes from the last saved cursor without refetching', async () => {
  const dir = await tempDir();
  try {
    const pages = [[swap('a'), swap('b', 'm1')], [swap('c', null, '2026-10-01T11:00:00Z')], [swap('d', null, '2026-10-01T10:00:00Z')]];
    const first = server(pages);
    const partial = await pullSwapsResumable(window, 'test-only', { dir, request: first.request, pause: async () => {}, maxPages: 2 });
    assert.equal(partial.complete, false);
    assert.equal((await savedPages(dir)).length, 2);
    const second = server(pages);
    const done = await pullSwapsResumable(window, 'test-only', { dir, request: second.request, pause: async () => {} });
    assert.equal(done.complete, true);
    assert.equal(done.rows, 4);
    assert.equal(second.urls[0].searchParams.get('endTimestamp'), '2026-10-01T11:00:00.001Z');
    assert.equal(second.urls.length, 2);
    const page1 = await readPage(dir, 'page-000001.json.gz');
    assert.equal(page1.rows[0].recipient, undefined);
    assert.equal(page1.cursor.createdAt, '2026-10-01T12:00:00.000Z');
    const again = server(pages);
    assert.equal((await pullSwapsResumable(window, 'test-only', { dir, request: again.request })).complete, true);
    assert.equal(again.urls.length, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('exclusive timestamp requests exhaust full pages without losing boundary rows', async () => {
  const dir = await tempDir();
  try {
    const data = Array.from({ length: 2001 }, (_, i) => swap(`a${i}`, null,
      new Date(Date.parse('2026-10-01T12:00:00Z') - Math.floor(i / 2) * 1000).toISOString()));
    const request = async url => {
      const p = new URL(url).searchParams;
      assert.equal(p.get('numberOfTransactions'), '1000');
      assert.equal(p.has('lastDepositAddress'), false);
      return ok(data.filter(row => Date.parse(row.createdAt) < Date.parse(p.get('endTimestamp'))).slice(0, 1000));
    };
    const done = await withFakeClock(clock => pullSwapsResumable(window, 'test-only', { dir, request, pause: clock.pause }));
    assert.equal(done.complete, true);
    assert.equal(done.rows, data.length);
    const saved = (await Promise.all((await savedPages(dir)).map(name => readPage(dir, name)))).flatMap(page => page.rows);
    assert.deepEqual(saved.map(row => row.depositAddress), data.map(row => row.depositAddress));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('swap pull accepts reused address/memo at another time and refuses parameter changes', async () => {
  const dir = await tempDir();
  try {
    const pages = [[swap('a', 'm1')], [swap('a', 'm1', '2026-10-01T11:00:00Z')]];
    await pullSwapsResumable(window, 'test-only', { dir, request: server(pages).request, pause: async () => {}, maxPages: 1 });
    const s = server(pages);
    assert.equal((await pullSwapsResumable(window, 'test-only', { dir, request: s.request, pause: async () => {} })).rows, 2);
    assert.equal((await readdir(join(dir, 'pages'))).length, 2);
    await assert.rejects(pullSwapsResumable({ ...window, end: '2026-10-03' }, 'test-only', { dir }), /different parameters/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('swap pull retries 429 and 5xx with pacing, and stops on 401 without the body', async () => {
  const dir = await tempDir();
  try {
    let calls = 0; const waits = [];
    const request = async () => [ { status: 429, ok: false, headers: new Headers({ 'retry-after': '9' }) },
      { status: 503, ok: false, headers: new Headers() }][calls++] || ok([]);
    const done = await withFakeClock(clock => pullSwapsResumable(window, 'test-only', { dir, request,
      pause: async ms => { waits.push(ms); await clock.pause(ms); } }));
    assert.equal(done.complete, true);
    assert.deepEqual(waits, [9000, 10400]);
    const dir2 = await tempDir();
    await assert.rejects(pullSwapsResumable(window, 'test-only', { dir: dir2, request: async () => ({ ok: false, status: 401 }) }), /^Error: Explorer HTTP 401; response body omitted\.$/);
    await rm(dir2, { recursive: true, force: true });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('every HTTP attempt, including retries, is at least one pace interval after the previous attempt', async () => {
  const dir = await tempDir();
  try {
    await withFakeClock(async clock => {
      const attempts = [];
      const pages = [[swap('a')], [swap('b', null, '2026-10-01T11:00:00Z')], [swap('c', null, '2026-10-01T10:00:00Z')]];
      const s = server(pages);
      let throttled = 0;
      const request = async url => {
        attempts.push(clock.now());
        const end = new URL(url).searchParams.get('endTimestamp');
        const i = end === window.end + 'T00:00:00.000Z' ? 0
          : pages.findIndex(p => new Date(Date.parse(p.at(-1).createdAt) + 1).toISOString() === end) + 1;
        // Each page's first attempt is throttled once (no retry-after), then succeeds.
        if (i < pages.length && throttled <= i) { throttled++; return { status: 429, ok: false, headers: new Headers() }; }
        return s.request(url);
      };
      const done = await pullSwapsResumable(window, 'test-only', { dir, request, pause: clock.pause });
      assert.equal(done.complete, true);
      assert.equal(attempts.length, 7);
      for (let k = 1; k < attempts.length; k++) assert.ok(attempts[k] - attempts[k - 1] >= PACE_MS, `attempt ${k} only ${attempts[k] - attempts[k - 1]} ms after the previous one`);
    });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('true duplicates within a page are rejected', async () => {
  const dir = await tempDir();
  try {
    await assert.rejects(pullSwapsResumable(window, 'test-only', { dir, request: async () => ok([swap('a'), swap('a')]) }), /Duplicate/);
    assert.equal((await savedPages(dir)).length, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('resume reads timestamps from legacy saved rows, not the address cursor; non-boundary repeats fail', async () => {
  const dir = await tempDir();
  try {
    await pullSwapsResumable(window, 'test-only', { dir, request: async () => ok([swap('a'), swap('b', null, '2026-10-01T11:00:00Z')]), maxPages: 1 });
    const name = 'page-000001.json.gz', page = await readPage(dir, name);
    page.cursor = { depositAddress: 'b', depositMemo: null };
    await writeFile(join(dir, 'pages', name), gzipSync(JSON.stringify(page)));
    let url;
    await assert.rejects(pullSwapsResumable(window, 'test-only', { dir, request: async u => { url = new URL(u); return ok([swap('a')]); } }), /Duplicate|continuity/);
    assert.equal(url.searchParams.get('endTimestamp'), '2026-10-01T11:00:00.001Z');
    assert.equal((await savedPages(dir)).length, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('a full boundary-only page stalls, a short one completes, and empty history completes', async () => {
  for (const count of [0, 1, 1000]) {
    const dir = await tempDir();
    try {
      const boundary = Array.from({ length: 1000 }, (_, i) => swap(`a${i}`));
      await pullSwapsResumable(window, 'test-only', { dir, request: async () => ok(boundary), maxPages: 1 });
      const run = pullSwapsResumable(window, 'test-only', { dir, request: async () => ok(boundary.slice(0, count)) });
      if (count === 1000) await assert.rejects(run, /stall|advance/i);
      else assert.equal((await run).complete, true);
      assert.equal((await savedPages(dir)).length, 1);
    } finally { await rm(dir, { recursive: true, force: true }); }
  }
});

test('rows newer than the previous oldest and ascending pages fail continuity checks', async () => {
  for (const resume of [false, true]) {
    const dir = await tempDir();
    try {
      if (resume) await pullSwapsResumable(window, 'test-only', { dir, request: async () => ok([swap('a', null, '2026-10-01T11:00:00Z')]), maxPages: 1 });
      const rows = resume ? [swap('b')] : [swap('a', null, '2026-10-01T11:00:00Z'), swap('b')];
      await assert.rejects(pullSwapsResumable(window, 'test-only', { dir, request: async () => ok(rows) }), /continuity|order/i);
    } finally { await rm(dir, { recursive: true, force: true }); }
  }
});
