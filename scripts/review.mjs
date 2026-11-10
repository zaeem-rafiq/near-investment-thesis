import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import {
  ROOT, QUERIES, PLAN_ONLY_QUERIES, literalDateFilters, pullBigQuery, hash,
  LEDGER, PRE_LEDGER_BILLED_BYTES, positiveInteger, DEFAULT_MAX_BYTES_BILLED,
  EXPLORER, PRICE_SOURCE, explorerParams
} from './sources.mjs';
import { POSITION_SCAN_LIMIT } from './position-sources.mjs';
import { reviewCalendar } from './position-section.mjs';
import { fileStore } from './store.mjs';
import { pullWindows } from './participants.mjs';
import { NEAR_ASSET_IDS, FULL_WINDOW_PULLS, PARTICIPANT_RETRIES } from './position-config.mjs';
import { PACE_MS } from './swaps.mjs';

// SHA-256 of the unverified receiver in the *saved first-run* extraction
// data/raw/bigquery/signer_top10-rows.json, rank 2 in signer-top10.json.
// Match its hash, never disclose its identity or rerank a moving cohort.
const UNNAMED_RECEIVER_HASH = '59c79c2fbf9db42b1cc5a6d61561923c9c3ecb3359dec5ae7baf766f2bde0e31';
const REVIEW_QUERIES = {
  supply: QUERIES.supply, burn: QUERIES.burn,
  coverage: QUERIES.coverage, signer_split: PLAN_ONLY_QUERIES.signer_split
};
const span = w => `${w.start} to ${w.endExclusive} (end excluded)`;
const asWindow = w => ({ start: w.start, end: w.endExclusive });
const shellQuote = s => `'${s.replaceAll("'", "'\\''")}'`;
class ReviewError extends Error {}

export function parseReviewArgs(args) {
  const dates = args.filter(a => !a.startsWith('--'));
  const flags = args.filter(a => a.startsWith('--'));
  if (dates.length !== 1 || flags.some(f => !['--plan', '--run'].includes(f)) ||
      new Set(flags).size !== flags.length || flags.length > 1) {
    throw new ReviewError('Usage: npm run review -- DATE [--plan | --run]');
  }
  const entry = reviewCalendar({ input: {} }).find(r => r.date === dates[0]);
  if (!entry) throw new ReviewError('Unscheduled review date; use 2026-11-16, 2027-02-01, 2027-05-03, 2027-08-02 or 2027-11-01.');
  return { entry, mode: flags[0]?.slice(2) || 'offline' };
}

// Replace every quoted ISO date in a single pass (no cascading replacements).
// Each source file has an explicit map; unknown literals fail closed.
export function mapSqlDates(sql, mapping) {
  return sql.replace(/'(\d{4}-\d{2}-\d{2})'/g, (_, date) => {
    if (!Object.hasOwn(mapping, date)) throw new ReviewError('Unmapped SQL literal date; review the source template before proceeding.');
    return `'${mapping[date]}'`;
  });
}

function frozenHashes(snapshot) {
  if (snapshot.receivers?.length !== 10 ||
      snapshot.receivers.filter(r => r.receiver === 'unnamed account').length !== 1) {
    throw new ReviewError('Frozen cohort snapshot is incomplete; refusing to invent receivers.');
  }
  const hashes = snapshot.receivers.map((r, i) => {
    if (r.rank !== i + 1) throw new ReviewError('Frozen cohort ranks changed.');
    if (r.receiver === 'unnamed account') {
      if (r.rank !== 2 || r.earlierMeanDailySigners !== 81627.8904109589) throw new ReviewError('Frozen unnamed receiver changed.');
      return UNNAMED_RECEIVER_HASH;
    }
    if (!/^[a-z0-9_.-]+$/.test(r.receiver)) throw new ReviewError('Invalid frozen receiver.');
    return hash(r.receiver);
  });
  if (new Set(hashes).size !== 10) throw new ReviewError('Duplicate frozen receiver.');
  return hashes;
}

export function fillReviewSql(name, template, entry, cohortHashes) {
  const current = entry.window, prior = entry.usageComparison.earlier;
  let mapping = { '2025-11-03': current.start, '2026-11-02': current.endExclusive };
  if (name === 'coverage') mapping = { '2024-11-01': prior.start, '2026-11-02': current.endExclusive };
  if (name === 'signer_split') {
    mapping = {
      '2024-11-01': prior.start, '2025-11-01': current.start, '2026-11-01': current.endExclusive
    };
  }
  // Check all dates, including literals in the CTE that will be removed.
  let sql = mapSqlDates(template, mapping);
  if (name === 'signer_split') {
    const cohort = /\), receiver_scores AS \([\s\S]*?\), ranked AS \(/;
    if ((sql.match(/\), receiver_scores AS \(/g) || []).length !== 1 || !cohort.test(sql) ||
        !sql.includes('INTERVAL 1 YEAR') || !sql.includes('/ 365.0')) {
      throw new ReviewError('Signer split template changed; refusing to guess its cohort or periods.');
    }
    sql = sql.replace(/^--[^\n]*\n/gm, '');
    sql = '-- Original frozen ten, matched by SHA-256; no new ranking.\n' + sql.replace(cohort,
      `), top10 AS (\n  SELECT DISTINCT receiver_account_id FROM signer_receiver_days\n` +
      `  WHERE LOWER(TO_HEX(SHA256(receiver_account_id))) IN (\n    ${cohortHashes.map(h => `'${h}'`).join(',\n    ')}\n  )\n), ranked AS (`);
    // Review periods are 52 weeks, not calendar years (including leap years).
    sql = sql.replace('INTERVAL 1 YEAR', 'INTERVAL 364 DAY').replace('/ 365.0', '/ 364.0');
  }
  literalDateFilters(sql);
  return sql;
}

function pullCommand(window, dir, filter = null, weekly = false) {
  // Commands are printed only. They use an explicitly exported JWT, not .env.
  // A final pause also spaces serial commands/windows across process boundaries.
  const program = [
    'import {pullSwapsResumable,PACE_MS} from "./scripts/swaps.mjs";',
    'import {pullWindows} from "./scripts/participants.mjs";',
    'import {sleep} from "./scripts/sources.mjs";',
    `const window=${JSON.stringify(window)};`,
    `const windows=${weekly ? 'pullWindows(window)' : '[{...window,directory:"full"}]'};`,
    'try { for (const w of windows) {',
    `await pullSwapsResumable(w,process.env.NEAR_INTENTS_JWT,{dir:${JSON.stringify(dir)}+${weekly ? '"/"+w.directory' : '""'},`,
    `retainParticipants:true,${filter ? `tokenFilter:${JSON.stringify(filter)},shortPageEnds:true,` : ''}`,
    `...${JSON.stringify(PARTICIPANT_RETRIES)}}); await sleep(PACE_MS);`,
    '} } catch { console.error("Explorer pull failed; private details omitted."); process.exitCode=1; }'
  ].join('');
  return `node --input-type=module -e ${shellQuote(program)}`;
}

export async function buildReview(entry, { root = ROOT } = {}) {
  if (!entry.window) return { entry, sql: {}, pulls: [], output: `${entry.date}: ${entry.action}.\nRecord veto status manually from the HSP-029 governance source; no checks run, no source requests.\n` };
  const snapshot = JSON.parse(await readFile(resolve(root, 'data/public/signer-top10.json'), 'utf8'));
  const hashes = frozenHashes(snapshot), sql = {};
  for (const name of Object.keys(REVIEW_QUERIES)) {
    sql[name] = fillReviewSql(name, await readFile(resolve(root, `sql/${name}.sql`), 'utf8'), entry, hashes);
  }
  const window = asWindow(entry.window), weekly = pullWindows(window);
  const dir = `data/raw/review/${entry.date}`;
  const pulls = ['buys', 'sells'].flatMap(side => NEAR_ASSET_IDS.map((asset, i) => {
    const full = FULL_WINDOW_PULLS.some(p => p.side === side && p.asset === asset);
    const filter = { side: side === 'buys' ? 'toTokenId' : 'fromTokenId', ids: [asset] };
    return { side, asset, filter, full, windows: full ? [window] : weekly,
      command: pullCommand(window, `${dir}/participants/${side}/asset-${i + 1}`, filter, !full) };
  }));
  const lines = [
    `${entry.date}: recompute Check 1 final, Check 2 and Check 3 (source preparation only).`,
    `Check 1 window: ${span(entry.window)}`,
    `Check 2 window: ${span(entry.check2Window)}`,
    `Check 3 current usage window: ${span(entry.usageComparison.later)}`,
    `Check 3 prior usage window: ${span(entry.usageComparison.earlier)}`,
    'Frozen cohort: the original ten from data/public/signer-top10.json; rank 2 is matched by its saved SHA-256, not disclosed or reranked.',
    `Own eligible window: ${entry.ownEligible ? 'yes' : 'no'} (not a check result).`,
    ...Object.entries(sql).map(([name, body]) => `\n--- sql/${name}.sql (review dates) ---\n${body}`),
    `NEAR Intents Explorer: ${EXPLORER}`,
    `1Click swap window: ${span(entry.window)}; SUCCESS, all assets, retain private participant fields for final exclusions.`,
    `Explorer request parameters: ${JSON.stringify(explorerParams(window))}`,
    `Pacing: ${PACE_MS / 1000} s minimum between every HTTP attempt, including retries. Run commands serially, never concurrently.`,
    `1Click pull command (not executed):\n${pullCommand(window, `${dir}/swaps`)}`,
    `Shared weekly participant windows (end excluded): ${weekly.map(w => `${w.start} to ${w.end}`).join('; ')}`,
    ...pulls.map(p => `Participant ${p.side}: ${p.filter.side}=${p.asset}; ${span(entry.window)}; ${p.full ? 'one full window (existing hypercore buy exception)' : `${p.windows.length} weekly windows listed above`}.\nCommand (not executed):\n${p.command}`),
    `Coinbase NEAR-USD daily price window: ${span(entry.window)}; ${PRICE_SOURCE}; granularity 86400, at most 250 days per request.`,
    `Wallet flows: NEARBlocks, NOT BigQuery; ${span(entry.check2Window)}; aggregate successful external NEAR/wNEAR transfers for all three revenue wallets, excluding internal and not_received transfers.`,
    'No check values or call are computed. Explorer, Coinbase, NEARBlocks, reconciliation, exclusions, wallet-week aggregation and review calculations remain separate work; original snapshot exporters are NOT review-date aware.',
    'data/public is never written by this command.'
  ];
  return { entry, sql, pulls, output: lines.join('\n') + '\n' };
}

// Inject credentials, HTTP and store at the boundary. Offline never reaches it,
// reads .env, invokes gcloud, writes files or pulls any source.
export async function runReview(args, dependencies = {}) {
  const { entry, mode } = parseReviewArgs(args);
  if (mode === 'run') {
    const today = new Date(dependencies.now ?? Date.now()).toISOString().slice(0, 10);
    if (today < entry.date) throw new ReviewError('Review date has not arrived (UTC); --run refused before any request.');
  }
  const review = await buildReview(entry, dependencies);
  const log = dependencies.log || (line => process.stdout.write(line));
  log(review.output);
  if (!entry.window || mode === 'offline') {
    if (entry.window) log('Offline only: no credentials read, no requests, no billed jobs. Use --plan for free estimates; --run requires the review date to have arrived.\n');
    return review;
  }
  // Deliberately do not call environment(): credentials come from the explicitly
  // exported process environment or an injected test provider, never .env.
  const env = await (dependencies.credentials || (() => ({ ...process.env })))();
  const store = dependencies.store || fileStore();
  if (mode === 'run') {
    positiveInteger(env.MAX_BYTES_BILLED, DEFAULT_MAX_BYTES_BILLED);
    const body = await store.read(LEDGER);
    const ledger = body ? JSON.parse(body) : { preLedgerBilledBytes: PRE_LEDGER_BILLED_BYTES, entries: [] };
    if (!Number.isSafeInteger(ledger.preLedgerBilledBytes) || ledger.preLedgerBilledBytes < 0 ||
        !Array.isArray(ledger.entries) || ledger.entries.some(e => !Number.isSafeInteger(e.billedBytes) || e.billedBytes < 0)) {
      throw new ReviewError('Invalid billing ledger; no requests permitted.');
    }
    const spent = ledger.preLedgerBilledBytes + ledger.entries.reduce((s, e) => s + e.billedBytes, 0);
    if (!Number.isSafeInteger(spent) || spent >= POSITION_SCAN_LIMIT) throw new ReviewError('900 GB cumulative gate reached; no requests permitted.');
  }
  const prefix = `data/raw/review/${entry.date}/bigquery/`;
  // Preserve the shared billing ledger; isolate all query results by review date.
  const path = p => p === LEDGER ? p : prefix + p.slice('data/raw/bigquery/'.length);
  const scopedStore = { read: p => store.read(path(p)), write: (p, b) => store.write(path(p), b) };
  const temporary = await mkdtemp(join(tmpdir(), 'near-review-'));
  try {
    await mkdir(join(temporary, 'sql'));
    for (const [name, body] of Object.entries(review.sql)) await writeFile(join(temporary, 'sql', `${name}.sql`), body, { mode: 0o600 });
    const result = await pullBigQuery(env, scopedStore, {
      root: temporary, queries: REVIEW_QUERIES, force: mode === 'plan', mode,
      cumulativeLimit: POSITION_SCAN_LIMIT, fetcher: dependencies.fetcher,
      accessToken: dependencies.accessToken, pause: dependencies.pause
    });
    // pullBigQuery's reused-result path is its logical cache key, not the
    // remapped physical path returned by scopedStore.write for new results.
    for (const record of Object.values(result.result)) {
      if (record.reused) record.path = path(record.path);
    }
    for (const plan of result.plans) plan.path = path(plan.path);
    for (const p of result.plans) log(p.reused ? `${p.name}: matching review result cached; no job submitted.\n`
      : `${p.name}: ${p.bytes} estimated bytes (dryRun: true).\n`);
    if (mode === 'plan') log(`Plan only: ${result.estimate} estimated bytes; dry runs bill nothing; no billed jobs or source pulls submitted.\n`);
    else log(`BigQuery collection completed (matching results reused); raw results in ${prefix}; shared billing ledger updated for new jobs only. Cumulative billed: ${result.cumulativeBilledBytes ?? 'unchanged (all results cached)'}. No Explorer/price/wallet pulls or checks performed; run the printed Explorer commands next with fresh owner approval.\n`);
    return { ...review, result };
  } catch {
    // Existing HTTP errors may contain remote SQL bodies; never relay them.
    throw new ReviewError('Review BigQuery refused or failed: check credentials, schema and per-run/cumulative budget gates. Remote details omitted.');
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runReview(process.argv.slice(2)).catch(error => {
    console.error(error instanceof ReviewError ? error.message : 'Review failed; local or remote details omitted.');
    process.exitCode = 1;
  });
}
