import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { environment } from './sources.mjs';
import { SWAP_WINDOW, swapDir, pullSwapsResumable } from './swaps.mjs';

// Resumable 1Click pull. Safe to rerun: it continues from the last saved page.
const env = await environment();
const window = { start: env.SWAP_START || SWAP_WINDOW.start, end: env.SWAP_END || SWAP_WINDOW.end };
const dir = swapDir(window);
const log = async line => {
  const entry = `${new Date().toISOString()} ${line}\n`;
  process.stdout.write(entry);
  await appendFile(resolve(dir, 'pull.log'), entry, { mode: 0o600 }).catch(() => {});
};
try {
  const result = await pullSwapsResumable(window, env.NEAR_INTENTS_JWT, { dir, log: line => { log(line); } });
  await log(result.complete ? `done: ${result.pages} pages, ${result.rows} rows` : 'stopped before completion');
} catch (e) {
  let message = e.message || 'Swap pull failed.';
  if (env.NEAR_INTENTS_JWT) message = message.replaceAll(env.NEAR_INTENTS_JWT, '[redacted]');
  await log(`FAILED: ${message} Rerun npm run pull-swaps to resume.`);
  process.exitCode = 1;
}
