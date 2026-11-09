import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { ROOT } from './sources.mjs';
import { usdUnits, usdString, addDays } from './report.mjs';
import { readJSON, savedPages, readPage, swapDir, SWAP_WINDOW } from './swaps.mjs';
import { NEAR_ASSET_IDS, POSITION_WINDOW, RECIPIENT_DIR, PULL_WINDOW_DAYS, FULL_WINDOW_PULLS } from './position-config.mjs';

export function pullWindows(window = POSITION_WINDOW, days = PULL_WINDOW_DAYS) {
  const out = [];
  for (let start = window.start; start < window.end; start = addDays(start, days)) {
    const end = addDays(start, days) < window.end ? addDays(start, days) : window.end;
    out.push({ start, end, directory: `window-${start}` });
  }
  return out;
}
export const participantPulls = (ids = NEAR_ASSET_IDS) => ['buys', 'sells'].flatMap(side =>
  ids.map((asset, i) => ({
    side, asset, filter: side === 'buys' ? 'toTokenId' : 'fromTokenId', directory: `${side}/asset-${i + 1}`,
    windows: FULL_WINDOW_PULLS.some(f => f.side === side && f.asset === asset)
      ? [{ ...POSITION_WINDOW, directory: 'full' }] : pullWindows()
  })));

// Keys never leave memory. Only counts and USD aggregates are returned.
export function participantTotals(ids = NEAR_ASSET_IDS, window = POSITION_WINDOW) {
  const near = new Set(ids), seen = new Map();
  const buckets = Object.fromEntries(['buys', 'sells'].map(side =>
    [side, new Map(ids.map(id => [id, { rows: 0, usd: 0n, missing_usd: 0 }]))]));
  const stats = { input_rows: 0, duplicate_rows: 0, near_to_near: 0 };
  return {
    add(rows) {
      for (const row of rows) {
        const ts = Date.parse(row.createdAt);
        if (!Number.isFinite(ts)) throw new Error('Invalid participant timestamp.');
        if (ts < Date.parse(window.start) || ts >= Date.parse(window.end)) continue;
        const origin = near.has(row.originAsset), destination = near.has(row.destinationAsset);
        if (!origin && !destination) continue;
        if (!row.depositAddress || row.status !== 'SUCCESS') throw new Error('Invalid participant swap identity.');
        stats.input_rows++;
        const key = createHash('sha256').update(JSON.stringify([row.depositAddress, row.depositMemo ?? null, row.createdAt])).digest('hex');
        const value = JSON.stringify([row.originAsset, row.destinationAsset, row.amountInUsd]);
        if (seen.has(key)) {
          if (seen.get(key) !== value) throw new Error('Conflicting duplicate participant swap.');
          stats.duplicate_rows++;
          continue;
        }
        seen.set(key, value);
        if (origin && destination) { stats.near_to_near++; continue; }
        const bucket = destination ? buckets.buys.get(row.destinationAsset) : buckets.sells.get(row.originAsset);
        bucket.rows++;
        if (row.amountInUsd == null || row.amountInUsd === '') { bucket.missing_usd++; continue; }
        const usd = usdUnits(row.amountInUsd);
        if (usd == null) throw new Error('Invalid participant USD amount.');
        bucket.usd += usd;
      }
    },
    finish() {
      return { ...stats, ...Object.fromEntries(Object.entries(buckets).map(([side, assets]) => [side, {
        assets: [...assets].map(([asset, b]) => ({ asset, rows: b.rows, usd: usdString(b.usd), missing_usd: b.missing_usd })),
        rows: [...assets.values()].reduce((n, b) => n + b.rows, 0),
        usd: usdString([...assets.values()].reduce((n, b) => n + b.usd, 0n)),
        missing_usd: [...assets.values()].reduce((n, b) => n + b.missing_usd, 0)
      }])) };
    }
  };
}

async function scan(dir, aggregate, expected, window) {
  const done = await readJSON(resolve(dir, 'complete.json'));
  if (window) {
    if (!done?.complete || done.window?.start !== window.start || done.window?.end !== window.end) {
      throw new Error('Participant window completion record differs from its planned window.');
    }
  } else if (!done?.complete || !Number.isFinite(Date.parse(done.window?.start)) || !Number.isFinite(Date.parse(done.window?.end)) ||
      Date.parse(done.window.start) > Date.parse(POSITION_WINDOW.start) || Date.parse(done.window.end) < Date.parse(POSITION_WINDOW.end)) {
    throw new Error('Participant reconciliation requires complete pages covering the locked window.');
  }
  if (expected && (JSON.stringify(done.params?.[expected.filter]) !== JSON.stringify([expected.asset]) ||
      done.retainParticipants !== true)) throw new Error('Participant pull metadata differs from its single-asset filter.');
  const names = await savedPages(dir);
  if (names.length !== done.pages) throw new Error('Participant page count differs from completion record.');
  let rows = 0;
  for (const name of names) {
    const page = await readPage(dir, name);
    if (!Array.isArray(page.rows)) throw new Error('Invalid participant page.');
    if (expected && page.rows.some(row =>
      row[expected.side === 'buys' ? 'destinationAsset' : 'originAsset'] !== expected.asset)) {
      throw new Error('Participant page violates its single-asset filter.');
    }
    if (window && page.rows.some(row => Date.parse(row.createdAt) < Date.parse(window.start) ||
      Date.parse(row.createdAt) >= Date.parse(window.end))) throw new Error('Participant page row lies outside its window.');
    aggregate.add(page.rows);
    rows += page.rows.length;
  }
  if (rows !== done.rows) throw new Error('Participant row count differs from completion record.');
}

export function compareParticipantTotals(saved, filtered) {
  const comparisons = [];
  for (const side of ['buys', 'sells']) {
    for (const expected of [...saved[side].assets, { asset: 'TOTAL', ...saved[side] }]) {
      const actual = expected.asset === 'TOTAL' ? filtered[side] : filtered[side].assets.find(a => a.asset === expected.asset);
      if (!actual) throw new Error('Participant comparison is missing an asset.');
      const a = usdUnits(actual.usd), b = usdUnits(expected.usd), delta = a > b ? a - b : b - a;
      comparisons.push({
        side, asset: expected.asset, saved_usd: expected.usd, filtered_usd: actual.usd,
        saved_rows: expected.rows, filtered_rows: actual.rows,
        saved_missing_usd: expected.missing_usd, filtered_missing_usd: actual.missing_usd,
        difference_percent: b === 0n ? (a === 0n ? 0 : null) : Number(delta) / Number(b) * 100,
        within_0_1_percent: b === 0n ? a === 0n : delta * 1000n <= b
      });
    }
  }
  return { pass: comparisons.every(c => c.within_0_1_percent), comparisons, saved, filtered };
}

export async function reconcileParticipants({
  root = ROOT, baselineDir = swapDir(SWAP_WINDOW, root), participantDir = resolve(root, RECIPIENT_DIR)
} = {}) {
  const baseline = participantTotals(), filtered = participantTotals();
  await scan(baselineDir, baseline);
  for (const pull of participantPulls()) {
    for (const w of pull.windows) await scan(resolve(participantDir, pull.directory, w.directory), filtered, pull, w);
  }
  return compareParticipantTotals(baseline.finish(), filtered.finish());
}
