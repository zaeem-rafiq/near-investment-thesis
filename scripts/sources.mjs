import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '..');
export const DATASET = 'bigquery-public-data.crypto_near_mainnet_us';
// The dataset lives in us-east1; jobs sent to the US multi-region fail with 403 Access Denied.
export const BQ_LOCATION = 'us-east1';
export const EXPLORER = 'https://explorer.near-intents.org/api/v0/transactions';
export const PRICE_SOURCE = 'https://api.exchange.coinbase.com/products/NEAR-USD/candles';
// Query name -> tables it scans. Every SQL file carries its own literal block_date filter.
export const QUERIES = {
  signers: ['transactions'],
  contracts: ['receipt_actions'],
  coverage: ['blocks'],
  supply: ['blocks'],
  burn: ['execution_outcomes', 'transactions']
};
// Build-only additions are estimated by plan, never included in refresh.
export const PLAN_ONLY_QUERIES = { signer_split: ['transactions'] };
export const REQUIRED_COLUMNS = {
  transactions: { block_date: 'DATE', signer_account_id: 'STRING', receiver_account_id: 'STRING', receipt_conversion_tokens_burnt: 'FLOAT' },
  receipt_actions: { block_date: 'DATE', action_kind: 'STRING', receipt_receiver_account_id: 'STRING' },
  blocks: { block_date: 'DATE', block_height: 'INTEGER', block_hash: 'STRING', prev_block_hash: 'STRING', block_timestamp_utc: 'TIMESTAMP', total_supply: 'FLOAT' },
  execution_outcomes: { block_date: 'DATE', tokens_burnt: 'FLOAT' }
};
export const DEFAULT_MAX_BYTES_BILLED = 300_000_000_000;
export const CUMULATIVE_SCAN_LIMIT = 1_000_000_000_000;
// Billed bytes from the Step 1 freshness, history-start and unit probes, run before the ledger existed.
export const PRE_LEDGER_BILLED_BYTES = 9_215_934_464;
export const hash = value => createHash('sha256').update(value).digest('hex');
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function environment() {
  let local = {};
  try {
    const body = await readFile(resolve(ROOT, '.env'), 'utf8');
    for (const line of body.split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (!match) throw new Error('Invalid .env syntax; use KEY=value, without shell commands.');
      local[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  return { ...local, ...process.env };
}

export function positiveInteger(value, fallback) {
  const n = Number(value || fallback);
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error('Limits must be positive safe integers.');
  return n;
}

const DATE = String.raw`DATE\s*'(\d{4}-\d{2}-\d{2})'`;
const TABLE_REF = /`bigquery-public-data\.crypto_near_mainnet_us\.(\w+)`/g;
const FILTER = new RegExp(String.raw`^\s*(?:AS\s+\w+\s+)?WHERE\s+block_date\s+(?:>=\s*${DATE}\s+AND\s+block_date\s*<\s*${DATE}|IN\s*\(\s*(${DATE}(?:\s*,\s*${DATE})*)\s*\))`, 'i');
const validDate = d => Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d;

// Refuses any SQL in which a dataset table is read without an immediate literal block_date range or date list.
export function literalDateFilters(sql) {
  const code = sql.replace(/--[^\n]*/g, '');
  if (/INFORMATION_SCHEMA|@\w+/i.test(code)) throw new Error('Queries must not use INFORMATION_SCHEMA or parameters.');
  if ((code.match(/`[^`]*`/g) || []).some(t => !/^`bigquery-public-data\.crypto_near_mainnet_us\.\w+`$/.test(t))) {
    throw new Error('Only dataset tables may be referenced.');
  }
  const filters = [];
  for (const match of code.matchAll(TABLE_REF)) {
    const m = code.slice(match.index + match[0].length).match(FILTER);
    if (!m) throw new Error(`Table ${match[1]} is read without a literal block_date filter.`);
    let filter;
    if (m[1]) {
      if (!validDate(m[1]) || !validDate(m[2]) || m[2] <= m[1]) throw new Error('Invalid literal block_date range.');
      filter = { table: match[1], start: m[1], end: m[2] };
    } else {
      const list = [...m[3].matchAll(new RegExp(DATE, 'gi'))].map(x => x[1]);
      if (!list.every(validDate) || new Set(list).size !== list.length) throw new Error('Invalid literal block_date list.');
      filter = { table: match[1], dates: list };
    }
    const span = filter.dates ? filter.dates.length : (Date.parse(filter.end) - Date.parse(filter.start)) / 86400000;
    if (span > 800) throw new Error('Literal block_date filter spans more than 800 days.');
    filters.push(filter);
  }
  if (!filters.length) throw new Error('Query reads no dataset table.');
  return filters;
}

async function jsonRequest(url, options = {}, fetcher = fetch) {
  const response = await fetcher(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(60000) });
  if (!response.ok) {
    // BigQuery 400 errors describe the SQL, never the bearer token; other bodies stay omitted.
    let detail = '';
    if (response.status === 400 && String(url).startsWith('https://bigquery.googleapis.com/')) {
      try { detail = ` ${String((await response.json()).error?.message || '').slice(0, 300)}`; } catch {}
    }
    throw new Error(`Source HTTP ${response.status}; response body omitted to protect credentials.${detail}`);
  }
  return response.json();
}

export function explorerParams(window) {
  // Both API bounds are exclusive. Widen by 1 ms, then enforce [start,end) locally.
  return {
    numberOfTransactions: '1000', direction: 'next', statuses: 'SUCCESS',
    showTestTxs: 'false', minUsdPrice: '0',
    startTimestamp: new Date(Date.parse(window.start) - 1).toISOString(),
    endTimestamp: new Date(window.end).toISOString()
  };
}

// Coinbase Exchange public daily candles (no key): [time, low, high, open, close, volume], at most 300 per request.
export async function pullPrices(window, fetcher = fetch, pause = sleep) {
  const days = [];
  for (let t = Date.parse(window.start); t < Date.parse(window.end); t += 250 * 86400000) {
    const stop = Math.min(t + 250 * 86400000, Date.parse(window.end)) - 86400000;
    const p = new URLSearchParams({ granularity: '86400', start: new Date(t).toISOString(), end: new Date(stop).toISOString() });
    const rows = await jsonRequest(`${PRICE_SOURCE}?${p}`, { headers: { 'User-Agent': 'near-evidence-thesis' } }, fetcher);
    if (!Array.isArray(rows)) throw new Error('Price source schema changed: expected an array.');
    for (const r of rows) {
      if (!Array.isArray(r) || r.length < 5 || !Number.isFinite(r[0]) || !(r[4] > 0)) throw new Error('Invalid price candle.');
      const day = new Date(r[0] * 1000).toISOString().slice(0, 10);
      if (day >= window.start && day < window.end) days.push({ date: day, close: r[4] });
    }
    await pause(400);
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  if (new Set(days.map(d => d.date)).size !== days.length) throw new Error('Duplicate price days.');
  return { source: PRICE_SOURCE, product: 'NEAR-USD', granularity: 86400, window, days };
}

function decodeBQ(field, value) {
  if (value == null) return null;
  if (field.mode === 'REPEATED') return value.map(x => decodeBQ({ ...field, mode: 'NULLABLE' }, x.v));
  if (field.type === 'RECORD' || field.type === 'STRUCT') return decodeRows(field.fields, [value])[0];
  if (field.type === 'TIMESTAMP') {
    const milliseconds = Number(value) * 1000;
    if (!Number.isFinite(milliseconds)) throw new Error('Invalid BigQuery timestamp.');
    return new Date(milliseconds).toISOString();
  }
  return value;
}
export function decodeRows(fields, rows = []) {
  return rows.map(row => Object.fromEntries(fields.map((f, i) => [f.name, decodeBQ(f, row.f[i].v)])));
}

export const cachePath = (name, sql) => `data/raw/bigquery/${name}-${hash(sql).slice(0, 16)}.json`;
export const LEDGER = 'data/raw/bigquery/ledger.json';

// store: { read(relPath) -> string|null, write(relPath, body) -> { path, sha256 } }.
// mode 'plan' dry-runs only; 'run' reuses cached results whose SQL and literal windows match unless force is set.
export async function pullBigQuery(env, store, dependencies = {}) {
  const { mode = 'run', force = false } = dependencies;
  const queries = dependencies.queries || (mode === 'plan' ? { ...QUERIES, ...PLAN_ONLY_QUERIES } : QUERIES);
  const cumulativeLimit = dependencies.cumulativeLimit ?? CUMULATIVE_SCAN_LIMIT;
  if (!Number.isSafeInteger(cumulativeLimit) || cumulativeLimit <= 0 || cumulativeLimit > CUMULATIVE_SCAN_LIMIT) {
    throw new Error('Invalid cumulative limit; it must not exceed 1 TB.');
  }
  const plans = [];
  for (const [name, tables] of Object.entries(queries)) {
    const sql = await readFile(resolve(dependencies.root || ROOT, `sql/${name}.sql`), 'utf8');
    const filters = literalDateFilters(sql);
    if (JSON.stringify([...new Set(filters.map(f => f.table))].sort()) !== JSON.stringify([...tables].sort())) {
      throw new Error(`sql/${name}.sql reads unexpected tables.`);
    }
    const path = cachePath(name, sql), body = await store.read(path);
    const cached = body && JSON.parse(body);
    if (!force && cached && cached.sql === sql && JSON.stringify(cached.filters) === JSON.stringify(filters)) {
      plans.push({ name, sql, filters, path, reused: true, body });
    } else plans.push({ name, sql, filters, path, reused: false });
  }
  const pending = plans.filter(p => !p.reused);
  const result = {};
  for (const p of plans.filter(p => p.reused)) {
    const cached = JSON.parse(p.body);
    result[p.name] = { ...cached, path: p.path, sha256: hash(p.body), reused: true };
  }
  if (!pending.length && mode === 'run') return { result, estimate: 0, plans };

  if (!env.GOOGLE_CLOUD_PROJECT || !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(env.GOOGLE_CLOUD_PROJECT)) {
    throw new Error('Set GOOGLE_CLOUD_PROJECT in .env to a query-enabled Google Cloud project.');
  }
  let token = dependencies.accessToken;
  try { token ||= execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000 }).trim(); }
  catch { throw new Error('Google Cloud CLI authentication unavailable. Install gcloud and run gcloud auth login.'); }
  const cap = positiveInteger(env.MAX_BYTES_BILLED, DEFAULT_MAX_BYTES_BILLED);
  const project = env.GOOGLE_CLOUD_PROJECT;
  const base = `https://bigquery.googleapis.com/bigquery/v2/projects/${project}`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const api = (url, body) => jsonRequest(url, { headers, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) }, dependencies.fetcher);

  for (const table of new Set(pending.flatMap(p => queries[p.name]))) {
    const meta = await api(`https://bigquery.googleapis.com/bigquery/v2/projects/bigquery-public-data/datasets/crypto_near_mainnet_us/tables/${table}`);
    const types = Object.fromEntries((meta.schema?.fields || []).map(f => [f.name, f.type]));
    for (const [column, type] of Object.entries({ ...REQUIRED_COLUMNS[table], ...dependencies.requiredColumns?.[table] })) {
      if (types[column] !== type) throw new Error(`Live schema mismatch: ${table}.${column} is ${types[column] || 'missing'}, expected ${type}.`);
    }
  }
  let estimate = 0;
  for (const plan of pending) {
    plan.query = { query: plan.sql, useLegacySql: false, maximumBytesBilled: String(cap) };
    const dry = await api(`${base}/jobs`, { jobReference: { projectId: project, location: BQ_LOCATION }, configuration: { dryRun: true, query: plan.query } });
    if (dry.status?.errorResult) throw new Error(`BigQuery dry-run rejected ${plan.name}. Check schema and permissions.`);
    plan.bytes = Number(dry.statistics?.query?.totalBytesProcessed ?? dry.statistics?.totalBytesProcessed);
    if (!Number.isSafeInteger(plan.bytes) || plan.bytes < 0) throw new Error('Missing dry-run byte estimate; refusing a billed job.');
    estimate += plan.bytes;
  }
  if (mode === 'plan') return { result, estimate, plans };
  if (estimate > cap) throw new Error(`Total dry-run estimate ${estimate} bytes exceeds budget ${cap}; narrow the SQL or explicitly raise MAX_BYTES_BILLED.`);
  const ledgerBody = await store.read(LEDGER);
  const ledger = ledgerBody ? JSON.parse(ledgerBody) : { preLedgerBilledBytes: PRE_LEDGER_BILLED_BYTES, entries: [] };
  const spent = () => ledger.preLedgerBilledBytes + ledger.entries.reduce((s, e) => s + e.billedBytes, 0);
  if (spent() + estimate > cumulativeLimit) {
    throw new Error(`Cumulative scans would pass ${cumulativeLimit === CUMULATIVE_SCAN_LIMIT ? '1 TB' : `${cumulativeLimit / 1e9} GB`} (${spent()} billed so far + ${estimate} estimated). Stopping before jobs.`);
  }
  let remaining = Math.min(cap, cumulativeLimit - spent());
  for (const plan of pending) {
    if (remaining <= 0) throw new Error('Actual billed-byte budget exhausted; no further jobs submitted.');
    const jobId = `near_thesis_${randomUUID().replaceAll('-', '')}`;
    const job = await api(`${base}/jobs`, {
      jobReference: { projectId: project, jobId, location: BQ_LOCATION },
      configuration: { query: { ...plan.query, maximumBytesBilled: String(remaining) }, jobTimeoutMs: '600000' }
    });
    if (job.status?.errorResult) throw new Error(`BigQuery job rejected for ${plan.name}.`);
    const rows = []; let pageToken, schema, complete = false;
    const deadline = Date.now() + 660000;
    do {
      if (Date.now() > deadline) throw new Error(`BigQuery timeout for ${plan.name}; check job ${jobId} before retrying.`);
      const p = new URLSearchParams({ location: BQ_LOCATION, timeoutMs: '10000', maxResults: '10000' });
      if (pageToken) p.set('pageToken', pageToken);
      const response = await api(`${base}/queries/${jobId}?${p}`);
      if (response.errors?.length) throw new Error(`BigQuery result error for ${plan.name}; inspect job ${jobId}.`);
      if (!response.jobComplete) { await (dependencies.pause || sleep)(1000); continue; }
      schema = response.schema || schema;
      rows.push(...decodeRows(schema.fields, response.rows));
      pageToken = response.pageToken;
      complete = !pageToken;
    } while (!complete);
    const finalJob = await api(`${base}/jobs/${jobId}?location=${BQ_LOCATION}`);
    const billed = Number(finalJob.statistics?.query?.totalBytesBilled);
    if (!Number.isSafeInteger(billed) || billed < 0) throw new Error('Missing actual billing statistics.');
    remaining -= billed;
    ledger.entries.push({ at: new Date().toISOString(), name: plan.name, jobId, estimatedBytes: plan.bytes, billedBytes: billed });
    await store.write(LEDGER, JSON.stringify(ledger, null, 2) + '\n');
    const record = { name: plan.name, sql: plan.sql, filters: plan.filters, rows, jobId, estimatedBytes: plan.bytes, billedBytes: billed, fetchedAt: new Date().toISOString() };
    const body = JSON.stringify(record) + '\n';
    const saved = await store.write(plan.path, body);
    result[plan.name] = { ...record, path: saved.path, sha256: saved.sha256, reused: false };
    if (remaining < 0) throw new Error('Actual billing exceeded the enforced budget; stopping.');
  }
  return { result, estimate, plans, cumulativeBilledBytes: spent() };
}
