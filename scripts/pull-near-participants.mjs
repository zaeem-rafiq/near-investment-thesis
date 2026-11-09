import { readFile, open, unlink, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROOT, environment, sleep } from './sources.mjs';
import { atomic } from './store.mjs';
import { pullSwapsResumable, PACE_MS, readJSON } from './swaps.mjs';
import { NEAR_ASSET_IDS, POSITION_WINDOW, RECIPIENT_DIR, PULL_WINDOW_DAYS, PARTICIPANT_RETRIES } from './position-config.mjs';
import { participantPulls, reconcileParticipants } from './participants.mjs';

// Private, resumable collection. Launch with a managed detached process.
const dir = resolve(ROOT, RECIPIENT_DIR), lockPath = resolve(dir, 'pull.lock');
const log = async message => {
  const line = `${new Date().toISOString()} ${message}\n`;
  await appendFile(resolve(dir, 'pull.log'), line, { mode: 0o600 });
  process.stdout.write(line);
};
let locked = false;
try {
  const rule = await readFile(resolve(ROOT, 'docs/position-rule.md'), 'utf8');
  if (!rule.includes('## Addendum 1')) throw new Error('Addendum 1 must be locked before collection.');
  await atomic(resolve(dir, 'runner.json'), JSON.stringify({ window: POSITION_WINDOW, assetIds: NEAR_ASSET_IDS, windowDays: PULL_WINDOW_DAYS, ...PARTICIPANT_RETRIES }) + '\n');
  try {
    const stale = await readJSON(lockPath);
    if (stale) {
      try { process.kill(stale.pid, 0); throw new Error('A participant pull is already running.'); }
      catch (error) { if (error.code !== 'ESRCH') throw error; }
      await unlink(lockPath);
    }
    const lock = await open(lockPath, 'wx', 0o600);
    await lock.writeFile(JSON.stringify({ pid: process.pid }));
    await lock.close(); locked = true;
  } catch { throw new Error('Cannot acquire participant pull lock; another runner may be active.'); }
  const env = await environment();
  let previous = (await readJSON(resolve(dir, 'rate.json')))?.at || 0;
  const request = async (url, init) => {
    const wait = previous + PACE_MS - Date.now();
    if (wait > 0) await sleep(wait);
    previous = Date.now();
    await atomic(resolve(dir, 'rate.json'), JSON.stringify({ at: previous }) + '\n');
    return fetch(url, init);
  };
  for (const pull of participantPulls()) {
    await log(`Starting ${pull.directory} single-asset filter in ${pull.windows.length} windows; private fields are never logged.`);
    let pages = 0, rows = 0;
    for (const w of pull.windows) {
      const name = `${pull.directory}/${w.directory}`;
      const result = await pullSwapsResumable({ start: w.start, end: w.end }, env.NEAR_INTENTS_JWT, {
        dir: resolve(dir, name), tokenFilter: { side: pull.filter, ids: [pull.asset] }, retainParticipants: true,
        shortPageEnds: true, ...PARTICIPANT_RETRIES, request,
        log: message => { log(`${name}: ${message}`).catch(() => {}); }
      });
      pages += result.pages; rows += result.rows;
    }
    await log(`${pull.directory} complete: ${pages} pages, ${rows} rows.`);
  }
  await atomic(resolve(dir, 'complete.json'), JSON.stringify({ complete: true, completedAt: new Date().toISOString() }) + '\n');
  await log('All eight pulls complete; reconciling every asset and both totals against saved pages.');
  const reconciliation = await reconcileParticipants();
  await atomic(resolve(dir, 'reconciliation.json'), JSON.stringify(reconciliation, null, 2) + '\n');
  for (const comparison of reconciliation.comparisons) await log(JSON.stringify(comparison));
  if (!reconciliation.pass) {
    await log('STOPPED: reconciliation failed; no further source work is permitted.');
    process.exitCode = 2;
  } else await log('Reconciliation PASS for every asset and both totals.');
} catch (error) {
  // Do not print error objects, remote bodies, URLs, addresses, or credentials.
  const safe = /^(Cannot acquire|A participant|Addendum 1|NEAR_INTENTS_JWT|Explorer |Invalid |Saved |Duplicate |Participant |Conflicting duplicate)/.test(error.message || '')
    ? error.message : 'Participant pull failed; private details omitted.';
  await log(`STOPPED: ${safe}`).catch(() => {});
  process.exitCode = 1;
} finally {
  if (locked) await unlink(lockPath).catch(() => {});
}
