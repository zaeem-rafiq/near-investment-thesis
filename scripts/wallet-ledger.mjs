import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROOT } from './sources.mjs';
import { addDays } from './report.mjs';
import { REVENUE_WALLETS } from './position-config.mjs';
import { RAW_NEARBLOCKS } from './nearblocks.mjs';

export const CHECK2 = { firstWeek: '2026-02-23', weeks: 36 };
export const CHECK2_WEEKS = Array.from({ length: CHECK2.weeks }, (_, i) => addDays(CHECK2.firstWeek, 7 * i));
const RETURNS = new Set(['wrap.near', 'system']);
const isWallet = account => REVENUE_WALLETS.includes(account);

// NEARBlocks emits yocto amounts as JSON numbers. Keep the emitted lexeme so
// integers stay exact; values the server already printed in rounded scientific
// form are counted, because their trailing digits are not recoverable.
export function exactYocto(lexeme) {
  const m = /^(\d+)(?:\.(\d+))?(?:[eE]\+?(\d+))?$/.exec(String(lexeme));
  if (!m) throw new Error('Invalid NEARBlocks amount.');
  const [, whole, fraction = '', exponent = '0'] = m, shift = Number(exponent) - fraction.length;
  if (shift < 0) throw new Error('Fractional yocto amount.');
  const digits = (whole + fraction).replace(/^0+(?=\d)/, '');
  return { yocto: BigInt(digits) * 10n ** BigInt(shift), rounded: Boolean(m[3]) && digits.replace(/0+$/, '').length >= 16 };
}

export function parsePage(body) {
  return JSON.parse(body, (key, value, context) => key === 'deposit' || key === 'amount' ? context?.source ?? value : value);
}

export const weekOf = nanoseconds => {
  const day = new Date(Number(BigInt(nanoseconds) / 1000000n)).toISOString().slice(0, 10);
  const dow = (new Date(day).getUTCDay() + 6) % 7;
  return addDays(day, -dow);
};

// One native TRANSFER action in one receipt. Returns null for actions outside the ledger.
export function classifyTransfer(row, wallet) {
  const sender = row.predecessor_account_id, receiver = row.receiver_account_id;
  if (isWallet(sender) && isWallet(receiver)) return receiver === wallet ? 'internal_in' : sender === wallet ? 'internal_out' : null;
  if (receiver === wallet) return RETURNS.has(sender) ? 'not_received' : 'in';
  if (sender === wallet) return 'out';
  return null;
}

export function walletLedger(wallet, receipts, { maxHeight, ftRows = [] } = {}) {
  if (!isWallet(wallet)) throw new Error('Unknown revenue wallet.');
  const totals = { in: 0n, out: 0n, not_received: 0n, internal_in: 0n, internal_out: 0n };
  const weeks = new Map(CHECK2_WEEKS.map(w => [w, { week: w, inNear: 0n, inWnear: 0n, out: 0n, notReceived: 0n }]));
  const audit = { receipts: 0, transferActions: 0, failedTransfers: 0, missingOutcomes: 0, roundedAmounts: 0, afterSnapshot: 0, wnearIn: 0, wnearRowsOther: 0 };
  const ids = new Set();
  for (const row of receipts) {
    if (ids.has(row.receipt_id)) throw new Error('Duplicate receipt.');
    ids.add(row.receipt_id); audit.receipts++;
    const height = row.receipt_block?.block_height;
    if (!Number.isSafeInteger(height)) throw new Error('Invalid receipt height.');
    if (maxHeight != null && height > maxHeight) { audit.afterSnapshot++; continue; }
    const transfers = (row.actions || []).filter(a => a.action === 'TRANSFER');
    if (!transfers.length) continue;
    const status = row.receipt_outcome?.status;
    if (typeof status !== 'boolean') { audit.missingOutcomes += transfers.length; continue; }
    const direction = classifyTransfer(row, wallet);
    for (const action of transfers) {
      audit.transferActions++;
      if (!status) { audit.failedTransfers++; continue; }
      if (!direction) continue;
      const { yocto, rounded } = exactYocto(action.deposit);
      if (rounded) audit.roundedAmounts++;
      totals[direction] += yocto;
      const week = weeks.get(weekOf(row.block_timestamp));
      if (!week) continue;
      if (direction === 'in') week.inNear += yocto;
      if (direction === 'out') week.out += yocto;
      if (direction === 'not_received') week.notReceived += yocto;
    }
  }
  for (const row of ftRows) {
    // wNEAR counts only when it arrives at the wallet from outside the three wallets.
    if (row.affected_account_id !== wallet) { audit.wnearRowsOther++; continue; }
    const raw = String(row.delta_amount ?? row.amount);
    if (raw.startsWith('-')) continue;
    const amount = exactYocto(raw).yocto;
    if (amount === 0n || isWallet(row.involved_account_id) || row.involved_account_id == null) continue;
    const height = row.block?.block_height;
    if (maxHeight != null && Number.isSafeInteger(height) && height > maxHeight) continue;
    audit.wnearIn++;
    const week = weeks.get(weekOf(row.block_timestamp));
    if (week) week.inWnear += amount;
  }
  const ledgerBalance = totals.in - totals.out + totals.not_received;
  // Moves among the three wallets are excluded from Check 2 but still change each balance.
  return { wallet, totals, weeks: [...weeks.values()], audit, ledgerBalance, balanceWithInternal: ledgerBalance + totals.internal_in - totals.internal_out };
}

export async function readHistory(wallet, kind, root = ROOT) {
  const dir = resolve(root, RAW_NEARBLOCKS, wallet, kind);
  const done = JSON.parse(await readFile(resolve(dir, 'complete.json'), 'utf8'));
  const names = (await readdir(dir)).filter(n => /^page-\d{4}\.json$/.test(n)).sort();
  if (!done.complete || names.length !== done.pages) throw new Error('Incomplete NEARBlocks history.');
  const rows = [];
  for (const name of names) rows.push(...parsePage(JSON.parse(await readFile(resolve(dir, name), 'utf8')).body).txns);
  if (rows.length !== done.rows) throw new Error('NEARBlocks row count differs from completion record.');
  return rows;
}
