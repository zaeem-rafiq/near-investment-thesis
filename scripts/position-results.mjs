import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { atomic } from './store.mjs';
import { ROOT } from './sources.mjs';
import * as REPORT from './report.mjs';
import { usdUnits, addDays, pearson, CAL } from './report.mjs';
import { readPage, savedPages } from './swaps.mjs';
import { NEAR_ASSET_IDS, POSITION_WINDOW, RECIPIENT_DIR, REVENUE_WALLETS } from './position-config.mjs';
import { participantPulls } from './participants.mjs';

export const usd = units => Number(units) / 1e18;
export const T3_WEEKS = Array.from({ length: CAL.t3.weeks }, (_, i) => addDays(CAL.t3.firstWeek, 7 * i));
const isWallet = a => REVENUE_WALLETS.includes(a);

// Private rows: kept in memory only. Same dedup key and exclusions as participant reconciliation.
export function normalizeSwaps(rawRows, ids = NEAR_ASSET_IDS, window = POSITION_WINDOW) {
  const near = new Set(ids), seen = new Map(), rows = [];
  let nearToNear = 0, duplicates = 0;
  for (const row of rawRows) {
    const ts = Date.parse(row.createdAt);
    if (!Number.isFinite(ts) || ts < Date.parse(window.start) || ts >= Date.parse(window.end)) continue;
    const origin = near.has(row.originAsset), destination = near.has(row.destinationAsset);
    if (!origin && !destination) continue;
    const key = createHash('sha256').update(JSON.stringify([row.depositAddress, row.depositMemo ?? null, row.createdAt])).digest('hex');
    const value = JSON.stringify([row.originAsset, row.destinationAsset, row.amountInUsd]);
    if (seen.has(key)) { if (seen.get(key) !== value) throw new Error('Conflicting duplicate swap.'); duplicates++; continue; }
    seen.set(key, value);
    if (origin && destination) { nearToNear++; continue; }
    const missing = row.amountInUsd == null || row.amountInUsd === '';
    const units = missing ? null : usdUnits(row.amountInUsd);
    if (!missing && units == null) throw new Error('Invalid swap USD amount.');
    const day = new Date(ts).toISOString().slice(0, 10), dow = (new Date(day).getUTCDay() + 6) % 7;
    rows.push({ side: destination ? 'buy' : 'sell', day, originAsset: row.originAsset, week: addDays(day, -dow), units, recipient: row.recipient ?? null,
      senders: Array.isArray(row.senders) ? row.senders : [], refundTo: row.refundTo ?? null });
  }
  return { rows, nearToNear, duplicates };
}

export async function loadParticipantSwaps(root = ROOT) {
  const raw = [];
  for (const pull of participantPulls()) for (const w of pull.windows) {
    const dir = resolve(root, RECIPIENT_DIR, pull.directory, w.directory);
    for (const name of await savedPages(dir)) raw.push(...(await readPage(dir, name)).rows);
  }
  return normalizeSwaps(raw);
}

export function weeklyMeanClose(prices, weeks) {
  const close = new Map(prices.days.map(d => [d.date, d.close]));
  return new Map(weeks.map(week => {
    const days = Array.from({ length: 7 }, (_, i) => close.get(addDays(week, i)));
    if (days.some(c => !(c > 0))) throw new Error(`Missing daily close in week ${week}.`);
    return [week, days.reduce((a, b) => a + b, 0) / 7];
  }));
}

// Net flow over rows passing keep(row). Missing-USD rows are left out and counted.
export function netFlow(rows, keep = () => true, weeks = T3_WEEKS) {
  const weekly = new Map(weeks.map(w => [w, 0n]));
  const out = { buys: 0n, sells: 0n, buyRows: 0, sellRows: 0, missingUsd: 0 };
  for (const r of rows) {
    if (!keep(r)) continue;
    if (r.units == null) { out.missingUsd++; continue; }
    if (r.side === 'buy') { out.buys += r.units; out.buyRows++; weekly.set(r.week, weekly.get(r.week) + r.units); }
    else { out.sells += r.units; out.sellRows++; weekly.set(r.week, weekly.get(r.week) - r.units); }
  }
  return { ...out, net: out.buys - out.sells, weekly };
}
const summary = (f, issuanceUsd) => ({
  buysUsd: usd(f.buys), sellsUsd: usd(f.sells), netUsd: usd(f.net), buyRows: f.buyRows, sellRows: f.sellRows,
  missingUsdRows: f.missingUsd, shareOfIssuanceValue: usd(f.net) / issuanceUsd
});

export const finalKeep = r => r.side === 'buy' ? !isWallet(r.recipient) : !r.senders.some(isWallet);

export function check1(rows, issuanceUsd) {
  const provisional = netFlow(rows), final = netFlow(rows, finalKeep);
  const excludedBuys = netFlow(rows, r => r.side === 'buy' && isWallet(r.recipient));
  const excludedSells = netFlow(rows, r => r.side === 'sell' && r.senders.some(isWallet));
  const sells = rows.filter(r => r.side === 'sell');
  const withSenders = sells.filter(r => r.senders.length);
  const sumUnits = list => list.reduce((s, r) => s + (r.units ?? 0n), 0n);
  const refundOnly = sells.filter(r => isWallet(r.refundTo) && !r.senders.some(isWallet));
  return {
    issuanceUsd, provisional: summary(provisional, issuanceUsd), final: summary(final, issuanceUsd),
    excluded: { buyRows: excludedBuys.buyRows, buysUsd: usd(excludedBuys.buys), sellRows: excludedSells.sellRows, sellsUsd: usd(excludedSells.sells) },
    pass: usd(final.net) / issuanceUsd >= 0.20,
    senderCoverage: { sells: sells.length, withSenders: withSenders.length, share: withSenders.length / sells.length,
      usdShare: usd(sumUnits(withSenders)) / usd(sumUnits(sells)) },
    refundToRevenueWalletNotSender: { sells: refundOnly.length, usd: usd(sumUnits(refundOnly)) },
    weeklyFinal: final.weekly
  };
}

// Two-way: received NEAR in a buy and is a seller (by sellersOf) in a sell; removed from both sides of Check 1 final.
export function twoWayCut(rows, issuanceUsd, sellersOf = r => r.senders) {
  const kept = rows.filter(finalKeep);
  const buyers = new Set(kept.filter(r => r.side === 'buy' && r.recipient).map(r => r.recipient));
  const sellers = new Set(kept.filter(r => r.side === 'sell').flatMap(sellersOf).filter(Boolean));
  const twoWay = new Set([...buyers].filter(a => sellers.has(a)));
  const f = netFlow(kept, r => r.side === 'buy' ? !twoWay.has(r.recipient) : !sellersOf(r).some(a => twoWay.has(a)));
  return { accounts: twoWay.size, ...summary(f, issuanceUsd) };
}

export function exchangeCut(rows, exchangeAccounts, issuanceUsd) {
  const ex = new Set(exchangeAccounts), kept = rows.filter(finalKeep);
  const hit = kept.filter(r => ex.has(r.recipient));
  const f = netFlow(kept, r => !ex.has(r.recipient));
  return { labeledAccounts: ex.size, removedBuyRows: hit.filter(r => r.side === 'buy').length,
    removedSellRows: hit.filter(r => r.side === 'sell').length, ...summary(f, issuanceUsd) };
}

// Weekly price change uses the previous week's mean close, so all 52 weeks have a change.
export function leadFollow(flows, closes, priorClose, lags = [1, 2, 4, 8]) {
  const change = closes.map((c, i) => c / (i ? closes[i - 1] : priorClose) - 1);
  const rows = lags.map(lag => {
    const n = flows.length - lag;
    const flowThenPrice = pearson(flows.slice(0, n), change.slice(lag));
    const priceThenFlow = pearson(change.slice(0, n), flows.slice(lag));
    return { lag, pairs: n, flowThenPrice, priceThenFlow };
  });
  const wins = (a, b) => rows.filter(r => r[a] != null && r[b] != null && r[a] >= 0.30 && r[a] - r[b] >= 0.15).length;
  const flowWins = wins('flowThenPrice', 'priceThenFlow'), priceWins = wins('priceThenFlow', 'flowThenPrice');
  const result = flowWins >= 2 && priceWins < 2 ? 'flow leads' : priceWins >= 2 && flowWins < 2 ? 'price leads' : "can't tell";
  return { lags: rows, flowLeadLags: flowWins, priceLeadLags: priceWins, result };
}

// Buyer = recipient; seller = first sender, else refundTo. Applied to Check 1 final rows.
export function concentration(rows, issuanceUsd) {
  const net = new Map(), bought = new Map();
  let unattributed = 0n, multiSender = 0;
  for (const r of rows.filter(finalKeep)) {
    if (r.units == null) continue;
    if (r.side === 'buy') {
      if (!r.recipient) { unattributed += r.units; continue; }
      net.set(r.recipient, (net.get(r.recipient) ?? 0n) + r.units);
      bought.set(r.recipient, (bought.get(r.recipient) ?? 0n) + r.units);
    } else {
      if (r.senders.length > 1) multiSender++;
      const seller = r.senders[0] ?? r.refundTo;
      if (!seller) { unattributed -= r.units; continue; }
      net.set(seller, (net.get(seller) ?? 0n) - r.units);
    }
  }
  const values = [...net.values()];
  const buyers = values.filter(v => v > 0n).sort((a, b) => (b > a ? 1 : b < a ? -1 : 0));
  const sellers = values.filter(v => v < 0n).sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
  const total = values.reduce((s, v) => s + v, 0n) + unattributed;
  const top = (list, k) => list.slice(0, k).reduce((s, v) => s + v, 0n);
  const share = units => usd(units) / issuanceUsd;
  const totals = [...bought.values()].sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
  const mid = totals.length >> 1;
  const median = !totals.length ? null : totals.length % 2 ? totals[mid] : (totals[mid - 1] + totals[mid]) / 2n;
  return {
    netBuyers: buyers.length, netSellers: sellers.length, netUsd: usd(total), shareOfIssuanceValue: share(total),
    withoutTopNetBuyers: Object.fromEntries([1, 3, 10].map(k => [k, { netUsd: usd(total - top(buyers, k)), share: share(total - top(buyers, k)) }])),
    withoutTopNetBuyersAndSellers: Object.fromEntries([3, 10].map(k => {
      const v = total - top(buyers, k) - top(sellers, k);
      return [k, { netUsd: usd(v), share: share(v) }];
    })),
    medianBuyerTotalUsd: totals.length ? usd(median) : null, buyersWithAnyBuy: totals.length,
    unattributedNetUsd: usd(unattributed), sellsWithMultipleSenders: multiSender
  };
}

export function check3(dayRows, signerDays) {
  const days = new Map();
  for (const r of dayRows) {
    if (r.grain !== 'day' || days.has(r.period_start)) throw new Error('Invalid signer split day.');
    const top = Number(r.top10), rest = Number(r.everyone_else);
    if (!Number.isSafeInteger(top) || !Number.isSafeInteger(rest) || top < 0 || rest < 0) throw new Error('Invalid signer split count.');
    if (signerDays && top + rest !== signerDays.get(r.period_start)?.signers) throw new Error(`Signer split does not sum on ${r.period_start}.`);
    days.set(r.period_start, rest);
  }
  const mean = (a, b) => {
    const v = []; for (let d = a; d < b; d = addDays(d, 1)) { if (!days.has(d)) throw new Error(`Missing signer day ${d}.`); v.push(days.get(d)); }
    return { days: v.length, mean: v.reduce((s, x) => s + x, 0) / v.length };
  };
  const prior = mean('2024-11-01', '2025-11-01'), latest = mean('2025-11-01', '2026-11-01');
  const growth = latest.mean / prior.mean - 1;
  return { prior, latest, growth, pass: growth >= 0.20 };
}

export const YOCTO = 10n ** 24n;
export function check2(t3Weeks, walletLedgers, weeks) {
  const byWeek = new Map(t3Weeks.map(w => [w.week, w]));
  let burned = 0, issued = 0, received = 0n;
  const rows = weeks.map(week => {
    const t = byWeek.get(week);
    if (!t) throw new Error(`Missing T3 week ${week}.`);
    let r = 0n;
    for (const l of walletLedgers) { const w = l.weeks.find(x => x.week === week); r += w.inNear + w.inWnear; }
    burned += t.burnt; issued += t.issued; received += r;
    return { week, burnedNear: t.burnt, issuedNear: t.issued, receivedNear: Number(r) / 1e24 };
  });
  const receivedNear = Number(received) / 1e24, ratio = (burned + receivedNear) / issued;
  return { weeks: rows, burnedNear: burned, issuedNear: issued, receivedNear, coverage: ratio, pass: ratio >= 0.20 };
}

// ---------- assembly (private inputs -> aggregate public object) ----------
const toYocto = s => { const [a, b = ''] = String(s).split('.'); return BigInt(a) * YOCTO + BigInt(b.padEnd(24, '0')); };
const near = y => Number(y) / 1e24;
const gapPercent = (gap, base) => Number(gap * 10n ** 12n / base) / 1e10;

export async function buildPositionResults(root = ROOT) {
  const { loadSources, t3Test } = await import('./report.mjs');
  const { walletLedger, readHistory, CHECK2_WEEKS, exactYocto } = await import('./wallet-ledger.mjs');
  const { RAW_NEARBLOCKS, HOLDERS_SOURCE, NEARBLOCKS_SOURCE } = await import('./nearblocks.mjs');
  const read = async p => JSON.parse(await readFile(resolve(root, p), 'utf8'));
  const reconciliation = await read(`${RECIPIENT_DIR}/reconciliation.json`);
  if (reconciliation.pass !== true || reconciliation.comparisons.length !== 10) throw new Error('Participant reconciliation has not passed.');
  const { sources } = await loadSources(root);
  const t3 = t3Test(sources.supply.data, sources.burn.data);
  if (t3.weeks.length !== 52 || t3.weeks.some(w => w.missing)) throw new Error('T3 weeks incomplete.');
  const prior = addDays(T3_WEEKS[0], -7);
  const closes = weeklyMeanClose(sources.prices.data, [prior, ...T3_WEEKS]);
  const issuanceUsd = t3.weeks.reduce((s, w) => s + w.issued * closes.get(w.week), 0);

  // Wallet ledger and both balance reconciliations.
  const controls = await read('data/public/wallet-controls.json'), height = controls.block.height;
  const ledgers = [], reconciliationRows = [];
  for (const wallet of REVENUE_WALLETS) {
    const receipts = await readHistory(wallet, 'receipts', root), ftRows = await readHistory(wallet, 'ft-txns', root);
    const l = walletLedger(wallet, receipts, { maxHeight: height, ftRows });
    const balance = toYocto(controls.wallets.find(w => w.wallet === wallet).nativeNear.value);
    let attachedIn = 0n;
    for (const r of receipts) {
      if (r.receipt_block.block_height > height || r.receipt_outcome?.status !== true || r.receiver_account_id !== wallet) continue;
      for (const a of r.actions || []) if (a.action === 'FUNCTION_CALL') attachedIn += exactYocto(a.deposit).yocto;
    }
    const literal = l.ledgerBalance - balance, corrected = l.balanceWithInternal - balance;
    ledgers.push(l);
    reconciliationRows.push({
      wallet, receipts: l.audit.receipts, wnearTransferRows: ftRows.length, nativeBalanceNear: near(balance),
      inNear: near(l.totals.in), outNear: near(l.totals.out), notReceivedNear: near(l.totals.not_received),
      movesFromOtherRevenueWalletsNear: near(l.totals.internal_in), movesToOtherRevenueWalletsNear: near(l.totals.internal_out),
      gapWithoutMoves: { near: near(literal), percent: gapPercent(literal, balance) },
      gapWithMoves: { near: near(corrected), percent: gapPercent(corrected, balance) },
      functionCallDepositsInNear: near(attachedIn),
      missingOutcomes: l.audit.missingOutcomes, failedTransfers: l.audit.failedTransfers,
      amountsPrintedRoundedBySource: l.audit.roundedAmounts
    });
  }
  const moves = [];
  for (const r of await readHistory(REVENUE_WALLETS[1], 'receipts', root)) {
    if (!REVENUE_WALLETS.includes(r.predecessor_account_id) || !REVENUE_WALLETS.includes(r.receiver_account_id)) continue;
    for (const a of r.actions || []) if (a.action === 'TRANSFER' && r.receipt_outcome?.status === true) moves.push({
      from: r.predecessor_account_id, to: r.receiver_account_id, near: near(exactYocto(a.deposit).yocto),
      at: new Date(Number(BigInt(r.block_timestamp) / 1000000n)).toISOString()
    });
  }
  const worst = Math.max(...reconciliationRows.map(r => Math.abs(r.gapWithMoves.percent)));
  if (worst > 5) throw new Error(`Corrected wallet balance gap ${worst}% exceeds 5%; stopping.`);

  const c2 = check2(t3.weeks, ledgers, CHECK2_WEEKS);
  for (const w of c2.weeks) { w.meanClose = closes.get(w.week); w.receivedUsd = w.receivedNear * w.meanClose; }
  const holders = JSON.parse((await read(`${RAW_NEARBLOCKS}/holders-revenue.json`)).body);
  const llama = new Map();
  for (const [ts, value] of holders.totalDataChart) {
    const day = new Date(ts * 1000).toISOString().slice(0, 10), dow = (new Date(day).getUTCDay() + 6) % 7, week = addDays(day, -dow);
    llama.set(week, (llama.get(week) ?? 0) + value);
  }
  for (const w of c2.weeks) {
    if (!llama.has(w.week)) throw new Error(`Missing holders revenue week ${w.week}.`);
    w.defillamaHoldersRevenueUsd = llama.get(w.week);
  }
  const receivedUsd = c2.weeks.reduce((s, w) => s + w.receivedUsd, 0);
  const llamaUsd = c2.weeks.reduce((s, w) => s + (w.defillamaHoldersRevenueUsd ?? 0), 0);
  const perWallet = REVENUE_WALLETS.map((wallet, i) => ({ wallet,
    receivedNear: near(ledgers[i].weeks.reduce((s, w) => s + w.inNear + w.inWnear, 0n)),
    receivedUsd: ledgers[i].weeks.reduce((s, w) => s + near(w.inNear + w.inWnear) * closes.get(w.week), 0) }));

  // Check 1, cuts and lead or follow from private participant rows.
  const swaps = await loadParticipantSwaps(root);
  const c1 = check1(swaps.rows, issuanceUsd);
  const weeklyFinal = T3_WEEKS.map(w => usd(c1.weeklyFinal.get(w)));
  delete c1.weeklyFinal;
  const exchangeFile = await read('data/raw/exchange-labels/accounts.json');
  const exchangeAccounts = [...new Set(Object.values(exchangeFile).flatMap(e => e.accounts))];
  const lf = leadFollow(weeklyFinal, T3_WEEKS.map(w => closes.get(w)), closes.get(prior));
  const refundVariant = c1.senderCoverage.share < 0.90
    ? { label: 'After-the-fact descriptive cut; changes no check. refundTo treated as a sender.',
        ...twoWayCut(swaps.rows, issuanceUsd, r => [...r.senders, r.refundTo].filter(Boolean)) }
    : null;

  // Check 3 from the daily split rows; groups must sum to signers.sql each day.
  const split = await read('data/raw/bigquery/signer_split-days.json');
  const sqlHash = createHash('sha256').update(await readFile(resolve(root, 'sql/signer_split.sql'), 'utf8')).digest('hex');
  if (split.sqlSha256 !== sqlHash) throw new Error('Signer split rows were produced by different SQL.');
  const c3 = check3(split.rows, sources.signers.data.days);

  const passes = [c1.pass, c2.pass, c3.pass].filter(Boolean).length;
  return {
    version: 1,
    notes: [
      'Aggregates only. Account-level rows remain in ignored private files.',
      'Check 1 final excludes buys whose recipient is a revenue wallet and sells whose senders include one. Swaps with no USD value are left out and counted.',
      'Check 2 counts successful native TRANSFER receipts into the three wallets from outside them, plus wNEAR from outside (none found). Moves among the three wallets are excluded; returns from wrap.near and system are not received.',
      'Two-way, exchange, lead-or-follow and concentration results are descriptive and change no check. The refundTo two-way variant and the concentration cut are after-the-fact.',
      'Issuance value and USD received use each week\'s mean of 7 daily Coinbase NEAR-USD closes.',
      'NEARBlocks prints yocto amounts as JSON numbers; most are already rounded to about 16 significant digits by the source.'
    ],
    sources: {
      participants: { window: POSITION_WINDOW, reconciliationPass: true, comparisons: 10, rows: swaps.rows.length, nearToNearExcluded: swaps.nearToNear, duplicateRows: swaps.duplicates },
      walletHistory: { source: `${NEARBLOCKS_SOURCE}/v1/account/{wallet}/receipts and /ft-txns?contract=wrap.near`, perPage: 100, order: 'asc', balanceBlock: controls.block },
      holdersRevenue: { source: HOLDERS_SOURCE },
      signerSplit: { sqlSha256: sqlHash, billedBytes: split.billedBytes, dayRows: split.rows.length, receiverPeriodRowsNotDownloaded: split.receiverPeriodRows },
      exchangeLabels: { publicFile: 'data/public/exchange-labels.json', accounts: exchangeAccounts.length }
    },
    issuance: { weeks: 52, issuedNear: t3.weeks.reduce((s, w) => s + w.issued, 0), issuanceValueUsd: issuanceUsd },
    check1: { ...c1, weeklyFinalNetUsd: T3_WEEKS.map((week, i) => ({ week, netUsd: weeklyFinal[i], meanClose: closes.get(week) })) },
    check2: { ...c2, receivedUsd, perWallet,
      holdersRevenueComparison: { defillamaUsd: llamaUsd, ledgerUsd: receivedUsd, gapUsd: receivedUsd - llamaUsd, gapPercent: (receivedUsd - llamaUsd) / llamaUsd * 100 } },
    check3: c3,
    call: { passing: passes, result: passes >= 2 ? 'Building' : 'Not yet' },
    descriptive: {
      twoWaySenders: twoWayCut(swaps.rows, issuanceUsd), twoWayRefundTo: refundVariant,
      exchange: exchangeCut(swaps.rows, exchangeAccounts, issuanceUsd), leadOrFollow: lf,
      concentration: { label: 'After-the-fact descriptive cut; changes no check. Buyer = recipient; seller = first sender, else refundTo.', ...concentration(swaps.rows, issuanceUsd) }
    },
    walletReconciliation: { rows: reconciliationRows, movesAmongRevenueWallets: moves, stopRule: 'Stop if any gap counting moves exceeds 5%.' }
  };
}

const ACCOUNT = /[a-z0-9_-]+(\.[a-z0-9_-]+)*\.(near|tg)\b|\b[0-9a-f]{64}\b|0x[0-9a-fA-F]{40}/g;
export function assertAggregateOnly(value) {
  const { assertNoWalletFields } = REPORT;
  assertNoWalletFields(value);
  const allowed = new Set([...REVENUE_WALLETS, 'wrap.near', 'api.nearblocks.io', 'api.llama.fi']);
  const text = JSON.stringify(value).replace(/"\w*Sha256":"[0-9a-f]{64}"/g, '')
    .replaceAll('https://rpc.mainnet.near.org', '');
  for (const m of text.match(ACCOUNT) || []) if (!allowed.has(m)) throw new Error('Account-like string in public results.');
}

// Explicit offline export, separate from rebuild and the original frozen results.
export async function exportPositionResults({ root = ROOT, results } = {}) {
  const data = results ?? await buildPositionResults(root);
  assertAggregateOnly(data);
  const body = JSON.stringify(data, null, 2) + '\n';
  const path = 'data/public/position-results.json';
  const manifestPath = resolve(root, 'data/public/manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.files.position_results = { path, sha256: createHash('sha256').update(body).digest('hex') };
  await atomic(resolve(root, path), body);
  await atomic(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return manifest.files.position_results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv[2] !== 'export') throw new Error('Usage: node scripts/position-results.mjs export');
    console.log(JSON.stringify(await exportPositionResults()));
  } catch { console.error('Position export failed; private source details omitted.'); process.exitCode = 1; }
}
