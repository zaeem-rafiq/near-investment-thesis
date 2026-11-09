import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROOT, hash } from './sources.mjs';
import { atomic } from './store.mjs';
import { REVENUE_WALLETS } from './position-config.mjs';
import { readHistory, walletLedger } from './wallet-ledger.mjs';
import { loadPositionEvidence } from './position-evidence.mjs';
import { assertNoWalletFields } from './report.mjs';

// Explicit offline export from completed histories. Never called by rebuild.
try {
  const read = async path => JSON.parse(await readFile(resolve(ROOT, path), 'utf8'));
  const manifest = await read('data/public/manifest.json');
  const controls = await read('data/public/wallet-controls.json');
  const wallets = [];
  for (const name of REVENUE_WALLETS) {
    const ledger = walletLedger(name, await readHistory(name, 'receipts'), {
      maxHeight: controls.block.height, ftRows: await readHistory(name, 'ft-txns')
    });
    if (ledger.audit.missingOutcomes || ledger.audit.wnearIn) throw new Error('Unsupported or incomplete history.');
    wallets.push({ name, weeks: ledger.weeks.map(w => ({
      week: w.week, receivedNear: Number(w.inNear + w.inWnear) / 1e24, sentNear: Number(w.out) / 1e24
    })) });
  }
  const split = await read('data/raw/bigquery/signer_split-days.json');
  if (split.sqlSha256 !== hash(await readFile(resolve(ROOT, 'sql/signer_split.sql')))) throw new Error('Split SQL differs.');
  const signerDays = split.rows.map(r => ({ grain: r.grain, period_start: r.period_start,
    top10: r.top10, everyone_else: r.everyone_else }));
  const save = async (name, file, value) => {
    assertNoWalletFields(value);
    const path = `data/public/${file}`, body = JSON.stringify(value, null, 2) + '\n';
    await atomic(resolve(ROOT, path), body);
    manifest.files[name] = { path, sha256: hash(body) };
  };
  await save('position_inputs', 'position-inputs.json', { wallets, signerDays,
    note: 'Successful external native TRANSFER outflows; internal moves and not_received excluded. No wNEAR transfers found. Frozen receiver means come only from signer-top10.json, not a new full receiver ranking.' });
  for (const [name, file] of [['staking', 'staking.json'], ['protocol_share', 'protocol-share.json']]) {
    await save(name, file, await read(`data/public/${file}`));
  }
  const evidence = await loadPositionEvidence(manifest);
  await save('position_section', 'position-section.json', evidence.section);
  await atomic(resolve(ROOT, 'data/public/manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('Exported aggregate position section and registered its public inputs.');
} catch {
  console.error('Position section export failed; private source details omitted.');
  process.exitCode = 1;
}
