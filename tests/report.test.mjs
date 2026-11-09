import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CAL, addDays, dayRange, weeksBetween, weekStart, parseSigners, parseContracts, parseCoverage, t1Test, t2Series, t2Test, t3Test,
  pearson, bootstrapAdvantage, newSwapAggregate, addSwapRows, swapDays, weeklyFromDaily, parseSwapDays, loadSwapDir, gapBand, analyse, numberTables, verifyThesis, thesisHTML, metricValues, t2SensitivitySeries, T2_SENSITIVITY_START, usdUnits, usdString, seriesSVG, render, loadSources } from '../scripts/report.mjs';
import { ROOT, hash, literalDateFilters } from '../scripts/sources.mjs';

// Synthetic fixtures only; never research data.
function signerRows({ previous = 100, latest = 130, top10Prev = 0.5, top10Latest = 0.44 } = {}) {
  const rows = dayRange(...CAL.coverage).map(d => ({ grain: 'day', period_start: d, transactions: '1000', signers: String(d < '2025-11-01' ? previous : latest) }));
  for (let i = 0; i < 24; i++) {
    const m = new Date(Date.UTC(2024, 10 + i, 1)).toISOString().slice(0, 10);
    rows.push({ grain: 'month', period_start: m, signers: '5000', accounts_2plus_days: String(m < '2025-11-01' ? previous * 10 : latest * 10) });
  }
  rows.push({ grain: 'period', period_start: '2024-11-01', transactions: '1000000', signers: '9', top10_transactions: String(top10Prev * 1e6) });
  rows.push({ grain: 'period', period_start: '2025-11-01', transactions: '1000000', signers: '9', top10_transactions: String(top10Latest * 1e6) });
  return rows;
}
const contractRows = (previous = 50, latest = 65) => CAL.sampleDays.map(d => ({ block_date: d, receiver_accounts: String(d < '2025-11-01' ? previous : latest), function_call_actions: '10' }));
const coverageRows = () => dayRange(...CAL.coverage).map(d => ({ block_date: d, block_count: '10', distinct_block_count: '10', first_block_utc: `${d}T00:00:01.000Z`, last_block_utc: `${d}T23:59:59.000Z` }));

test('T1 pass, fail and can\'t-tell follow the fixed thresholds', () => {
  const run = (s, c) => t1Test(parseSigners(signerRows(s)), parseContracts(contractRows(...c)), parseCoverage(coverageRows()));
  assert.equal(run({}, [50, 65]).verdict, 'PASS');
  assert.equal(run({}, [50, 59]).verdict, "CAN'T TELL");
  assert.equal(run({ latest: 89 }, [50, 65]).verdict, 'FAIL');
  assert.equal(run({ top10Latest: 0.55 }, [50, 65]).verdict, 'FAIL');
  assert.equal(run({ top10Latest: 0.46 }, [50, 65]).verdict, "CAN'T TELL");
  const short = parseContracts(contractRows().slice(1));
  assert.equal(t1Test(parseSigners(signerRows()), short, parseCoverage(coverageRows())).verdict, "CAN'T TELL");
  const truncated = coverageRows(); truncated[3].first_block_utc = truncated[3].block_date + 'T05:00:00Z';
  assert.equal(t1Test(parseSigners(signerRows()), parseContracts(contractRows()), parseCoverage(truncated)).verdict, "CAN'T TELL");
});

function rng(seed) { let a = seed; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296 - 0.5; }; }
// Builds weekly inputs where `leader` ('volume' or 'price') leads usage by 1 and 2 weeks.
function t2Inputs(leader, { lowWeeks = 5 } = {}) {
  const weeks = weeksBetween(CAL.t2.firstWeek, CAL.t2.lastWeek), r = rng(7), r2 = rng(99);
  const lead = weeks.map(() => r() * 0.4), other = weeks.map(() => r2() * 0.4);
  const usageChange = weeks.map((_, i) => i < 2 ? 0 : 0.5 * lead[i - 1] + 0.5 * lead[i - 2] + r() * 0.02);
  let vol = 1e6, price = 3, usage = 1e5;
  const swaps = new Map(), days = new Map(), prices = [];
  weeks.forEach((w, i) => {
    if (i) { vol *= 1 + (leader === 'volume' ? lead[i] : other[i]); price *= 1 + (leader === 'price' ? lead[i] : other[i]); usage *= 1 + usageChange[i]; }
    swaps.set(w, { week: w, swaps: i < lowWeeks ? 1000 : 8000, volume: vol, volumeExact: String(vol), missingUsd: 0 });
    for (const d of dayRange(w, addDays(w, 7))) { days.set(d, { signers: usage }); prices.push({ date: d, close: price }); }
  });
  return [swaps, { days }, { days: prices }];
}
test('T2 starts at the first complete week with 7,000 swaps and marks earlier weeks excluded', () => {
  const series = t2Series(...t2Inputs('volume'));
  assert.equal(series.start, addDays(CAL.t2.firstWeek, 35));
  assert.equal(series.rows.filter(r => r.excluded).length, 5);
  assert.ok(series.rows.slice(0, 6).every(r => r.dv == null));
  const svg = seriesSVG({ title: 'swaps', unit: 'swaps', points: series.rows.map(r => ({ x: r.week, v: r.swaps, excluded: r.excluded })) });
  assert.match(svg, /Excluded from T2 test/);
  assert.equal((svg.match(/\(excluded from test\)/g) || []).length, 5);
});
test('T2 passes when volume leads, fails when price leads, and reports every lag', () => {
  const pass = t2Test(t2Series(...t2Inputs('volume')));
  assert.equal(pass.verdict, 'PASS');
  assert.deepEqual(pass.lags.map(l => l.lag), [1, 2, 4, 8]);
  assert.ok(pass.lags.filter(l => l.volumeWins).length >= 2);
  const fail = t2Test(t2Series(...t2Inputs('price')));
  assert.equal(fail.verdict, 'FAIL');
  assert.ok(fail.lags.filter(l => l.priceWins).length >= 2);
});
test('T2 needs at least 52 weekly changes from the start week', () => {
  const late = t2Test(t2Series(...t2Inputs('volume', { lowWeeks: 40 })));
  assert.ok(late.changes < 52);
  assert.equal(late.verdict, "CAN'T TELL");
  assert.equal(t2Test(t2Series(null, null, null)).verdict, "CAN'T TELL");
});
test('correlation and paired block bootstrap are deterministic and sane', () => {
  assert.equal(pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1);
  assert.equal(pearson([1, 1, 1], [1, 2, 3]), null);
  const r = rng(3), pairs = Array.from({ length: 60 }, () => { const dv = r(); return { dv, dp: r(), du: dv + r() * 0.1 }; });
  const a = bootstrapAdvantage(pairs, { seed: 5, resamples: 2000 }), b = bootstrapAdvantage(pairs, { seed: 5, resamples: 2000 });
  assert.deepEqual(a, b);
  assert.ok(a.low > 0 && a.high > a.low);
});

function t3Maps({ fields = 30e24, falls = 25e24, rises = 100e24, unlinkedAll = 0 } = {}) {
  const supply = new Map(), burn = new Map();
  weeksBetween('2025-11-03', '2026-10-26').forEach((w, i) => {
    supply.set(w, { week: w, unlinked: i === 0 ? 1 : unlinkedAll, falls, rises, opening: 1e33, closing: 1e33 });
    burn.set(w, { week: w, outcome: fields * 0.9, conversion: fields * 0.1, nulls: 0 });
  });
  return [supply, burn];
}
test('T3 uses supply falls as burn and rises as issuance, under the fixed pass and fail lines', () => {
  const pass = t3Test(...t3Maps());
  assert.equal(pass.verdict, 'PASS');
  assert.equal(pass.totals.offset, 0.25);
  assert.ok(Math.abs(pass.totals.fieldOffset - 30 / 105) < 1e-12);
  const fail = t3Test(...t3Maps({ fields: 2.4e24, falls: 2e24 }));
  assert.equal(fail.verdict, 'FAIL');
  assert.equal(fail.atMost5, 52);
  assert.equal(t3Test(...t3Maps({ fields: 12e24, falls: 10e24 })).verdict, "CAN'T TELL");
  // Field burn above supply falls by up to the 30% contract reward is explained; beyond it, or falls above fields, is not.
  assert.equal(t3Test(...t3Maps({ fields: 35e24, falls: 25e24 })).verdict, 'PASS');
  assert.match(t3Test(...t3Maps({ fields: 40e24, falls: 25e24 })).reasons.join(' '), /outside the explained range/);
  assert.equal(t3Test(...t3Maps({ fields: 20e24, falls: 25e24 })).verdict, "CAN'T TELL");
  assert.equal(t3Test(...t3Maps({ unlinkedAll: 1 })).verdict, "CAN'T TELL");
});

const swap = (a, usd = '0.1', at = '2025-06-04T10:00:00Z') => ({ depositAddress: a, depositMemo: null, createdAt: at, status: 'SUCCESS', amountInUsd: usd, originAsset: 'x', destinationAsset: 'y' });
test('1Click weekly aggregation is exact, rejects duplicates and never zero-fills missing USD', () => {
  const agg = addSwapRows(newSwapAggregate(CAL.swapWindow), [swap('a'), swap('b', '0.2'), swap('c', '1', '2025-06-08T23:59:59Z')]);
  const w = weeklyFromDaily(parseSwapDays({ window: CAL.swapWindow, rows: agg.rows, days: swapDays(agg) })).get('2025-06-02');
  assert.equal(w.volumeExact, '1.3');
  assert.equal(w.swaps, 3);
  assert.throws(() => addSwapRows(agg, [swap('a')]), /duplicate/);
  addSwapRows(agg, [swap('a', '2', '2025-06-04T11:00:00Z')]);
  assert.equal(agg.rows, 4);
  const missing = weeklyFromDaily(parseSwapDays({ window: CAL.swapWindow, rows: 1, days: swapDays(addSwapRows(newSwapAggregate(CAL.swapWindow), [swap('a', null)])) })).get('2025-06-02');
  assert.equal(missing.volume, null);
  assert.equal(usdString(usdUnits('12.000000000000000001')), '12.000000000000000001');
  assert.equal(weekStart('2025-06-08'), '2025-06-02');
});

test('empty build renders explicit unavailable states with no fabricated charts or scripts', async () => {
  const files = new Map();
  const sources = {};
  await render({ id: 'test-only', fetchedAt: null, sources: {} }, sources, async (n, t) => files.set(n, t));
  const html = files.get('index.html');
  assert.equal((html.match(/Data unavailable/g) || []).length, 10);
  assert.doesNotMatch(html, /<script|Bearer [A-Za-z0-9]/);
  assert.deepEqual(JSON.parse(files.get('charts.json')).files, []);
  assert.match(files.get('NUMBERS.md'), /CAN'T TELL/);
  assert.doesNotMatch(files.get('NUMBERS.md'), /PASS\*\*|FAIL\*\*/);
});
test('offline rebuild verifies public hashes and refuses results fetched with different SQL', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'near-report-test-'));
  try {
    await mkdir(join(temp, 'sql')); await mkdir(join(temp, 'data/public/bigquery'), { recursive: true });
    const sql = await readFile(`${ROOT}/sql/signers.sql`, 'utf8');
    await writeFile(join(temp, 'sql/signers.sql'), sql);
    const body = JSON.stringify({ sql, filters: literalDateFilters(sql), rows: signerRows(), jobId: 'synthetic', billedBytes: 1 });
    const path = 'data/public/bigquery/signers-test.json';
    await writeFile(join(temp, path), body);
    const manifest = { id: 'test-only', files: { signers: { path, sha256: hash(body) } } };
    await writeFile(join(temp, 'data/public/manifest.json'), JSON.stringify(manifest));
    const { sources } = await loadSources(temp);
    assert.equal(sources.signers.data.days.size, 731);
    await writeFile(join(temp, path), body + ' ');
    await assert.rejects(loadSources(temp), /hash mismatch/);
    await writeFile(join(temp, path), body);
    await writeFile(join(temp, 'sql/signers.sql'), sql.replace('2026-11-02', '2026-11-03'));
    await assert.rejects(loadSources(temp), /SQL changed/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('charts break the line at missing values and tables show the gap as Unavailable', async () => {
  const svg = seriesSVG({ title: 'gap', unit: 'count', points: [{ x: 'a', v: 3 }, { x: 'b', v: null }, { x: 'c', v: 5 }] });
  const d = svg.match(/<path d="(M[^"]*)" fill="none" stroke="#171717"/)[1];
  assert.equal((d.match(/M/g) || []).length, 2);
  assert.doesNotMatch(d, /L/);
  assert.equal(seriesSVG({ title: 'none', unit: 'count', points: [{ x: 'a', v: null }] }), null);
  const rows = signerRows().filter(r => r.period_start !== '2025-01-15');
  const files = new Map();
  await render({ id: 'test-only', sources: {} }, { signers: { data: parseSigners(rows) } }, async (n, t) => files.set(n, t));
  assert.match(files.get('index.html'), /<tr><td>2025-01-15<\/td><td>Unavailable<\/td><\/tr>/);
});

async function swapProject(root, { complete = true, pagesInRecord = 1, rows } = {}) {
  const rel = 'data/raw/swaps/2025-03-01_2026-11-02', dir = join(root, rel);
  await mkdir(join(dir, 'pages'), { recursive: true });
  const page = { page: 1, cursor: { depositAddress: rows.at(-1).depositAddress, depositMemo: null }, rows };
  await writeFile(join(dir, 'pages/page-000001.json.gz'), gzipSync(JSON.stringify(page)));
  if (complete !== null) await writeFile(join(dir, 'complete.json'), JSON.stringify({ window: CAL.swapWindow, pages: pagesInRecord, rows: rows.length, complete }));
  return rel;
}

async function publicSwapProject(root, raw) {
  const path = 'data/public/swaps.json', body = JSON.stringify(raw);
  await mkdir(join(root, 'data/public'), { recursive: true });
  await writeFile(join(root, path), body);
  await writeFile(join(root, 'data/public/manifest.json'), JSON.stringify({ id: 'test-only', files: { swaps: { path, sha256: hash(body) } } }));
}
test('public daily totals and dashboard never contain wallet fields', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'near-wallet-test-'));
  try {
    const rows = [{ ...swap('RAW_DEPOSIT_ADDRESS_MUST_NOT_LEAK', '5'), depositMemo: 'RAW_MEMO_MUST_NOT_LEAK' }];
    const dir = await swapProject(temp, { rows });
    const raw = await loadSwapDir(join(temp, dir));
    const pub = { window: raw.window, rows: raw.rows, days: raw.days };
    await publicSwapProject(temp, pub);
    const { sources } = await loadSources(temp);
    assert.equal(sources.swaps.data.rows, 1);
    const files = new Map();
    await render({ id: 'test-only' }, sources, async (n, t) => files.set(n, t));
    files.set('data/public/swaps.json', await readFile(join(temp, 'data/public/swaps.json'), 'utf8'));
    for (const [name, body] of files) {
      assert.doesNotMatch(body, /RAW_DEPOSIT_ADDRESS_MUST_NOT_LEAK|RAW_MEMO_MUST_NOT_LEAK/, name);
      assert.doesNotMatch(body, /"(depositAddress|depositMemo|recipient|senders|refundTo)"\s*:/, name);
    }
    for (const key of ['depositAddress', 'depositMemo', 'recipient', 'senders', 'refundTo', 'nearTxHashes']) {
      await publicSwapProject(temp, { ...pub, extra: { [key]: 'MUST_NOT_LEAK' } });
      await assert.rejects(loadSources(temp), /Wallet-level/);
    }
  } finally { await rm(temp, { recursive: true, force: true }); }
});
test('public manifests refuse paths outside data/public and raw pulls must be complete', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'near-manifest-test-'));
  try {
    await mkdir(join(temp, 'data/public'), { recursive: true });
    for (const path of ['../.env', '/etc/passwd', 'data/raw/prices.json', 'data/public/../../.env']) {
      await writeFile(join(temp, 'data/public/manifest.json'), JSON.stringify({ files: { prices: { path } } }));
      await assert.rejects(loadSources(temp), /Invalid public/);
    }
    const rows = [swap('a'), swap('b')];
    for (const [options, message] of [[{ complete: null }, /no completion record/], [{ complete: false }, /Incomplete/], [{ pagesInRecord: 2 }, /do not match/]]) {
      await rm(join(temp, 'data/raw'), { recursive: true, force: true });
      const dir = await swapProject(temp, { rows, ...options });
      await assert.rejects(loadSwapDir(join(temp, dir)), message);
    }
    const dir = await swapProject(temp, { rows });
    await assert.rejects(loadSwapDir(join(temp, dir), 'wrong'), /hash mismatch/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});
test('daily swap totals reject missing days, wrong windows and inconsistent row counts', () => {
  const agg = addSwapRows(newSwapAggregate(CAL.swapWindow), [swap('a')]);
  const pub = { window: CAL.swapWindow, rows: 1, days: swapDays(agg) };
  assert.equal(parseSwapDays(pub).length, dayRange(CAL.swapWindow.start, CAL.swapWindow.end).length);
  assert.equal(weeklyFromDaily(parseSwapDays(pub)).has('2025-02-24'), false);
  assert.throws(() => parseSwapDays({ ...pub, days: pub.days.slice(1) }), /cover/);
  assert.throws(() => parseSwapDays({ ...pub, rows: 2 }), /add up/);
  assert.throws(() => parseSwapDays({ ...pub, window: { ...CAL.swapWindow, start: '2025-03-02' } }), /window/);
});
test('protocol 87 gap bands apply only on their own side of activation', () => {
  assert.equal(gapBand('2026-10-26').low, -0.30);
  assert.equal(gapBand('2026-11-02'), null);
  assert.equal(gapBand('2026-11-09').low, -0.05);
  assert.equal(gapBand('2026-11-09').high, 0.05);
});
test('thesis metrics are verified, not rewritten; prose and tagged claims survive', async () => {
  const a = analyse({});
  const text = `Hand-written reasoning stays here.\n<!-- evidence:begin -->\n${numberTables(a)}<!-- evidence:end -->\nT1 is <!-- metric:t1.verdict -->CAN'T TELL<!-- /metric -->.`;
  assert.doesNotThrow(() => verifyThesis(text, a));
  assert.throws(() => verifyThesis(text.replace('| t2.changes | 0 |', '| t2.changes | 99 |'), a), /metrics differ/);
  assert.throws(() => verifyThesis(text.replace("TELL<!-- /metric -->", "PASS<!-- /metric -->"), a), /metric mismatch/);
  assert.throws(() => verifyThesis('Missing evidence table', a), /metrics differ/);
  const writes = new Map();
  await render({ id: 'test' }, {}, async (n, body) => writes.set(n, body));
  assert.equal(writes.has('THESIS.md'), false);
  assert.equal(writes.has('NUMBERS.md'), true);
});

test('thesis.html renders the real thesis without metric tags, escapes markup and keeps the CSP', async () => {
  const md = await readFile(join(ROOT, 'THESIS.md'), 'utf8');
  const html = thesisHTML(md);
  assert.doesNotMatch(html, /<!--|metric:|evidence:(begin|end)/);
  assert.match(html, /<h1>NEAR: three tests, fixed before the results<\/h1>/);
  assert.match(html, /<td>t2\.changes<\/td><td>78<\/td>/);
  assert.match(html, /Content-Security-Policy" content="default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'"/);
  assert.doesNotMatch(html, /<script/i);
  const hostile = thesisHTML('# T <script>x</script>\n\nA **b** \`<img src=x>\` <!-- metric:t1.verdict -->FAIL<!-- /metric -->\n\n- one\n- two\n');
  assert.match(hostile, /<h1>T &lt;script&gt;x&lt;\/script&gt;<\/h1>/);
  assert.match(hostile, /<p>A <strong>b<\/strong> <code>&lt;img src=x&gt;<\/code> FAIL<\/p>/);
  assert.match(hostile, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
});
test('chart axis ticks fit the left margin and the excluded label sits above the plot', () => {
  const points = [{ x: 'a', v: 106_298_020, excluded: true }, { x: 'b', v: 5e7 }, { x: 'c', v: 1e6 }];
  const svg = seriesSVG({ title: 't', unit: 'USD', points });
  const ticks = [...svg.matchAll(/<text x="72" y="(?:44|134)" text-anchor="end">([^<]+)<\/text>/g)].map(m => m[1]);
  assert.deepEqual(ticks, ['111.6M', '55.8M']);
  assert.match(svg, /<text x="84" y="34"[^>]*>Excluded from T2 test<\/text>/);
  const mixed = seriesSVG({ title: 't', unit: 'blocks', points: [{ x: 'a', v: 150_000 }, { x: 'b', v: 70_000 }] });
  assert.match(mixed, />157.5K<\/text>/);
  assert.match(mixed, />78.8K<\/text>/);
  assert.match(svg, /<title>a: 106,298,020 \(excluded from test\)<\/title>/);
});

// Official T2 values as published before the sensitivity check existed (dashboard/NUMBERS.md at 16587a8).
const OFFICIAL_T2 = `t2.verdict=CAN'T TELL|t2.start=2025-04-14|t2.changes=78|t2.weeks=81|t2.startSwaps=8,568|t2.weeksBelowMinAfterStart=15|t2.nextWeekAtMin=2025-08-04|t2.volumeUnavailable.weeks=2026-02-02|t2.volumeUnavailable.missingUsd=2|t2.volumeUnavailable.swaps=182,281|t2.lag1.pairs=77|t2.lag1.rv=0|t2.lag1.rp=0.284|t2.lag1.advantage=-0.284|t2.lag1.half1.rv=-0.003|t2.lag1.half1.rp=0.193|t2.lag1.half2.rv=0.121|t2.lag1.half2.rp=0.317|t2.lag1.ci.low=-0.613|t2.lag1.ci.high=0.179|t2.lag1.favours=neither|t2.lag2.pairs=76|t2.lag2.rv=-0.065|t2.lag2.rp=0.039|t2.lag2.advantage=-0.104|t2.lag2.half1.rv=-0.186|t2.lag2.half1.rp=-0.082|t2.lag2.half2.rv=0.151|t2.lag2.half2.rp=0.038|t2.lag2.ci.low=-0.385|t2.lag2.ci.high=0.263|t2.lag2.favours=neither|t2.lag4.pairs=74|t2.lag4.rv=0.013|t2.lag4.rp=0.009|t2.lag4.advantage=0.004|t2.lag4.half1.rv=0.091|t2.lag4.half1.rp=-0.012|t2.lag4.half2.rv=-0.005|t2.lag4.half2.rp=0.002|t2.lag4.ci.low=-0.241|t2.lag4.ci.high=0.201|t2.lag4.favours=neither|t2.lag8.pairs=70|t2.lag8.rv=-0.004|t2.lag8.rp=-0.187|t2.lag8.advantage=0.183|t2.lag8.half1.rv=-0.056|t2.lag8.half1.rp=-0.174|t2.lag8.half2.rv=-0.177|t2.lag8.half2.rp=-0.165|t2.lag8.ci.low=0.02|t2.lag8.ci.high=0.304|t2.lag8.favours=neither`;
test('first-screen numbers match the published public-snapshot metrics', async () => {
  const { manifest, sources } = await loadSources();
  const files = new Map(), a = analyse(sources), v = metricValues(a);
  await render(manifest, sources, async (n, body) => files.set(n, body));
  const first = files.get('index.html').split('<!-- first-screen:end -->')[0];
  assert.match(first, /Does on-chain evidence support a long-term case for NEAR\?/);
  assert.match(first, /Not on this evidence\. None of three claims passed\./);
  assert.ok(first.includes(`data-metric="signers-change">${v['t1.signers.change']}</strong>`));
  assert.ok(first.includes(`data-metric="burn-offset">${v['t3.offset']}</strong>`));
  assert.ok(first.includes(`${(a.t3.totals.burnt / 1e6).toFixed(1)} million NEAR burned`));
  assert.ok(first.includes(`${(a.t3.totals.issued / 1e6).toFixed(1)} million issued`));
  assert.match(first, /href="#signers">See the evidence<\/a>\s*<p class="rebuild-note">Every chart rebuilds from public data with one command\.<\/p>/);
});
test('first screen uses plain labels and keeps technical results below it', async () => {
  const { manifest, sources } = await loadSources(), files = new Map();
  await render(manifest, sources, async (n, body) => files.set(n, body));
  const [first, rest] = files.get('index.html').split('<!-- first-screen:end -->');
  assert.doesNotMatch(first, /\bT[123]\b|r volume|r price|r-value|Snapshot|correlations by lag/);
  assert.match(rest, /Sensitivity check, not official/);
  assert.match(rest, /correlation with volume/);
  assert.match(rest, /correlation with price/);
  assert.doesNotMatch(rest, />r volume<|>r price</);
  assert.ok(!rest.includes('<div class="table-wrap">'), 'wide result tables must be keyboard-focusable');
  const css = await readFile(join(ROOT, 'web/style.css'), 'utf8');
  assert.match(css, /\.hypotheses \.table-wrap \{ max-height: none; \}/, 'result tables must not clip behind an inner scrollbar');
  assert.match(css, /^\.table-wrap \{[^}]*max-height: 400px/m, 'long values tables keep their height limit');
  assert.doesNotMatch(css, /\.first-screen \{[^}]*min-height/, 'first screen must not force empty height');
});
test('the sensitivity check leaves the official T2 verdict, start rule and every published number unchanged', async () => {
  const { sources } = await loadSources();
  const a = analyse(sources), v = metricValues(a);
  const official = Object.fromEntries(OFFICIAL_T2.split('|').map(p => p.split('=')));
  for (const [k, value] of Object.entries(official)) assert.equal(v[k], value, k);
  assert.deepEqual(Object.keys(v).filter(k => k.startsWith('t2.')).sort(), Object.keys(official).sort());
  assert.equal(a.t2.verdict, "CAN'T TELL");
  assert.equal(a.t2.start, a.series.rows.find(r => r.swaps >= CAL.t2.minSwaps).week);
  assert.deepEqual(t2Test(a.series), a.t2);
  assert.equal(a.t2sens.start, T2_SENSITIVITY_START);
  assert.notEqual(a.t2sens.start, a.t2.start);
  assert.equal(v['t2sens.weeksBelowMin'], '0');
});
test('sensitivity series starts at its fixed week with the official change method and leaves the input series intact', () => {
  const series = t2Series(...t2Inputs('volume'));
  const before = JSON.stringify(series);
  const start = addDays(CAL.t2.firstWeek, 7 * 20), sens = t2SensitivitySeries(series, start);
  assert.equal(JSON.stringify(series), before);
  assert.equal(sens.start, start);
  const i = sens.rows.findIndex(r => r.week === start);
  assert.ok(sens.rows.every((r, j) => r.excluded === j < i));
  assert.ok(sens.rows.slice(0, i + 1).every(r => r.dv == null && r.du == null));
  for (const [j, r] of sens.rows.entries()) if (j > i) assert.equal(r.dv, series.rows[j].dv);
  assert.equal(t2Test(sens).changes, series.rows.length - i - 1);
  assert.equal(t2SensitivitySeries(t2Series(null, null, null)).start, null);
});
