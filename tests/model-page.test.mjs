import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ROOT } from '../scripts/sources.mjs';
import { writeModelAssets, deriveModelInputs } from '../scripts/model-page.mjs';
import { parseState, stateQuery, DEFAULT_STATE, renderModel, scenarioState } from '../dashboard/model-ui.js';
import { projectModel } from '../scripts/model.mjs';

test('browser model is a byte copy and generated defaults independently match public evidence', async () => {
  const files = {};
  await writeModelAssets(async (name, body) => { files[name] = body; });
  assert.deepEqual(Object.keys(files), ['model.mjs', 'model-inputs.js']);
  assert.deepEqual(files['model.mjs'], await readFile(`${ROOT}/scripts/model.mjs`));
  assert.deepEqual(await readFile(`${ROOT}/dashboard/model.mjs`), files['model.mjs']);
  assert.equal(await readFile(`${ROOT}/dashboard/model-inputs.js`, 'utf8'), files['model-inputs.js']);
  const { MODEL_INPUTS: inputs } = await import(`data:text/javascript;base64,${Buffer.from(files['model-inputs.js']).toString('base64')}`);
  const supply = JSON.parse(await readFile(`${ROOT}/data/public/bigquery/supply.json`, 'utf8')).rows;
  const prices = JSON.parse(await readFile(`${ROOT}/data/public/prices.json`, 'utf8')).days;
  const position = JSON.parse(await readFile(`${ROOT}/data/public/position-results.json`, 'utf8'));
  const total = field => supply.map(w => Number(w[field]) / 1e24).reduce((a, b) => a + b, 0);
  const mean = (total('opening_supply_yocto') + total('closing_supply_yocto')) / (2 * 52);
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-12);
  near(inputs.startingSupply.value, Number(supply.at(-1).closing_supply_yocto) / 1e24);
  near(inputs.realizedShare.value, total('supply_rises_yocto') / (0.025 * mean));
  near(inputs.yearlyBurn.value, total('supply_falls_yocto'));
  near(inputs.price.value, prices.at(-1).close);
  near(inputs.yearlyNetBuying.value, position.check1.final.netUsd);
  near(inputs.yearlyNetBuying.value, position.check1.weeklyFinalNetUsd.reduce((s, w) => s + w.netUsd, 0));
  assert.equal(inputs.startMonth.value, 2026 * 12 + 10);
  near(inputs.yearlyBuybacks.value, position.check2.receivedUsd * 52 / 36);
  near(inputs.yearlyBuybacks.value, position.check2.weeks.reduce((s, w) => s + w.receivedUsd, 0) * 52 / 36);
  assert.equal(inputs.yearlyNetBuying.status, 'measured');
  assert.equal(inputs.yearlyBuybacks.status, 'annualized');
  for (const input of Object.values(inputs)) assert.match(input.source, /^data\/public\//);
});

test('model input generation refuses incomplete evidence', () => {
  assert.throws(() => deriveModelInputs({ rows: [] }, { days: [] }, { weeks: [] }), /52 T3 weeks/);
});

test('URL settings clamp at slider bounds and snap to valid slider steps', () => {
  assert.deepEqual(parseState('?price=100&buying=-10&buybacks=200000000&growth=-2&cut=1'), {
    price: 5, buying: -1, buybacks: 100_000_000, growth: -0.5, cut: 1
  });
  assert.deepEqual(parseState('?price=-1&buying=99&buybacks=-5&growth=2&cut=0'), {
    price: 0.25, buying: 10, buybacks: 0, growth: 1, cut: 0
  });
  assert.equal(parseState('?price=1.237').price, 1.24);
  assert.equal(parseState('?buybacks=1234567').buybacks, 1_200_000);
});
test('URL settings reject empty, repeated, non-finite, non-decimal and injected values', () => {
  for (const bad of ['', 'NaN', 'Infinity', '-Infinity', '1e2', '0x10', ' 2 ', '<script>', 'null']) {
    const query = new URLSearchParams(Object.keys(DEFAULT_STATE).map(key => [key, bad]));
    assert.deepEqual(parseState(query.toString()), DEFAULT_STATE, bad);
  }
  assert.deepEqual(parseState('?price=2&price=3&cut=2&growth=nope&unknown=4'), DEFAULT_STATE);
  assert.equal(parseState('?cut=0.5').cut, 0);
  assert.equal(parseState('?price=' + '9'.repeat(400)).price, 1);
});
test('URL settings round trip and only known settings survive canonicalization', () => {
  const state = { price: 0.25, buying: 10, buybacks: 100_000_000, growth: -0.5, cut: 1 };
  assert.deepEqual(parseState(stateQuery(state)), state);
  assert.deepEqual(parseState(''), DEFAULT_STATE);
  assert.doesNotMatch(stateQuery(parseState('?unknown=bad')), /unknown/);
});
test('fixed-input rendering agrees with an independent constant-rate annuity for every annual row', () => {
  const value = number => ({ value: number });
  const inputs = {
    startingSupply: value(1_000_000), startMonth: value(2027 * 12),
    realizedShare: value(0.96), yearlyBurn: value(1200), price: value(2),
    yearlyNetBuying: value(24_000), yearlyBuybacks: value(100_000)
  };
  const view = renderModel({ ...DEFAULT_STATE, buybacks: 100_000 }, inputs);
  // Use a slider-valid buyback amount, and keep units explicit.
  const rate = 0.025 * 0.96 / 12, burnPerMonth = 100, absorption = 62_000;
  const close = (a, b) => assert.ok(Math.abs(a - b) < Math.max(1, Math.abs(b)) * 1e-10, `${a} != ${b}`);
  let start = 1_000_000;
  for (const [i, row] of view.years.entries()) {
    const end = (start - burnPerMonth / rate) * (1 + rate) ** 12 + burnPerMonth / rate;
    const issued = end - start + 1200;
    assert.equal(row.year, 2027 + i);
    close(row.newNear, issued);
    close(row.burnedNear, 1200);
    close(row.absorbedNear, absorption);
    close(row.coverage, (absorption + 1200) / issued);
    close(row.netFloatChange, issued - 1200 - absorption);
    close(row.breakEvenPrice, 124_000 / (issued - 1200));
    start = end;
  }
  close(view.neededUsd, (view.years[4].newNear - 1200) * 2);
  close(view.multiple, view.neededUsd / 24_000);
  assert.equal((view.tableRows.match(/<tr>/g) || []).length, 5);
  assert.equal((view.chart.match(/<rect /g) || []).length, 10);
  assert.doesNotMatch(view.chart, /\bstyle=/);
});
test('all 32 slider/toggle corners render finite rows and valid markup', () => {
  for (const cut of [0, 1]) for (const price of [0.25, 5]) for (const buying of [-1, 10]) {
    for (const buybacks of [0, 100_000_000]) for (const growth of [-0.5, 1]) {
      const view = renderModel({ cut, price, buying, buybacks, growth });
      for (const row of view.years) {
        for (const value of Object.values(row)) assert.ok(value === null || Number.isFinite(value));
      }
      assert.doesNotMatch(JSON.stringify(view), /NaN|Infinity|undefined/);
      assert.doesNotMatch(view.chart, /\bstyle=/);
    }
  }
});
test('undefined values render explicit text, never NaN or Infinity', () => {
  const input = Object.fromEntries(Object.entries({
    startingSupply: 1_000_000, startMonth: 2027 * 12, realizedShare: 0,
    yearlyBurn: 0, price: 2, yearlyNetBuying: 0, yearlyBuybacks: 0
  }).map(([key, value]) => [key, { value }]));
  const view = renderModel(DEFAULT_STATE, input);
  assert.equal(view.coverage, 'Not defined');
  assert.equal(view.multiple, null);
  assert.match(view.tableRows, /Not defined/);
  assert.doesNotMatch(JSON.stringify(view), /NaN|Infinity/);
});
test('standalone page keeps the existing CSP with only self-hosted script permission added', async () => {
  const html = await readFile(`${ROOT}/dashboard/model.html`, 'utf8');
  const oldHtml = await readFile(`${ROOT}/dashboard/index.html`, 'utf8');
  const csp = text => text.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.equal(csp(html), `${csp(oldHtml)}; script-src 'self'`);
  assert.doesNotMatch(html, /<style\b|style=|\bon\w+=|<script(?![^>]*\bsrc=)/);
  assert.match(html, /id="coverage"[^>]*aria-live="polite"/);
  for (const id of ['price', 'buying', 'buybacks', 'growth', 'cut']) {
    assert.match(html, new RegExp(`<label for="${id}">[^<]*(?:<[^>]+>[^<]*)*?assumption`));
  }
  const js = await readFile(`${ROOT}/dashboard/model-ui.js`, 'utf8');
  assert.doesNotMatch(js, /\bfetch\s*\(|XMLHttpRequest|https?:\/\//);
});

test('scenario buttons preserve exact sourced inputs through render, URL sharing and repeated preset changes', async () => {
  const section = JSON.parse(await readFile(`${ROOT}/data/public/position-section.json`, 'utf8'));
  for (const name of ['bear', 'base', 'bull', 'bear', 'base']) {
    const state = scenarioState(name);
    assert.deepEqual(parseState(stateQuery(state)), state);
    const view = renderModel(state), expected = projectModel(section.scenarios[name].inputs);
    for (const [i, row] of view.years.entries()) {
      for (const [key, value] of Object.entries(expected.years[i])) {
        if (value === null) assert.equal(row[key], null);
        else assert.ok(Math.abs(row[key] - value) < Math.max(1, Math.abs(value)) * 1e-12, `${name}.${key}`);
      }
    }
  }
  assert.ok(scenarioState('bear').buying < 0);
  assert.throws(() => scenarioState('toString'), /Unknown scenario/);
  assert.deepEqual(renderModel(DEFAULT_STATE).state, DEFAULT_STATE, 'Reset must not round the annualized USD default.');
  const html = await readFile(`${ROOT}/dashboard/model.html`, 'utf8');
  for (const name of ['bear', 'base', 'bull']) assert.match(html, new RegExp(`id="scenario-${name}" type="button" aria-pressed="false"`));
  assert.doesNotMatch(html, /provisional|pending Check 2/);
});

test('every page declares the local favicon and rebuild ships its exact source', async () => {
  const icon = await readFile(`${ROOT}/web/favicon.svg`, 'utf8');
  assert.equal(await readFile(`${ROOT}/dashboard/favicon.svg`, 'utf8'), icon);
  assert.doesNotMatch(icon, /<script|<image|<foreignObject|\bon\w+=/i);
  for (const page of ['index.html', 'thesis.html', 'model.html']) {
    assert.match(await readFile(`${ROOT}/dashboard/${page}`, 'utf8'), /rel="icon" href="favicon.svg" type="image\/svg\+xml"/);
  }
});
