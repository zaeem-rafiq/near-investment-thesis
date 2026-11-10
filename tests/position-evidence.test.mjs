import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ROOT } from '../scripts/sources.mjs';
import { loadPositionEvidence, positionMetricValues } from '../scripts/position-evidence.mjs';

test('position section recomputes from public evidence and reconciles locked checks', async () => {
  const read = async file => JSON.parse(await readFile(`${ROOT}/data/public/${file}`, 'utf8'));
  const evidence = await loadPositionEvidence(await read('manifest.json'));
  assert.deepEqual(evidence.section, await read('position-section.json'));
  const p = await read('position-results.json'), l = evidence.section.holderLedger;
  assert.ok(Math.abs(l.walletReceived.observed.near.value - p.check2.receivedNear) < 1e-8);
  assert.ok(Math.abs(l.walletReceived.observed.usd.value - p.check2.receivedUsd) < 1e-6);
  assert.ok(Math.abs(l.walletReceived.annualized.near.value - p.check2.receivedNear * 52 / 36) < 1e-8);
  assert.equal(l.wallets.boughtNearBurned.value, null);
  const metrics = positionMetricValues(evidence);
  assert.equal(metrics['position.top3Share'], '96.6%');
  assert.equal(metrics['position.check1.coverage'], '77.75%');
  assert.equal(metrics['position.oneClick.nearPercent'], '2.07%');
  assert.equal(metrics['position.call.result'], 'Not yet');
  const queryRecord = await readFile(`${ROOT}/docs/query-changes.md`, 'utf8');
  const positionRecord = await readFile(`${ROOT}/docs/position-results.md`, 'utf8');
  assert.ok(queryRecord.includes(`${metrics['position.audit.sampleRows']} rows`));
  assert.ok(queryRecord.includes(`${metrics['position.audit.sampleDifferences']} rows in one result`));
  assert.ok(positionRecord.includes(`${metrics['position.audit.walletScanProjectedGb']} GB projection`));
});

test('position evidence rejects missing or changed registered sources', async () => {
  const manifest = JSON.parse(await readFile(`${ROOT}/data/public/manifest.json`, 'utf8'));
  const bad = structuredClone(manifest);
  delete bad.files.staking;
  await assert.rejects(loadPositionEvidence(bad), /Missing position source: staking/);
  bad.files.staking = { ...manifest.files.staking, sha256: 'bad' };
  await assert.rejects(loadPositionEvidence(bad), /hash mismatch: staking/);
});

test('treasury conflict reports both sourced proxies without changing the saved on-chain calculation', async () => {
  const manifest = JSON.parse(await readFile(`${ROOT}/data/public/manifest.json`, 'utf8'));
  const evidence = await loadPositionEvidence(manifest), v = positionMetricValues(evidence);
  assert.equal(v['position.stakingConflict.rpcRate'], '[0,1]');
  assert.equal(v['position.stakingConflict.postSplit'], '90/10');
  assert.equal(v['position.stakingConflict.postMeasuredShare'], '10.13%');
  assert.equal(v['position.holderLedger.staking.grossYield'], '5.52%');
  assert.equal(v['position.stakingConflict.postYield'], '4.97%');
  const stake = Number(evidence.section.inputs.stakingSnapshot.total_stake_yocto) / 1e24;
  const expected = evidence.results.issuance.issuedNear * .9 / stake;
  assert.equal(v['position.stakingConflict.postYield'], `${(expected * 100).toFixed(2)}%`);
  assert.match(evidence.treasuryConflict.post.source, /^https:\/\/gov\.near\.org\//);
  assert.equal(v['position.check1.netUsdCompact'], '52.1M');
  assert.equal(v['position.whatYouMustBelieve.lowUsdCompact'], '46.1M');
  assert.equal(v['position.whatYouMustBelieve.highUsdCompact'], '154M');
  assert.equal(v['position.receiptsComparisonGap'], '0.04%');
});
