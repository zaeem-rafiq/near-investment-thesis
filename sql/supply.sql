-- Weekly (Monday-start, UTC) block-to-block changes in total_supply (yoctoNEAR, FLOAT64).
-- nearcore: supply = previous + minted - burnt, minting only on an epoch's first block,
-- so falls measure burn and rises measure issuance net of that block's burn.
-- Blocks are linked by prev_block_hash; the window's first block has no parent and no change.
WITH b AS (
  SELECT block_date, block_height, block_hash, prev_block_hash, total_supply
  FROM `bigquery-public-data.crypto_near_mainnet_us.blocks`
  WHERE block_date >= DATE '2025-11-03' AND block_date < DATE '2026-11-02'
), changes AS (
  SELECT DATE_TRUNC(b.block_date, WEEK(MONDAY)) AS week_start, b.block_height,
    b.total_supply, b.total_supply - p.total_supply AS change
  FROM b LEFT JOIN b AS p ON b.prev_block_hash = p.block_hash
)
SELECT week_start, COUNT(*) AS blocks,
  COUNTIF(change IS NULL) AS unlinked_blocks,
  COUNTIF(change > 0) AS rising_blocks,
  FORMAT('%.17g', SUM(IF(change < 0, -change, 0))) AS supply_falls_yocto,
  FORMAT('%.17g', SUM(IF(change > 0, change, 0))) AS supply_rises_yocto,
  FORMAT('%.17g', ARRAY_AGG(total_supply ORDER BY block_height LIMIT 1)[OFFSET(0)]) AS opening_supply_yocto,
  FORMAT('%.17g', ARRAY_AGG(total_supply ORDER BY block_height DESC LIMIT 1)[OFFSET(0)]) AS closing_supply_yocto
FROM changes
GROUP BY week_start
ORDER BY week_start;
