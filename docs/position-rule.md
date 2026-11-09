# Position rule

Written on 2026-11-09, after the T1, T2 and T3 results and press figures on buybacks were known, and before any number below was computed. T1, T2 and T3 and their results do not change.

NEAR means the assets that 1Click's token list labels NEAR or wNEAR on 2026-11-09: nep141:wrap.near, nep245:v2_1.omni.hot.tg:56_SZzgw3HSudhZcTwPWUTi2RJB19t, 1cs_v1:hypercore:hip1:0x20b8c9d2f022ffd2aea4f7962b7b1d8b and 1cs_v1:sol:spl:3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG. Liquid staking tokens are not NEAR.

Check 1, net NEAR flow, over the 52 T3 weeks from 2025-11-03 to 2026-11-01. Buys are the USD input of successful 1Click swaps into NEAR from another asset. Sells are the USD input of successful 1Click swaps from NEAR into another asset. NEAR-to-NEAR swaps are left out. Swaps with no USD value are left out and counted. Issuance value is each week's issued NEAR, the T3 sum of supply rises, times that week's mean NEAR/USD close. The check passes if buys minus sells is at least 20% of issuance value. A pass counts only after swaps whose recipient is one of the three revenue wallets are excluded by a targeted pull.

Check 2, buyback coverage, over the 36 complete weeks from 2026-02-23 to 2026-11-01: burn, the T3 sum of supply falls, plus NEAR and wNEAR received from outside by fefundsadmin.sputnik-dao.near, 1csfundsadmin.sputnik-dao.near and buybacks.multisignature.near, divided by NEAR issued. The check passes at 20% or more.

Check 3, usage outside the 10 biggest apps: mean daily signers in the everyone_else group of sql/signer_split.sql for 2025-11-01 to 2026-10-31, against 2024-11-01 to 2025-10-31. The check passes if it rose at least 20%.

The call. Zero or one check passing gives Not yet. Two or three give Building. Own needs all three to pass in a later 52-week window. The 20% bars come from the T1 and T3 pass lines.

## Addendum 1

Written on 2026-11-09, after the first Check 1 total and its asset and weekly breakdowns were known, and before any recipient data, wallet data or signer split was pulled.

NEAR swaps pull. For the 52 T3 weeks, pull successful 1Click swaps with a NEAR asset on either side and keep recipient, senders, refundTo, referral and appFees. The pull must match the saved pages' buys and sells within 0.1%, or the steps below stop. Recipient data stays in ignored raw files.

Check 1 final. Buys exclude swaps whose recipient is one of the three revenue wallets. Sells exclude swaps whose senders include one of them. The 20% bar does not change.

Two-way accounts. An account is two-way if it received NEAR in a buy and is a sender of a sell in the 52 weeks. Net buying is also reported with two-way accounts removed from both sides. This cut is descriptive and does not change Check 1.

Exchange accounts. Net buying is also reported without recipients labeled as exchanges by a free public source, named in the results and chosen before this cut is computed. If no such source exists, the results say the cut is not measurable. This cut is descriptive.

Lead or follow. Using the 52 weekly net flows and weekly mean NEAR/USD closes, at lags of 1, 2, 4 and 8 weeks, correlate net flow with later price change, and price change with later net flow. Flow leads if at two or more lags its correlation is at least 0.30 and beats the reverse by at least 0.15. Price leads under the same test in reverse. Otherwise the result is can't tell. This test is descriptive.
