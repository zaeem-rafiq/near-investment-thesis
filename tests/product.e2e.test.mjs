// End-to-end: each test drives a real command in a copy of the repository and reads what
// it builds, the way a judge would. FEATURES.md names every test here.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../scripts/sources.mjs';

let root, env, rebuild;
// Published values, read from the reviewed evidence table rather than repeated here.
const published = async key => {
  const evidence = await readFile(join(ROOT, 'docs/EVIDENCE.md'), 'utf8');
  const match = evidence.match(new RegExp(`^\\| ${key.replaceAll('.', '\\.')} \\| (.*) \\|$`, 'm'));
  assert.ok(match, `docs/EVIDENCE.md has no ${key} row`);
  return match[1];
};
const page = name => readFile(join(root, 'dashboard', name), 'utf8');

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'near-e2e-'));
  for (const path of ['scripts', 'sql', 'web', 'data/public', 'docs', 'THESIS.md', 'package.json']) {
    await cp(join(ROOT, path), join(root, path), { recursive: true });
  }
  // Only the hand-written model files; every other page must come from the rebuild itself.
  for (const file of ['model.html', 'model-ui.js', 'model.css']) {
    await cp(join(ROOT, 'dashboard', file), join(root, 'dashboard', file));
  }
  // The commands must work offline and without credentials, as they do for a judge.
  const guard = join(root, 'no-network.cjs');
  await writeFile(guard, `const fail = () => { throw new Error('Network forbidden'); };
globalThis.fetch = fail; require('node:net').Socket.prototype.connect = fail; require('node:tls').connect = fail;
const fs = require('node:fs/promises'), read = fs.readFile;
fs.readFile = async function (p, ...args) { if (String(p).endsWith('/.env')) throw new Error('Credentials forbidden'); return read.call(this, p, ...args); };`);
  env = { PATH: process.env.PATH, HOME: root, NODE_OPTIONS: `--require=${guard}`, npm_config_update_notifier: 'false' };
  rebuild = spawnSync('npm', ['run', 'rebuild'], { cwd: root, env, encoding: 'utf8', timeout: 60000 });
});
after(() => root && rm(root, { recursive: true, force: true }));

test('npm run rebuild builds the dashboard offline from committed data', async () => {
  assert.equal(rebuild.status, 0, rebuild.stdout + rebuild.stderr);
  const verdicts = ['t1', 't2', 't3'].map(t => published(`${t}.verdict`));
  const [t1, t2, t3] = await Promise.all(verdicts);
  assert.match(rebuild.stdout, new RegExp(`T1 ${t1}, T2 ${t2}, T3 ${t3}\\.`));
  assert.equal(await readFile(join(root, 'THESIS.md'), 'utf8'), await readFile(join(ROOT, 'THESIS.md'), 'utf8'));
});

test('first screen shows the call, the three checks and the live line', async () => {
  assert.equal(rebuild.status, 0, rebuild.stderr);
  const html = await page('index.html');
  assert.match(html, /class="answer">Not yet\.</);
  for (const key of ['position.check1.coverage', 'position.check2.coveragePercent', 'position.check3.signedGrowth']) {
    assert.ok(html.includes(`data-metric="${key}">${await published(key)}<`), key);
  }
  assert.match(html, /id="live-line"[^>]*hidden/);
  assert.match(html, /<script src="live\.js" defer>/);
  assert.equal(await page('live.js'), await readFile(join(ROOT, 'web/live.js'), 'utf8'));
});

test('thesis page shows the thesis, its stated limits and its links', async () => {
  assert.equal(rebuild.status, 0, rebuild.stderr);
  const html = await page('thesis.html');
  assert.match(html, /<h1>NEAR through 2031: Not yet<\/h1>/);
  assert.match(html, /Limit: Check 1 counts 1Click swaps only/);
  assert.match(html, /No locked check tests whether this price is fair\./);
  for (const link of ['docs/EVIDENCE.md', 'model.html', 'VERIFY.md']) assert.ok(html.includes(`href="${link}"`), link);
});

test('model page computes a 2031 result for the default and each scenario', async () => {
  assert.equal(rebuild.status, 0, rebuild.stderr);
  assert.match(await page('model.html'), /<script type="module" src="model-ui\.js">/);
  const ui = await import(pathToFileURL(join(root, 'dashboard/model-ui.js')).href);
  const view = ui.renderModel(ui.DEFAULT_STATE);
  assert.match(view.coverage, /^\d[\d,.]*%$/);
  assert.match(view.tableRows, /<td data-label="Year">2031<\/td>/);
  const coverages = ['bear', 'base', 'bull'].map(name => ui.renderModel(ui.scenarioState(name)).coverage);
  assert.equal(new Set(coverages).size, 3, 'each scenario gives its own 2031 coverage');
});

test('evidence, number tables and verification steps are published beside the page', async () => {
  assert.equal(rebuild.status, 0, rebuild.stderr);
  assert.equal(await page('docs/EVIDENCE.md'), await readFile(join(ROOT, 'docs/EVIDENCE.md'), 'utf8'));
  assert.equal(await page('VERIFY.md'), await readFile(join(ROOT, 'docs/VERIFY.md'), 'utf8'));
  assert.match(await page('NUMBERS.md'), new RegExp(`t1\\.verdict \\| ${await published('t1.verdict')}`));
  const charts = JSON.parse(await page('charts.json'));
  await Promise.all(charts.files.map(file => access(join(root, 'dashboard', file))));
});

test('review command prints the windows for a scheduled review date offline', () => {
  const result = spawnSync(process.execPath, ['scripts/review.mjs', '2027-02-01'], { cwd: root, env, encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /2026-02-02 to 2027-02-01/);
  const bad = spawnSync(process.execPath, ['scripts/review.mjs', '2027-02-02'], { cwd: root, env, encoding: 'utf8', timeout: 15000 });
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /Unscheduled review date/);
});
