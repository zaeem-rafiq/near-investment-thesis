# Judge questions

## Why this problem?

A long-term case for NEAR usually rests on claims about growing usage and token burn. We wrote pass and fail lines first, then tested three such claims on public chain data and 7,509,299 real swaps. None of the three passed.

## Why should a judge care?

This track scores evidence that someone else can re-run. Anyone can clone the repository and rebuild every chart and number with no credentials or network. The evidence cuts against the easy bull case: mean daily signers fell 73.1% year over year, and burn offset 1.56% of new supply.

## What breaks without the sponsor's tool?

Without NEAR's public BigQuery dataset there is no usage or supply evidence, so T1 and T3 cannot run. Without the NEAR Intents Explorer API there is no swap volume, so T2 cannot run. The BigQuery tables have no USD or 1Click swap fields, so neither source can replace the other.

## What is real, and what is simulated?

Every published number comes from real sources: BigQuery, the Explorer API and Coinbase daily prices. Nothing is simulated. The test suite uses synthetic fixtures, but only to check the rules, and they never reach a chart or a result.

## What comes next?

The thesis names the result that would change each conclusion. Next we would re-run the same rules on later windows, because T2 has only 78 weekly changes. We would also extend the swap data beyond 1Click, which is only part of NEAR Intents.
