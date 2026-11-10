import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runReview, parseReviewArgs, mapSqlDates } from '../scripts/review.mjs';
import { ROOT, REQUIRED_COLUMNS, LEDGER, hash, literalDateFilters } from '../scripts/sources.mjs';

const schedules = [
  ['2027-02-01', '2026-02-02', '2026-02-23', '2025-02-03'],
  ['2027-05-03', '2026-05-04', '2026-05-04', '2025-05-05'],
  ['2027-08-02', '2026-08-03', '2026-08-03', '2025-08-04'],
  ['2027-11-01', '2026-11-02', '2026-11-02', '2025-11-03']
];
const forbidden = () => { throw new Error('Unexpected credential, network or store access'); };
function stub({ bytes = 100, spent = 242_870_000_000, cap = 300_000_000_000, env } = {}) {
  const requests = [], writes = [], memory = new Map([[LEDGER, JSON.stringify({ preLedgerBilledBytes: spent, entries: [] })]]);
  return {
    requests, writes, memory, log() {}, now: '2027-11-01T00:00:00Z', accessToken: 'SYNTHETIC_TOKEN',
    credentials: () => env ?? { GOOGLE_CLOUD_PROJECT: 'test-project', MAX_BYTES_BILLED: String(cap) },
    store: {
      read: async p => memory.get(p) ?? null,
      write: async (p, body) => { writes.push(p); memory.set(p, body); return { path: p, sha256: hash(body) }; }
    },
    fetcher: async (url, init) => {
      const body = init.body && JSON.parse(init.body);
      requests.push({ url, body });
      let result;
      if (url.includes('/tables/')) {
        const name = url.split('/').at(-1);
        result = { schema: { fields: Object.entries(REQUIRED_COLUMNS[name]).map(([name, type]) => ({ name, type })) } };
      } else if (body?.configuration?.dryRun === true) result = { statistics: { query: { totalBytesProcessed: String(bytes) } } };
      else if (body) result = { status: {} };
      else if (url.includes('/queries/')) result = { jobComplete: true, schema: { fields: [] }, rows: [] };
      else result = { statistics: { query: { totalBytesBilled: String(bytes) } } };
      return { ok: true, json: async () => result };
    }
  };
}
const jobs = s => s.requests.filter(r => r.body);
const billed = s => jobs(s).filter(r => r.body.configuration.dryRun !== true);

for (const [date, start, check2, prior] of schedules) {
  test(`review ${date} is offline with exact check, usage, SQL and pull windows`, async () => {
    let output = '';
    const r = await runReview([date], { credentials: forbidden, fetcher: forbidden,
      store: { read: forbidden, write: forbidden }, log: s => { output += s; } });
    for (const expected of [
      `Check 1 window: ${start} to ${date}`,
      `Check 2 window: ${check2} to ${date}`,
      `Check 3 current usage window: ${start} to ${date}`,
      `Check 3 prior usage window: ${prior} to ${start}`,
      `1Click swap window: ${start} to ${date}`,
      `Coinbase NEAR-USD daily price window: ${start} to ${date}`
    ]) assert.ok(output.includes(expected), expected);
    assert.match(output, /Frozen cohort: the original ten/);
    assert.match(output, /Pacing: 5\.2 s minimum/);
    assert.match(output, /NEARBlocks, NOT BigQuery/);
    assert.match(output, /Offline only: no credentials read/);
    assert.deepEqual(Object.keys(r.sql), ['supply', 'burn', 'coverage', 'signer_split']);
    for (const [name, sql] of Object.entries(r.sql)) {
      const dates = [...sql.matchAll(/DATE '(\d{4}-\d{2}-\d{2})'/g)].map(m => m[1]);
      const expected = name === 'signer_split' ? [prior, start, date]
        : name === 'coverage' ? [prior, date] : [start, date];
      assert.deepEqual([...new Set(dates)].sort(), expected.sort());
      const filters = literalDateFilters(sql);
      assert.ok(filters.every(f => f.end === date));
      assert.ok(filters.every(f => f.start === (['coverage', 'signer_split'].includes(name) ? prior : start)));
    }
    assert.match(r.sql.signer_split, /INTERVAL 364 DAY/);
    assert.match(r.sql.signer_split, /SUM\(signer_days\) \/ 364\.0/);
    assert.doesNotMatch(r.sql.signer_split, /receiver_scores|ORDER BY earlier_signer_days|INTERVAL 1 YEAR|365\.0/);
    assert.equal([...r.sql.signer_split.matchAll(/'[a-f0-9]{64}'/g)].length, 10);
    assert.ok(r.sql.signer_split.includes(`'${hash('game.hot.tg')}'`));
    assert.equal(r.pulls.length, 8);
    assert.equal(r.pulls.filter(p => p.full).length, 1);
    for (const p of r.pulls) {
      assert.equal(p.filter.ids.length, 1);
      assert.equal(p.windows[0].start, start);
      assert.equal(p.windows.at(-1).end, date);
      assert.equal(p.windows.length, p.full ? 1 : 52);
      assert.equal(p.full, p.side === 'buys' && p.asset.startsWith('1cs_v1:hypercore:'));
      assert.ok(p.windows.every((w, i) => i === 0 || w.start === p.windows[i - 1].end));
      assert.match(p.command, /retainParticipants:true/);
      assert.match(p.command, /sleep\(PACE_MS\)/);
    }
    assert.ok(r.pulls.every(p => p.command.includes(`data/raw/review/${date}/participants/`)));
  });
}

test('review veto-only date records manual governance status and never runs checks even with flags', async () => {
  for (const flag of [[], ['--plan'], ['--run']]) {
    let output = '';
    const r = await runReview(['2026-11-16', ...flag], { now: '2026-11-16', credentials: forbidden,
      fetcher: forbidden, log: s => { output += s; } });
    assert.match(output, /record HSP-029 veto status; no checks run/);
    assert.match(output, /manually.*governance source/);
    assert.deepEqual(r.sql, {});
    assert.equal(r.pulls.length, 0);
    assert.doesNotMatch(output, /sql\/|Check 1 window/);
  }
});

test('review refuses unscheduled dates, malformed and conflicting flags', () => {
  assert.throws(() => parseReviewArgs(['2027-02-02']), /Unscheduled review date/);
  for (const args of [[], ['2027-02-01', '--plan', '--run'], ['2027-02-01', '--force'],
    ['2027-02-01', '--plan', '--plan'], ['2027-02-01', '2027-05-03']]) {
    assert.throws(() => parseReviewArgs(args), /Usage:/);
  }
});

test('review SQL mapping rejects unknown literal dates and does not cascade replacements', () => {
  assert.throws(() => mapSqlDates("DATE '2099-01-01'", {}), /Unmapped SQL literal/);
  assert.equal(mapSqlDates("DATE '2025-11-03', DATE '2026-11-02'", {
    '2025-11-03': '2026-11-02', '2026-11-02': '2027-11-01'
  }), "DATE '2026-11-02', DATE '2027-11-01'");
});

test('review --plan submits only dry runs, never billed jobs or store writes', async () => {
  const s = stub();
  const r = await runReview(['2027-02-01', '--plan'], s);
  assert.equal(r.result.estimate, 400);
  assert.equal(jobs(s).length, 4);
  assert.equal(billed(s).length, 0);
  assert.ok(jobs(s).every(r => r.body.configuration.dryRun === true));
  assert.ok(jobs(s).every(r => !r.body.jobReference.jobId));
  assert.equal(s.writes.length, 0);
});

test('review --run before UTC review date refuses before credentials or requests', async () => {
  await assert.rejects(runReview(['2027-02-01', '--run'], {
    now: '2027-01-31T23:59:59.999Z', credentials: forbidden, fetcher: forbidden, log() {}
  }), /has not arrived/);
});

test('review --run without credentials refuses without a request or a write', async () => {
  const s = stub({ env: {} });
  await assert.rejects(runReview(['2027-02-01', '--run'], s), /credentials.*budget gates/);
  assert.equal(s.requests.length, 0);
  assert.equal(s.writes.length, 0);
});

test('review arrived --run dry-runs first, gates jobs and scopes results while preserving global ledger', async () => {
  const s = stub();
  s.now = '2027-02-01T00:00:00Z';
  let output = '';
  s.log = text => { output += text; };
  const r = await runReview(['2027-02-01', '--run'], s);
  assert.equal(jobs(s).length, 8);
  assert.ok(jobs(s).slice(0, 4).every(r => r.body.configuration.dryRun === true));
  assert.equal(billed(s).length, 4);
  assert.ok(billed(s).every(r => Number(r.body.configuration.query.maximumBytesBilled) <= 300_000_000_000));
  assert.ok(s.writes.every(p => p === LEDGER || p.startsWith('data/raw/review/2027-02-01/bigquery/')));
  assert.equal(s.writes.filter(p => p === LEDGER).length, 4);
  assert.equal(r.result.cumulativeBilledBytes, 242_870_000_400);
  assert.match(output, /No Explorer\/price\/wallet pulls or checks performed/);
  assert.ok(Object.values(r.result.result).every(row => row.path.startsWith('data/raw/review/2027-02-01/')));
});

test('review repeated --run reuses matching date-scoped results without new requests or billing', async () => {
  const s = stub();
  await runReview(['2027-02-01', '--run'], s);
  const writes = s.writes.length, requests = s.requests.length;
  const r = await runReview(['2027-02-01', '--run'], s);
  assert.equal(s.writes.length, writes);
  assert.equal(s.requests.length, requests);
  assert.equal(r.result.estimate, 0);
  assert.ok(r.result.plans.every(p => p.reused));
  assert.ok(Object.values(r.result.result).every(row => row.path.startsWith('data/raw/review/2027-02-01/')));
  assert.ok(r.result.plans.every(p => p.path.startsWith('data/raw/review/2027-02-01/')));
});

test('review run gates reject per-run budget, cumulative headroom and exhausted ledger before billing', async () => {
  for (const options of [{ cap: 399 }, { spent: 899_999_999_800 }, { spent: 900_000_000_000 }]) {
    const s = stub(options);
    await assert.rejects(runReview(['2027-02-01', '--run'], s), /budget gates|cumulative gate/);
    assert.equal(billed(s).length, 0);
    assert.equal(s.writes.length, 0);
    if (options.spent === 900_000_000_000) assert.equal(s.requests.length, 0);
  }
});

test('review offline with arrived date still cannot read credentials, request or bill without --run', async () => {
  const s = stub();
  s.credentials = forbidden;
  await runReview(['2027-02-01'], s);
  assert.equal(s.requests.length, 0);
  assert.equal(s.writes.length, 0);
});

test('review source errors omit credentials and remote bodies', async () => {
  const s = stub();
  s.fetcher = async () => { throw new Error('SYNTHETIC_TOKEN PRIVATE_REMOTE_BODY'); };
  await assert.rejects(runReview(['2027-02-01', '--plan'], s), error => {
    assert.doesNotMatch(error.message, /SYNTHETIC_TOKEN|PRIVATE_REMOTE_BODY/);
    assert.match(error.message, /Remote details omitted/);
    return true;
  });
});

test('review default CLI succeeds under a network guard and invalid dates return nonzero', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'near-review-test-'));
  try {
    const guard = join(dir, 'no-network.cjs');
    await writeFile(guard, `const fail=()=>{throw Error("Network forbidden")}; globalThis.fetch=fail; require("node:net").Socket.prototype.connect=fail; require("node:tls").connect=fail;
const fs=require("node:fs/promises"),read=fs.readFile; fs.readFile=async function(p,...args){if(String(p).endsWith("/.env"))throw Error("Credentials forbidden");return read.call(this,p,...args)}; require("node:module").syncBuiltinESMExports();`);
    const env = { PATH: process.env.PATH, HOME: dir, NODE_OPTIONS: `--require=${guard}` };
    const cli = args => spawnSync(process.execPath, ['scripts/review.mjs', ...args], { cwd: ROOT, env, encoding: 'utf8', timeout: 15000 });
    const result = cli(['2027-02-01']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /2026-02-02 to 2027-02-01/);
    assert.equal(result.stderr, '');
    const bad = cli(['2027-02-02']);
    assert.notEqual(bad.status, 0);
    assert.match(bad.stderr, /Unscheduled review date/);
    const early = cli(['2027-02-01', '--run']);
    // Host dates may advance; the injected-now unit test proves the early gate.
    if (new Date().toISOString().slice(0, 10) < '2027-02-01') {
      assert.notEqual(early.status, 0);
      assert.match(early.stderr, /has not arrived/);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
