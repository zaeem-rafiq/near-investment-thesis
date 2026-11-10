import { mkdir, readFile, readdir, writeFile, rename } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { ROOT, EXPLORER, explorerParams, sleep } from './sources.mjs';

// 1Click history starts on 2025-03-27; the Explorer returned no successful swap before 2025-03-01.
export const SWAP_WINDOW = { start: '2025-03-01', end: '2026-11-02' };
export const PACE_MS = 5200;
const FIELDS = ['depositAddress', 'depositMemo', 'createdAt', 'status', 'originAsset', 'destinationAsset', 'amountInUsd'];
const PARTICIPANT_FIELDS = ['recipient', 'senders', 'refundTo', 'referral', 'appFees'];

export const swapDir = (window, root = ROOT) => resolve(root, 'data/raw/swaps', `${window.start}_${window.end}`);
const pageName = n => `page-${String(n).padStart(6, '0')}.json.gz`;
const swapKey = row => createHash('sha256').update(JSON.stringify([row.depositAddress, row.depositMemo ?? null, row.createdAt])).digest('base64').slice(0, 22);

async function atomic(path, body) {
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, body, { mode: 0o600 });
  await rename(temp, path);
}
export async function readJSON(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
export async function savedPages(dir) {
  let names;
  try { names = await readdir(resolve(dir, 'pages')); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  const pages = names.filter(n => /^page-\d{6}\.json\.gz$/.test(n)).sort();
  pages.forEach((n, i) => { if (n !== pageName(i + 1)) throw new Error(`Saved swap pages are not contiguous at ${n}.`); });
  return pages;
}
export async function readPage(dir, name) {
  return JSON.parse(gunzipSync(await readFile(resolve(dir, 'pages', name))).toString('utf8'));
}

export function cleanRows(rows, window, seen, boundary, tokenFilter, retainParticipants) {
  const start = Date.parse(window.start), end = Date.parse(window.end), clean = [];
  const pageKeys = new Set();
  let previous = boundary == null ? end : Date.parse(boundary);
  for (const row of rows) {
    if (!row.depositAddress || !row.createdAt || row.status !== 'SUCCESS' || !row.originAsset || !row.destinationAsset) {
      throw new Error('Invalid successful swap record.');
    }
    if (tokenFilter && !tokenFilter.ids.includes(row[tokenFilter.side === 'toTokenId' ? 'destinationAsset' : 'originAsset'])) {
      throw new Error('Explorer returned a swap outside the requested token filter.');
    }
    const ts = Date.parse(row.createdAt);
    if (!Number.isFinite(ts)) throw new Error('Invalid swap timestamp.');
    if (ts > previous) throw new Error('Explorer timestamp order/continuity failed.');
    previous = ts;
    if (ts === start - 1) continue;
    if (ts < start || ts >= end) throw new Error('Explorer returned a record outside the requested interval.');
    const key = swapKey(row);
    if (pageKeys.has(key)) throw new Error('Duplicate swap within Explorer page.');
    pageKeys.add(key);
    if (seen.has(key)) {
      if (row.createdAt === boundary) continue;
      throw new Error('Duplicate swap away from page boundary.');
    }
    seen.add(key);
    if (retainParticipants && (
      (row.recipient != null && typeof row.recipient !== 'string') ||
      (row.senders != null && (!Array.isArray(row.senders) || row.senders.some(s => typeof s !== 'string'))) ||
      (row.appFees != null && !Array.isArray(row.appFees)))) throw new Error('Invalid private swap participant fields.');
    clean.push(Object.fromEntries([...FIELDS, ...(retainParticipants ? PARTICIPANT_FIELDS : [])].map(k => [k, row[k] ?? null])));
  }
  return clean;
}

export async function fetchPage(url, jwt, request, pause, log, { maxRetries, maxBackoffMs }) {
  const backoff = attempt => Math.min(maxBackoffMs, PACE_MS * 2 ** Math.min(attempt, 6));
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await request(url, { headers: { Authorization: `Bearer ${jwt}` }, redirect: 'error', signal: AbortSignal.timeout(60000) });
    } catch {
      if (attempt >= maxRetries) throw new Error('Explorer network request failed repeatedly.');
      log(`network error, retry ${attempt + 1}`);
      await pause(backoff(attempt));
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= maxRetries) throw new Error(`Explorer HTTP ${res.status} repeatedly.`);
      const retry = Number(res.headers?.get?.('retry-after'));
      const wait = res.status === 429 ? PACE_MS : backoff(attempt);
      log(`HTTP ${res.status}, retry ${attempt + 1}`);
      await pause(Math.min(maxBackoffMs, Math.max(wait, Number.isFinite(retry) ? retry * 1000 : 0)));
      continue;
    }
    if (!res.ok) throw new Error(`Explorer HTTP ${res.status}; response body omitted.`);
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error('Explorer schema changed: expected an array.');
    return rows;
  }
}

// Each page is saved before the next request; resume from its oldest row, including legacy pages.
export async function pullSwapsResumable(window, jwt, options = {}) {
  if (!jwt) throw new Error('NEAR_INTENTS_JWT missing; add the partner JWT to .env.');
  const { dir = swapDir(window), request = fetch, pause = sleep, log = () => {}, maxPages = Infinity } = options;
  const { tokenFilter, retainParticipants = false, shortPageEnds = false } = options;
  const { maxRetries = 20, maxBackoffMs = 300000 } = options;
  if (!Number.isSafeInteger(maxRetries) || maxRetries < 0 || !Number.isSafeInteger(maxBackoffMs) || maxBackoffMs < PACE_MS) {
    throw new Error('Invalid Explorer retry limits.');
  }
  if (tokenFilter && Array.isArray(tokenFilter.ids) && tokenFilter.ids.length !== 1) {
    throw new Error('Explorer token filters require exactly one token ID per pull.');
  }
  if (tokenFilter && (!['toTokenId', 'fromTokenId'].includes(tokenFilter.side) ||
      !Array.isArray(tokenFilter.ids) || !tokenFilter.ids.length ||
      tokenFilter.ids.some(id => typeof id !== 'string' || !id))) throw new Error('Invalid Explorer token filter.');
  await mkdir(resolve(dir, 'pages'), { recursive: true, mode: 0o700 });
  const base = explorerParams(window);
  if (tokenFilter) base[tokenFilter.side] = tokenFilter.ids;
  const meta = { window: { start: window.start, end: window.end }, params: base, ...(retainParticipants ? { retainParticipants: true } : {}) };
  const existing = await readJSON(resolve(dir, 'pull.json'));
  if (existing && (JSON.stringify(existing.params) !== JSON.stringify(base) ||
      Boolean(existing.retainParticipants) !== retainParticipants)) {
    throw new Error('Saved swap pull used different parameters; use a new directory.');
  }
  if (!existing) await atomic(resolve(dir, 'pull.json'), JSON.stringify({ ...meta, startedAt: new Date().toISOString() }, null, 2) + '\n');
  const done = await readJSON(resolve(dir, 'complete.json'));
  if (done) return done;

  const seen = new Set(), pages = await savedPages(dir);
  let last = null, rows = 0;
  for (const name of pages) {
    const page = await readPage(dir, name);
    for (const row of page.rows) {
      const key = swapKey(row);
      if (seen.has(key)) throw new Error(`Duplicate swap in saved ${name}.`);
      seen.add(key);
    }
    rows += page.rows.length;
    if (page.rows.length) last = page.rows.at(-1).createdAt;
  }
  if (pages.length) log(`resuming after ${pages.length} saved pages, ${rows} rows`);
  const params = { ...base };
  const setCursor = timestamp => { params.endTimestamp = new Date(Date.parse(timestamp) + 1).toISOString(); };
  if (last) setCursor(last);
  // Every HTTP attempt, retries included, starts at least PACE_MS after the previous attempt.
  let previousAttempt = 0;
  const paced = async (url, init) => {
    const wait = previousAttempt + PACE_MS - Date.now();
    if (previousAttempt && wait > 0) await pause(wait);
    previousAttempt = Date.now();
    return request(url, init);
  };
  let n = pages.length, fetched = 0;
  while (fetched < maxPages) {
    const query = new URLSearchParams(Object.entries(params).flatMap(([key, value]) =>
      Array.isArray(value) ? value.map(id => [key, id]) : [[key, value]]));
    const raw = await fetchPage(`${EXPLORER}?${query}`, jwt, paced, pause, log, { maxRetries, maxBackoffMs });
    fetched++;
    const clean = cleanRows(raw, window, seen, last, tokenFilter, retainParticipants);
    if (clean.length === 0 && raw.length >= Number(base.numberOfTransactions)) {
      throw new Error('Explorer timestamp pagination stalled: full page with no new rows.');
    }
    const exhausted = clean.length === 0 || (shortPageEnds && raw.length < Number(base.numberOfTransactions));
    if (clean.length) {
      const cursor = { createdAt: clean.at(-1).createdAt };
      n++; rows += clean.length;
      await atomic(resolve(dir, 'pages', pageName(n)), gzipSync(JSON.stringify({ page: n, fetchedAt: new Date().toISOString(), cursor, rows: clean })));
      last = cursor.createdAt; setCursor(last);
      log(`page ${n}: ${clean.length} rows, oldest ${clean.at(-1)?.createdAt ?? 'n/a'}, total ${rows}`);
    }
    if (exhausted) {
      const summary = { ...meta, pages: n, rows, complete: true, completedAt: new Date().toISOString() };
      await atomic(resolve(dir, 'complete.json'), JSON.stringify(summary, null, 2) + '\n');
      log(`complete: ${n} pages, ${rows} rows`);
      return summary;
    }
  }
  return { ...meta, pages: n, rows, complete: false };
}
