# NEAR: three tests, fixed before the results

Track: Investment Thesis (`thesis`). All times UTC. This is not a valuation or investment advice.

The pass/fail thresholds below were fixed before metrics were computed. The T3 burn-field reconciliation band was revised after inspecting the gap, as disclosed below. No T2 rule was changed after the weekly 1Click series was seen.

## Summary

| Test | Claim | Result |
|---|---|---|
| T1 | NEAR usage is broadening | <!-- metric:t1.verdict -->FAIL<!-- /metric --> |
| T2 | 1Click volume leads usage better than NEAR price | <!-- metric:t2.verdict -->CAN'T TELL<!-- /metric --> |
| T3 | Usage reaches holders through burn | <!-- metric:t3.verdict -->FAIL<!-- /metric --> |

None of the three claims passed. Two failed outright. The third could not be decided under its fixed rule because neither volume nor price showed a reliable lead. On this evidence, recent NEAR activity does not support a thesis of broadening usage that accrues to holders through burn. The tests cannot rule out other sources of value; they test only these three claims.

## Claim

NEAR usage is broadening (T1); 1Click swap volume leads that usage better than the NEAR price does (T2); and usage reaches holders through fee burn (T3). Together these would support holding NEAR as a bet on broad, growing activity that accrues to the token.

## Evidence for

- 1Click grew fast. In the latest 13 complete weeks (from 2026-08-03) it handled <!-- metric:oneClick.latest.swaps -->2,005,609<!-- /metric --> successful swaps and <!-- metric:oneClick.latest.volume -->3,804,396,974<!-- /metric --> USD of input volume. In the same 13 weeks a year earlier (from 2025-08-04) it handled <!-- metric:oneClick.previous.swaps -->489,406<!-- /metric --> swaps and <!-- metric:oneClick.previous.volume -->821,906,590<!-- /metric --> USD. That is <!-- metric:oneClick.swaps.change -->+309.8%<!-- /metric --> in swaps and <!-- metric:oneClick.volume.change -->+362.9%<!-- /metric --> in volume. This comparison is descriptive and is not one of the three tests.
- Transaction concentration fell slightly. The top-10 signers' share moved from <!-- metric:t1.top10.previous -->80.47%<!-- /metric --> to <!-- metric:t1.top10.latest -->79.35%<!-- /metric --> (<!-- metric:t1.top10.changePp -->-1.12 pp<!-- /metric -->).
- At an 8-week lag, the 90% interval for the volume advantage over price was above zero (<!-- metric:t2.lag8.ci.low -->0.02<!-- /metric --> to <!-- metric:t2.lag8.ci.high -->0.304<!-- /metric -->), although volume's own correlation was near zero.
- Burn is real. Supply falls totalled <!-- metric:t3.burnt -->500,289.94<!-- /metric --> NEAR over the 52 T3 weeks.

## Evidence against

- Breadth contracted sharply. Mean daily signers changed by <!-- metric:t1.signers.change -->-73.1%<!-- /metric -->, receiver accounts by <!-- metric:t1.receivers.change -->-38.5%<!-- /metric -->, and accounts active on 2 or more days a month by <!-- metric:t1.accounts2.change -->-66%<!-- /metric -->.
- The fall in top-10 share (<!-- metric:t1.top10.changePp -->-1.12 pp<!-- /metric -->) is far short of the 5 points the rule requires.
- 1Click volume changes had near-zero correlation with later signer changes: <!-- metric:t2.lag1.rv -->0<!-- /metric -->, <!-- metric:t2.lag2.rv -->-0.065<!-- /metric -->, <!-- metric:t2.lag4.rv -->0.013<!-- /metric --> and <!-- metric:t2.lag8.rv -->-0.004<!-- /metric --> at lags of 1, 2, 4 and 8 weeks. 1Click grew while T1 signer counts fell, so its growth did not appear as broader NEAR account activity in these measures.
- Burn offset only <!-- metric:t3.offset -->1.56%<!-- /metric --> of gross new supply. <!-- metric:t3.atLeast10 -->0<!-- /metric --> of 52 weeks reached 10%, and <!-- metric:t3.atMost5 -->52<!-- /metric --> were at or below 5%.

## What would change my mind

- **T1:** a later 12-month comparison in which mean daily signers, receiver accounts and accounts active on 2 or more days each rise by at least 20%, and the top-10 share falls by at least 5 points. Today those changes are <!-- metric:t1.signers.change -->-73.1%<!-- /metric -->, <!-- metric:t1.receivers.change -->-38.5%<!-- /metric -->, <!-- metric:t1.accounts2.change -->-66%<!-- /metric --> and <!-- metric:t1.top10.changePp -->-1.12 pp<!-- /metric -->.
- **T2:** the same rule, run on a longer future window, finding at two or more lags a volume correlation of at least 0.30 that beats price by at least 0.15, wins in both halves and has a 90% interval above zero. Today the highest volume correlation is <!-- metric:t2.lag4.rv -->0.013<!-- /metric -->. Price winning at two lags under the same conditions would turn the result into a FAIL.
- **T3:** a 52-week window in which burn offsets at least 20% of gross new supply and at least 39 weeks reach 10%. Today the offset is <!-- metric:t3.offset -->1.56%<!-- /metric -->, with <!-- metric:t3.atLeast10 -->0<!-- /metric --> weeks at 10% or more.

## T1. Usage is broadening

**Rule.** Compare the latest 12 complete months (2025-11-01 to 2026-10-31) with the preceding 12 (2024-11-01 to 2025-10-31).
Pass if mean daily signers, mean receiver accounts (one-day-a-week sample) and mean monthly accounts active on 2 or more days each rise by at least 20%, AND the top-10 signers' share of transactions falls by at least 5 percentage points. Fail if any breadth measure falls by 10% or more, or top-10 share rises by 5 points or more. Otherwise can't tell.

**Result: <!-- metric:t1.verdict -->FAIL<!-- /metric -->.** All three breadth measures contracted. A small decline in transaction concentration does not offset that contraction under the stated rule. These are account-level activity proxies, not counts of people or evidence that every NEAR application is shrinking.

Top-10 share uses the largest signers across each full 12-month period, not an average of daily top-10 shares.

## T2. 1Click volume leads usage better than NEAR price

**Rule.** Use Monday-start weekly percentage changes in 1Click input USD volume, weekly mean NEAR/USD daily closes, and usage (weekly mean of daily signers). At lags of 1, 2, 4 and 8 weeks, correlate this week's volume and price changes with later usage changes, pooling overlapping weeks. Start at the first complete week with at least 7,000 successful swaps. Show earlier weeks but exclude them from the test. Require at least 52 weekly changes.

**When the start rule was set.** The 7,000-swap start rule was set after the Step 1 spot samples of the daily swap rate, and before any weekly volume was computed.

Pass if, at two or more lags, volume correlation is at least 0.30, exceeds price correlation by at least 0.15, beats price in both chronological halves, and the 90% paired moving-block bootstrap interval for the advantage is above zero. Use 4-week blocks, 10,000 resamples and fixed seed 20261108 (plus the lag). Fail if price wins at two or more lags under the same conditions, without the 0.30 floor. Otherwise can't tell.

**Result: <!-- metric:t2.verdict -->CAN'T TELL<!-- /metric -->.** The full 1Click pull is complete and aggregated. The first complete week with at least 7,000 successful swaps is <!-- metric:t2.start -->2025-04-14<!-- /metric -->. The test covers <!-- metric:t2.weeks -->81<!-- /metric --> weeks from there. Week <!-- metric:t2.volumeUnavailable.weeks -->2026-02-02<!-- /metric --> has <!-- metric:t2.volumeUnavailable.missingUsd -->2<!-- /metric --> swaps with no USD value out of <!-- metric:t2.volumeUnavailable.swaps -->182,281<!-- /metric -->. The rule therefore makes that week's volume unavailable, and the two weekly changes touching it drop out. That leaves <!-- metric:t2.changes -->78<!-- /metric --> weekly changes, above the 52 minimum, so this is a decided rule outcome, not missing data.

Volume never reached the 0.30 correlation floor. Its correlation with later usage changes was <!-- metric:t2.lag1.rv -->0<!-- /metric -->, <!-- metric:t2.lag2.rv -->-0.065<!-- /metric -->, <!-- metric:t2.lag4.rv -->0.013<!-- /metric --> and <!-- metric:t2.lag8.rv -->-0.004<!-- /metric --> at lags of 1, 2, 4 and 8 weeks. No lag therefore favours volume, so the test cannot pass.

Price also did not win at two lags, so the test does not fail:

- At lag 1, price correlation was <!-- metric:t2.lag1.rp -->0.284<!-- /metric --> and beat volume in both halves. The 90% interval for the volume advantage, <!-- metric:t2.lag1.ci.low -->-0.613<!-- /metric --> to <!-- metric:t2.lag1.ci.high -->0.179<!-- /metric -->, includes zero.
- At lag 8, the advantage interval, <!-- metric:t2.lag8.ci.low -->0.02<!-- /metric --> to <!-- metric:t2.lag8.ci.high -->0.304<!-- /metric -->, sits above zero only because both correlations are near zero or negative (price <!-- metric:t2.lag8.rp -->-0.187<!-- /metric -->). Price beat volume in the second half (<!-- metric:t2.lag8.half2.rp -->-0.165<!-- /metric --> against <!-- metric:t2.lag8.half2.rv -->-0.177<!-- /metric -->).
- Lags 2 and 4 favour neither, with advantages of <!-- metric:t2.lag2.advantage -->-0.104<!-- /metric --> and <!-- metric:t2.lag4.advantage -->0.004<!-- /metric -->.

**Interpretation.** Weekly changes in 1Click volume had near-zero correlations with later changes in NEAR signers, from <!-- metric:t2.lag2.rv -->-0.065<!-- /metric --> to <!-- metric:t2.lag4.rv -->0.013<!-- /metric --> across the four lags. The claim that 1Click activity is a leading indicator of chain usage is not supported. The rule's failure condition, price clearly leading instead, was not met either. For an investor, 1Click volume should be read as its own business metric, not as a proxy for NEAR usage.

**Disclosed feature of the fixed start.** The start week is an isolated early spike of <!-- metric:t2.startSwaps -->8,568<!-- /metric --> swaps. The following <!-- metric:t2.weeksBelowMinAfterStart -->15<!-- /metric --> weeks fall below 7,000 swaps, and the next week at or above 7,000 is <!-- metric:t2.nextWeekAtMin -->2025-08-04<!-- /metric -->. As the rule specifies, those weeks stay in the test. No alternative start was tested, and any later sensitivity check would not be pre-registered.

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
| t2.start | 2025-04-14 |
| t2.changes | 78 |
| t2.weeks | 81 |
| t2.startSwaps | 8,568 |
| t2.weeksBelowMinAfterStart | 15 |
| t2.nextWeekAtMin | 2025-08-04 |
| t2.volumeUnavailable.weeks | 2026-02-02 |
| t2.volumeUnavailable.missingUsd | 2 |
| t2.volumeUnavailable.swaps | 182,281 |
| oneClick.previous.swaps | 489,406 |
| oneClick.latest.swaps | 2,005,609 |
| oneClick.swaps.change | +309.8% |
| oneClick.previous.volume | 821,906,590 |
| oneClick.latest.volume | 3,804,396,974 |
| oneClick.volume.change | +362.9% |
| t2.lag1.pairs | 77 |
| t2.lag1.rv | 0 |
| t2.lag1.rp | 0.284 |
| t2.lag1.advantage | -0.284 |
| t2.lag1.half1.rv | -0.003 |
| t2.lag1.half1.rp | 0.193 |
| t2.lag1.half2.rv | 0.121 |
| t2.lag1.half2.rp | 0.317 |
| t2.lag1.ci.low | -0.613 |
| t2.lag1.ci.high | 0.179 |
| t2.lag1.favours | neither |
| t2.lag2.pairs | 76 |
| t2.lag2.rv | -0.065 |
| t2.lag2.rp | 0.039 |
| t2.lag2.advantage | -0.104 |
| t2.lag2.half1.rv | -0.186 |
| t2.lag2.half1.rp | -0.082 |
| t2.lag2.half2.rv | 0.151 |
| t2.lag2.half2.rp | 0.038 |
| t2.lag2.ci.low | -0.385 |
| t2.lag2.ci.high | 0.263 |
| t2.lag2.favours | neither |
| t2.lag4.pairs | 74 |
| t2.lag4.rv | 0.013 |
| t2.lag4.rp | 0.009 |
| t2.lag4.advantage | 0.004 |
| t2.lag4.half1.rv | 0.091 |
| t2.lag4.half1.rp | -0.012 |
| t2.lag4.half2.rv | -0.005 |
| t2.lag4.half2.rp | 0.002 |
| t2.lag4.ci.low | -0.241 |
| t2.lag4.ci.high | 0.201 |
| t2.lag4.favours | neither |
| t2.lag8.pairs | 70 |
| t2.lag8.rv | -0.004 |
| t2.lag8.rp | -0.187 |
| t2.lag8.advantage | 0.183 |
| t2.lag8.half1.rv | -0.056 |
| t2.lag8.half1.rp | -0.174 |
| t2.lag8.half2.rv | -0.177 |
| t2.lag8.half2.rp | -0.165 |
| t2.lag8.ci.low | 0.02 |
| t2.lag8.ci.high | 0.304 |
| t2.lag8.favours | neither |
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

T1 account counts are period means; `change` is relative change, except `changePp`, which is percentage points. T3 quantities are NEAR; `fields` and `fieldOffset` are comparisons only, not the burn definition. `atLeast10` and `atMost5` count weeks meeting the corresponding percentage threshold. T2 `rv` and `rp` are Pearson correlations of weekly percentage changes with usage changes `lag` weeks later; `advantage` is `rv − rp`; `ci` is its 90% paired moving-block bootstrap interval; `half1` and `half2` are the chronological halves of the pairs; `favours` applies every pass or fail condition at that lag. `t2.weeks` counts weeks in the test; `t2.volumeUnavailable` rows give in-test weeks whose volume is unavailable because some swaps lack USD values. `oneClick` rows compare the latest 13 complete weeks with the same 13 weeks a year earlier; they are descriptive, not a test.

## Definitions, quality and limits

- Signers include failed transactions, relayers, bots and multiple accounts per person. Accounts are not people.
- Receiver accounts receive `FUNCTION_CALL` actions on a one-day-a-week sample of 104 Mondays, 52 per comparison period. They are not a measured daily series.
- Duplicate block rows occur on 2024-11-04, 2024-11-05 and 2025-08-20, outside the T3 window. Distinct signer and receiver counts are unaffected; transaction concentration may include duplicate transaction rows.
- Daily 1Click totals sum `amountInUsd` exactly once per deposit address, memo (null when absent) and `createdAt`, by UTC creation day. Deposit addresses can repeat at different times. Only full seven-day weeks enter the weekly series. Missing USD makes the day's and week's volume unavailable.
- Prices are Coinbase Exchange NEAR-USD daily UTC closes. Weekly price is their seven-day mean.
- Supply and burn source fields are FLOAT64 in yoctoNEAR. Float precision is well below typical block burn, but the sources are not exact integer balances.
- Supply changes link each block to its parent by `prev_block_hash`. The first block's parent lies outside the window, so that first change is not counted. Minting can coincide with burn at epoch boundaries, so falls are a net-change proxy and may undercount burn on those blocks.
- Correlation is not causation. USD volume can reflect token prices and market conditions; a lead alone is not incremental adoption.
- These tests do not estimate fair value, transaction economics, or the success of every application. They test specific claims under fixed investment thresholds.

## Reproduction

Run `npm run rebuild`, then open `dashboard/index.html` and `dashboard/NUMBERS.md`. Rebuild reads aggregate evidence only from `data/public/`, needs no credentials or network, and never writes this file. It copies this reviewed thesis into the dashboard after verification.

`npm run export-public -- --swaps` exported the saved BigQuery aggregates, prices and daily 1Click totals from the completed pull, with no deposit addresses, memos or transaction hashes. Raw pages and `.env` stay private. Pull audit results are in `VALIDATION.md`; see also `README.md`.
