import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { atomic, fileStore } from '../scripts/store.mjs';

test('atomic replaces the file and leaves no temporary file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'store-'));
  try {
    await atomic(join(dir, 'out.json'), 'one');
    await atomic(join(dir, 'out.json'), 'two');
    assert.equal(await readFile(join(dir, 'out.json'), 'utf8'), 'two');
    assert.deepEqual(await readdir(dir), ['out.json']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('a failed atomic write removes its temporary file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'store-'));
  try {
    // A non-empty directory at the target makes the final rename fail after the temporary file exists.
    await mkdir(join(dir, 'target'));
    await writeFile(join(dir, 'target', 'keep'), 'x');
    await assert.rejects(atomic(join(dir, 'target'), 'body'));
    assert.deepEqual(await readdir(dir), ['target']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('the raw store refuses paths outside data/raw/', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'store-'));
  try {
    const store = fileStore(dir);
    for (const path of ['data/public/x.json', 'data/raw/../x.json', '/etc/passwd', 'data/raw/a b.json']) {
      await assert.rejects(store.write(path, 'x'), /Invalid raw data path/);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
