import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROOT, literalDateFilters } from './sources.mjs';
import { dayRange } from './report.mjs';

const START = '2024-11-01', END = '2026-11-01';
const count = value => {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new Error('Invalid signer split count.');
  return Number(value);
};

export function checkSignerSplit(rows, signers) {
  if (!Array.isArray(rows) || !signers?.days) throw new Error('Signer split requires daily signers.');
  const days = new Map(), receivers = new Set();
  for (const row of rows) {
    if (row.grain === 'day') {
      if (row.period_start < START || row.period_start >= END || days.has(row.period_start)) throw new Error('Invalid or duplicate signer split day.');
      days.set(row.period_start, count(row.top10) + count(row.everyone_else));
    } else if (row.grain === 'receiver_period') {
      const key = JSON.stringify([row.receiver_account_id, row.period_start]);
      if (typeof row.receiver_account_id !== 'string' || !row.receiver_account_id ||
          ![START, '2025-11-01'].includes(row.period_start) || receivers.has(key) ||
          row.mean_daily_signers == null || row.mean_daily_signers === '' ||
          !Number.isFinite(Number(row.mean_daily_signers)) || Number(row.mean_daily_signers) < 0) {
        throw new Error('Invalid signer split receiver mean.');
      }
      receivers.add(key);
    } else throw new Error('Unknown signer split grain.');
  }
  for (const day of dayRange(START, END)) {
    if (!days.has(day) || days.get(day) !== signers.days.get(day)?.signers) {
      throw new Error(`Signer split groups do not sum to signers.sql on ${day}.`);
    }
  }
}

// Optional until the owner locks the research rule and authorizes fetching it.
export async function verifyOptionalSignerSplit(signers, root = ROOT) {
  let body;
  try { body = await readFile(resolve(root, 'data/public/bigquery/signer_split.json'), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  const raw = JSON.parse(body);
  const sql = await readFile(resolve(root, 'sql/signer_split.sql'), 'utf8');
  if (raw.sql !== sql || JSON.stringify(raw.filters) !== JSON.stringify(literalDateFilters(sql))) {
    throw new Error('Signer split SQL does not match its public snapshot.');
  }
  checkSignerSplit(raw.rows, signers);
}
