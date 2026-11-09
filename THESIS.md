# NEAR: three tests, fixed before the data

Track: Investment Thesis (`thesis`). All times UTC. This is not a valuation or investment advice.

The pass/fail thresholds below were fixed before metrics were computed. The T3 burn-field reconciliation band was revised after inspecting the gap, as disclosed below. The interpretation is provisional until the full 1Click pull is available.

## T1. Usage is broadening

**Rule.** Compare the latest 12 complete months (2025-11-01 to 2026-10-31) with the preceding 12 (2024-11-01 to 2025-10-31).
Pass if mean daily signers, mean receiver accounts (one-day-a-week sample) and mean monthly accounts active on 2 or more days each rise by at least 20%, AND the top-10 signers' share of transactions falls by at least 5 percentage points. Fail if any breadth measure falls by 10% or more, or top-10 share rises by 5 points or more. Otherwise can't tell.

**Result: <!-- metric:t1.verdict -->FAIL<!-- /metric -->.** All three breadth measures contracted. A small decline in transaction concentration does not offset that contraction under the stated rule. These are account-level activity proxies, not counts of people or evidence that every NEAR application is shrinking.

Top-10 share uses the largest signers across each full 12-month period, not an average of daily top-10 shares.

## T2. 1Click volume leads usage better than NEAR price

**Rule.** Use Monday-start weekly percentage changes in 1Click input USD volume, weekly mean NEAR/USD daily closes, and usage (weekly mean of daily signers). At lags of 1, 2, 4 and 8 weeks, correlate this week's volume and price changes with later usage changes, pooling overlapping weeks. Start at the first complete week with at least 7,000 successful swaps. Show earlier weeks but exclude them from the test. Require at least 52 weekly changes.

Pass if, at two or more lags, volume correlation is at least 0.30, exceeds price correlation by at least 0.15, beats price in both chronological halves, and the 90% paired moving-block bootstrap interval for the advantage is above zero. Use 4-week blocks, 10,000 resamples and fixed seed 20261108 (plus the lag). Fail if price wins at two or more lags under the same conditions, without the 0.30 floor. Otherwise can't tell.

**Result: <!-- metric:t2.verdict -->CAN'T TELL<!-- /metric -->, pending data.** The pull is still running. Partial pages are neither published nor used for inference. This is a missing-data state, not a completed test finding. The investment interpretation will be written after the full pull is aggregated.

The feed covers **1Click only**, not all NEAR Intents. The first successful swap observed in the feed is dated 2025-03-27. Weekly input USD volume is not protocol revenue and does not establish demand for the NEAR token.

## T3. Usage reaches holders through burn

**Rule.** For the latest 52 complete weeks (2025-11-03 to 2026-11-01), gross new supply = change in `blocks.total_supply` + burn. Burn is the sum of block-to-block falls in supply; issuance is the sum of rises. Offset share = burn / gross new supply. Pass if the total offset is at least 20% and at least 39 weeks have offset at least 10%. Fail if the total offset is at most 5% and at least 39 weeks have offset at most 5%. Otherwise can't tell.

**Result: <!-- metric:t3.verdict -->FAIL<!-- /metric -->.** The observed offset is <!-- metric:t3.offset -->1.56%<!-- /metric -->. In this window, this channel of holder value capture is small relative to issuance. That does not price other possible sources of token demand.

**Post-observation reconciliation rule.** After observing the <!-- metric:t3.gap -->-18.32%<!-- /metric --> gap between supply falls and recorded burn fields, we investigated nearcore and added the −30% to +5% tolerance for blocks before protocol 87. This was not a pre-registered tolerance and should not be presented as one. The original ±5% check remains for protocol 87 and later. A week spanning activation is unresolved rather than assigned either band. Reconciliation is grouped by protocol band; the investment pass/fail thresholds did not change.

nearcore commit `8b42edf6d3ca9f3b803b09ddc22daea92c9d2177` copies `tx_burnt_amount` into outcome `tokens_burnt` before subtracting the contract's `receiver_reward` (`runtime/runtime/src/lib.rs`, lines 1141 and 1160). The chunk's `total_balance_burnt` uses the reduced amount, plus other and slashed burns, minus `subsidized_amount` (`chain/chain/src/runtime/mod.rs`, lines 408–424). Recorded burn fields therefore include contract rewards. `parameters.yaml` sets `burnt_gas_reward` to 3/10, and `87.yaml` changes it to 0/1.

Archival FastNear RPC identified the last protocol-86 block as 223,012,336 at 2026-11-04T11:46:28Z and the first protocol-87 block as 223,012,337 at 2026-11-04T11:46:29.014Z. All weeks in this analysis end before activation.

## Evidence tables

This table is reviewed and maintained by hand. Rebuild checks it against `data/public/` and fails on any mismatch. Computed claims elsewhere use `metric` comments so the same check covers them. Rule thresholds, dates and source-code facts are not computed investment metrics.

<!-- evidence:begin -->
| Metric | Value |
|---|---|
| t1.verdict | FAIL |
| t2.verdict | CAN'T TELL |
| t3.verdict | FAIL |
| t1.signers.previous | 535,478 |
| t1.signers.latest | 143,857 |
| t1.signers.change | -73.1% |
| t1.receivers.previous | 1,963 |
| t1.receivers.latest | 1,208 |
| t1.receivers.change | -38.5% |
| t1.accounts2.previous | 700,239 |
| t1.accounts2.latest | 238,304 |
| t1.accounts2.change | -66% |
| t1.top10.previous | 80.47% |
| t1.top10.latest | 79.35% |
| t1.top10.changePp | -1.12 pp |
| t2.start | none |
| t2.changes | 0 |
| t3.burnt | 500,289.94 |
| t3.issued | 32,123,695.5 |
| t3.delta | 31,623,405.56 |
| t3.endpointDelta | 31,623,405.56 |
| t3.gross | 32,123,695.5 |
| t3.fields | 612,526.51 |
| t3.offset | 1.56% |
| t3.fieldOffset | 1.9% |
| t3.gap | -18.32% |
| t3.atLeast10 | 0 |
| t3.atMost5 | 52 |
<!-- evidence:end -->

T1 account counts are period means; `change` is relative change, except `changePp`, which is percentage points. T3 quantities are NEAR; `fields` and `fieldOffset` are comparisons only, not the burn definition. `atLeast10` and `atMost5` count weeks meeting the corresponding percentage threshold. T2 correlation and interval rows will appear after the pull.

## Definitions, quality and limits

- Signers include failed transactions, relayers, bots and multiple accounts per person. Accounts are not people.
- Receiver accounts receive `FUNCTION_CALL` actions on a one-day-a-week sample of 104 Mondays, 52 per comparison period. They are not a measured daily series.
- Duplicate block rows occur on 2024-11-04, 2024-11-05 and 2025-08-20, outside the T3 window. Distinct signer and receiver counts are unaffected; transaction concentration may include duplicate transaction rows.
- Daily 1Click totals sum `amountInUsd` exactly once per deposit address and memo, by UTC creation day. Only full seven-day weeks enter the weekly series. Missing USD makes the day's and week's volume unavailable.
- Prices are Coinbase Exchange NEAR-USD daily UTC closes. Weekly price is their seven-day mean.
- Supply and burn source fields are FLOAT64 in yoctoNEAR. Float precision is well below typical block burn, but the sources are not exact integer balances.
- Supply changes link each block to its parent by `prev_block_hash`. The first block's parent lies outside the window, so that first change is not counted. Minting can coincide with burn at epoch boundaries, so falls are a net-change proxy and may undercount burn on those blocks.
- Correlation is not causation. USD volume can reflect token prices and market conditions; a lead alone is not incremental adoption.
- These tests do not estimate fair value, transaction economics, or the success of every application. They test specific claims under fixed investment thresholds.

## Reproduction

Run `npm run rebuild`, then open `dashboard/index.html` and `dashboard/NUMBERS.md`. Rebuild reads aggregate evidence only from `data/public/`, needs no credentials or network, and never writes this file. It copies this reviewed thesis into the dashboard after verification.

`npm run export-public` exports saved BigQuery aggregates and prices without touching the running swap pull. After it finishes, `npm run export-public -- --swaps` adds daily swap totals with no deposit addresses. Raw pages and `.env` stay private. See `README.md` and `VALIDATION.md`.
