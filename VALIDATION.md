# Validation

Checked on 2026-11-09 (UTC).

## Passed

- `npm run check`: syntax checks passed for every module.
- `npm audit --offline`: zero vulnerabilities (no dependencies).
- `npm test`: 33 tests passed, none failed or skipped. Rule tests use synthetic fixtures; public-data and CLI checks use the committed snapshot. They cover:
  - the literal `block_date` guard, run on every SQL file and on known bad patterns, including an unfiltered `MIN(block_date)`;
  - the approved query windows;
  - `us-east1` on every BigQuery call;
  - dry runs before billed jobs;
  - the 300 GB run budget and the 1 TB cumulative ledger;
  - cache reuse, `--rescan`, and SQL changes invalidating the cache;
  - live schema type checks;
  - resumable 1Click paging (resume without refetch, memo cursor, duplicates, 429/5xx retry, 401 without the response body);
  - exact USD sums;
  - the T1, T2 and T3 rules, including the T2 7,000-swap start week, the 52-change minimum and excluded-week marking;
  - bootstrap determinism;
  - hash and SQL checks on rebuild;
  - charts breaking at missing values, with Unavailable rows in the tables;
  - no deposit addresses, memos or wallet fields in public JSON or generated output;
  - manifests refusing arbitrary paths and incomplete or altered 1Click snapshots;
  - unavailable-data rendering;
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

## Data-quality findings

- Duplicate block rows appear on 2024-11-04 (1,615), 2024-11-05 (31) and 2025-08-20 (6,021). None fall in the T3 window. Distinct signer and receiver counts are unaffected. The top-10 transaction share may include duplicated transaction rows on those days.
- T3 burn: block-to-block falls in `total_supply` total 500,290 NEAR. The burn fields total 612,527 NEAR, a gap of -18.3%.
  - The gap is explained by nearcore (commit `8b42edf`). `tokens_burnt` is copied before the 30% function-call reward to contracts is subtracted (`runtime/runtime/src/lib.rs` lines 1141 and 1160). The chunk's `total_balance_burnt` uses the reduced amount (`chain/chain/src/runtime/mod.rs` lines 408–424).
  - `burnt_gas_reward` is 3/10 in `parameters.yaml`, and `87.yaml` changes it to 0. FastNear archival RPC identified the last protocol-86 block as 223,012,336 at 2026-11-04T11:46:28Z and the first protocol-87 block as 223,012,337 at 2026-11-04T11:46:29.014Z. All T3 weeks end before activation.
  - **Rule added after seeing the gap:** the −30% to +5% reconciliation band was introduced only after observing the −18.3% discrepancy and investigating nearcore. It was not pre-registered. The code limits that band to weeks ending before activation; post-upgrade weeks retain ±5%, and an activation-spanning week is unresolved. Investment pass/fail thresholds were not changed.
  - T3 therefore uses falls as burn and rises as issuance: an offset of 1.56%, with 52 of 52 weeks at or below 5%, so **FAIL**. The field-based offset (1.90%) is reported for comparison only.
  - Net supply change from rises minus falls (31,623,405.56 NEAR) equals the last closing supply minus the first opening supply.
  - Exactly one block in the window has no parent inside it (the first block), as expected.

## Pending

- T2 needs the full 1Click pull: about 6,600 pages at one request per 5.2 s. It is running in the background under `caffeinate -i` and is resumable with `npm run pull-swaps`. Until it completes, T2 is "can't tell".
- After the pull: publish aggregate daily totals, write the completed T2 interpretation, and repeat the no-credentials rebuild from a temporary Git clone, comparing all generated charts and numbers.
