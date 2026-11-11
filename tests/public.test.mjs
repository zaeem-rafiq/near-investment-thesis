import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, cp, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { ROOT, hash, literalDateFilters } from '../scripts/sources.mjs';
import { exportPublic } from '../scripts/public.mjs';
import { assertNoWalletFields, CAL, parseSwapDays } from '../scripts/report.mjs';

async function fileHashes(dir, prefix = '') {
  const files = {};
  for (const entry of await readdir(join(dir, prefix), { withFileTypes: true })) {
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) Object.assign(files, await fileHashes(dir, path));
    else files[path] = hash(await readFile(join(dir, path)));
  }
  return files;
}
test('saved public snapshot contains aggregate JSON only, with verified hashes and no wallet fields', async () => {
  const manifest = JSON.parse(await readFile(join(ROOT, 'data/public/manifest.json'), 'utf8'));
  assertNoWalletFields(manifest);
  const publicFiles = Object.keys(await fileHashes(join(ROOT, 'data/public')));
  assert.deepEqual(publicFiles.sort(), ['manifest.json', ...Object.values(manifest.files).map(e => e.path.replace('data/public/', ''))].sort());
  for (const entry of Object.values(manifest.files)) {
    assert.match(entry.path, /^data\/public\//);
    const body = await readFile(join(ROOT, entry.path), 'utf8');
    assert.equal(hash(body), entry.sha256);
    assertNoWalletFields(JSON.parse(body));
    assert.doesNotMatch(body, /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  }
});
test('public exporter checks raw hashes, refuses wallet fields and never reads partial swaps by default', async () => {
  const root = await mkdtemp(join(tmpdir(), 'near-export-test-'));
  try {
    await mkdir(join(root, 'data/raw'), { recursive: true });
    const path = 'data/raw/prices.json';
    let body = JSON.stringify({ days: [{ date: '2025-03-01', close: 2 }] });
    await writeFile(join(root, path), body);
    const manifest = { id: 'synthetic', sources: { prices: { status: 'ok', path, sha256: hash(body) } } };
    const pub = await exportPublic(manifest, { root });
    assert.ok(pub.files.prices);
    assert.ok(pub.unavailable.swaps);
    assert.equal(Object.keys(pub.files).length, 1);
    await assert.rejects(exportPublic(manifest, { root, swaps: true }), /no completion record/);
    const dir = join(root, `data/raw/swaps/${CAL.swapWindow.start}_${CAL.swapWindow.end}`);
    await mkdir(join(dir, 'pages'), { recursive: true });
    const rows = ['0.1', '0.2'].map((amountInUsd, i) => ({ depositAddress: `PRIVATE_ADDRESS_${i}`, depositMemo: null,
      createdAt: '2025-06-04T10:00:00Z', status: 'SUCCESS', amountInUsd, recipient: 'PRIVATE_RECIPIENT' }));
    await writeFile(join(dir, 'pages/page-000001.json.gz'), gzipSync(JSON.stringify({ page: 1, rows })));
    await writeFile(join(dir, 'complete.json'), JSON.stringify({ complete: true, window: CAL.swapWindow, pages: 1, rows: 2 }));
    const complete = await exportPublic(manifest, { root, swaps: true });
    const swapsBody = await readFile(join(root, complete.files.swaps.path), 'utf8');
    assert.doesNotMatch(swapsBody, /PRIVATE_ADDRESS|PRIVATE_RECIPIENT|depositAddress|recipient/);
    const days = parseSwapDays(JSON.parse(swapsBody));
    assert.equal(days.find(d => d.date === '2025-06-04').volumeExact, '0.3');
    assert.equal(days.find(d => d.date === '2025-06-03').swaps, 0);
    await writeFile(join(root, path), body + ' ');
    await assert.rejects(exportPublic(manifest, { root }), /hash mismatch/);
    body = JSON.stringify({ days: [], depositAddress: 'MUST_NOT_LEAK' });
    await writeFile(join(root, path), body);
    manifest.sources.prices.sha256 = hash(body);
    await assert.rejects(exportPublic(manifest, { root }), /Wallet-level/);
    manifest.sources.prices.path = '../.env';
    await assert.rejects(exportPublic(manifest, { root }), /Invalid raw/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('public exporter keeps manifest entries written by the other exporters', async () => {
  const root = await mkdtemp(join(tmpdir(), 'near-export-merge-'));
  try {
    await mkdir(join(root, 'data/raw'), { recursive: true });
    await mkdir(join(root, 'data/public'), { recursive: true });
    const other = { path: 'data/public/peers.json', sha256: 'a'.repeat(64) };
    await writeFile(join(root, 'data/public/manifest.json'), JSON.stringify({ version: 1, id: 'old', files: {
      peers: other, signers: { path: 'data/public/bigquery/signers.json', sha256: 'b'.repeat(64) } }, unavailable: {} }));
    const path = 'data/raw/prices.json', body = JSON.stringify({ days: [{ date: '2025-03-01', close: 2 }] });
    await writeFile(join(root, path), body);
    const pub = await exportPublic({ id: 'new', sources: { prices: { status: 'ok', path, sha256: hash(body) } } }, { root });
    const saved = JSON.parse(await readFile(join(root, 'data/public/manifest.json'), 'utf8'));
    assert.deepEqual(saved.files, pub.files);
    assert.deepEqual(pub.files.peers, other);
    assert.ok(pub.files.prices);
    // A source this exporter owns and could not export this run is unavailable, not left pointing at old data.
    assert.equal(pub.files.signers, undefined);
    assert.ok(pub.unavailable.signers);
    for (const bad of ['', 'null', '{"files":"abc"}']) {
      await writeFile(join(root, 'data/public/manifest.json'), bad);
      await assert.rejects(exportPublic({ id: 'new', sources: {} }, { root }), /malformed|JSON/);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('rebuild CLI works offline, preserves prose and rejects inconsistent signer splits and stale metrics', async () => {
  const root = await mkdtemp(join(tmpdir(), 'near-offline-test-'));
  try {
    for (const path of ['scripts', 'sql', 'web', 'data/public', 'docs', 'THESIS.md', 'package.json']) {
      await cp(join(ROOT, path), join(root, path), { recursive: true });
    }
    const thesis = await readFile(join(root, 'THESIS.md'), 'utf8');
    const evidence = await readFile(join(root, 'docs/EVIDENCE.md'), 'utf8');
    // Any attempt to load .env would reject this syntax.
    await writeFile(join(root, '.env'), 'INVALID ENV SYNTAX MUST NOT BE READ');
    const guard = join(root, 'no-network.cjs');
    await writeFile(guard, "const fail = () => { throw new Error('Network forbidden in offline rebuild'); }; globalThis.fetch = fail; require('node:net').Socket.prototype.connect = fail; require('node:tls').connect = fail;");
    const env = { PATH: process.env.PATH, HOME: root, NODE_OPTIONS: `--require=${guard}`, npm_config_update_notifier: 'false' };
    const build = () => spawnSync('npm', ['run', 'rebuild'], { cwd: root, env, encoding: 'utf8', timeout: 15000 });
    let result = build();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(join(root, 'THESIS.md'), 'utf8'), thesis);
    const before = await fileHashes(join(root, 'dashboard'));
    const chartManifest = JSON.parse(await readFile(join(ROOT, 'dashboard/charts.json'), 'utf8'));
    const generated = ['index.html', 'style.css', 'THESIS.md', 'docs/EVIDENCE.md', 'thesis.html', 'VERIFY.md', 'NUMBERS.md', 'charts.json',
      ...chartManifest.files, 'model.mjs', 'model-inputs.js', 'favicon.svg', 'live.js'];
    const current = Object.fromEntries(await Promise.all(generated.map(async path => [path, hash(await readFile(join(ROOT, 'dashboard', path)))])));
    assert.deepEqual(before, current);
    assert.equal(await readFile(join(root, 'dashboard/VERIFY.md'), 'utf8'), await readFile(join(root, 'docs/VERIFY.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dashboard/docs/EVIDENCE.md'), 'utf8'), evidence);
    assert.equal(await readFile(join(root, 'docs/EVIDENCE.md'), 'utf8'), evidence);
    await rm(join(root, '.env'));
    result = build();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(await fileHashes(join(root, 'dashboard')), before);
    const splitSql = await readFile(join(root, 'sql/signer_split.sql'), 'utf8');
    const splitPath = join(root, 'data/public/bigquery/signer_split.json');
    await writeFile(splitPath, JSON.stringify({ sql: splitSql, filters: literalDateFilters(splitSql), rows: [] }));
    result = build();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Signer split groups do not sum to signers.sql/);
    assert.deepEqual(await fileHashes(join(root, 'dashboard')), before);
    await rm(splitPath);
    const stale = evidence.replace('| t3.offset | 1.56% |', '| t3.offset | 99% |');
    assert.notEqual(stale, evidence, 'Fixture must change a real metric.');
    await writeFile(join(root, 'docs/EVIDENCE.md'), stale);
    result = build();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /metrics differ/);
    assert.equal(await readFile(join(root, 'docs/EVIDENCE.md'), 'utf8'), stale);
    await writeFile(join(root, 'docs/EVIDENCE.md'), evidence);
    const staleThesis = thesis.replace('<!-- metric:position.check1.coverage -->77.75%', '<!-- metric:position.check1.coverage -->99%');
    assert.notEqual(staleThesis, thesis);
    await writeFile(join(root, 'THESIS.md'), staleThesis);
    result = build();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /metric mismatch/);
    assert.equal(await readFile(join(root, 'THESIS.md'), 'utf8'), staleThesis);
  } finally { await rm(root, { recursive: true, force: true }); }
});
