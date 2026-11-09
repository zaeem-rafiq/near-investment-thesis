import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ROOT, hash } from '../scripts/sources.mjs';
import { assertNoWalletFields } from '../scripts/report.mjs';

// Partial static NEAR owner labels, selected before the descriptive exchange cut.
// Each list hash uses unique account IDs, ASCII sort, LF separators and a final LF.
// Tests run offline without private accounts; raw-list hashes are checked at export.
test('exchange-label provenance exports only pinned sources, dates, counts and hashes', async () => {
  const body = await readFile(`${ROOT}/data/public/exchange-labels.json`, 'utf8');
  const data = JSON.parse(body);
  assert.deepEqual(Object.keys(data).sort(), ['commit', 'exchanges', 'retrievedAt', 'sourceUrl']);
  assert.equal(data.sourceUrl, 'https://github.com/DefiLlama/DefiLlama-Adapters');
  assert.equal(data.commit, '8caedd8fe7ccfface7871e96f2b10e61ea52b79f');
  assert.match(data.retrievedAt, /^2026-11-09T\d{2}:\d{2}:\d{2}Z$/);
  assert.ok(Number.isFinite(Date.parse(data.retrievedAt)));
  const expected = { Bitfinex: 2, Bitget: 2, Bitlo: 1, Flipster: 1, 'Gate US': 2,
    KuCoin: 3, MEXC: 1, SwissBorg: 5 };
  assert.deepEqual(data.exchanges.map(row => row.exchange), Object.keys(expected));
  for (const row of data.exchanges) {
    assert.deepEqual(Object.keys(row).sort(), ['accountCount', 'exchange', 'sortedListSha256', 'sourceUrl']);
    assert.equal(row.accountCount, expected[row.exchange]);
    assert.match(row.sortedListSha256, /^[a-f0-9]{64}$/);
    assert.ok(row.sourceUrl.startsWith(`${data.sourceUrl}/blob/${data.commit}/`));
    assert.match(row.sourceUrl, /\/(?:cex\/[a-z-]+|projects\/[a-z-]+\/index)\.js#L\d+-L\d+$/);
  }
  assertNoWalletFields(data);
  assert.doesNotMatch(body, /[a-z0-9_-]+\.near\b/i);
  const manifest = JSON.parse(await readFile(`${ROOT}/data/public/manifest.json`, 'utf8'));
  assert.deepEqual(manifest.files.exchange_labels, {
    path: 'data/public/exchange-labels.json', sha256: hash(body)
  });
});
