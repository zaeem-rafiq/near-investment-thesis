import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pullBigQuery, QUERIES, PLAN_ONLY_QUERIES, REQUIRED_COLUMNS, LEDGER, PRE_LEDGER_BILLED_BYTES } from '../scripts/sources.mjs';

const env = { GOOGLE_CLOUD_PROJECT: 'test-only-project', MAX_BYTES_BILLED: '100000000' };
const response = data => ({ ok: true, status: 200, json: async () => data });
const sqlFor = tables => tables.map(t => `SELECT COUNT(*) AS n FROM \`bigquery-public-data.crypto_near_mainnet_us.${t}\` WHERE block_date >= DATE '2026-10-01' AND block_date < DATE '2026-10-02'`).join('\nUNION ALL\n');
async function project(override = {}) {
  const root = await mkdtemp(join(tmpdir(), 'bq-test-'));
  await mkdir(join(root, 'sql'));
  for (const [name, tables] of Object.entries({ ...QUERIES, ...PLAN_ONLY_QUERIES })) await writeFile(join(root, `sql/${name}.sql`), override[name] ?? sqlFor(tables));
  return root;
}
function memoryStore(initial = {}) {
  const files = new Map(Object.entries(initial));
  return { files, read: async p => files.get(p) ?? null, write: async (p, body) => { files.set(p, body); return { path: p, sha256: 'x' }; } };
}
function fakeBQ(estimate = '10000000', billed = '10000000') {
  const jobs = [], requests = [], pages = new Map();
  const fetcher = async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : null;
    requests.push({ url, body });
    assert.equal(options.redirect, 'error');
    if (url.includes('/tables/')) {
      const table = url.split('/tables/')[1];
      return response({ schema: { fields: Object.entries(REQUIRED_COLUMNS[table]).map(([name, type]) => ({ name, type })) } });
    }
    if (body?.configuration.dryRun) return response({ statistics: { query: { totalBytesProcessed: estimate } } });
    if (body) { jobs.push(body); return response({ jobReference: body.jobReference }); }
    if (url.includes('/queries/')) {
      const id = url.split('/queries/')[1].split('?')[0], n = pages.get(id) || 0;
      pages.set(id, n + 1);
      if (!n) return response({ jobComplete: false });
      const data = { jobComplete: true, schema: { fields: [{ name: 'n', type: 'INTEGER' }] }, rows: [{ f: [{ v: String(n) }] }] };
      if (n === 1) data.pageToken = 'page-two';
      else assert.equal(new URL(url).searchParams.get('pageToken'), 'page-two');
      return response(data);
    }
    return response({ statistics: { query: { totalBytesBilled: billed } } });
  };
  return { fetcher, jobs, requests };
}
const deps = (fake, root, extra = {}) => ({ accessToken: 'synthetic-test-token', fetcher: fake.fetcher, pause: async () => {}, root, ...extra });

test('BigQuery checks schema, dry-runs ALL queries before jobs, uses us-east1, paginates and tracks billing', async () => {
  const root = await project(), fake = fakeBQ(), store = memoryStore();
  try {
    const { result } = await pullBigQuery(env, store, deps(fake, root));
    const firstJob = fake.requests.findIndex(r => r.body?.jobReference?.jobId);
    assert.equal(fake.requests.slice(0, firstJob).filter(r => r.body?.configuration.dryRun).length, 5);
    assert.equal(fake.jobs.length, 5);
    assert.deepEqual(fake.jobs.map(j => j.configuration.query.maximumBytesBilled), ['100000000', '90000000', '80000000', '70000000', '60000000']);
    const posts = fake.requests.filter(r => r.body), gets = fake.requests.filter(r => /\/(queries|jobs)\/near_thesis_/.test(r.url));
    assert.ok(posts.every(r => r.body.jobReference.location === 'us-east1'));
    assert.ok(gets.length >= 10 && gets.every(r => new URL(r.url).searchParams.get('location') === 'us-east1'));
    assert.equal(result.signers.rows.length, 2);
    const ledger = JSON.parse(store.files.get(LEDGER));
    assert.equal(ledger.entries.length, 5);
    assert.equal(ledger.preLedgerBilledBytes, PRE_LEDGER_BILLED_BYTES);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('refresh reuses cached results when SQL and window match; --rescan and SQL changes rerun', async () => {
  const root = await project(), store = memoryStore();
  try {
    await pullBigQuery(env, store, deps(fakeBQ(), root));
    const again = fakeBQ();
    const { result } = await pullBigQuery(env, store, deps(again, root));
    assert.equal(again.requests.length, 0);
    assert.ok(Object.values(result).every(r => r.reused));
    const forced = fakeBQ();
    await pullBigQuery(env, store, deps(forced, root, { force: true }));
    assert.equal(forced.jobs.length, 5);
    await writeFile(join(root, 'sql/coverage.sql'), sqlFor(['blocks']).replace("'2026-10-02'", "'2026-10-03'"));
    const changed = fakeBQ();
    const r2 = await pullBigQuery(env, store, deps(changed, root));
    assert.equal(changed.jobs.length, 1);
    assert.equal(r2.result.coverage.reused, false);
    assert.equal(r2.result.signers.reused, true);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('SQL without a literal block_date filter is refused before any network request', async () => {
  const root = await project({ coverage: 'SELECT MIN(block_date) FROM `bigquery-public-data.crypto_near_mainnet_us.blocks`' }), fake = fakeBQ();
  try {
    await assert.rejects(pullBigQuery(env, memoryStore(), deps(fake, root)), /literal block_date/);
    assert.equal(fake.requests.length, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('run budget, cumulative 1 TB limit and actual billing all block jobs', async () => {
  const root = await project();
  try {
    const over = fakeBQ('30000000');
    await assert.rejects(pullBigQuery(env, memoryStore(), deps(over, root)), /exceeds budget/);
    assert.equal(over.jobs.length, 0);
    const near = memoryStore({ [LEDGER]: JSON.stringify({ preLedgerBilledBytes: 999_990_000_000, entries: [] }) }), big = fakeBQ();
    await assert.rejects(pullBigQuery(env, near, deps(big, root)), /pass 1 TB/);
    assert.equal(big.jobs.length, 0);
    const actual = fakeBQ('0', '100000000');
    await assert.rejects(pullBigQuery(env, memoryStore(), deps(actual, root)), /budget exhausted/);
    assert.equal(actual.jobs.length, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('plan mode dry-runs only and never submits a billed job', async () => {
  const root = await project(), fake = fakeBQ();
  try {
    const r = await pullBigQuery(env, memoryStore(), deps(fake, root, { mode: 'plan', force: true }));
    assert.equal(fake.jobs.length, 0);
    assert.equal(r.estimate, 60000000);
    assert.equal(r.plans.at(-1).name, 'signer_split');
    assert.equal(fake.requests.filter(r => r.body?.configuration.dryRun).length, 6);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('live schema type mismatch stops before dry runs', async () => {
  const root = await project(), fake = fakeBQ();
  const fetcher = async (url, o) => url.includes('/tables/blocks') ? response({ schema: { fields: [{ name: 'total_supply', type: 'STRING' }] } }) : fake.fetcher(url, o);
  try {
    await assert.rejects(pullBigQuery(env, memoryStore(), { ...deps(fake, root), fetcher }), /schema mismatch/);
    assert.equal(fake.requests.filter(r => r.body).length, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});
