import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, sleep } from './sources.mjs';
import { atomic } from './store.mjs';
import { REVENUE_WALLETS } from './position-config.mjs';

export const NEARBLOCKS_SOURCE = 'https://api.nearblocks.io';
export const HOLDERS_SOURCE = 'https://api.llama.fi/summary/fees/near-intents?dataType=dailyHoldersRevenue';
export const RAW_NEARBLOCKS = 'data/raw/nearblocks';
const EXPECTED_MINIMUM = [3304, 1543, 547];
async function optional(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}

// No credentials. Only fixed public hosts and the three owner-approved accounts.
// Responses remain private; errors and progress never include response bodies.
export async function collectNearblocks({ root = ROOT, request = fetch, pause = sleep, now = Date.now, progress = () => {} } = {}) {
  const dir = resolve(root, RAW_NEARBLOCKS);
  let last = (await optional(resolve(dir, 'last-request.json')))?.at || 0;
  async function get(url) {
    for (let attempt = 0; attempt < 6; attempt++) {
      await pause(Math.max(0, last + 12500 - now()));
      last = now();
      await atomic(resolve(dir, 'last-request.json'), JSON.stringify({ at: last }));
      const response = await request(url, { redirect: 'error', signal: AbortSignal.timeout(60000) });
      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && attempt < 5) {
          const retry = Number(response.headers?.get('retry-after'));
          await pause(Math.max(12500, Math.min(120000, Number.isFinite(retry) ? retry * 1000 : 12500 * 2 ** attempt)));
          continue;
        }
        throw new Error(`NEARBlocks HTTP ${response.status}; private response omitted.`);
      }
      const body = await response.text();
      JSON.parse(body);
      return { url, fetchedAt: new Date(now()).toISOString(), body };
    }
  }
  const complete = [];
  for (const wallet of REVENUE_WALLETS) {
    for (const kind of ['receipts', 'ft-txns']) {
      let cursor, total = 0, page = 1, previousTime = -1n;
      const cursors = new Set(), ids = new Set();
      for (;;) {
        const params = new URLSearchParams({ per_page: '100', order: 'asc' });
        if (kind === 'ft-txns') params.set('contract', 'wrap.near');
        if (cursor) params.set('cursor', cursor);
        else if (kind === 'ft-txns') params.set('page', String(page));
        const url = `${NEARBLOCKS_SOURCE}/v1/account/${wallet}/${kind}?${params}`;
        const path = resolve(dir, wallet, kind, `page-${String(page).padStart(4, '0')}.json`);
        let record = await optional(path);
        if (record && record.url !== url) throw new Error('Cached NEARBlocks request mismatch.');
        if (!record) { record = await get(url); await atomic(path, JSON.stringify(record) + '\n'); }
        const data = JSON.parse(record.body), rows = data.txns;
        if (!Array.isArray(rows) || rows.length > 100) throw new Error('NEARBlocks page schema changed.');
        for (const row of rows) {
          const id = row.id;
          if (typeof id !== 'string' || ids.has(id)) throw new Error('Missing or duplicate NEARBlocks row identity.');
          ids.add(id);
          if (!/^\d+$/.test(row.block_timestamp)) throw new Error('Invalid NEARBlocks timestamp.');
          const time = BigInt(row.block_timestamp);
          if (time < previousTime) throw new Error('NEARBlocks ascending pagination violated.');
          previousTime = time;
        }
        total += rows.length;
        progress({ wallet, kind, page, rows: rows.length, total });
        if (rows.length < 100) break;
        if (typeof data.cursor !== 'string' || !data.cursor || cursors.has(data.cursor)) {
          throw new Error('NEARBlocks full page has no new cursor; refusing incomplete history.');
        }
        cursor = data.cursor; cursors.add(cursor); page++;
      }
      const summary = { wallet, kind, pages: page, rows: total, perPage: 100, order: 'asc', complete: true };
      await atomic(resolve(dir, wallet, kind, 'complete.json'), JSON.stringify(summary) + '\n');
      complete.push(summary);
    }
  }
  // Owner-provided counts are a set; histories only grow, so compare sorted pairs.
  const got = complete.filter(h => h.kind === 'receipts').map(h => h.rows).sort((a, b) => a - b);
  const want = [...EXPECTED_MINIMUM].sort((a, b) => a - b);
  if (got.some((n, i) => n < want[i])) throw new Error('Receipt history is shorter than the owner-provided counts.');
  await atomic(resolve(dir, 'complete.json'), JSON.stringify({ complete: true, completedAt: new Date(now()).toISOString(), histories: complete }, null, 2) + '\n');
  return complete;
}

export async function collectHoldersRevenue({ root = ROOT, request = fetch } = {}) {
  const response = await request(HOLDERS_SOURCE, { redirect: 'error', signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`DefiLlama HTTP ${response.status}; response omitted.`);
  const body = await response.text(), data = JSON.parse(body);
  if (!Array.isArray(data.totalDataChart)) throw new Error('DefiLlama holders-revenue schema changed.');
  await atomic(resolve(root, RAW_NEARBLOCKS, 'holders-revenue.json'), JSON.stringify({ url: HOLDERS_SOURCE, fetchedAt: new Date().toISOString(), body }) + '\n');
  return { days: data.totalDataChart.length, dataType: 'dailyHoldersRevenue' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv[2] !== 'collect') throw new Error('Usage: node scripts/nearblocks.mjs collect');
    console.log(JSON.stringify(await collectHoldersRevenue()));
    console.log(JSON.stringify(await collectNearblocks({ progress: item => console.log(JSON.stringify(item)) })));
  } catch { console.error('Collection failed; private response details omitted.'); process.exitCode = 1; }
}
