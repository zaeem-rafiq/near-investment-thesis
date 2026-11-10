# NEAR through 2031: Not yet

Not yet: public data through November 1, 2026 does not support opening or adding to a NEAR position for a hold through 2031, because only one of three locked tests passed and three accounts made up <!-- metric:position.top3Share -->96.6%<!-- /metric --> of that pass.

General research opinion on public data, not personal advice. No portfolio share is given.

Here, the three locked position tests are Checks 1–3 below, not the original T1–T3 claims. The position rule was written after those original results were known. Their thresholds and results remain unchanged.

**Call meanings, from `docs/position-rule-addendum-2.md`.** Not yet is neutral: this evidence does not support opening or adding, and does not itself say to sell. Building is constructive: it supports a small position at most, not a full one. Own is positive: it supports holding a full position through the horizon. Broken is negative: it withdraws the case for holding on this thesis. These are research labels, not personal sizing instructions.

**Next reviews:** 2026-11-16, record HSP-029 veto status only; then 2027-02-01, 2027-05-03, 2027-08-02 and 2027-11-01, recompute the checks.

## Five-line summary

- **Usage:** mean daily signers fell <!-- metric:presentation.signersDecline -->73.1%<!-- /metric -->. Outside the frozen biggest receivers, mean signers rose <!-- metric:position.check3.growthPercent -->14.58%<!-- /metric -->, below the locked growth bar.
- **Net buying:** final net buying was $<!-- metric:position.check1.netUsdCompact -->52.1M<!-- /metric -->, or <!-- metric:position.check1.coverage -->77.75%<!-- /metric --> of issuance value; three net-buying accounts made up <!-- metric:position.top3Share -->96.6%<!-- /metric --> of that total.
- **Buybacks and burn:** outside wallet receipts plus burn covered <!-- metric:position.check2.coveragePercent -->15.08%<!-- /metric --> of issuance in the wallet window, below the 20% bar. Receipts are not burns; held tokens remain under wallet control and can return to circulation.
- **What you must believe:** balancing issuance after burn in 2031 needs annual total buying of $<!-- metric:position.whatYouMustBelieve.lowUsdCompact -->46.1M<!-- /metric --> to $<!-- metric:position.whatYouMustBelieve.highUsdCompact -->154M<!-- /metric --> across the stated price and issuance-rule inputs, not a forecast.
- **What would change the call:** at least two position checks passing at a review gives Building; all three in a non-overlapping window can give Own, unless a Broken condition applies.

## Claim

Public evidence does not yet support opening or adding to a NEAR position for a hold through 2031. Only Check 1 passed, and its net buying was concentrated in three accounts. This is a neutral research call, not a recommendation to sell.

## Evidence for

Evidence for the Not yet claim: burn plus buybacks covered <!-- metric:position.check2.coveragePercent -->15.08%<!-- /metric --> of issuance, and everyone else's signers grew <!-- metric:position.check3.growthPercent -->14.58%<!-- /metric -->, so both checks failed their <!-- metric:position.rules.passBar -->20%<!-- /metric --> bars. Three accounts made up <!-- metric:position.top3Share -->96.6%<!-- /metric --> of net buying. Overall daily signers fell <!-- metric:presentation.signersDecline -->73.1%<!-- /metric -->, burn alone offset <!-- metric:t3.offset -->1.56%<!-- /metric --> of issuance, and NEAR appeared on one side of only <!-- metric:position.oneClick.nearPercent -->2.07%<!-- /metric --> of 1Click input volume.

## Evidence against

The case for NEAR: Check 1 passed at <!-- metric:position.check1.coverage -->77.75%<!-- /metric --> of issuance value. The descriptive two-way cuts still leave <!-- metric:position.descriptive.twoWaySenders.coverage -->44.74%<!-- /metric --> and <!-- metric:position.descriptive.twoWayRefundTo.coverage -->50.47%<!-- /metric -->. Wallet receipts match DefiLlama's aggregate to about <!-- metric:position.receiptsComparisonGap -->0.04%<!-- /metric --> (rounded), although that does not verify every receipt's economic origin. Everyone else's signers rose <!-- metric:position.check3.growthPercent -->14.58%<!-- /metric -->, and 1Click volume grew <!-- metric:oneClick.volume.change -->+362.9%<!-- /metric --> in the latest complete-quarter comparison. The conditional HSP-029 issuance cut would reduce the buying needed to offset new supply; it is an assumption, not an observed future outcome. Descriptive cuts and growth comparisons are not official tests.

## What would change my mind

At the reviews on 2027-02-01, 2027-05-03, 2027-08-02 and 2027-11-01, rerun all position checks over the preceding 52 weeks; Check 2 uses only weeks from 2026-02-23 onward, and Check 3 compares with the preceding 52 weeks while retaining the original frozen top ten. Each check passes at <!-- metric:position.rules.passBar -->20%<!-- /metric --> or more. Missing data is not measurable and counts as not passing.

Zero or one pass resets the call to Not yet, regardless of the previous call. Two or three gives Building. Own requires all three in a non-overlapping window, first eligible at the 2027-11-01 review. Broken overrides these calls if Check 1 final and Check 2 are both strictly below 10% at two consecutive reruns, or if the wallets receive no outside NEAR or wNEAR in the last 13 weeks of any rerun. Broken stays until a new rule is written and time-stamped. On or after 2026-11-16, record HSP-029 veto status only; no checks run on that date. The full calendar and required pipeline parameterization are below.

## Holder ledger (not official T1–T3)

Supply uses the 52 weeks from 2025-11-03 through 2026-11-01. Wallet transfers use only the 36 complete weeks from 2026-02-23. USD flows use each week's mean close, not today's price. Shares below use the opening supply of the supply window.

| Channel | NEAR | USD at weekly prices | Share of opening supply |
|---|---|---|---|
| Gross issuance, 52 weeks | <!-- metric:position.holderLedger.issued.near -->32,123,695.5<!-- /metric --> | $<!-- metric:position.holderLedger.issued.usd -->66,987,430.78<!-- /metric --> | <!-- metric:position.holderLedger.issued.shareOfOpeningSupply -->2.51%<!-- /metric --> |
| Burn, 52 weeks | <!-- metric:position.holderLedger.burned.near -->500,289.94<!-- /metric --> | $<!-- metric:position.holderLedger.burned.usd -->970,557.43<!-- /metric --> | <!-- metric:position.holderLedger.burned.shareOfOpeningSupply -->0.04%<!-- /metric --> |
| Outside wallet receipts, observed 36 weeks | <!-- metric:position.holderLedger.walletReceived.observed.near -->3,125,552.77<!-- /metric --> | $<!-- metric:position.holderLedger.walletReceived.observed.usd -->7,547,226.28<!-- /metric --> | <!-- metric:position.holderLedger.walletReceived.observed.shareOfOpeningSupply -->0.24%<!-- /metric --> |
| Receipts annualized by 52/36, not observed annual revenue | <!-- metric:position.holderLedger.walletReceived.annualized.near -->4,514,687.33<!-- /metric --> | $<!-- metric:position.holderLedger.walletReceived.annualized.usd -->10,901,549.08<!-- /metric --> | <!-- metric:position.holderLedger.walletReceived.annualized.shareOfOpeningSupply -->0.35%<!-- /metric --> |
| Mixed-window net float proxy | <!-- metric:position.holderLedger.netFloatChange.near -->28,554,888.79<!-- /metric --> | $<!-- metric:position.holderLedger.netFloatChange.usd -->58,555,562.06<!-- /metric --> | <!-- metric:position.holderLedger.netFloatChange.shareOfOpeningSupply -->2.23%<!-- /metric --> |

The float proxy is issuance minus burn minus outside receipts plus external outflows. It combines the stated unequal windows. It is not a full circulating-supply estimate or proof that wallet receipts stay off-market.

A non-staker's ownership share fell by <!-- metric:position.holderLedger.nonStakerLossOfShare -->2.41%<!-- /metric --> across the supply window. Current aggregate validator stake was <!-- metric:position.holderLedger.staking.totalStakeNear -->581,798,949.62<!-- /metric --> NEAR at the 2026-11-09 snapshot.

**Staking-yield evidence conflicts.** The pinned on-chain `protocol_reward_rate` is <!-- metric:position.stakingConflict.rpcRate -->[0,1]<!-- /metric -->, implying a treasury share of <!-- metric:position.holderLedger.staking.treasuryShare -->0%<!-- /metric --> if used literally. The HSP-029 post instead states a <!-- metric:position.stakingConflict.postSplit -->90/10<!-- /metric --> staker/treasury split and a measured treasury share of <!-- metric:position.stakingConflict.postMeasuredShare -->10.13%<!-- /metric -->. It explicitly warns that the config field is not a reliable verification of the economic split.

Using the same trailing issuance and snapshot stake, the literal-config yield proxy is about <!-- metric:position.holderLedger.staking.grossYield -->5.52%<!-- /metric -->; applying the post's nominal split gives about <!-- metric:position.stakingConflict.postYield -->4.97%<!-- /metric -->. The latter uses the nominal treasury share of <!-- metric:position.stakingConflict.postNominalShare -->10%<!-- /metric -->, not the post's slightly different measured share. We do not choose between these proxies or independently establish the economic split. Both are before validator commission, not measured delegator returns, real returns after dilution, or future yield promises.

Sources: `data/public/staking.json` is the sum of current validator stakes, pinned to a finalized epoch. `data/public/protocol-share.json` reads `protocol_reward_rate` from `EXPERIMENTAL_protocol_config` at the same block on `https://rpc.mainnet.near.org`. This is a post-window protocol snapshot, not a claim that its reward split applied throughout the historical issuance window.

The conflicting source is the HSP-029 post, Context and issuance-split table: https://gov.near.org/t/hsp-029-establish-a-24-month-issuance-ramp-to-a-1-6-target-rate-of-near-token-emissions/42644/1 . Its attributed shares and warning are recorded in `data/public/hsp-treasury.json`, not presented as our own treasury-flow measurement.

### Wallets: received, sent, retained and held

Amounts below are NEAR. Receipts and external outflows cover the wallet window; balances are the separate 2026-11-09 snapshot in `wallet-controls.json`, not end-of-window balances. All observed wNEAR balances and transfers are zero. Internal transfers are excluded from both flow columns, so individual net receipts do not explain individual balances.

| Named revenue wallet | Outside received | Outside sent | Received minus sent | Snapshot balance |
|---|---|---|---|---|
| fefundsadmin.sputnik-dao.near | <!-- metric:position.holderLedger.wallets.perWallet.0.received.near -->1,041,071.09<!-- /metric --> | <!-- metric:position.holderLedger.wallets.perWallet.0.sent.near -->0.5<!-- /metric --> | <!-- metric:position.holderLedger.wallets.perWallet.0.netRetained.near -->1,041,070.59<!-- /metric --> | <!-- metric:position.holderLedger.wallets.perWallet.0.currentBalance.near -->1,994,812.25<!-- /metric --> |
| 1csfundsadmin.sputnik-dao.near | <!-- metric:position.holderLedger.wallets.perWallet.1.received.near -->432,327.19<!-- /metric --> | <!-- metric:position.holderLedger.wallets.perWallet.1.sent.near -->45,010.5<!-- /metric --> | <!-- metric:position.holderLedger.wallets.perWallet.1.netRetained.near -->387,316.69<!-- /metric --> | <!-- metric:position.holderLedger.wallets.perWallet.1.currentBalance.near -->270.88<!-- /metric --> |
| buybacks.multisignature.near | <!-- metric:position.holderLedger.wallets.perWallet.2.received.near -->1,652,154.49<!-- /metric --> | <!-- metric:position.holderLedger.wallets.perWallet.2.sent.near -->12,025<!-- /metric --> | <!-- metric:position.holderLedger.wallets.perWallet.2.netRetained.near -->1,640,129.49<!-- /metric --> | <!-- metric:position.holderLedger.wallets.perWallet.2.currentBalance.near -->2,229,439.34<!-- /metric --> |
| Total | <!-- metric:position.holderLedger.wallets.received.near -->3,125,552.77<!-- /metric --> | <!-- metric:position.holderLedger.wallets.sent.near -->57,036<!-- /metric --> | <!-- metric:position.holderLedger.wallets.netRetained.near -->3,068,516.77<!-- /metric --> | <!-- metric:position.holderLedger.wallets.currentBalance.near -->4,224,522.47<!-- /metric --> |

Total outside outflows were $<!-- metric:position.holderLedger.wallets.sent.usd -->85,915<!-- /metric --> at weekly prices. Net retained flows were $<!-- metric:position.holderLedger.wallets.netRetained.usd -->7,461,311.29<!-- /metric -->. The snapshot balance is worth $<!-- metric:position.holderLedger.wallets.currentBalance.usd -->18,097,854.27<!-- /metric --> at the latest close and equals <!-- metric:position.holderLedger.wallets.currentBalance.shareOfOpeningSupply -->0.33%<!-- /metric --> of opening supply. It includes earlier receipts and later flows; it is not a measure of the amount bought in this window.

**Held is not burned.** Native balances include storage reserve and exclude locked stake. DAO/multisig permissions govern held funds, and policies or keys may change control. Aggregate transfers and balances cannot identify whether particular bought tokens were later held or burned. That quantity is not identifiable, not measured zero. Check 2 credits gross outside receipts, not permanent retirement or distributions to token holders.

## What you must believe (not official)

**Headline:** annual total buying needed to balance modeled issuance after burn in 2031 ranges from $<!-- metric:position.whatYouMustBelieve.lowUsdCompact -->46.1M<!-- /metric --> to $<!-- metric:position.whatYouMustBelieve.highUsdCompact -->154M<!-- /metric -->, or <!-- metric:position.whatYouMustBelieve.rules.1.prices.0.multipleOfMeasuredBuying -->0.89<!-- /metric -->× to <!-- metric:position.whatYouMustBelieve.rules.0.prices.1.multipleOfMeasuredBuying -->2.95<!-- /metric -->× final measured annual net buying, across these inputs.

This is an equilibrium buying requirement, not a fair-price estimate. Total buying includes wallet buybacks; do not add the buybacks to the requirement again. Supply starts after the last T3 week, realized issuance share and annual burn stay fixed, and the model runs from November 2026. HSP-029 activation in March 2027 is an assumption, not an observed future event. The published monthly midpoint schedule is in `scripts/model.mjs`.

| Issuance rule | Constant price input | Total buying needed in 2031 per year | Multiple of measured net buying |
|---|---|---|---|
| 2.5% cap | Issuance-weighted mean, $<!-- metric:position.whatYouMustBelieve.prices.issuanceWeightedMean -->2.09<!-- /metric --> | $<!-- metric:position.whatYouMustBelieve.rules.0.prices.0.buyingNeededUsd -->74,882,041.69<!-- /metric --> | <!-- metric:position.whatYouMustBelieve.rules.0.prices.0.multipleOfMeasuredBuying -->1.44<!-- /metric -->× |
| 2.5% cap | Latest close, $<!-- metric:position.latestClose -->4.284<!-- /metric --> | $<!-- metric:position.whatYouMustBelieve.rules.0.prices.1.buyingNeededUsd -->153,836,474.5<!-- /metric --> | <!-- metric:position.whatYouMustBelieve.rules.0.prices.1.multipleOfMeasuredBuying -->2.95<!-- /metric -->× |
| 2.5% cap | Half latest, $<!-- metric:position.whatYouMustBelieve.prices.halfLatest -->2.14<!-- /metric --> | $<!-- metric:position.whatYouMustBelieve.rules.0.prices.2.buyingNeededUsd -->76,918,237.25<!-- /metric --> | <!-- metric:position.whatYouMustBelieve.rules.0.prices.2.multipleOfMeasuredBuying -->1.48<!-- /metric -->× |
| HSP-029 | Issuance-weighted mean, $<!-- metric:position.whatYouMustBelieve.prices.issuanceWeightedMean -->2.09<!-- /metric --> | $<!-- metric:position.whatYouMustBelieve.rules.1.prices.0.buyingNeededUsd -->46,141,799.89<!-- /metric --> | <!-- metric:position.whatYouMustBelieve.rules.1.prices.0.multipleOfMeasuredBuying -->0.89<!-- /metric -->× |
| HSP-029 | Latest close, $<!-- metric:position.latestClose -->4.284<!-- /metric --> | $<!-- metric:position.whatYouMustBelieve.rules.1.prices.1.buyingNeededUsd -->94,792,979.23<!-- /metric --> | <!-- metric:position.whatYouMustBelieve.rules.1.prices.1.multipleOfMeasuredBuying -->1.82<!-- /metric -->× |
| HSP-029 | Half latest, $<!-- metric:position.whatYouMustBelieve.prices.halfLatest -->2.14<!-- /metric --> | $<!-- metric:position.whatYouMustBelieve.rules.1.prices.2.buyingNeededUsd -->47,396,489.61<!-- /metric --> | <!-- metric:position.whatYouMustBelieve.rules.1.prices.2.multipleOfMeasuredBuying -->0.91<!-- /metric -->× |

## Review calendar and downgrade rules

The immutable rule is `docs/position-rule-addendum-2.md`. Every rerun resets the call: zero or one pass gives Not yet; two or three gives Building. Own requires all three in a window that does not overlap the original supply window. The first scheduled eligible review is 2027-11-01. A missing source is not measurable and counts as not passing.

Broken overrides the ordinary call if Check 1 final and Check 2 are both strictly below 10% at two consecutive reruns, or if the revenue wallets receive no outside NEAR or wNEAR during the last 13 weeks of any review window. Broken persists until a new rule is written and time-stamped.

| Review date | Window, end excluded | Action and executable status |
|---|---|---|
| 2026-11-16 | No check window | Record whether HSP-029 was vetoed from its governance source. No automated veto-status command exists. Do not run checks on this date. |
| 2027-02-01 | 2026-02-02 to 2027-02-01 | First parameterize the pipeline for these dates; Check 2 starts 2026-02-23. Preserve the original frozen receiver cohort. Own is not eligible. |
| 2027-05-03 | 2026-05-04 to 2027-05-03 | First parameterize the pipeline for these dates and the preceding usage window. Own is not eligible. |
| 2027-08-02 | 2026-08-03 to 2027-08-02 | First parameterize the pipeline for these dates and the preceding usage window. Own is not eligible. |
| 2027-11-01 | 2026-11-02 to 2027-11-01 | First parameterize the pipeline for these dates and the preceding usage window. Own becomes eligible if all checks pass and no Broken condition applies. |

**Do not run today's export as a future rerun.** `CAL`, literal SQL dates, participant-pull windows, wallet-week aggregation, price coverage, position-section validation dates and the prior usage period are currently fixed to the original snapshot. They must be parameterized together, retaining the frozen cohort rather than ranking a new top ten. Source access and any billed work need fresh owner approval. `npm run rebuild` only verifies the saved snapshot. With the existing completed local histories, `node scripts/export-position-section.mjs` reproduces this descriptive section offline; it does not collect future evidence.

## Why usage fell (not official attribution)

The frozen top-ten receiver group fell from <!-- metric:position.usageDecline.top10.earlier -->520,897.21<!-- /metric --> to <!-- metric:position.usageDecline.top10.later -->127,150.61<!-- /metric --> mean daily signers. Everyone else rose from <!-- metric:position.usageDecline.everyoneElse.earlier -->14,580.39<!-- /metric --> to <!-- metric:position.usageDecline.everyoneElse.later -->16,705.96<!-- /metric -->. The top-ten group's decline explains <!-- metric:position.usageDecline.shareOfDropExplained -->100.54%<!-- /metric --> of the total decline, above the whole decline because everyone else partly offset it.

The following receiver means are from `data/public/signer-top10.json`, frozen by the earlier year's ranking. They overlap: one signer can use several receivers on a day. Do not sum them as distinct daily users or substitute the sum for the exclusive group counts above.

| Frozen receiver | Earlier mean daily signers | Later mean daily signers |
|---|---|---|
| game.hot.tg | <!-- metric:position.usageDecline.receivers.0.earlierMean -->421,296.02<!-- /metric --> | <!-- metric:position.usageDecline.receivers.0.laterMean -->124,774.34<!-- /metric --> |
| unnamed account | <!-- metric:position.usageDecline.receivers.1.earlierMean -->81,627.89<!-- /metric --> | <!-- metric:position.usageDecline.receivers.1.laterMean -->0.01<!-- /metric --> |
| aa-harvest-moon.near | <!-- metric:position.usageDecline.receivers.2.earlierMean -->16,371.44<!-- /metric --> | <!-- metric:position.usageDecline.receivers.2.laterMean -->872.7<!-- /metric --> |
| firedrop.hot.tg | <!-- metric:position.usageDecline.receivers.3.earlierMean -->10,920.04<!-- /metric --> | <!-- metric:position.usageDecline.receivers.3.laterMean -->1,919.88<!-- /metric --> |
| wrap.near | <!-- metric:position.usageDecline.receivers.4.earlierMean -->2,952.35<!-- /metric --> | <!-- metric:position.usageDecline.receivers.4.laterMean -->913.53<!-- /metric --> |
| embr.playember_reserve.near | <!-- metric:position.usageDecline.receivers.5.earlierMean -->2,551.16<!-- /metric --> | <!-- metric:position.usageDecline.receivers.5.laterMean -->0.12<!-- /metric --> |
| omni.firedrop.hot.tg | <!-- metric:position.usageDecline.receivers.6.earlierMean -->1,783.45<!-- /metric --> | <!-- metric:position.usageDecline.receivers.6.laterMean -->0.66<!-- /metric --> |
| usdt.tether-token.near | <!-- metric:position.usageDecline.receivers.7.earlierMean -->1,495.95<!-- /metric --> | <!-- metric:position.usageDecline.receivers.7.laterMean -->932.13<!-- /metric --> |
| v1-1.omni.hot.tg | <!-- metric:position.usageDecline.receivers.8.earlierMean -->1,323.35<!-- /metric --> | <!-- metric:position.usageDecline.receivers.8.laterMean -->0.18<!-- /metric --> |
| token.sweat | <!-- metric:position.usageDecline.receivers.9.earlierMean -->1,304.23<!-- /metric --> | <!-- metric:position.usageDecline.receivers.9.laterMean -->330.02<!-- /metric --> |

This identifies where measured activity disappeared, not why a person stopped using a product. Deployment evidence verifies which receiver names can be shown as public contracts, not that their activity is organic. The unnamed receiver has no verified contract-code evidence. Everyone else still includes bots, reward programs, relayers and other concentrated activity. It is not an organic-user control group.

Only the frozen receivers were extracted. Means outside that set, including the separately queried account noted as not extracted in the public export, and any activity break date remain unmeasured. No causal product explanation or unobserved account identity is inferred.

## What the price assumes (not official)

At the latest close, the end-window supply implies a market-cap proxy of $<!-- metric:position.priceAssumes.marketCap -->5,614,507,696.9<!-- /metric -->. Burn at weekly prices plus annualized gross outside receipts is $<!-- metric:position.priceAssumes.yearlyHolderCapture -->11,872,106.51<!-- /metric --> per year: a <!-- metric:position.priceAssumes.multiple -->472.92<!-- /metric -->× multiple, or <!-- metric:position.priceAssumes.yield -->0.21%<!-- /metric --> per year. Gross receipts are a capture proxy, not proof of retention or a cash distribution to investors.

Hold that market cap constant through the end of 2031. The following capture-yield targets are inputs, not findings or forecasts. Required growth is the compound annual rate from the model's November 2026 start, not a price-return prediction.

| Target capture yield input | Required annual capture | Annual capture growth required |
|---|---|---|
| <!-- metric:position.priceAssumes.targets.0.targetYield -->1.6%<!-- /metric --> | $<!-- metric:position.priceAssumes.targets.0.requiredCapture -->89,832,123.15<!-- /metric --> | <!-- metric:position.priceAssumes.targets.0.compoundYearlyGrowth -->47.95%<!-- /metric --> |
| <!-- metric:position.priceAssumes.targets.1.targetYield -->2.5%<!-- /metric --> | $<!-- metric:position.priceAssumes.targets.1.requiredCapture -->140,362,692.42<!-- /metric --> | <!-- metric:position.priceAssumes.targets.1.compoundYearlyGrowth -->61.3%<!-- /metric --> |
| <!-- metric:position.priceAssumes.targets.2.targetYield -->5%<!-- /metric --> | $<!-- metric:position.priceAssumes.targets.2.requiredCapture -->280,725,384.84<!-- /metric --> | <!-- metric:position.priceAssumes.targets.2.compoundYearlyGrowth -->84.45%<!-- /metric --> |

## Scenarios, inputs not probabilities (not official)

Bear and Bull independently annualize the weakest and strongest rolling 13-week net-buying and outside-receipt windows, respectively. Their buying and receipt extrema need not occur together. Base keeps final measured annual net buying and annualizes all observed receipts. Growth in buying is zero in each scenario, price stays at the latest close, burn and realized issuance share remain fixed. There are no assigned probabilities.

Scenario receipts are annualized NEAR valued at the latest close. This differs from the model page's initial annualized historical USD receipts, which use each week's price; pressing a scenario button must load the scenario's own inputs.

| Input or 2031 output | Bear | Base | Bull |
|---|---|---|---|
| Issuance rule | 2.5% cap | HSP-029 | HSP-029 |
| Annual net buying | $<!-- metric:position.scenarios.bear.inputs.yearlyNetBuying -->-12,332,694.07<!-- /metric --> | $<!-- metric:position.scenarios.base.inputs.yearlyNetBuying -->52,082,185.45<!-- /metric --> | $<!-- metric:position.scenarios.bull.inputs.yearlyNetBuying -->139,432,214.81<!-- /metric --> |
| Annualized receipts at latest close | $<!-- metric:position.scenarios.bear.inputs.yearlyBuybacks -->13,931,523.81<!-- /metric --> | $<!-- metric:position.scenarios.base.inputs.yearlyBuybacks -->19,340,920.53<!-- /metric --> | $<!-- metric:position.scenarios.bull.inputs.yearlyBuybacks -->24,273,938.52<!-- /metric --> |
| 2031 coverage | <!-- metric:position.scenarios.bear.years.4.coverage -->2.4%<!-- /metric --> | <!-- metric:position.scenarios.base.years.4.coverage -->75.89%<!-- /metric --> | <!-- metric:position.scenarios.bull.years.4.coverage -->171.09%<!-- /metric --> |
| 2031 net float change, NEAR | <!-- metric:position.scenarios.bear.years.4.netFloatChange -->35,536,331.64<!-- /metric --> | <!-- metric:position.scenarios.base.years.4.netFloatChange -->5,455,152.48<!-- /metric --> | <!-- metric:position.scenarios.bull.years.4.netFloatChange -->-16,086,175.09<!-- /metric --> |
| 2031 break-even price | $<!-- metric:position.scenarios.bear.years.4.breakEvenPrice -->0.04<!-- /metric --> | $<!-- metric:position.scenarios.base.years.4.breakEvenPrice -->3.23<!-- /metric --> | $<!-- metric:position.scenarios.bull.years.4.breakEvenPrice -->7.4<!-- /metric --> |

The Bear input is net selling, not a zero-demand placeholder. The model counts buying and buybacks as float absorption, not token destruction. HSP-029 is conditional; review its veto status before treating the cut as operative.

**Peer comparison is out of scope.** A defensible comparison requires matched supply, revenue, staking, activity and valuation sources not used here. No relative-value claim is made.

## Check 1. Final net NEAR buying

**Locked rule:** over the 52 T3 weeks, buys are successful 1Click input USD into the defined NEAR/wNEAR assets from other assets; sells are input USD out of them. Exclude NEAR-to-NEAR swaps. Leave missing USD out and count it. Exclude buys to the three revenue wallets and sells whose senders include one. Divide final net buying by weekly-price issuance value. Pass at 20% or more. Asset definitions and exclusions are in `docs/position-rule.md` and addendum 1.

**Result: PASS.** Buys of $<!-- metric:position.check1.final.buysUsd -->153,513,711.49<!-- /metric --> across <!-- metric:position.check1.final.buyRows -->308,117<!-- /metric --> rows minus sells of $<!-- metric:position.check1.final.sellsUsd -->101,431,526.04<!-- /metric --> across <!-- metric:position.check1.final.sellRows -->348,887<!-- /metric --> rows give $<!-- metric:position.check1.final.netUsd -->52,082,185.45<!-- /metric -->, or <!-- metric:position.check1.coverage -->77.75%<!-- /metric --> of $<!-- metric:position.check1.issuanceUsd -->66,987,430.78<!-- /metric --> issuance value. Missing-USD rows: <!-- metric:position.check1.final.missingUsdRows -->0<!-- /metric -->. The wallet exclusion removed <!-- metric:position.check1.excluded.buyRows -->0<!-- /metric --> buy rows and <!-- metric:position.check1.excluded.sellRows -->0<!-- /metric --> sell rows, so final and provisional totals agree.

**Call with and without Check 1, not official sensitivity:** with its locked pass the call is <!-- metric:position.call.result -->Not yet<!-- /metric -->; treating Check 1 as not passing still gives Not yet because both other position checks fail. This does not amend the rule.

**Price sensitivity, not official:** the official denominator uses each week's issuance times its mean close, equivalent to an issuance-weighted price of $<!-- metric:position.whatYouMustBelieve.prices.issuanceWeightedMean -->2.09<!-- /metric -->. Revalue the same issued NEAR at the latest close of $<!-- metric:position.latestClose -->4.284<!-- /metric --> and coverage falls to <!-- metric:position.check1.latestPriceCoverage -->37.85%<!-- /metric -->. This changes no official check.

### Concentration (after-the-fact, not official)

Buyer identity is the recipient; seller identity is the first sender, otherwise refundTo. There are <!-- metric:position.descriptive.concentration.netBuyers -->48,048<!-- /metric --> net buyers and <!-- metric:position.descriptive.concentration.netSellers -->83,482<!-- /metric --> net sellers. Removing the three largest net buyers leaves $<!-- metric:position.descriptive.concentration.withoutTopNetBuyers.3.netUsd -->1,778,868.7<!-- /metric -->, or <!-- metric:position.concentration.withoutTopNetBuyers.3.coverage -->2.66%<!-- /metric --> of issuance value. Those three accounts therefore made up <!-- metric:position.top3Share -->96.6%<!-- /metric --> of the original net total, not that share of all gross buys or unique people.

| Exclusion | Net USD | Issuance-value coverage |
|---|---|---|
| Largest net buyer | $<!-- metric:position.descriptive.concentration.withoutTopNetBuyers.1.netUsd -->24,869,647.75<!-- /metric --> | <!-- metric:position.concentration.withoutTopNetBuyers.1.coverage -->37.13%<!-- /metric --> |
| Three largest net buyers | $<!-- metric:position.descriptive.concentration.withoutTopNetBuyers.3.netUsd -->1,778,868.7<!-- /metric --> | <!-- metric:position.concentration.withoutTopNetBuyers.3.coverage -->2.66%<!-- /metric --> |
| Ten largest net buyers | $<!-- metric:position.descriptive.concentration.withoutTopNetBuyers.10.netUsd -->-11,969,197.07<!-- /metric --> | <!-- metric:position.concentration.withoutTopNetBuyers.10.coverage -->-17.87%<!-- /metric --> |
| Three largest on each side | $<!-- metric:position.descriptive.concentration.withoutTopNetBuyersAndSellers.3.netUsd -->8,621,054.76<!-- /metric --> | <!-- metric:position.concentration.withoutTopNetBuyersAndSellers.3.coverage -->12.87%<!-- /metric --> |
| Ten largest on each side | $<!-- metric:position.descriptive.concentration.withoutTopNetBuyersAndSellers.10.netUsd -->4,640,235.16<!-- /metric --> | <!-- metric:position.concentration.withoutTopNetBuyersAndSellers.10.coverage -->6.93%<!-- /metric --> |

Median total buying per account with any buy was $<!-- metric:position.descriptive.concentration.medianBuyerTotalUsd -->0.91<!-- /metric --> across <!-- metric:position.descriptive.concentration.buyersWithAnyBuy -->63,558<!-- /metric --> such accounts. It is not median net buying. These descriptive cuts were added after the result and do not alter the pass.

### Sender coverage and descriptive cuts (not official)

Senders were present on <!-- metric:position.sender.rowsPercent -->64.34%<!-- /metric --> of sell rows, covering <!-- metric:position.sender.usdPercent -->35.44%<!-- /metric --> of sell USD. A refund address is not necessarily the sender. Revenue-wallet refundTo-only sells absent from senders: <!-- metric:position.check1.refundToRevenueWalletNotSender.sells -->0<!-- /metric -->. Incomplete sender coverage limits account-level exclusion certainty even though observed wallet hits removed nothing.

Removing accounts that both received a buy and sent a sell leaves $<!-- metric:position.descriptive.twoWaySenders.netUsd -->29,971,625.45<!-- /metric -->, or <!-- metric:position.descriptive.twoWaySenders.coverage -->44.74%<!-- /metric -->, after excluding <!-- metric:position.descriptive.twoWaySenders.accounts -->18,333<!-- /metric --> two-way accounts. The after-the-fact refundTo-as-sender variant excludes <!-- metric:position.descriptive.twoWayRefundTo.accounts -->27,546<!-- /metric --> accounts and leaves $<!-- metric:position.descriptive.twoWayRefundTo.netUsd -->33,811,582.23<!-- /metric -->, or <!-- metric:position.descriptive.twoWayRefundTo.coverage -->50.47%<!-- /metric -->. Neither is the official result.

The exchange-recipient cut uses <!-- metric:position.descriptive.exchange.labeledAccounts -->17<!-- /metric --> publicly labeled accounts with pinned provenance in `exchange-labels.json`. It removes <!-- metric:position.descriptive.exchange.removedBuyRows -->0<!-- /metric --> buys and <!-- metric:position.descriptive.exchange.removedSellRows -->0<!-- /metric --> sells, leaving <!-- metric:position.descriptive.exchange.coverage -->77.75%<!-- /metric -->. This partial list does not establish that no exchange activity exists.

Lead/follow uses weekly net flows and weekly price changes at the locked lags. A direction must reach correlation 0.30 and exceed the reverse by 0.15 at two or more lags. Flow leads at <!-- metric:position.descriptive.leadOrFollow.flowLeadLags -->0<!-- /metric --> qualifying lags and price at <!-- metric:position.descriptive.leadOrFollow.priceLeadLags -->1<!-- /metric -->: <!-- metric:position.descriptive.leadOrFollow.result -->can't tell<!-- /metric -->. The full correlation pairs remain in the evidence table; correlation is not causation.

Across the same supply window, NEAR was on one side of only <!-- metric:position.oneClick.nearPercent -->2.07%<!-- /metric --> of 1Click input volume: $<!-- metric:position.oneClick.nearMillions -->254.9<!-- /metric --> million of $<!-- metric:position.oneClick.totalBillions -->12.34<!-- /metric --> billion. This excludes NEAR-to-NEAR from the numerator, counts input USD once, and does not measure all Intents activity.

## Check 2. Burn plus outside revenue-wallet receipts

**Locked rule:** for the 36 complete weeks from 2026-02-23 through 2026-11-01, add native NEAR/wNEAR received from outside the three named wallets to T3-defined burn, then divide by issuance. Exclude internal moves, failed transfers and unwrap/system returns. Pass at 20% or more.

**Result: FAIL.** Burn of <!-- metric:position.check2.burnedNear -->239,869.61<!-- /metric --> NEAR plus receipts of <!-- metric:position.check2.receivedNear -->3,125,552.77<!-- /metric --> NEAR against <!-- metric:position.check2.issuedNear -->22,320,954.38<!-- /metric --> issued gives <!-- metric:position.check2.coveragePercent -->15.08%<!-- /metric -->. Receipt value at weekly prices is $<!-- metric:position.check2.receivedUsd -->7,547,226.28<!-- /metric -->. Buyback receipts are the larger channel, but adding them still does not meet the bar.

Wallet receipt amounts and individual holdings are in the holder ledger. They are not all burned. DefiLlama's holders-revenue comparison totals $<!-- metric:position.check2.holdersRevenueComparison.defillamaUsd -->7,544,164.05<!-- /metric --> for the same weeks, versus $<!-- metric:position.check2.receivedUsd -->7,547,226.28<!-- /metric --> in this ledger. Agreement is a useful cross-check, not independent proof of each receipt's economic origin. Rounding and classification limits remain.

The wallet histories reconcile to the separately pinned balances within the locked tolerance after counting transfers among the wallets. Native TRANSFER amounts, external sends and internal moves remain distinct. Function-call deposits are not revenue receipts under this rule. `position-results.json` retains both literal and corrected reconciliation gaps.

## Check 3. Usage outside the frozen top ten

**Locked rule:** compare mean daily everyone_else signers for 2025-11-01 through 2026-10-31 with 2024-11-01 through 2025-10-31. The earlier receiver ranking stays frozen. Pass at growth of 20% or more.

**Result: FAIL.** Mean daily everyone_else signers rose from <!-- metric:position.check3.prior.mean -->14,580.39<!-- /metric --> to <!-- metric:position.check3.latest.mean -->16,705.96<!-- /metric -->, growth of <!-- metric:position.check3.growthPercent -->14.58%<!-- /metric -->. The exclusive daily groups reconcile to the original daily signer totals. This is a narrower improvement amid the headline decline, but below the bar and not a count of organic users.

Only Check 1 passes. The locked position call is **<!-- metric:position.call.result -->Not yet<!-- /metric -->**. Checks 1–3 supplement rather than replace the original tests below.

## Original claims and supporting evidence

| Original test | Claim | Unchanged result |
|---|---|---|
| T1 | Usage is broadening | <!-- metric:t1.verdict -->FAIL<!-- /metric --> |
| T3 | Usage reaches holders through fee burn | <!-- metric:t3.verdict -->FAIL<!-- /metric --> |
| T2, supporting evidence | 1Click volume leads usage better than price | <!-- metric:t2.verdict -->CAN'T TELL<!-- /metric --> |

1Click's latest 13 complete weeks handled <!-- metric:oneClick.latest.swaps -->2,005,609<!-- /metric --> successful swaps and $<!-- metric:oneClick.latest.volume -->3,804,396,974<!-- /metric --> input volume, compared with <!-- metric:oneClick.previous.swaps -->489,406<!-- /metric --> swaps and $<!-- metric:oneClick.previous.volume -->821,906,590<!-- /metric --> a year earlier. Growth was <!-- metric:oneClick.swaps.change -->+309.8%<!-- /metric --> and <!-- metric:oneClick.volume.change -->+362.9%<!-- /metric -->, respectively. This descriptive growth is not evidence of proportional NEAR-token demand.

T1 breadth changes were <!-- metric:t1.signers.change -->-73.1%<!-- /metric --> in mean daily signers, <!-- metric:t1.receivers.change -->-38.5%<!-- /metric --> in sampled receiver accounts and <!-- metric:t1.accounts2.change -->-66%<!-- /metric --> in monthly accounts active on multiple days. Transaction concentration fell only <!-- metric:presentation.top10Decline -->1.12 pp<!-- /metric -->, from <!-- metric:t1.top10.previous -->80.47%<!-- /metric --> to <!-- metric:t1.top10.latest -->79.35%<!-- /metric -->.

## T1. Usage is broadening

**Rule.** Compare the latest 12 complete months (2025-11-01 to 2026-10-31) with the preceding 12 (2024-11-01 to 2025-10-31).
Pass if mean daily signers, mean receiver accounts (one-day-a-week sample) and mean monthly accounts active on 2 or more days each rise by at least 20%, AND the top-10 signers' share of transactions falls by at least 5 percentage points. Fail if any breadth measure falls by 10% or more, or top-10 share rises by 5 points or more. Otherwise can't tell.

**Result: <!-- metric:t1.verdict -->FAIL<!-- /metric -->.** All three breadth measures contracted. A small decline in transaction concentration does not offset that contraction under the stated rule. These are account-level activity proxies, not counts of people or evidence that every NEAR application is shrinking.

Top-10 share uses the largest signers across each full 12-month period, not an average of daily top-10 shares.

## T3. Usage reaches holders through burn

**Rule.** For the latest 52 complete weeks (2025-11-03 to 2026-11-01), gross new supply = change in `blocks.total_supply` + burn. Burn is the sum of block-to-block falls in supply; issuance is the sum of rises. Offset share = burn / gross new supply. Pass if the total offset is at least 20% and at least 39 weeks have offset at least 10%. Fail if the total offset is at most 5% and at least 39 weeks have offset at most 5%. Otherwise can't tell.

**Result: <!-- metric:t3.verdict -->FAIL<!-- /metric -->.** The observed offset is <!-- metric:t3.offset -->1.56%<!-- /metric -->. In this window, this channel of holder value capture is small relative to issuance. That does not price other possible sources of token demand.

**Post-observation reconciliation rule.** After observing the <!-- metric:t3.gap -->-18.32%<!-- /metric --> gap between supply falls and recorded burn fields, we investigated nearcore and added the −30% to +5% tolerance for blocks before protocol 87. This was not a pre-registered tolerance and should not be presented as one. The original ±5% check remains for protocol 87 and later. A week spanning activation is unresolved rather than assigned either band. Reconciliation is grouped by protocol band; the investment pass/fail thresholds did not change.

nearcore commit `8b42edf6d3ca9f3b803b09ddc22daea92c9d2177` copies `tx_burnt_amount` into outcome `tokens_burnt` before subtracting the contract's `receiver_reward` (`runtime/runtime/src/lib.rs`, lines 1141 and 1160). The chunk's `total_balance_burnt` uses the reduced amount, plus other and slashed burns, minus `subsidized_amount` (`chain/chain/src/runtime/mod.rs`, lines 408–424). Recorded burn fields therefore include contract rewards. `parameters.yaml` sets `burnt_gas_reward` to 3/10, and `87.yaml` changes it to 0/1.

Archival FastNear RPC identified the last protocol-86 block as 223,012,336 at 2026-11-04T11:46:28Z and the first protocol-87 block as 223,012,337 at 2026-11-04T11:46:29.014Z. All weeks in this analysis end before activation.

Burn is one channel of holder value capture, not the whole case. Outside wallet receipts are larger in the observed wallet window; see Check 2 for their combined coverage. Receipts held in controlled wallets are not burned supply.

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

**Disclosed feature of the fixed start.** The start week is an isolated early spike of <!-- metric:t2.startSwaps -->8,568<!-- /metric --> swaps. The following <!-- metric:t2.weeksBelowMinAfterStart -->15<!-- /metric --> weeks fall below 7,000 swaps, and the next week at or above 7,000 is <!-- metric:t2.nextWeekAtMin -->2025-08-04<!-- /metric -->. As the rule specifies, those weeks stay in the official test.

### T2 sensitivity check (not official)

**This is a sensitivity check, added after the official result was seen. It does not change the official T2 result, which stays <!-- metric:t2.verdict -->CAN'T TELL<!-- /metric -->.** The owner approved it, and its design was fixed before it was computed. It starts at <!-- metric:t2sens.start -->2025-08-04<!-- /metric -->, the first week of the unbroken run at or above 7,000 swaps; <!-- metric:t2sens.weeksBelowMin -->0<!-- /metric --> weeks from there fall below 7,000. Everything else follows the official method: the same weekly changes, lags of 1, 2, 4 and 8 weeks, 4-week blocks, 10,000 resamples, seed 20261108 plus the lag, and the 52-change minimum. Week 2026-02-02 stays unavailable under the same rule, which leaves <!-- metric:t2sens.changes -->62<!-- /metric --> weekly changes.

| Lag | Pairs | r volume | r price | Advantage | First half (r volume / r price) | Second half (r volume / r price) | 90% interval | Favours |
|---|---|---|---|---|---|---|---|---|
| 1 | <!-- metric:t2sens.lag1.pairs -->61<!-- /metric --> | <!-- metric:t2sens.lag1.rv -->0.017<!-- /metric --> | <!-- metric:t2sens.lag1.rp -->0.293<!-- /metric --> | <!-- metric:t2sens.lag1.advantage -->-0.276<!-- /metric --> | <!-- metric:t2sens.lag1.half1.rv -->0.019<!-- /metric --> / <!-- metric:t2sens.lag1.half1.rp -->-0.153<!-- /metric --> | <!-- metric:t2sens.lag1.half2.rv -->0.023<!-- /metric --> / <!-- metric:t2sens.lag1.half2.rp -->0.532<!-- /metric --> | <!-- metric:t2sens.lag1.ci.low -->-0.643<!-- /metric --> to <!-- metric:t2sens.lag1.ci.high -->0.285<!-- /metric --> | <!-- metric:t2sens.lag1.favours -->neither<!-- /metric --> |
| 2 | <!-- metric:t2sens.lag2.pairs -->60<!-- /metric --> | <!-- metric:t2sens.lag2.rv -->0.075<!-- /metric --> | <!-- metric:t2sens.lag2.rp -->0.048<!-- /metric --> | <!-- metric:t2sens.lag2.advantage -->0.028<!-- /metric --> | <!-- metric:t2sens.lag2.half1.rv -->0.008<!-- /metric --> / <!-- metric:t2sens.lag2.half1.rp -->-0.371<!-- /metric --> | <!-- metric:t2sens.lag2.half2.rv -->0.181<!-- /metric --> / <!-- metric:t2sens.lag2.half2.rp -->0.295<!-- /metric --> | <!-- metric:t2sens.lag2.ci.low -->-0.243<!-- /metric --> to <!-- metric:t2sens.lag2.ci.high -->0.404<!-- /metric --> | <!-- metric:t2sens.lag2.favours -->neither<!-- /metric --> |
| 4 | <!-- metric:t2sens.lag4.pairs -->58<!-- /metric --> | <!-- metric:t2sens.lag4.rv -->0.016<!-- /metric --> | <!-- metric:t2sens.lag4.rp -->0.003<!-- /metric --> | <!-- metric:t2sens.lag4.advantage -->0.013<!-- /metric --> | <!-- metric:t2sens.lag4.half1.rv -->0.149<!-- /metric --> / <!-- metric:t2sens.lag4.half1.rp -->0.268<!-- /metric --> | <!-- metric:t2sens.lag4.half2.rv -->-0.295<!-- /metric --> / <!-- metric:t2sens.lag4.half2.rp -->-0.142<!-- /metric --> | <!-- metric:t2sens.lag4.ci.low -->-0.293<!-- /metric --> to <!-- metric:t2sens.lag4.ci.high -->0.252<!-- /metric --> | <!-- metric:t2sens.lag4.favours -->neither<!-- /metric --> |
| 8 | <!-- metric:t2sens.lag8.pairs -->54<!-- /metric --> | <!-- metric:t2sens.lag8.rv -->-0.153<!-- /metric --> | <!-- metric:t2sens.lag8.rp -->-0.194<!-- /metric --> | <!-- metric:t2sens.lag8.advantage -->0.041<!-- /metric --> | <!-- metric:t2sens.lag8.half1.rv -->-0.096<!-- /metric --> / <!-- metric:t2sens.lag8.half1.rp -->-0.229<!-- /metric --> | <!-- metric:t2sens.lag8.half2.rv -->-0.343<!-- /metric --> / <!-- metric:t2sens.lag8.half2.rp -->-0.174<!-- /metric --> | <!-- metric:t2sens.lag8.ci.low -->-0.172<!-- /metric --> to <!-- metric:t2sens.lag8.ci.high -->0.25<!-- /metric --> | <!-- metric:t2sens.lag8.favours -->neither<!-- /metric --> |

**The same pass and fail lines on this window would give <!-- metric:t2sens.ruleOutcome -->CAN'T TELL<!-- /metric --> (not official).** No lag favours volume or price.

**How it differs from the official test:**

- At lag 8, the official 90% interval was above zero (<!-- metric:t2.lag8.ci.low -->0.02<!-- /metric --> to <!-- metric:t2.lag8.ci.high -->0.304<!-- /metric -->). Here it includes zero (<!-- metric:t2sens.lag8.ci.low -->-0.172<!-- /metric --> to <!-- metric:t2sens.lag8.ci.high -->0.25<!-- /metric -->).
- At lag 1, price beat volume in both halves in the official test. Here volume is ahead in the first half (<!-- metric:t2sens.lag1.half1.rv -->0.019<!-- /metric --> against <!-- metric:t2sens.lag1.half1.rp -->-0.153<!-- /metric -->), and price is ahead in the second (<!-- metric:t2sens.lag1.half2.rp -->0.532<!-- /metric --> against <!-- metric:t2sens.lag1.half2.rv -->0.023<!-- /metric -->).
- At lag 2, the halves reverse: officially price led the first half and volume the second; here volume leads the first (<!-- metric:t2sens.lag2.half1.rv -->0.008<!-- /metric --> against <!-- metric:t2sens.lag2.half1.rp -->-0.371<!-- /metric -->) and price the second (<!-- metric:t2sens.lag2.half2.rp -->0.295<!-- /metric --> against <!-- metric:t2sens.lag2.half2.rv -->0.181<!-- /metric -->). At lag 4, officially volume led the first half; here price leads both halves (<!-- metric:t2sens.lag4.half1.rp -->0.268<!-- /metric --> against <!-- metric:t2sens.lag4.half1.rv -->0.149<!-- /metric -->, and <!-- metric:t2sens.lag4.half2.rp -->-0.142<!-- /metric --> against <!-- metric:t2sens.lag4.half2.rv -->-0.295<!-- /metric -->), but its overall margin is too small for a price win.
- The window is shorter: <!-- metric:t2sens.changes -->62<!-- /metric --> weekly changes against <!-- metric:t2.changes -->78<!-- /metric --> officially.
- The highest volume correlation here is <!-- metric:t2sens.lag2.rv -->0.075<!-- /metric --> at lag 2. In the official test it was <!-- metric:t2.lag4.rv -->0.013<!-- /metric --> at lag 4. Both are far below 0.30.

The outcome matches the official result. The official interpretation above is unchanged.

The feed covers **1Click only**, not all NEAR Intents. The first successful swap observed in the feed is dated 2025-03-27. Weekly input USD volume is not protocol revenue and does not establish demand for the NEAR token.

## Disclosures and chronology

- The position rule was written after the T1–T3 results and press buyback figures were known. It is not a pre-result registration of the original thesis. Addendum 1 followed the first Check 1 total; addendum 2 preceded the final checks and descriptive cuts but followed the preliminary results and current wallet balances. The rule files and their timestamp proofs are unchanged. Addendum 2's Bitcoin timestamp upgrade remains pending.
- `signer_split.sql` was rewritten after a memory-exhaustion failure, with no full result seen. The <!-- metric:position.audit.sampleDays -->4<!-- /metric -->-day sample and comparison checked <!-- metric:position.audit.sampleRows -->18,503,984<!-- /metric --> rows with <!-- metric:position.audit.sampleDifferences -->0<!-- /metric --> differences. This is a query-equivalence check, not independent confirmation of economic meaning; see `docs/query-changes.md`.
- Wallet receipts came from NEARBlocks because the proposed BigQuery wallet scan projected <!-- metric:position.audit.walletScanProjectedGb -->1,053<!-- /metric --> GB, above the owner-approved gate. That scan was not run. NEARBlocks has already rounded many amounts; exact original yocto precision cannot be restored. The public reconciliation is a control, not a complete audit of revenue origin or key custody.
- The buyback-wallet exclusion removed no observed rows. Incomplete sell-sender coverage means this should not be described as proof of perfect economic separation. The exchange-label list is partial, and a zero-removal cut is not proof of no exchange activity.
- Concentration and the refundTo-as-sender variant are after-the-fact descriptive cuts, not official. The holder ledger, capture-yield calculations and scenarios were added after the position results. They change no locked threshold or result. Model scenarios have no assigned probabilities.
- The frozen receiver export contains receiver-level means only for the selected cohort. Group attribution uses exclusive day counts, not overlapping receiver sums. Accounts are not people, and a deployed contract is not proof of organic demand.
- T3's post-observation burn reconciliation tolerance is disclosed in its section. Its investment pass/fail rule did not change. T2's sensitivity window remains explicitly not official.

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
| presentation.signersDecline | 73.1% |
| presentation.top10Decline | 1.12 pp |
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
| t2sens.start | 2025-08-04 |
| t2sens.weeksBelowMin | 0 |
| t2sens.changes | 62 |
| t2sens.ruleOutcome | CAN'T TELL |
| t2sens.lag1.pairs | 61 |
| t2sens.lag1.rv | 0.017 |
| t2sens.lag1.rp | 0.293 |
| t2sens.lag1.advantage | -0.276 |
| t2sens.lag1.half1.rv | 0.019 |
| t2sens.lag1.half1.rp | -0.153 |
| t2sens.lag1.half2.rv | 0.023 |
| t2sens.lag1.half2.rp | 0.532 |
| t2sens.lag1.ci.low | -0.643 |
| t2sens.lag1.ci.high | 0.285 |
| t2sens.lag1.favours | neither |
| t2sens.lag2.pairs | 60 |
| t2sens.lag2.rv | 0.075 |
| t2sens.lag2.rp | 0.048 |
| t2sens.lag2.advantage | 0.028 |
| t2sens.lag2.half1.rv | 0.008 |
| t2sens.lag2.half1.rp | -0.371 |
| t2sens.lag2.half2.rv | 0.181 |
| t2sens.lag2.half2.rp | 0.295 |
| t2sens.lag2.ci.low | -0.243 |
| t2sens.lag2.ci.high | 0.404 |
| t2sens.lag2.favours | neither |
| t2sens.lag4.pairs | 58 |
| t2sens.lag4.rv | 0.016 |
| t2sens.lag4.rp | 0.003 |
| t2sens.lag4.advantage | 0.013 |
| t2sens.lag4.half1.rv | 0.149 |
| t2sens.lag4.half1.rp | 0.268 |
| t2sens.lag4.half2.rv | -0.295 |
| t2sens.lag4.half2.rp | -0.142 |
| t2sens.lag4.ci.low | -0.293 |
| t2sens.lag4.ci.high | 0.252 |
| t2sens.lag4.favours | neither |
| t2sens.lag8.pairs | 54 |
| t2sens.lag8.rv | -0.153 |
| t2sens.lag8.rp | -0.194 |
| t2sens.lag8.advantage | 0.041 |
| t2sens.lag8.half1.rv | -0.096 |
| t2sens.lag8.half1.rp | -0.229 |
| t2sens.lag8.half2.rv | -0.343 |
| t2sens.lag8.half2.rp | -0.174 |
| t2sens.lag8.ci.low | -0.172 |
| t2sens.lag8.ci.high | 0.25 |
| t2sens.lag8.favours | neither |
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
| position.holderLedger.issued.near | 32,123,695.5 |
| position.holderLedger.issued.usd | 66,987,430.78 |
| position.holderLedger.issued.shareOfOpeningSupply | 2.51% |
| position.holderLedger.burned.near | 500,289.94 |
| position.holderLedger.burned.usd | 970,557.43 |
| position.holderLedger.burned.shareOfOpeningSupply | 0.04% |
| position.holderLedger.walletReceived.observed.near | 3,125,552.77 |
| position.holderLedger.walletReceived.observed.usd | 7,547,226.28 |
| position.holderLedger.walletReceived.observed.shareOfOpeningSupply | 0.24% |
| position.holderLedger.walletReceived.annualized.near | 4,514,687.33 |
| position.holderLedger.walletReceived.annualized.usd | 10,901,549.08 |
| position.holderLedger.walletReceived.annualized.shareOfOpeningSupply | 0.35% |
| position.holderLedger.netFloatChange.near | 28,554,888.79 |
| position.holderLedger.netFloatChange.usd | 58,555,562.06 |
| position.holderLedger.netFloatChange.shareOfOpeningSupply | 2.23% |
| position.holderLedger.nonStakerLossOfShare | 2.41% |
| position.holderLedger.staking.totalStakeNear | 581,798,949.62 |
| position.holderLedger.staking.treasuryShare | 0% |
| position.holderLedger.staking.grossYield | 5.52% |
| position.holderLedger.wallets.perWallet.0.received.near | 1,041,071.09 |
| position.holderLedger.wallets.perWallet.0.received.usd | 2,433,859.55 |
| position.holderLedger.wallets.perWallet.0.received.shareOfOpeningSupply | 0.08% |
| position.holderLedger.wallets.perWallet.0.sent.near | 0.5 |
| position.holderLedger.wallets.perWallet.0.sent.usd | 0.62 |
| position.holderLedger.wallets.perWallet.0.sent.shareOfOpeningSupply | 0% |
| position.holderLedger.wallets.perWallet.0.netRetained.near | 1,041,070.59 |
| position.holderLedger.wallets.perWallet.0.netRetained.usd | 2,433,858.93 |
| position.holderLedger.wallets.perWallet.0.netRetained.shareOfOpeningSupply | 0.08% |
| position.holderLedger.wallets.perWallet.0.currentBalance.near | 1,994,812.25 |
| position.holderLedger.wallets.perWallet.0.currentBalance.usd | 8,545,775.69 |
| position.holderLedger.wallets.perWallet.0.currentBalance.shareOfOpeningSupply | 0.16% |
| position.holderLedger.wallets.perWallet.0.boughtNearBurned | Unavailable |
| position.holderLedger.wallets.perWallet.1.received.near | 432,327.19 |
| position.holderLedger.wallets.perWallet.1.received.usd | 552,736.92 |
| position.holderLedger.wallets.perWallet.1.received.shareOfOpeningSupply | 0.03% |
| position.holderLedger.wallets.perWallet.1.sent.near | 45,010.5 |
| position.holderLedger.wallets.perWallet.1.sent.usd | 62,776.9 |
| position.holderLedger.wallets.perWallet.1.sent.shareOfOpeningSupply | 0% |
| position.holderLedger.wallets.perWallet.1.netRetained.near | 387,316.69 |
| position.holderLedger.wallets.perWallet.1.netRetained.usd | 489,960.02 |
| position.holderLedger.wallets.perWallet.1.netRetained.shareOfOpeningSupply | 0.03% |
| position.holderLedger.wallets.perWallet.1.currentBalance.near | 270.88 |
| position.holderLedger.wallets.perWallet.1.currentBalance.usd | 1,160.43 |
| position.holderLedger.wallets.perWallet.1.currentBalance.shareOfOpeningSupply | 0% |
| position.holderLedger.wallets.perWallet.1.boughtNearBurned | Unavailable |
| position.holderLedger.wallets.perWallet.2.received.near | 1,652,154.49 |
| position.holderLedger.wallets.perWallet.2.received.usd | 4,560,629.82 |
| position.holderLedger.wallets.perWallet.2.received.shareOfOpeningSupply | 0.13% |
| position.holderLedger.wallets.perWallet.2.sent.near | 12,025 |
| position.holderLedger.wallets.perWallet.2.sent.usd | 23,137.48 |
| position.holderLedger.wallets.perWallet.2.sent.shareOfOpeningSupply | 0% |
| position.holderLedger.wallets.perWallet.2.netRetained.near | 1,640,129.49 |
| position.holderLedger.wallets.perWallet.2.netRetained.usd | 4,537,492.34 |
| position.holderLedger.wallets.perWallet.2.netRetained.shareOfOpeningSupply | 0.13% |
| position.holderLedger.wallets.perWallet.2.currentBalance.near | 2,229,439.34 |
| position.holderLedger.wallets.perWallet.2.currentBalance.usd | 9,550,918.15 |
| position.holderLedger.wallets.perWallet.2.currentBalance.shareOfOpeningSupply | 0.17% |
| position.holderLedger.wallets.perWallet.2.boughtNearBurned | Unavailable |
| position.holderLedger.wallets.received.near | 3,125,552.77 |
| position.holderLedger.wallets.received.usd | 7,547,226.28 |
| position.holderLedger.wallets.received.shareOfOpeningSupply | 0.24% |
| position.holderLedger.wallets.sent.near | 57,036 |
| position.holderLedger.wallets.sent.usd | 85,915 |
| position.holderLedger.wallets.sent.shareOfOpeningSupply | 0% |
| position.holderLedger.wallets.netRetained.near | 3,068,516.77 |
| position.holderLedger.wallets.netRetained.usd | 7,461,311.29 |
| position.holderLedger.wallets.netRetained.shareOfOpeningSupply | 0.24% |
| position.holderLedger.wallets.currentBalance.near | 4,224,522.47 |
| position.holderLedger.wallets.currentBalance.usd | 18,097,854.27 |
| position.holderLedger.wallets.currentBalance.shareOfOpeningSupply | 0.33% |
| position.holderLedger.wallets.boughtNearBurned | Unavailable |
| position.whatYouMustBelieve.prices.issuanceWeightedMean | 2.09 |
| position.whatYouMustBelieve.prices.latest | 4.28 |
| position.whatYouMustBelieve.prices.halfLatest | 2.14 |
| position.whatYouMustBelieve.rules.0.cut | 0 |
| position.whatYouMustBelieve.rules.0.prices.0.year | 2,031 |
| position.whatYouMustBelieve.rules.0.prices.0.price | 2.09 |
| position.whatYouMustBelieve.rules.0.prices.0.buyingNeededUsd | 74,882,041.69 |
| position.whatYouMustBelieve.rules.0.prices.0.multipleOfMeasuredBuying | 1.44 |
| position.whatYouMustBelieve.rules.0.prices.1.year | 2,031 |
| position.whatYouMustBelieve.rules.0.prices.1.price | 4.28 |
| position.whatYouMustBelieve.rules.0.prices.1.buyingNeededUsd | 153,836,474.5 |
| position.whatYouMustBelieve.rules.0.prices.1.multipleOfMeasuredBuying | 2.95 |
| position.whatYouMustBelieve.rules.0.prices.2.year | 2,031 |
| position.whatYouMustBelieve.rules.0.prices.2.price | 2.14 |
| position.whatYouMustBelieve.rules.0.prices.2.buyingNeededUsd | 76,918,237.25 |
| position.whatYouMustBelieve.rules.0.prices.2.multipleOfMeasuredBuying | 1.48 |
| position.whatYouMustBelieve.rules.1.cut | 1 |
| position.whatYouMustBelieve.rules.1.prices.0.year | 2,031 |
| position.whatYouMustBelieve.rules.1.prices.0.price | 2.09 |
| position.whatYouMustBelieve.rules.1.prices.0.buyingNeededUsd | 46,141,799.89 |
| position.whatYouMustBelieve.rules.1.prices.0.multipleOfMeasuredBuying | 0.89 |
| position.whatYouMustBelieve.rules.1.prices.1.year | 2,031 |
| position.whatYouMustBelieve.rules.1.prices.1.price | 4.28 |
| position.whatYouMustBelieve.rules.1.prices.1.buyingNeededUsd | 94,792,979.23 |
| position.whatYouMustBelieve.rules.1.prices.1.multipleOfMeasuredBuying | 1.82 |
| position.whatYouMustBelieve.rules.1.prices.2.year | 2,031 |
| position.whatYouMustBelieve.rules.1.prices.2.price | 2.14 |
| position.whatYouMustBelieve.rules.1.prices.2.buyingNeededUsd | 47,396,489.61 |
| position.whatYouMustBelieve.rules.1.prices.2.multipleOfMeasuredBuying | 0.91 |
| position.priceAssumes.marketCap | 5,614,507,696.9 |
| position.priceAssumes.yearlyHolderCapture | 11,872,106.51 |
| position.priceAssumes.multiple | 472.92 |
| position.priceAssumes.yield | 0.21% |
| position.priceAssumes.targets.0.targetYield | 1.6% |
| position.priceAssumes.targets.0.yearsTo2031 | 5.17 |
| position.priceAssumes.targets.0.requiredCapture | 89,832,123.15 |
| position.priceAssumes.targets.0.compoundYearlyGrowth | 47.95% |
| position.priceAssumes.targets.1.targetYield | 2.5% |
| position.priceAssumes.targets.1.yearsTo2031 | 5.17 |
| position.priceAssumes.targets.1.requiredCapture | 140,362,692.42 |
| position.priceAssumes.targets.1.compoundYearlyGrowth | 61.3% |
| position.priceAssumes.targets.2.targetYield | 5% |
| position.priceAssumes.targets.2.yearsTo2031 | 5.17 |
| position.priceAssumes.targets.2.requiredCapture | 280,725,384.84 |
| position.priceAssumes.targets.2.compoundYearlyGrowth | 84.45% |
| position.scenarios.bear.buyingWindow.total | -3,083,173.52 |
| position.scenarios.bear.receiptsWindow.total | 812,997.42 |
| position.scenarios.bear.years.0.year | 2,027 |
| position.scenarios.bear.years.0.coverage | 2.65% |
| position.scenarios.bear.years.0.netFloatChange | 32,146,716.99 |
| position.scenarios.bear.years.0.breakEvenPrice | 0.05 |
| position.scenarios.bear.years.1.year | 2,028 |
| position.scenarios.bear.years.1.coverage | 2.58% |
| position.scenarios.bear.years.1.netFloatChange | 32,962,878.23 |
| position.scenarios.bear.years.1.breakEvenPrice | 0.05 |
| position.scenarios.bear.years.2.year | 2,029 |
| position.scenarios.bear.years.2.coverage | 2.52% |
| position.scenarios.bear.years.2.netFloatChange | 33,799,522.88 |
| position.scenarios.bear.years.2.breakEvenPrice | 0.05 |
| position.scenarios.bear.years.3.year | 2,030 |
| position.scenarios.bear.years.3.coverage | 2.46% |
| position.scenarios.bear.years.3.netFloatChange | 34,657,165.03 |
| position.scenarios.bear.years.3.breakEvenPrice | 0.05 |
| position.scenarios.bear.years.4.year | 2,031 |
| position.scenarios.bear.years.4.coverage | 2.4% |
| position.scenarios.bear.years.4.netFloatChange | 35,536,331.64 |
| position.scenarios.bear.years.4.breakEvenPrice | 0.04 |
| position.scenarios.base.years.0.year | 2,027 |
| position.scenarios.base.years.0.coverage | 55.51% |
| position.scenarios.base.years.0.netFloatChange | 13,762,147.12 |
| position.scenarios.base.years.0.breakEvenPrice | 2.35 |
| position.scenarios.base.years.1.year | 2,028 |
| position.scenarios.base.years.1.coverage | 67.06% |
| position.scenarios.base.years.1.netFloatChange | 8,433,468.56 |
| position.scenarios.base.years.1.breakEvenPrice | 2.84 |
| position.scenarios.base.years.2.year | 2,029 |
| position.scenarios.base.years.2.coverage | 77.98% |
| position.scenarios.base.years.2.netFloatChange | 4,848,831.18 |
| position.scenarios.base.years.2.breakEvenPrice | 3.32 |
| position.scenarios.base.years.3.year | 2,030 |
| position.scenarios.base.years.3.coverage | 77.08% |
| position.scenarios.base.years.3.netFloatChange | 5,106,767.6 |
| position.scenarios.base.years.3.breakEvenPrice | 3.28 |
| position.scenarios.base.years.4.year | 2,031 |
| position.scenarios.base.years.4.coverage | 75.89% |
| position.scenarios.base.years.4.netFloatChange | 5,455,152.48 |
| position.scenarios.base.years.4.breakEvenPrice | 3.23 |
| position.scenarios.bull.buyingWindow.total | 34,858,053.7 |
| position.scenarios.bull.receiptsWindow.total | 1,416,546.37 |
| position.scenarios.bull.years.0.year | 2,027 |
| position.scenarios.bull.years.0.coverage | 125.15% |
| position.scenarios.bull.years.0.netFloatChange | -7,779,180.46 |
| position.scenarios.bull.years.0.breakEvenPrice | 5.38 |
| position.scenarios.bull.years.1.year | 2,028 |
| position.scenarios.bull.years.1.coverage | 151.19% |
| position.scenarios.bull.years.1.netFloatChange | -13,107,859.02 |
| position.scenarios.bull.years.1.breakEvenPrice | 6.52 |
| position.scenarios.bull.years.2.year | 2,029 |
| position.scenarios.bull.years.2.coverage | 175.8% |
| position.scenarios.bull.years.2.netFloatChange | -16,692,496.4 |
| position.scenarios.bull.years.2.breakEvenPrice | 7.61 |
| position.scenarios.bull.years.3.year | 2,030 |
| position.scenarios.bull.years.3.coverage | 173.77% |
| position.scenarios.bull.years.3.netFloatChange | -16,434,559.98 |
| position.scenarios.bull.years.3.breakEvenPrice | 7.52 |
| position.scenarios.bull.years.4.year | 2,031 |
| position.scenarios.bull.years.4.coverage | 171.09% |
| position.scenarios.bull.years.4.netFloatChange | -16,086,175.09 |
| position.scenarios.bull.years.4.breakEvenPrice | 7.4 |
| position.usageDecline.receivers.0.earlierMean | 421,296.02 |
| position.usageDecline.receivers.0.laterMean | 124,774.34 |
| position.usageDecline.receivers.1.earlierMean | 81,627.89 |
| position.usageDecline.receivers.1.laterMean | 0.01 |
| position.usageDecline.receivers.2.earlierMean | 16,371.44 |
| position.usageDecline.receivers.2.laterMean | 872.7 |
| position.usageDecline.receivers.3.earlierMean | 10,920.04 |
| position.usageDecline.receivers.3.laterMean | 1,919.88 |
| position.usageDecline.receivers.4.earlierMean | 2,952.35 |
| position.usageDecline.receivers.4.laterMean | 913.53 |
| position.usageDecline.receivers.5.earlierMean | 2,551.16 |
| position.usageDecline.receivers.5.laterMean | 0.12 |
| position.usageDecline.receivers.6.earlierMean | 1,783.45 |
| position.usageDecline.receivers.6.laterMean | 0.66 |
| position.usageDecline.receivers.7.earlierMean | 1,495.95 |
| position.usageDecline.receivers.7.laterMean | 932.13 |
| position.usageDecline.receivers.8.earlierMean | 1,323.35 |
| position.usageDecline.receivers.8.laterMean | 0.18 |
| position.usageDecline.receivers.9.earlierMean | 1,304.23 |
| position.usageDecline.receivers.9.laterMean | 330.02 |
| position.usageDecline.top10.earlier | 520,897.21 |
| position.usageDecline.top10.later | 127,150.61 |
| position.usageDecline.everyoneElse.earlier | 14,580.39 |
| position.usageDecline.everyoneElse.later | 16,705.96 |
| position.usageDecline.totalDrop | 391,621.04 |
| position.usageDecline.top10Drop | 393,746.6 |
| position.usageDecline.shareOfDropExplained | 100.54% |
| position.call.passing | 1 |
| position.call.result | Not yet |
| position.check1.issuanceUsd | 66,987,430.78 |
| position.check1.provisional.buysUsd | 153,513,711.49 |
| position.check1.provisional.sellsUsd | 101,431,526.04 |
| position.check1.provisional.netUsd | 52,082,185.45 |
| position.check1.provisional.buyRows | 308,117 |
| position.check1.provisional.sellRows | 348,887 |
| position.check1.provisional.missingUsdRows | 0 |
| position.check1.provisional.shareOfIssuanceValue | 0.78 |
| position.check1.final.buysUsd | 153,513,711.49 |
| position.check1.final.sellsUsd | 101,431,526.04 |
| position.check1.final.netUsd | 52,082,185.45 |
| position.check1.final.buyRows | 308,117 |
| position.check1.final.sellRows | 348,887 |
| position.check1.final.missingUsdRows | 0 |
| position.check1.final.shareOfIssuanceValue | 0.78 |
| position.check1.excluded.buyRows | 0 |
| position.check1.excluded.buysUsd | 0 |
| position.check1.excluded.sellRows | 0 |
| position.check1.excluded.sellsUsd | 0 |
| position.check1.senderCoverage.sells | 348,887 |
| position.check1.senderCoverage.withSenders | 224,485 |
| position.check1.senderCoverage.share | 0.64 |
| position.check1.senderCoverage.usdShare | 0.35 |
| position.check1.refundToRevenueWalletNotSender.sells | 0 |
| position.check1.refundToRevenueWalletNotSender.usd | 0 |
| position.check2.burnedNear | 239,869.61 |
| position.check2.issuedNear | 22,320,954.38 |
| position.check2.receivedNear | 3,125,552.77 |
| position.check2.coverage | 0.15 |
| position.check2.receivedUsd | 7,547,226.28 |
| position.check2.perWallet.0.receivedNear | 1,041,071.09 |
| position.check2.perWallet.0.receivedUsd | 2,433,859.55 |
| position.check2.perWallet.1.receivedNear | 432,327.19 |
| position.check2.perWallet.1.receivedUsd | 552,736.92 |
| position.check2.perWallet.2.receivedNear | 1,652,154.49 |
| position.check2.perWallet.2.receivedUsd | 4,560,629.82 |
| position.check2.holdersRevenueComparison.defillamaUsd | 7,544,164.05 |
| position.check2.holdersRevenueComparison.ledgerUsd | 7,547,226.28 |
| position.check2.holdersRevenueComparison.gapUsd | 3,062.23 |
| position.check2.holdersRevenueComparison.gapPercent | 0.04 |
| position.check3.prior.days | 365 |
| position.check3.prior.mean | 14,580.39 |
| position.check3.latest.days | 365 |
| position.check3.latest.mean | 16,705.96 |
| position.check3.growth | 0.15 |
| position.descriptive.twoWaySenders.accounts | 18,333 |
| position.descriptive.twoWaySenders.buysUsd | 106,630,568.3 |
| position.descriptive.twoWaySenders.sellsUsd | 76,658,942.85 |
| position.descriptive.twoWaySenders.netUsd | 29,971,625.45 |
| position.descriptive.twoWaySenders.buyRows | 107,532 |
| position.descriptive.twoWaySenders.sellRows | 194,823 |
| position.descriptive.twoWaySenders.missingUsdRows | 0 |
| position.descriptive.twoWaySenders.shareOfIssuanceValue | 0.45 |
| position.descriptive.twoWayRefundTo.accounts | 27,546 |
| position.descriptive.twoWayRefundTo.buysUsd | 67,272,445.56 |
| position.descriptive.twoWayRefundTo.sellsUsd | 33,460,863.33 |
| position.descriptive.twoWayRefundTo.netUsd | 33,811,582.23 |
| position.descriptive.twoWayRefundTo.buyRows | 63,942 |
| position.descriptive.twoWayRefundTo.sellRows | 107,047 |
| position.descriptive.twoWayRefundTo.missingUsdRows | 0 |
| position.descriptive.twoWayRefundTo.shareOfIssuanceValue | 0.5 |
| position.descriptive.exchange.labeledAccounts | 17 |
| position.descriptive.exchange.removedBuyRows | 0 |
| position.descriptive.exchange.removedSellRows | 0 |
| position.descriptive.exchange.buysUsd | 153,513,711.49 |
| position.descriptive.exchange.sellsUsd | 101,431,526.04 |
| position.descriptive.exchange.netUsd | 52,082,185.45 |
| position.descriptive.exchange.buyRows | 308,117 |
| position.descriptive.exchange.sellRows | 348,887 |
| position.descriptive.exchange.missingUsdRows | 0 |
| position.descriptive.exchange.shareOfIssuanceValue | 0.78 |
| position.descriptive.leadOrFollow.lags.0.lag | 1 |
| position.descriptive.leadOrFollow.lags.0.pairs | 51 |
| position.descriptive.leadOrFollow.lags.0.flowThenPrice | -0.05 |
| position.descriptive.leadOrFollow.lags.0.priceThenFlow | 0.3 |
| position.descriptive.leadOrFollow.lags.1.lag | 2 |
| position.descriptive.leadOrFollow.lags.1.pairs | 50 |
| position.descriptive.leadOrFollow.lags.1.flowThenPrice | -0.18 |
| position.descriptive.leadOrFollow.lags.1.priceThenFlow | 0.16 |
| position.descriptive.leadOrFollow.lags.2.lag | 4 |
| position.descriptive.leadOrFollow.lags.2.pairs | 48 |
| position.descriptive.leadOrFollow.lags.2.flowThenPrice | -0.21 |
| position.descriptive.leadOrFollow.lags.2.priceThenFlow | -0.06 |
| position.descriptive.leadOrFollow.lags.3.lag | 8 |
| position.descriptive.leadOrFollow.lags.3.pairs | 44 |
| position.descriptive.leadOrFollow.lags.3.flowThenPrice | -0.2 |
| position.descriptive.leadOrFollow.lags.3.priceThenFlow | -0.12 |
| position.descriptive.leadOrFollow.flowLeadLags | 0 |
| position.descriptive.leadOrFollow.priceLeadLags | 1 |
| position.descriptive.leadOrFollow.result | can't tell |
| position.descriptive.concentration.netBuyers | 48,048 |
| position.descriptive.concentration.netSellers | 83,482 |
| position.descriptive.concentration.netUsd | 52,082,185.45 |
| position.descriptive.concentration.shareOfIssuanceValue | 0.78 |
| position.descriptive.concentration.withoutTopNetBuyers.1.netUsd | 24,869,647.75 |
| position.descriptive.concentration.withoutTopNetBuyers.1.share | 0.37 |
| position.descriptive.concentration.withoutTopNetBuyers.3.netUsd | 1,778,868.7 |
| position.descriptive.concentration.withoutTopNetBuyers.3.share | 0.03 |
| position.descriptive.concentration.withoutTopNetBuyers.10.netUsd | -11,969,197.07 |
| position.descriptive.concentration.withoutTopNetBuyers.10.share | -0.18 |
| position.descriptive.concentration.withoutTopNetBuyersAndSellers.3.netUsd | 8,621,054.76 |
| position.descriptive.concentration.withoutTopNetBuyersAndSellers.3.share | 0.13 |
| position.descriptive.concentration.withoutTopNetBuyersAndSellers.10.netUsd | 4,640,235.16 |
| position.descriptive.concentration.withoutTopNetBuyersAndSellers.10.share | 0.07 |
| position.descriptive.concentration.medianBuyerTotalUsd | 0.91 |
| position.descriptive.concentration.buyersWithAnyBuy | 63,558 |
| position.descriptive.concentration.unattributedNetUsd | 0 |
| position.descriptive.concentration.sellsWithMultipleSenders | 0 |
| position.top3Share | 96.6% |
| position.topBuyerCount | 3 |
| position.topBuyerCountWords | three |
| position.call.total | 3 |
| position.call.totalWords | three |
| position.call.passingWords | One |
| position.holdHorizon | 2031 |
| position.check1.coverage | 77.75% |
| position.check1.latestPriceCoverage | 37.85% |
| position.check2.coveragePercent | 15.08% |
| position.check3.growthPercent | 14.58% |
| position.sender.rowsPercent | 64.34% |
| position.sender.usdPercent | 35.44% |
| position.check1.netUsdCompact | 52.1M |
| position.whatYouMustBelieve.lowUsdCompact | 46.1M |
| position.whatYouMustBelieve.highUsdCompact | 154M |
| position.receiptsComparisonGap | 0.04% |
| position.stakingConflict.rpcRate | [0,1] |
| position.stakingConflict.postSplit | 90/10 |
| position.stakingConflict.postMeasuredShare | 10.13% |
| position.stakingConflict.postNominalShare | 10% |
| position.stakingConflict.postYield | 4.97% |
| position.rules.passBar | 20% |
| position.rules.growthBar | 20% |
| position.rules.signedGrowthBar | +20% |
| position.check3.signedGrowth | +14.58% |
| position.oneClick.totalUsd | 12,335,739,697.24 |
| position.oneClick.nearUsd | 254,945,237.53 |
| position.oneClick.nearShare | 0.02 |
| position.audit.sampleRows | 18,503,984 |
| position.audit.sampleDifferences | 0 |
| position.audit.sampleDays | 4 |
| position.audit.walletScanProjectedGb | 1,053 |
| position.oneClick.nearPercent | 2.07% |
| position.oneClick.nearMillions | 254.9 |
| position.latestClose | 4.284 |
| position.oneClick.totalBillions | 12.34 |
| position.scenarios.bear.inputs.startingSupply | 1,310,576,026.35 |
| position.scenarios.bear.inputs.startMonth | 24,322 |
| position.scenarios.bear.inputs.realizedShare | 0.99 |
| position.scenarios.bear.inputs.yearlyBurn | 500,289.94 |
| position.scenarios.bear.inputs.price | 4.28 |
| position.scenarios.bear.inputs.yearlyNetBuying | -12,332,694.07 |
| position.scenarios.bear.inputs.yearlyBuybacks | 13,931,523.81 |
| position.scenarios.bear.inputs.yearlyBuyingGrowth | 0 |
| position.scenarios.bear.inputs.cut | 0 |
| position.scenarios.bear.inputs.activationMonth | 24,326 |
| position.scenarios.base.inputs.startingSupply | 1,310,576,026.35 |
| position.scenarios.base.inputs.startMonth | 24,322 |
| position.scenarios.base.inputs.realizedShare | 0.99 |
| position.scenarios.base.inputs.yearlyBurn | 500,289.94 |
| position.scenarios.base.inputs.price | 4.28 |
| position.scenarios.base.inputs.yearlyNetBuying | 52,082,185.45 |
| position.scenarios.base.inputs.yearlyBuybacks | 19,340,920.53 |
| position.scenarios.base.inputs.yearlyBuyingGrowth | 0 |
| position.scenarios.base.inputs.cut | 1 |
| position.scenarios.base.inputs.activationMonth | 24,326 |
| position.scenarios.bull.inputs.startingSupply | 1,310,576,026.35 |
| position.scenarios.bull.inputs.startMonth | 24,322 |
| position.scenarios.bull.inputs.realizedShare | 0.99 |
| position.scenarios.bull.inputs.yearlyBurn | 500,289.94 |
| position.scenarios.bull.inputs.price | 4.28 |
| position.scenarios.bull.inputs.yearlyNetBuying | 139,432,214.81 |
| position.scenarios.bull.inputs.yearlyBuybacks | 24,273,938.52 |
| position.scenarios.bull.inputs.yearlyBuyingGrowth | 0 |
| position.scenarios.bull.inputs.cut | 1 |
| position.scenarios.bull.inputs.activationMonth | 24,326 |
| position.descriptive.twoWaySenders.coverage | 44.74% |
| position.descriptive.twoWayRefundTo.coverage | 50.47% |
| position.descriptive.exchange.coverage | 77.75% |
| position.descriptive.concentration.coverage | 77.75% |
| position.concentration.withoutTopNetBuyers.1.coverage | 37.13% |
| position.concentration.withoutTopNetBuyers.3.coverage | 2.66% |
| position.concentration.withoutTopNetBuyers.10.coverage | -17.87% |
| position.concentration.withoutTopNetBuyersAndSellers.3.coverage | 12.87% |
| position.concentration.withoutTopNetBuyersAndSellers.10.coverage | 6.93% |
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
