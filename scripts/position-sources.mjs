import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, environment, pullBigQuery, LEDGER, PRE_LEDGER_BILLED_BYTES, positiveInteger } from './sources.mjs';
import { fileStore } from './store.mjs';
import { RECIPIENT_DIR } from './position-config.mjs';

export const POSITION_QUERIES = {
  signer_split: ['transactions']
};
export const POSITION_SCAN_LIMIT = 900_000_000_000;

// Explicit opt-in entry point. Never called by refresh, rebuild, or plan.
export async function pullPositionSources(env, store, dependencies = {}) {
  const root = dependencies.root || ROOT;
  let reconciliation;
  try { reconciliation = JSON.parse(await readFile(resolve(root, RECIPIENT_DIR, 'reconciliation.json'), 'utf8')); }
  catch { throw new Error('Participant reconciliation has not passed; no BigQuery request is permitted.'); }
  if (reconciliation.pass !== true || reconciliation.comparisons?.length !== 10 ||
      reconciliation.comparisons.some(c => c.within_0_1_percent !== true)) {
    throw new Error('Participant reconciliation has not passed; no BigQuery request is permitted.');
  }
  const ledgerBody = await store.read(LEDGER);
  const ledger = ledgerBody ? JSON.parse(ledgerBody) : { preLedgerBilledBytes: PRE_LEDGER_BILLED_BYTES, entries: [] };
  const spent = ledger.preLedgerBilledBytes + ledger.entries.reduce((s, e) => s + e.billedBytes, 0);
  const headroom = POSITION_SCAN_LIMIT - spent;
  if (!Number.isSafeInteger(headroom) || headroom <= 0) throw new Error('900 GB cumulative gate reached; stopping.');
  const result = await pullBigQuery({ ...env, MAX_BYTES_BILLED: String(Math.min(
    positiveInteger(env.MAX_BYTES_BILLED, headroom), headroom
  )) }, store, {
    ...dependencies, queries: POSITION_QUERIES, cumulativeLimit: POSITION_SCAN_LIMIT
  });
  return { ...result, priorBilledBytes: spent, projectedCumulativeBilledBytes: spent + result.estimate };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const mode = process.argv[2];
    if (!['plan', 'run'].includes(mode)) throw new Error('Usage: node scripts/position-sources.mjs plan|run');
    const r = await pullPositionSources(await environment(), fileStore(), { mode });
    for (const p of r.plans) console.log(`${p.name}: ${p.reused ? 'cached' : `${p.bytes} estimated bytes (${p.bytes / 1e9} GB)`}`);
    console.log(`Projected cumulative: ${r.projectedCumulativeBilledBytes} bytes (${r.projectedCumulativeBilledBytes / 1e9} GB); gate 900 GB.`);
    if (r.cumulativeBilledBytes != null) console.log(`Cumulative billed: ${r.cumulativeBilledBytes} bytes (${r.cumulativeBilledBytes / 1e9} GB).`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
