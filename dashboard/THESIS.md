# NEAR through 2031: Not yet

First we tested T1–T3; none passed. Then we wrote three position checks and their 20% bars before computing them, and time-stamped the rules. One passed.

**Rating: hold, do not buy, through 2031.** "Not yet" is the rule's label for this call, as addenda 2 and 3 define it.

- New money: does not support buying now.
- Staked holder: does not say to sell; yields <!-- metric:position.stakingConflict.postYield -->4.97%<!-- /metric --> and <!-- metric:position.holderLedger.staking.grossYield -->5.52%<!-- /metric -->, before validator commission and tax, are above gross issuance <!-- metric:position.holderLedger.issued.shareOfOpeningSupply -->2.51%<!-- /metric -->.
- Unstaked holder: does not say to sell, but unstaked holding lost <!-- metric:position.holderLedger.nonStakerLossOfShare -->2.41%<!-- /metric --> of its supply share over the year.

## Call and position

Not yet: public data through November 1, 2026 does not support opening or adding to a NEAR position for a hold through 2031, because only one of three locked tests passed and three accounts made up <!-- metric:position.top3Share -->96.6%<!-- /metric --> of that pass.

| Check | What it measures | Bar | Result | Pass/fail |
|---|---|---|---|---|
| 1 | Net 1Click buying of NEAR as a share of new NEAR's value, 52 weeks | ≥<!-- metric:position.rules.passBar -->20%<!-- /metric --> | <!-- metric:position.check1.coverage -->77.75%<!-- /metric --> | <!-- metric:position.check1.passWord -->Pass<!-- /metric --> |
| 2 | Burn plus outside receipts to the three revenue wallets as a share of new NEAR, 36 weeks | ≥<!-- metric:position.rules.passBar -->20%<!-- /metric --> | <!-- metric:position.check2.coveragePercent -->15.08%<!-- /metric --> | <!-- metric:position.check2.passWord -->Fail<!-- /metric --> |
| 3 | Growth in mean daily signers outside the ten biggest apps, fixed by the earlier year's ranking | ≥<!-- metric:position.rules.signedGrowthBar -->+20%<!-- /metric --> | <!-- metric:position.check3.signedGrowth -->+14.58%<!-- /metric --> | <!-- metric:position.check3.passWord -->Fail<!-- /metric --> |

T1 usage broadening, <!-- metric:t1.verdict -->FAIL<!-- /metric -->; T2 1Click volume leads usage better than price, <!-- metric:t2.verdict -->CAN'T TELL<!-- /metric -->; T3 burn offsets supply, <!-- metric:t3.verdict -->FAIL<!-- /metric -->.

Size band, as a share of the reader's own full position: none now, at most a quarter at Building, full at Own. General research opinion on public data, not personal advice.

| Call | Condition at a review | Size band | Meaning for a holder |
|---|---|---|---|
| Not yet | Zero or one check passing | None | Does not support adding, and by itself does not say to sell |
| Building | Two or three passing | At most a quarter of a full position | Supports a small position at most |
| Own | All three passing in a window that does not overlap the original; first possible 2027-11-01 | Full | Supports holding a full position through 2031 |
| Broken | Check 1 final and Check 2 both below 10% at two reviews in a row, or no outside receipts to the wallets for 13 weeks | None | Withdraws the case for holding NEAR on this thesis |

Not official, how the call moves with the bar, using the same results: at a 10% bar <!-- metric:position.barSensitivity.10.passingWords -->all three<!-- /metric --> checks pass, giving <!-- metric:position.barSensitivity.10.call -->Building<!-- /metric -->, because Own needs a non-overlapping window; at 15%, <!-- metric:position.barSensitivity.15.passingWords -->two<!-- /metric --> pass (Checks 1 and 2), giving <!-- metric:position.barSensitivity.15.call -->Building<!-- /metric -->; at 20% or 25%, <!-- metric:position.barSensitivity.20.passingWords -->only Check 1<!-- /metric --> passes, giving <!-- metric:position.barSensitivity.25.call -->Not yet<!-- /metric -->. At any bar from 10% to 25%, the size band is <!-- metric:position.barSensitivity.rangeBands -->none or at most a quarter<!-- /metric -->; no bar gives a full position before 2027-11-01.

## Holder facts

Control: the bought NEAR is held by <!-- metric:position.control.daoCountWords -->two<!-- /metric --> Sputnik DAOs and <!-- metric:position.control.multisigCountWords -->one<!-- /metric --> multisig. Spending needs <!-- metric:position.control.daoSpendApprovalsWords -->two<!-- /metric --> approvals in each DAO and <!-- metric:position.control.multisigConfirmationsWords -->two<!-- /metric --> confirmations in the multisig; <!-- metric:position.control.fullAccessKeyWalletsWords -->none<!-- /metric --> of the three has a full-access key; <!-- metric:position.control.singleVoteAdminDaosWords -->one<!-- /metric --> DAO's admin role can change its rules with a single vote. DefiLlama's holders revenue matches the wallet receipts within <!-- metric:position.receiptsComparisonGap -->0.04%<!-- /metric -->. That is a consistency check, not independent confirmation, because DefiLlama measures revenue from the same wallets.

## Claim

Demand is concentrated: without <!-- metric:position.topBuyerCountWords -->three<!-- /metric --> accounts, net buying falls from <!-- metric:position.check1.coverage -->77.75%<!-- /metric --> to <!-- metric:position.concentration.withoutTopNetBuyers.3.coverage -->2.66%<!-- /metric --> of the value of new NEAR.

All <!-- metric:position.buyers.implicitCountWords -->three<!-- /metric --> are 64-hex implicit accounts. The largest bought $<!-- metric:position.buyers.1.boughtUsdCompact -->27.2M<!-- /metric --> in <!-- metric:position.buyers.1.buySwaps -->374<!-- /metric --> swaps over <!-- metric:position.buyers.1.activeBuyWeeks -->3<!-- /metric --> weeks, paid <!-- metric:position.buyers.1.zecShare -->100%<!-- /metric --> in ZEC, <!-- metric:position.buyers.1.may22Through27Share -->90%<!-- /metric --> of it from May 22 to 27, 2026, sold $<!-- metric:position.buyers.1.soldUsdCompact -->0<!-- /metric --> through 1Click and holds <!-- metric:position.buyers.1.nativeNear -->no<!-- /metric --> native NEAR; the other two bought $<!-- metric:position.buyers.2.boughtUsdCompact -->16.9M<!-- /metric --> over <!-- metric:position.buyers.2.activeBuyWeeks -->26<!-- /metric --> weeks and $<!-- metric:position.buyers.3.boughtUsdCompact -->8.26M<!-- /metric --> over <!-- metric:position.buyers.3.activeBuyWeeks -->7<!-- /metric -->, sold $<!-- metric:position.buyers.2.soldUsdCompact -->1.98M<!-- /metric --> and $<!-- metric:position.buyers.3.soldUsdCompact -->77.3K<!-- /metric -->, and hold <!-- metric:position.buyers.2.nativeNear -->3.05<!-- /metric --> and <!-- metric:position.buyers.3.nativeNear -->3.05<!-- /metric --> NEAR (public RPC, <!-- metric:position.buyers.balanceDate -->2026-11-10<!-- /metric -->). The data cannot tell whether they are exchanges, market makers or long-term buyers.

## Why: evidence for Not yet

- Check 2: about <!-- metric:position.holderLedger.wallets.retainedShare -->98%<!-- /metric --> of receipts remained in the wallets by November 1; held is not burned.
- Check 3: everyone else grew, but all daily signers fell <!-- metric:presentation.signersDecline -->73.1%<!-- /metric -->.
- Intents is chain-agnostic by design. NEAR was on one side of only <!-- metric:position.oneClick.nearPercent -->2.07%<!-- /metric --> of 1Click volume, so volume growth does not translate directly into NEAR demand.

Author's view: the author weighs Check 2 most, because burn and buybacks are the only channel where NEAR Intents revenue reaches holders, while Check 1's pass rests on <!-- metric:position.topBuyerCountWords -->three<!-- /metric --> accounts.

## The case for NEAR

- Net buying was $<!-- metric:position.check1.netUsdCompactPrecise -->52.08M<!-- /metric -->, <!-- metric:position.check1.coverage -->77.75%<!-- /metric --> of issuance value; latest 13-week 1Click volume was $<!-- metric:oneClick.latest.volumeCompact -->3.8B<!-- /metric -->, up <!-- metric:oneClick.volume.change -->+362.9%<!-- /metric -->.
- The ten biggest apps explain the usage decline; everyone else grew. Holders-revenue wallet receipts were $<!-- metric:position.holderLedger.wallets.received.usdCompact -->7.5M<!-- /metric --> in 36 weeks.

## What the price assumes

Capture multiple <!-- metric:position.priceAssumes.multiple -->472.92<!-- /metric -->×; yield <!-- metric:position.priceAssumes.yield -->0.21%<!-- /metric -->. Reaching <!-- metric:position.priceAssumes.targets.0.targetYield -->1.6%<!-- /metric -->–<!-- metric:position.priceAssumes.targets.2.targetYield -->5%<!-- /metric --> yield by 2031 requires <!-- metric:position.priceAssumes.targets.0.compoundYearlyGrowth -->47.95%<!-- /metric -->–<!-- metric:position.priceAssumes.targets.2.compoundYearlyGrowth -->84.45%<!-- /metric --> annual capture growth at constant market cap, not a forecast.

Not-official peers: NEAR <!-- metric:peers.nearWithIntents.multiple -->570×<!-- /metric --> including Intents, <!-- metric:peers.near.multiple -->5,687×<!-- /metric --> chain-only; Avalanche <!-- metric:peers.below.multiple -->1,398×<!-- /metric -->. Zero-revenue Bitcoin Cash stays only because the pre-set rule picked it. Model cap $<!-- metric:position.priceAssumes.marketCapCompact -->5.61B<!-- /metric --> uses total supply × latest close; peer cap $<!-- metric:peers.near.mcapCompact -->4.78B<!-- /metric --> uses DefiLlama circulating supply. Bases differ, so compare them only within a row.

## What you must believe

Annual buying needed in 2031: $<!-- metric:position.whatYouMustBelieve.lowUsdCompact -->46.1M<!-- /metric -->–$<!-- metric:position.whatYouMustBelieve.highUsdCompact -->154M<!-- /metric -->, <!-- metric:position.whatYouMustBelieve.rules.1.prices.0.multipleOfMeasuredBuying -->0.89<!-- /metric -->–<!-- metric:position.whatYouMustBelieve.rules.0.prices.1.multipleOfMeasuredBuying -->2.95<!-- /metric -->× measured buying.

Scenarios have no odds because the data cannot estimate them without inventing assumptions. Measured inputs, against a latest close of $<!-- metric:position.latestClose -->4.284<!-- /metric -->: Bear covers <!-- metric:position.scenarios.bear.years.4.coverage -->2.4%<!-- /metric --> of 2031 issuance and breaks even at $<!-- metric:position.scenarios.bear.breakEven2031 -->0.04<!-- /metric --> under the <!-- metric:position.scenarios.bear.ruleLabel -->2.5% cap<!-- /metric -->; Base <!-- metric:position.scenarios.base.years.4.coverage -->75.89%<!-- /metric --> and $<!-- metric:position.scenarios.base.breakEven2031 -->3.23<!-- /metric --> under <!-- metric:position.scenarios.base.ruleLabel -->HSP-029<!-- /metric -->; Bull <!-- metric:position.scenarios.bull.years.4.coverage -->171.09%<!-- /metric --> and $<!-- metric:position.scenarios.bull.breakEven2031 -->7.40<!-- /metric --> under <!-- metric:position.scenarios.bull.ruleLabel -->HSP-029<!-- /metric -->. The latest close is about <!-- metric:position.latestCloseAboveBaseBreakEven -->32.7%<!-- /metric --> above the Base break-even. HSP-029, if adopted, lowers the latest-price requirement from $<!-- metric:position.whatYouMustBelieve.capLatestUsdCompact -->154M<!-- /metric --> to $<!-- metric:position.whatYouMustBelieve.hspLatestUsdCompact -->94.8M<!-- /metric -->.

## What would change my mind

- Up: Building or Own on the call table's conditions; Checks 2 and 3 are closest to their bars.
- Down: Broken on the table's conditions.

## Review dates

2026-11-16: veto status only. Recompute 2027-02-01, 2027-05-03, 2027-08-02, 2027-11-01. `npm run review -- DATE` prints each date's windows, dated SQL and pulls; `--plan` estimates cost; `--run` works only once the date arrives.

## What the bull has to show, and by when

By 2027-02-01: Check 2 reaches <!-- metric:position.rules.passBar -->20%<!-- /metric --> (now <!-- metric:position.check2.coveragePercent -->15.08%<!-- /metric -->); Check 3 reaches <!-- metric:position.rules.signedGrowthBar -->+20%<!-- /metric --> (now <!-- metric:position.check3.signedGrowth -->+14.58%<!-- /metric -->).

## Watch list between reviews

Watch weekly buyback receipts, signers outside the top ten, and the dashboard's daily net buying, wallet balances and supply. Per governance sources, HSP-029 passed the House of Stake vote November 2; veto runs until November 16, and validator adoption is still required. If vetoed or not adopted, use the 2.5% cap rows; the call stays Not yet. Only locked review rules decide the call.

Bands are the author's choice, not portfolio shares.

[Supporting evidence, scenarios, review rules and verified tables](docs/EVIDENCE.md) · [Model](dashboard/model.html) · [How to verify](docs/VERIFY.md).
