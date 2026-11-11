import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ROOT, hash } from './sources.mjs';

export async function atomic(path, body) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, body, { mode: 0o600 });
    await rename(temp, path);
  } catch (error) {
    // A failed write must not leave a stray file in dashboard/ or data/.
    await rm(temp, { force: true });
    throw error;
  }
}
// Project-relative raw-data store; paths are confined to data/raw/.
export function fileStore(root = ROOT) {
  const full = rel => {
    if (!/^data\/raw\/[a-zA-Z0-9_./-]+$/.test(rel) || rel.includes('..')) throw new Error('Invalid raw data path.');
    return resolve(root, rel);
  };
  return {
    read: async rel => { try { return await readFile(full(rel), 'utf8'); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } },
    write: async (rel, body) => { await atomic(full(rel), body); return { path: rel, sha256: hash(body) }; }
  };
}
