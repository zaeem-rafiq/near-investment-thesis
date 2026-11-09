# Validation

Checked on 2026-11-09 (UTC).

## Passed

- `npm run check`: syntax checks passed for every module.
- `npm audit --offline`: zero vulnerabilities (no dependencies).
- `npm test`: 41 tests passed, none failed or skipped. Rule tests use synthetic fixtures; public-data and CLI checks use the committed snapshot. They cover:
  - the literal `block_date` guard, run on every SQL file and on known bad patterns, including an unfiltered `MIN(block_date)`;
  - the approved query windows;
  - `us-east1` on every BigQuery call;
  - dry runs before billed jobs;
  - the 300 GB run budget and the 1 TB cumulative ledger;
  - cache reuse, `--rescan`, and SQL changes invalidating the cache;
  - live schema type checks;
  - resumable 1Click timestamp paging (legacy-page resume from saved rows, exclusive end bound plus 1 ms, boundary-only overlap removal, reused addresses at different times, true duplicates, ordering/continuity, full-page stalls, empty/short end-of-data, paced 429/5xx retries, 401 without the response body);
  - exact USD sums;
  - the T1, T2 and T3 rules, including the T2 7,000-swap start week, the 52-change minimum and excluded-week marking;
  - bootstrap determinism;
  - hash and SQL checks on rebuild;
  - charts breaking at missing values, with Unavailable rows in the tables;
  - no deposit addresses, memos or wallet fields in public JSON or generated output;
  - manifests refusing arbitrary paths and incomplete or altered 1Click snapshots;
  - unavailable-data rendering;
  - `dashboard/thesis.html` generated from the real `THESIS.md` with no metric or evidence tags, escaped markup, no scripts and the dashboard's content security policy;
  - compact chart axis ticks that fit the left margin, and the excluded-weeks label placed above the plot area;
  - daily aggregation, full-week selection and rejection of incomplete daily windows;
  - separate pre-/post-protocol-87 bands and an unresolved activation week;
  - thesis table and tagged-claim mismatches failing without rewriting prose;
  - the real `npm run rebuild` entry point in an isolated copy with no raw data, no credentials and networking blocked, both with an absent `.env` and an invalid `.env` that would fail if read;
  - SHA-256 equality of all generated charts, number tables, HTML, CSS and thesis copy between that isolated rebuild and the working snapshot.
- `npm run plan` (free dry run): 233.65 GB in total. signers 76.70, contracts 79.48, coverage 5.63, supply 5.98, burn 65.86.
- BigQuery jobs ran through the shared runner: 233.65 GB billed. Cumulative billed scans, including the Step 1 probes (9.22 GB), are 242.87 GB, below the 1 TB limit.
- `npm run refresh` reused all five cached BigQuery results (0 bytes billed) and fetched Coinbase NEAR-USD prices.
- `npm run export-public` exported the five saved BigQuery results and price candles without network calls or touching the running swap pull.
- `npm run rebuild` passes using `data/public/` only. It generates `dashboard/NUMBERS.md` and charts, verifies `THESIS.md`, and copies the reviewed thesis without changing the source file.
- The first rebuild against the unconverted thesis failed as expected. After the evidence table was reviewed and inserted by hand, rebuild passed. The CLI regression test independently alters the offset and verifies nonzero exit with the altered prose preserved.
- The dashboard contains no JWT and no deposit addresses.
- After the pull completed, `npm run refresh` reused all five cached BigQuery results (0 bytes billed; cumulative stays 242.87 GB) and refetched prices. The exported `bigquery/*.json` and `prices.json` are byte-identical to the earlier snapshot. Refresh then stopped, as designed, because the thesis was stale. `npm run export-public -- --swaps` wrote `data/public/swaps.json`: 611 UTC days, 7,509,299 swaps, no wallet-level fields.
- **When the T2 start rule was set:** the 7,000-swap start rule was set after the Step 1 spot samples of the daily swap rate, and before any weekly volume was computed.
- T2 was computed with the rule and code unchanged since commit `62fa25a` (first week with 7,000 swaps, 52-change minimum, lags 1, 2, 4 and 8, 4-week blocks, 10,000 resamples, seed 20261108). Result: CAN'T TELL. The reasoning was then written by hand in `THESIS.md`, and rebuild verifies every tagged value.

## 1Click pull audit

Run over all 7,513 saved pages after `complete.json` was written (2026-11-09T12:35:22Z):

- 7,509,299 rows; newest 2026-11-01T23:59:47.681Z, oldest 2025-03-27T08:56:14.383Z. All rows are inside the window and have status SUCCESS. No page is empty.
- Pages 1–4,404 used the old address cursor; pages 4,405–7,513 used timestamp paging.
- Time order: zero rows newer than the row before them, within pages or across page boundaries.
- Composite duplicates (address, memo, `createdAt`): zero.
- Largest gap between pages: 61.21 minutes (page 7,492, early low-volume history). Largest gap between any two consecutive swaps: 4,192.56 minutes, ending 2025-04-04T14:18:41Z, also in early history before the T2 start week. Six page boundaries share a timestamp with the previous page's oldest row; those rows have different keys and were kept.
- Deposit address reuse: 7,473,224 distinct addresses. 67 addresses appear on more than one swap, covering 36,142 swaps; one address accounts for 36,010 of them.
- Weekly counts: the T2 start week 2025-04-14 has 8,568 swaps. The next 15 weeks are below 7,000; the next week at or above 7,000 is 2025-08-04. The fixed rule keeps those weeks in the test.
- T2 has 78 weekly changes from 81 in-test weeks. Week 2026-02-02 has 2 swaps with no USD value out of 182,281, so its volume is unavailable under the rule, and the two changes touching it drop out.

## Data-quality findings

- The initial swap pull stopped after page 4,404 because an address with no memo reappeared at a different creation time. Address-and-memo identity is not unique, and the address cursor can resume at an older occurrence. The fix keys swaps by address, memo and `createdAt`, pages by timestamp, and preserves all saved pages and original pull parameters. A full boundary-only page fails closed rather than skipping an unresolved timestamp.

- Duplicate block rows appear on 2024-11-04 (1,615), 2024-11-05 (31) and 2025-08-20 (6,021). None fall in the T3 window. Distinct signer and receiver counts are unaffected. The top-10 transaction share may include duplicated transaction rows on those days.
- T3 burn: block-to-block falls in `total_supply` total 500,290 NEAR. The burn fields total 612,527 NEAR, a gap of -18.3%.
  - The gap is explained by nearcore (commit `8b42edf`). `tokens_burnt` is copied before the 30% function-call reward to contracts is subtracted (`runtime/runtime/src/lib.rs` lines 1141 and 1160). The chunk's `total_balance_burnt` uses the reduced amount (`chain/chain/src/runtime/mod.rs` lines 408–424).
  - `burnt_gas_reward` is 3/10 in `parameters.yaml`, and `87.yaml` changes it to 0. FastNear archival RPC identified the last protocol-86 block as 223,012,336 at 2026-11-04T11:46:28Z and the first protocol-87 block as 223,012,337 at 2026-11-04T11:46:29.014Z. All T3 weeks end before activation.
  - **Rule added after seeing the gap:** the −30% to +5% reconciliation band was introduced only after observing the −18.3% discrepancy and investigating nearcore. It was not pre-registered. The code limits that band to weeks ending before activation; post-upgrade weeks retain ±5%, and an activation-spanning week is unresolved. Investment pass/fail thresholds were not changed.
  - T3 therefore uses falls as burn and rises as issuance: an offset of 1.56%, with 52 of 52 weeks at or below 5%, so **FAIL**. The field-based offset (1.90%) is reported for comparison only.
  - Net supply change from rises minus falls (31,623,405.56 NEAR) equals the last closing supply minus the first opening supply.
  - Exactly one block in the window has no parent inside it (the first block), as expected.

## Clean-clone rebuild

- `git clone` of commit `7799824` into a temporary folder had no `.env` and no `data/raw/`. All generated dashboard files were deleted, then `npm run rebuild` ran with `NEAR_INTENTS_JWT` and `GOOGLE_CLOUD_PROJECT` unset. It printed T1 FAIL, T2 CAN'T TELL, T3 FAIL.
- `git status` in the clone was empty afterwards, so every regenerated file is byte-identical to the commit. SHA-256 of all 16 files in `dashboard/` (charts, `charts.json`, `NUMBERS.md`, `index.html`, `thesis.html`, `style.css`, `THESIS.md`) matched the working tree, with no extra or missing files. The untracked `dashboard/preview.png` was excluded.
