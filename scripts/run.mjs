import { copyFile, readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ROOT, QUERIES, environment, pullBigQuery, pullPrices } from './sources.mjs';
import { SWAP_WINDOW, swapDir, savedPages, readJSON } from './swaps.mjs';
import { CAL, loadSources, loadSwapDir, render, verifyThesis, thesisHTML } from './report.mjs';
import { exportPublic } from './public.mjs';
import { atomic, fileStore } from './store.mjs';

function safeError(error, env) {
  let message = error.message || 'Source request failed.';
  for (const secret of [env.NEAR_INTENTS_JWT]) if (secret) message = message.replaceAll(secret, '[redacted]');
  // Network errors should not expose stacks or credential-bearing request objects.
  if (error.name === 'TypeError' || error.name === 'TimeoutError') return 'Source network request failed or timed out.';
  return message;
}

async function plan(env) {
  const r = await pullBigQuery(env, fileStore(), { mode: 'plan', force: true });
  for (const p of r.plans) console.log(`${p.name.padEnd(10)} ${(p.bytes / 1e9).toFixed(2).padStart(8)} GB  ${p.filters.map(f => f.dates ? `${f.table}: ${f.dates.length} literal dates` : `${f.table}: ${f.start} to ${f.end} (end excluded)`).join('; ')}`);
  console.log(`total      ${(r.estimate / 1e9).toFixed(2).padStart(8)} GB (dry run, no bytes billed)`);
}

async function refresh(env, force) {
  const store = fileStore();
  const id = new Date().toISOString().replaceAll(/[:.]/g, '-') + '_' + randomUUID().slice(0, 8);
  const manifest = { version: 2, id, fetchedAt: new Date().toISOString(), sources: {} };
  try {
    console.log(force ? 'BigQuery: forced rescan of every query.' : 'BigQuery: reuse cached results whose SQL and date window match; dry-run and run the rest.');
    const { result } = await pullBigQuery(env, store, { mode: 'run', force });
    for (const [name, r] of Object.entries(result)) {
      manifest.sources[name] = { status: 'ok', path: r.path, sha256: r.sha256, reused: r.reused, jobId: r.jobId, billedBytes: r.reused ? 0 : r.billedBytes };
      console.log(`  ${name}: ${r.reused ? 'cached result reused' : `${(r.billedBytes / 1e9).toFixed(2)} GB billed`}`);
    }
  } catch (e) {
    const reason = safeError(e, env);
    for (const name of Object.keys(QUERIES)) manifest.sources[name] = { status: 'unavailable', reason };
    console.error(`BigQuery unavailable: ${reason}`);
  }
  try {
    console.log('Prices: Coinbase NEAR-USD daily candles.');
    manifest.sources.prices = { status: 'ok', ...await store.write(`data/raw/${id}/prices.json`, JSON.stringify(await pullPrices(CAL.priceWindow), null, 2) + '\n') };
  } catch (e) {
    manifest.sources.prices = { status: 'unavailable', reason: safeError(e, env) };
    console.error(`Prices unavailable: ${manifest.sources.prices.reason}`);
  }
  const dir = swapDir(SWAP_WINDOW);
  try {
    if (!await readJSON(resolve(dir, 'complete.json'))) {
      const pages = (await savedPages(dir)).length;
      throw new Error(`1Click pull incomplete: ${pages} pages saved. Run npm run pull-swaps to resume it.`);
    }
    const swaps = await loadSwapDir(dir);
    manifest.sources.swaps = { status: 'ok', dir: relative(ROOT, dir), pages: swaps.pages, rows: swaps.rows, pagesSha256: swaps.pagesSha256 };
    console.log(`1Click: ${swaps.rows} successful swaps in ${swaps.pages} saved pages.`);
  } catch (e) {
    manifest.sources.swaps = { status: 'unavailable', reason: safeError(e, env) };
    console.error(`1Click unavailable: ${manifest.sources.swaps.reason}`);
  }
  await store.write(`data/raw/${id}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
  await store.write('data/raw/latest.json', JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

async function main() {
  const mode = process.argv[2] || 'build', force = process.argv.includes('--rescan');
  if (!['build', 'refresh', 'export', 'plan'].includes(mode)) throw new Error('Usage: node scripts/run.mjs build|refresh [--rescan]|export [--swaps]|plan');
  if (mode === 'plan') return plan(await environment());
  if (mode === 'refresh' || mode === 'export') {
    const raw = mode === 'refresh' ? await refresh(await environment(), force)
      : JSON.parse(await readFile(resolve(ROOT, 'data/raw/latest.json'), 'utf8'));
    await exportPublic(raw, { swaps: mode === 'refresh' ? raw.sources.swaps?.status === 'ok' : process.argv.includes('--swaps') });
    console.log('Exported aggregate files to data/public/. Review the thesis metrics before rebuilding.');
    if (mode === 'export') return;
  }
  const { manifest, sources } = await loadSources();
  if (manifest.id == null) throw new Error('No public snapshot. Export saved sources before rebuilding.');
  const write = (name, body) => atomic(resolve(ROOT, 'dashboard', name), body);
  const { analysis } = await render(manifest, sources, write);
  const thesis = await readFile(resolve(ROOT, 'THESIS.md'), 'utf8');
  verifyThesis(thesis, analysis);
  await copyFile(resolve(ROOT, 'web/style.css'), resolve(ROOT, 'dashboard/style.css'));
  await atomic(resolve(ROOT, 'dashboard/THESIS.md'), thesis);
  await atomic(resolve(ROOT, 'dashboard/thesis.html'), thesisHTML(thesis));
  console.log(`Rebuilt dashboard/ and verified THESIS.md from public snapshot ${manifest.id}: T1 ${analysis.t1.verdict}, T2 ${analysis.t2.verdict}, T3 ${analysis.t3.verdict}.`);
  if (mode === 'refresh' && Object.keys(manifest.unavailable).length) {
    console.error('Refresh incomplete. Unavailable sources are shown in the dashboard; no data was substituted.');
    process.exitCode = 1;
  }
}
main().catch(e => { console.error(`Build stopped: ${e.message}`); process.exitCode = 1; });
