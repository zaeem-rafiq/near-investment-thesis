import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './sources.mjs';
import { atomic } from './store.mjs';
import { dayRange, assertNoWalletFields } from './report.mjs';

const PERIODS = ['2024-11-01', '2025-11-01'];

// The table reference stays private. Read the completed result, never transactions.
export function signerTop10Query(table) {
  if (!/^[a-z][a-z0-9-]*\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/.test(table)) throw new Error('Invalid result table reference.');
  return `WITH frozen AS (
  SELECT receiver_account_id
  FROM \`${table}\`
  WHERE grain = 'receiver_period' AND period_start = DATE '2024-11-01'
    AND mean_daily_signers > 0
  ORDER BY mean_daily_signers DESC, receiver_account_id
  LIMIT 10
)
SELECT r.grain, r.period_start, r.receiver_account_id, r.mean_daily_signers
FROM \`${table}\` AS r JOIN frozen USING (receiver_account_id)
WHERE r.grain = 'receiver_period'
  AND r.period_start IN (DATE '2024-11-01', DATE '2025-11-01')
ORDER BY r.receiver_account_id, r.period_start`;
}

// appEvidence maps only independently verified public app contracts to evidence.
// Any unverified receiver is deliberately unnamed in the public output.
export function summarizeSignerTop10(rows, dayRows, appEvidence = new Map()) {
  if (rows.length !== 20) throw new Error('Expected exactly twenty receiver-period rows.');
  const accounts = new Map();
  for (const r of rows) {
    const mean = Number(r.mean_daily_signers);
    if (r.grain !== 'receiver_period' || !PERIODS.includes(r.period_start)
      || typeof r.receiver_account_id !== 'string' || !r.receiver_account_id
      || !Number.isFinite(mean) || mean < 0) throw new Error('Invalid receiver-period row.');
    if (!accounts.has(r.receiver_account_id)) accounts.set(r.receiver_account_id, {});
    const pair = accounts.get(r.receiver_account_id);
    if (Object.hasOwn(pair, r.period_start)) throw new Error('Duplicate receiver period.');
    pair[r.period_start] = mean;
  }
  if (accounts.size !== 10 || [...accounts.values()].some(p => !(p[PERIODS[0]] > 0) || p[PERIODS[1]] == null)) {
    throw new Error('Incomplete frozen cohort.');
  }
  const ranked = [...accounts].sort(([a, x], [b, y]) => y[PERIODS[0]] - x[PERIODS[0]] || (a < b ? -1 : a > b ? 1 : 0));
  const receivers = ranked.map(([account, pair], i) => ({
    rank: i + 1, receiver: appEvidence.has(account) ? account : 'unnamed account',
    appEvidence: appEvidence.get(account) ?? null,
    earlierMeanDailySigners: pair[PERIODS[0]], laterMeanDailySigners: pair[PERIODS[1]],
    change: pair[PERIODS[1]] - pair[PERIODS[0]], fractionalChange: pair[PERIODS[1]] / pair[PERIODS[0]] - 1
  }));
  const days = new Map();
  for (const r of dayRows) {
    if (r.grain !== 'day' || days.has(r.period_start) || !Number.isSafeInteger(Number(r.top10)) || Number(r.top10) < 0) {
      throw new Error('Invalid or duplicate signer day.');
    }
    days.set(r.period_start, Number(r.top10));
  }
  if (days.size !== 730) throw new Error('Expected 730 signer days.');
  const comparisons = PERIODS.map((start, i) => {
    const dates = dayRange(start, i ? '2026-11-01' : PERIODS[1]);
    if (dates.some(d => !days.has(d))) throw new Error('Missing signer day.');
    const receiverSum = receivers.reduce((s, r) => s + (i ? r.laterMeanDailySigners : r.earlierMeanDailySigners), 0);
    const dayLevelTop10Mean = dates.reduce((s, d) => s + days.get(d), 0) / 365;
    // A signer counted once across the ten can only be counted again per app, never fewer times.
    if (receiverSum < dayLevelTop10Mean - 1e-6) throw new Error('Receiver sum is below the day-level top10 mean.');
    return { periodStart: start, receiverSum, dayLevelTop10Mean, difference: receiverSum - dayLevelTop10Mean };
  });
  const kaiching = accounts.get('users.kaiching');
  return {
    version: 1, periods: { earlier: { start: PERIODS[0], endExclusive: PERIODS[1] }, later: { start: PERIODS[1], endExclusive: '2026-11-01' } },
    ranking: '2024-11-01 mean_daily_signers descending, ties by receiver_account_id ascending; frozen for both years',
    receivers, comparisons,
    overlapExplanation: 'Per-receiver means count a signer once for every app used on a day; day-level top10 counts that signer once across the ten. The difference is excess signer-app incidences, not distinct overlapping users.',
    usersKaiching: { amongFrozenTen: Boolean(kaiching), earlierMeanDailySigners: kaiching?.[PERIODS[0]] ?? null, laterMeanDailySigners: kaiching?.[PERIODS[1]] ?? null,
      meansStatus: kaiching ? 'measured' : 'not extracted; only the ten frozen receivers were selected', breakDate: null, breakDateStatus: 'not measured' },
    unnamedAccounts: receivers.filter(r => r.receiver === 'unnamed account').length
  };
}

// Offline: reads the private extracted rows, daily split rows and contract-code checks.
export async function exportSignerTop10(root = ROOT) {
  const read = async p => JSON.parse(await readFile(resolve(root, p), 'utf8'));
  const extract = await read('data/raw/bigquery/signer_top10-rows.json');
  const split = await read('data/raw/bigquery/signer_split-days.json');
  const contracts = await read('data/raw/bigquery/signer_top10-contracts.json');
  const evidence = new Map(contracts.accounts.filter(a => a.contractCode === true)
    .map(a => [a.account, `contract code deployed at final block ${a.block} (view_account, ${contracts.rpc}, ${contracts.checkedAt})`]));
  const data = { ...summarizeSignerTop10(extract.rows, split.rows, evidence),
    source: { signerSplitJobId: extract.sourceJobId, extractionJobId: extract.jobId, dryRunBytes: extract.estimatedBytes, billedBytes: extract.billedBytes,
      signerSplitSqlSha256: split.sqlSha256, note: 'Selected from the full signer_split result table; no new transactions scan.' } };
  assertNoWalletFields(data);
  const body = JSON.stringify(data, null, 2) + '\n', path = 'data/public/signer-top10.json';
  const manifestPath = resolve(root, 'data/public/manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.files.signer_top10 = { path, sha256: createHash('sha256').update(body).digest('hex') };
  await atomic(resolve(root, path), body);
  await atomic(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return manifest.files.signer_top10;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv[2] !== 'export') throw new Error('Usage: node scripts/signer-top10.mjs export');
    console.log(JSON.stringify(await exportSignerTop10()));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
