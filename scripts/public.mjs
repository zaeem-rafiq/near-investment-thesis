import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROOT, QUERIES, hash } from './sources.mjs';
import { assertNoWalletFields, loadSwapDir, CAL } from './report.mjs';
import { atomic } from './store.mjs';

// Export is separate from rebuild: only this path may read private raw files.
export async function exportPublic(manifest, { root = ROOT, swaps = false } = {}) {
  const pub = { version: 1, id: manifest.id, fetchedAt: manifest.fetchedAt, files: {}, unavailable: {} };
  const save = async (name, data, path) => {
    assertNoWalletFields(data);
    const body = JSON.stringify(data, null, 2) + '\n';
    await atomic(resolve(root, path), body);
    pub.files[name] = { path, sha256: hash(body) };
  };
  for (const name of [...Object.keys(QUERIES), 'prices']) {
    const entry = manifest.sources[name];
    if (entry?.status !== 'ok') {
      pub.unavailable[name] = entry?.reason || `${name} has not been fetched.`;
      continue;
    }
    if (!/^data\/raw\/[a-zA-Z0-9_./-]+$/.test(entry.path) || entry.path.includes('..')) throw new Error('Invalid raw export path.');
    const body = await readFile(resolve(root, entry.path), 'utf8');
    if (hash(body) !== entry.sha256) throw new Error(`Raw data hash mismatch: ${name}.`);
    const raw = JSON.parse(body);
    const data = name === 'prices' ? raw : Object.fromEntries(
      ['name', 'sql', 'filters', 'rows', 'jobId', 'estimatedBytes', 'billedBytes', 'fetchedAt'].map(k => [k, raw[k]]));
    await save(name, data, `data/public/${name === 'prices' ? '' : 'bigquery/'}${name}.json`);
  }
  if (swaps) {
    const raw = await loadSwapDir(resolve(root, `data/raw/swaps/${CAL.swapWindow.start}_${CAL.swapWindow.end}`));
    await save('swaps', { window: raw.window, days: raw.days, rows: raw.rows, pages: raw.pages,
      pagesSha256: raw.pagesSha256, completedAt: raw.completedAt }, 'data/public/swaps.json');
  } else {
    pub.unavailable.swaps = '1Click pull pending. Partial pages are not published or used for T2.';
  }
  await atomic(resolve(root, 'data/public/manifest.json'), JSON.stringify(pub, null, 2) + '\n');
  return pub;
}
