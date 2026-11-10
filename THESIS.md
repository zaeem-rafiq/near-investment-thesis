# NEAR through 2031: Not yet

Not yet: public data through November 1, 2026 does not support opening or adding to a NEAR position for a hold through 2031, because only one of three locked tests passed and three accounts made up <!-- metric:position.top3Share -->96.6%<!-- /metric --> of that pass.

For new money: this evidence does not support buying NEAR now for a hold through 2031.

For current holders: this evidence does not support adding, and by itself it does not say to sell.

General research opinion on public data, not personal advice. No portfolio share is given.

## Claim

Public data through November 1, 2026 does not yet support a NEAR hold through 2031. The one passing test does not show broad demand: without <!-- metric:position.topBuyerCountWords -->three<!-- /metric --> accounts, net buying falls from <!-- metric:position.check1.coverage -->77.75%<!-- /metric --> to <!-- metric:position.concentration.withoutTopNetBuyers.3.coverage -->2.66%<!-- /metric --> of the value of new NEAR.

## Evidence for

- Burn plus buybacks offset <!-- metric:position.check2.coveragePercent -->15.08%<!-- /metric --> of new NEAR, short of the <!-- metric:position.rules.passBar -->20%<!-- /metric --> bar. About <!-- metric:position.holderLedger.wallets.retainedShare -->98%<!-- /metric --> of buyback receipts had not left the three wallets by November 1, and held NEAR is not burned.
- Signers outside the ten biggest apps grew <!-- metric:position.check3.growthPercent -->14.58%<!-- /metric -->, short of the <!-- metric:position.rules.growthBar -->20%<!-- /metric --> bar, while all daily signers fell <!-- metric:presentation.signersDecline -->73.1%<!-- /metric -->.
- NEAR was on one side of only <!-- metric:position.oneClick.nearPercent -->2.07%<!-- /metric --> of 1Click swap volume.

## Evidence against

- 1Click users bought $<!-- metric:position.check1.netUsdCompactPrecise -->52.08M<!-- /metric --> more NEAR than they sold, <!-- metric:position.check1.coverage -->77.75%<!-- /metric --> of the value of new NEAR. Removing accounts that both bought and sold still leaves <!-- metric:position.descriptive.twoWaySenders.coverage -->44.74%<!-- /metric --> to <!-- metric:position.descriptive.twoWayRefundTo.coverage -->50.47%<!-- /metric -->.
- Buyback receipts of <!-- metric:position.holderLedger.wallets.received.nearCompact -->3.13M<!-- /metric --> NEAR in 36 weeks match DefiLlama within <!-- metric:position.receiptsComparisonGap -->0.04%<!-- /metric -->.
- The usage drop is concentrated: the ten biggest apps explain all of it, and everyone else grew.
- If adopted, HSP-029 lowers the yearly buying needed in 2031 from $<!-- metric:position.whatYouMustBelieve.capLatestUsdCompact -->154M<!-- /metric --> to $<!-- metric:position.whatYouMustBelieve.hspLatestUsdCompact -->94.8M<!-- /metric --> at the latest close.

## What would change my mind

- Up: two passing checks at a review give Building. The two closest are burn plus buybacks, <!-- metric:position.check2.coveragePercent -->15.08%<!-- /metric --> now against <!-- metric:position.rules.passBar -->20%<!-- /metric -->, and usage outside the ten biggest apps, <!-- metric:position.check3.signedGrowth -->+14.58%<!-- /metric --> now against <!-- metric:position.rules.signedGrowthBar -->+20%<!-- /metric -->.
- Down: the thesis is Broken if Check 1 and Check 2 both fall below 10% at two reviews in a row, or if the revenue wallets receive no NEAR from outside for 13 weeks.

If HSP-029 is vetoed or not adopted, the call stays Not yet and the 2031 buying need moves from the HSP-029 rows to the 2.5% cap rows of the existing table. Veto status alone does not rerun the checks.

## Watch list between reviews

Use the dashboard's daily line to watch net 1Click buying, revenue-wallet balances and supply since November 2, 2026; also track HSP-029 veto status from governance. These are a watch list, not new thresholds; only the locked review rules decide the call. The daily line hides when unavailable; veto status requires a separate manual review.

## Review dates

2026-11-16: record veto status only. Recompute checks on 2027-02-01, 2027-05-03, 2027-08-02 and 2027-11-01. Pipeline dates must first be parameterized; today's rebuild verifies only the saved snapshot.

[Supporting evidence, scenarios, review rules and verified tables](docs/EVIDENCE.md) · [Model](dashboard/model.html) · [How to verify](docs/VERIFY.md). Checks 1–3 were written after the original T1–T3 results were known; neither set's rules or results changes.
