import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROOT, hash } from './sources.mjs';
import { assertNoWalletFields } from './report.mjs';
import { loadPositionEvidence } from './position-evidence.mjs';

const supplyPath = 'data/public/bigquery/supply.json';
const pricePath = 'data/public/prices.json';
const positionPath = 'data/public/position-results.json';

export function deriveModelInputs(supply, prices, position) {
  const weeks = [...supply.rows].sort((a, b) => a.week_start.localeCompare(b.week_start));
  const expected = Array.from({ length: 52 }, (_, i) =>
    new Date(Date.parse('2025-11-03') + i * 7 * 86400000).toISOString().slice(0, 10));
  if (JSON.stringify(weeks.map(w => w.week_start)) !== JSON.stringify(expected)
    || JSON.stringify(position?.check1?.weeklyFinalNetUsd?.map(w => w.week) ?? []) !== JSON.stringify(expected)) {
    throw new Error('Model inputs require all 52 T3 weeks.');
  }
  if (JSON.stringify(position.check2?.weeks?.map(w => w.week)) !== JSON.stringify(expected.slice(16))) {
    throw new Error('Model inputs require all 36 Check 2 weeks.');
  }
  const near = value => Number(value) / 1e24;
  const issued = weeks.reduce((sum, w) => sum + near(w.supply_rises_yocto), 0);
  const meanSupply = weeks.reduce((sum, w) =>
    sum + (near(w.opening_supply_yocto) + near(w.closing_supply_yocto)) / 2, 0) / 52;
  const last = weeks.at(-1), latest = prices.days.at(-1);
  const entry = (value, source, status = 'measured') => {
    if (!Number.isFinite(value)) throw new Error('Non-finite model input.');
    return { value, source, status };
  };
  const inputs = {
    startingSupply: entry(near(last.closing_supply_yocto),
      `${supplyPath}: closing_supply_yocto / 1e24, week ${last.week_start}`),
    startMonth: entry(2026 * 12 + 10,
      `${supplyPath}: November 2026 start, following the final T3 week`, 'assumption'),
    realizedShare: entry(issued / (0.025 * meanSupply),
      `${supplyPath}: 52-week issuance / (2.5% × mean of weekly opening/closing supply midpoints)`),
    yearlyBurn: entry(weeks.reduce((sum, w) => sum + near(w.supply_falls_yocto), 0),
      `${supplyPath}: sum of supply_falls_yocto / 1e24 over 52 T3 weeks`),
    price: entry(latest?.close, `${pricePath}: NEAR/USD close on ${latest?.date}`),
    yearlyNetBuying: entry(position.check1.final.netUsd,
      `${positionPath}: Check 1 final netUsd after revenue-wallet recipient/sender exclusions over 52 T3 weeks`),
    yearlyBuybacks: entry(position.check2.receivedUsd * 52 / 36,
      `${positionPath}: 36-week Check 2 receivedUsd at weekly prices × 52/36; annualized gross receipts, not observed annual revenue`,
      'annualized')
  };
  if (inputs.startingSupply.value <= 0 || inputs.price.value <= 0 || inputs.yearlyBurn.value < 0
    || inputs.yearlyBuybacks.value < 0 || inputs.realizedShare.value < 0 || inputs.realizedShare.value > 1) throw new Error('Invalid model defaults.');
  return inputs;
}

// No raw data, environment, network or source refresh. Only two generated files.
export async function writeModelAssets(write, { root = ROOT } = {}) {
  const manifest = JSON.parse(await readFile(resolve(root, 'data/public/manifest.json'), 'utf8'));
  const load = async (name, path) => {
    const entry = manifest.files?.[name];
    if (entry?.path !== path) throw new Error(`Missing public model source: ${name}.`);
    const body = await readFile(resolve(root, path), 'utf8');
    if (hash(body) !== entry.sha256) throw new Error(`Public model source hash mismatch: ${name}.`);
    const data = JSON.parse(body);
    assertNoWalletFields(data);
    return data;
  };
  const [supply, prices, position, evidence] = await Promise.all([
    load('supply', supplyPath), load('prices', pricePath), load('position_results', positionPath),
    loadPositionEvidence(manifest, root)
  ]);
  const inputs = deriveModelInputs(supply, prices, position);
  const scenarios = Object.fromEntries(Object.entries(evidence.section.scenarios).map(([name, scenario]) => [name, scenario.inputs]));
  await write('model.mjs', await readFile(resolve(root, 'scripts/model.mjs')));
  await write('model-inputs.js', `// Generated offline from data/public; do not edit.\nexport const MODEL_INPUTS = ${JSON.stringify(inputs, null, 2)};\nexport const MODEL_SCENARIOS = ${JSON.stringify(scenarios, null, 2)};\n`);
}
