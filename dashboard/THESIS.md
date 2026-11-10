# NEAR through 2031: Not yet

First we tested T1–T3; none passed. Then we wrote three position checks and their 20% bars before computing them, and time-stamped the rules. One passed. The evidence records the intervening provisional results and addenda.

## Call and position

Not yet: public data through November 1, 2026 does not support opening or adding to a NEAR position for a hold through 2031, because only one of three locked tests passed and three accounts made up <!-- metric:position.top3Share -->96.6%<!-- /metric --> of that pass.

For new money: this evidence does not support buying NEAR now for a hold through 2031.

For current holders: this evidence does not support adding, and by itself it does not say to sell.

In rating terms: hold, do not buy.

Size band, as a share of the reader's own full position: none now, at most a quarter at Building, full at Own.

## Holder facts

An unstaked holder's supply share fell <!-- metric:position.holderLedger.nonStakerLossOfShare -->2.41%<!-- /metric -->. Gross staking-yield estimates of <!-- metric:position.stakingConflict.postYield -->4.97%<!-- /metric --> and <!-- metric:position.holderLedger.staking.grossYield -->5.52%<!-- /metric --> exceed gross issuance of <!-- metric:position.holderLedger.issued.shareOfOpeningSupply -->2.51%<!-- /metric -->, so staking offsets dilution before fees and tax.

## Claim

Demand is concentrated: without <!-- metric:position.topBuyerCountWords -->three<!-- /metric --> accounts, net buying falls from <!-- metric:position.check1.coverage -->77.75%<!-- /metric --> to <!-- metric:position.concentration.withoutTopNetBuyers.3.coverage -->2.66%<!-- /metric --> of the value of new NEAR.

## Why: evidence for Not yet

- Burn plus buybacks offset <!-- metric:position.check2.coveragePercent -->15.08%<!-- /metric --> of new NEAR, below <!-- metric:position.rules.passBar -->20%<!-- /metric -->. About <!-- metric:position.holderLedger.wallets.retainedShare -->98%<!-- /metric --> of receipts remained in the wallets by November 1; held is not burned.
- Signers outside the ten biggest apps, fixed by the earlier year's ranking, grew <!-- metric:position.check3.growthPercent -->14.58%<!-- /metric -->, below <!-- metric:position.rules.growthBar -->20%<!-- /metric -->; all daily signers fell <!-- metric:presentation.signersDecline -->73.1%<!-- /metric -->.
- Intents is chain-agnostic by design. NEAR was on one side of only <!-- metric:position.oneClick.nearPercent -->2.07%<!-- /metric --> of 1Click volume, so volume growth does not translate directly into NEAR demand.

## The case for NEAR

- Net buying was $<!-- metric:position.check1.netUsdCompactPrecise -->52.08M<!-- /metric -->, <!-- metric:position.check1.coverage -->77.75%<!-- /metric --> of issuance value.
- Latest 13-week 1Click volume was $<!-- metric:oneClick.latest.volumeCompact -->3.8B<!-- /metric -->, up <!-- metric:oneClick.volume.change -->+362.9%<!-- /metric -->.
- Holders-revenue wallet receipts were $<!-- metric:position.holderLedger.wallets.received.usdCompact -->7.5M<!-- /metric --> in 36 weeks, matching DefiLlama within <!-- metric:position.receiptsComparisonGap -->0.04%<!-- /metric -->.
- The ten biggest apps explain the usage decline; everyone else grew.

## What the price assumes

Capture multiple <!-- metric:position.priceAssumes.multiple -->472.92<!-- /metric -->×; yield <!-- metric:position.priceAssumes.yield -->0.21%<!-- /metric -->. Reaching <!-- metric:position.priceAssumes.targets.0.targetYield -->1.6%<!-- /metric -->–<!-- metric:position.priceAssumes.targets.2.targetYield -->5%<!-- /metric --> yield by 2031 requires <!-- metric:position.priceAssumes.targets.0.compoundYearlyGrowth -->47.95%<!-- /metric -->–<!-- metric:position.priceAssumes.targets.2.compoundYearlyGrowth -->84.45%<!-- /metric --> annual capture growth at constant market cap, not a forecast.

Not-official peers: NEAR <!-- metric:peers.nearWithIntents.multiple -->570×<!-- /metric --> including Intents, <!-- metric:peers.near.multiple -->5,687×<!-- /metric --> chain-only; Avalanche <!-- metric:peers.below.multiple -->1,398×<!-- /metric -->. Zero-revenue Bitcoin Cash stays only because the pre-set rule picked it. Model cap $<!-- metric:position.priceAssumes.marketCapCompact -->5.61B<!-- /metric --> uses total supply × latest close; peer cap $<!-- metric:peers.near.mcapCompact -->4.78B<!-- /metric --> uses DefiLlama circulating supply.

## What you must believe

Annual buying needed in 2031: $<!-- metric:position.whatYouMustBelieve.lowUsdCompact -->46.1M<!-- /metric -->–$<!-- metric:position.whatYouMustBelieve.highUsdCompact -->154M<!-- /metric -->, <!-- metric:position.whatYouMustBelieve.rules.1.prices.0.multipleOfMeasuredBuying -->0.89<!-- /metric -->–<!-- metric:position.whatYouMustBelieve.rules.0.prices.1.multipleOfMeasuredBuying -->2.95<!-- /metric -->× measured buying. Base breaks even at $<!-- metric:position.scenarios.base.years.4.breakEvenPrice -->3.23<!-- /metric --> versus latest close $<!-- metric:position.latestClose -->4.284<!-- /metric -->. HSP-029, if adopted, lowers the latest-price requirement from $<!-- metric:position.whatYouMustBelieve.capLatestUsdCompact -->154M<!-- /metric --> to $<!-- metric:position.whatYouMustBelieve.hspLatestUsdCompact -->94.8M<!-- /metric -->.

## What the bull has to show, and by when

By 2027-02-01: Check 2 reaches <!-- metric:position.rules.passBar -->20%<!-- /metric --> (now <!-- metric:position.check2.coveragePercent -->15.08%<!-- /metric -->); Check 3 reaches <!-- metric:position.rules.signedGrowthBar -->+20%<!-- /metric --> (now <!-- metric:position.check3.signedGrowth -->+14.58%<!-- /metric -->).

## What would change my mind

- Up: two passing checks give Building; all three in an eligible non-overlapping window give Own.
- Down: Broken if Checks 1 and 2 both fall below 10% at two consecutive reviews, or no outside wallet receipts for 13 weeks.

## Watch list between reviews

Watch weekly buyback receipts, signers outside the top ten, and the dashboard's daily net buying, wallet balances and supply. HSP-029 passed the House of Stake vote November 2 (governance source in supporting evidence); veto runs until November 16; validator adoption is still required. If vetoed or not adopted, use the 2.5% cap rows; the call stays Not yet. Only locked review rules decide the call.

## Review dates

2026-11-16: veto status only. Recompute 2027-02-01, 2027-05-03, 2027-08-02, 2027-11-01. `npm run review -- DATE` prints each date's windows, dated SQL and pulls; `--plan` estimates cost; `--run` works only once the date arrives.

General research opinion on public data, not personal advice. Bands are the author's choice, not portfolio shares.

[Supporting evidence, scenarios, review rules and verified tables](docs/EVIDENCE.md) · [Model](dashboard/model.html) · [How to verify](docs/VERIFY.md).
