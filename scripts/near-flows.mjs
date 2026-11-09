import { resolve } from 'node:path';
import { ROOT } from './sources.mjs';
import { CAL, addDays, usdUnits, usdString } from './report.mjs';
import { readJSON, savedPages, readPage } from './swaps.mjs';
import { atomic } from './store.mjs';

const START = CAL.t3.firstWeek, END = addDays(START, CAL.t3.weeks * 7);

function accumulator(nearAssetIds) {
  // Exact IDs are supplied by the owner; substring matches are not token classification.
  if (!Array.isArray(nearAssetIds) || !nearAssetIds.length ||
      nearAssetIds.some(id => typeof id !== 'string' || !id.trim()) ||
      new Set(nearAssetIds).size !== nearAssetIds.length) throw new Error('Supply explicit, distinct NEAR asset IDs.');
  const near = new Set(nearAssetIds);
  const weeks = Array.from({ length: CAL.t3.weeks }, (_, i) => ({
    week: addDays(START, i * 7), total: 0n, buys: 0n, sells: 0n, missing: 0
  }));
  return {
    add(rows) {
      if (!Array.isArray(rows)) throw new Error('Invalid saved swap page.');
      for (const row of rows) {
        const time = Date.parse(row.createdAt);
        if (!Number.isFinite(time)) throw new Error('Invalid flow timestamp.');
        if (time < Date.parse(START) || time >= Date.parse(END)) continue;
        if (typeof row.originAsset !== 'string' || !row.originAsset ||
            typeof row.destinationAsset !== 'string' || !row.destinationAsset) throw new Error('Invalid flow asset ID.');
        const week = weeks[Math.floor((time - Date.parse(START)) / (7 * 86400000))];
        const units = usdUnits(row.amountInUsd);
        if (row.amountInUsd == null || row.amountInUsd === '') { week.missing++; continue; }
        if (units == null) throw new Error('Invalid flow USD amount.');
        const originNear = near.has(row.originAsset), destinationNear = near.has(row.destinationAsset);
        if (originNear && destinationNear) continue;
        week.total += units;
        if (destinationNear) week.buys += units;
        if (originNear) week.sells += units;
      }
    },
    finish: () => ({ weeks: weeks.map(w => ({
      week: w.week, total_usd: usdString(w.total), buys_usd: usdString(w.buys),
      sells_usd: usdString(w.sells), missing_usd: w.missing
    })) })
  };
}

export function aggregateNearFlows(rows, nearAssetIds) {
  const aggregate = accumulator(nearAssetIds);
  aggregate.add(rows);
  return aggregate.finish();
}

// Explicit offline operation, never called by rebuild, refresh, or export-public.
// Only weekly totals leave the private page directory.
export async function exportNearFlows(dir, nearAssetIds, { root = ROOT } = {}) {
  const aggregate = accumulator(nearAssetIds), done = await readJSON(resolve(dir, 'complete.json'));
  if (done?.complete !== true || !Number.isFinite(Date.parse(done.window?.start)) ||
      !Number.isFinite(Date.parse(done.window?.end)) ||
      Date.parse(done.window.start) > Date.parse(START) || Date.parse(done.window.end) < Date.parse(END)) {
    throw new Error('NEAR flows require complete saved pages covering all 52 weeks.');
  }
  const names = await savedPages(dir);
  if (names.length !== done.pages) throw new Error('Saved flow page count differs from completion record.');
  let rows = 0;
  for (const name of names) {
    const page = await readPage(dir, name);
    aggregate.add(page.rows);
    rows += page.rows.length;
  }
  if (rows !== done.rows) throw new Error('Saved flow row count differs from completion record.');
  const result = aggregate.finish();
  await atomic(resolve(root, 'data/public/near_flows.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}
