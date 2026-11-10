import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ROOT } from '../scripts/sources.mjs';

test('README opens with the approved call, three tagged findings, run/model steps and exact rule chronology', async () => {
  const readme = await readFile(`${ROOT}/README.md`, 'utf8');
  const plain = readme.replace(/<!-- metric:[^ ]+ -->/g, '').replaceAll('<!-- /metric -->', '');
  assert.match(plain, /^This repository tests the long-term investment case for NEAR[^\n]*\. It is written for investors and judges[^\n]*\.\n\nNot yet: public data through November 1, 2026 does not support opening or adding to a NEAR position for a hold through 2031, because only one of three locked tests passed and three accounts made up 96\.6% of that pass\./);
  const beforeRun = readme.split('## Run locally')[0];
  assert.equal(beforeRun.split('\n').filter(line => line.startsWith('- ')).length, 3);
  for (const [key, value] of [
    ['position.check1.coverage', '77.75%'], ['position.top3Share', '96.6%'],
    ['position.check2.coveragePercent', '15.08%'], ['position.check3.growthPercent', '14.58%'],
    ['presentation.signersDecline', '73.1%'], ['t3.offset', '1.56%'],
    ['position.oneClick.nearPercent', '2.07%']
  ]) assert.ok(readme.includes(`<!-- metric:${key} -->${value}<!-- /metric -->`), key);
  const libs = readme.split('## Libraries and AI assistance')[1]?.split('\n## ')[0] ?? '';
  assert.match(libs, /Node\.js 22 standard library/);
  assert.match(libs, /declares no dependencies/);
  assert.match(libs, /opentimestamps-client/);
  assert.match(libs, /AI coding agents/);
  const pkg = JSON.parse(await readFile(`${ROOT}/package.json`, 'utf8'));
  const lock = JSON.parse(await readFile(`${ROOT}/package-lock.json`, 'utf8'));
  assert.equal(pkg.dependencies ?? pkg.devDependencies, undefined);
  assert.deepEqual(Object.keys(lock.packages), ['']);
  assert.match(readme, /npm run check/);
  assert.match(readme, /npm test/);
  assert.match(readme, /npm run rebuild/);
  assert.match(readme, /T1 FAIL, T2 CAN'T TELL, T3 FAIL/);
  assert.match(readme, /dashboard\/model\.html/);
  assert.match(readme, /docs\/VERIFY\.md/);
  assert.doesNotMatch(readme, /pre-registered|fixed before metrics were computed/i);
  const sequence = [
    'original T1–T3 results and press coverage were known',
    'position rule was recorded before the first provisional flow-data commit',
    'Addendum 1 was added after provisional flow totals',
    'Addendum 2 came after preliminary results',
    'The timestamp proof covers'
  ].map(term => readme.indexOf(term));
  assert.ok(sequence.every((value, index) => value >= 0 && (!index || value > sequence[index - 1])));
  assert.match(readme, /Git commit times establish content order, not when analysis actually ran/);
});
