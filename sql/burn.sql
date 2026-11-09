-- Weekly (Monday-start, UTC) recorded burn in yoctoNEAR (FLOAT64 sums):
-- receipt execution outcomes plus transaction-to-receipt conversion.
WITH outcomes AS (
  SELECT DATE_TRUNC(block_date, WEEK(MONDAY)) AS week_start, SUM(tokens_burnt) AS burnt, COUNTIF(tokens_burnt IS NULL) AS null_rows
  FROM `bigquery-public-data.crypto_near_mainnet_us.execution_outcomes`
  WHERE block_date >= DATE '2025-11-03' AND block_date < DATE '2026-11-02'
  GROUP BY week_start
), conversions AS (
  SELECT DATE_TRUNC(block_date, WEEK(MONDAY)) AS week_start, SUM(receipt_conversion_tokens_burnt) AS burnt, COUNTIF(receipt_conversion_tokens_burnt IS NULL) AS null_rows
  FROM `bigquery-public-data.crypto_near_mainnet_us.transactions`
  WHERE block_date >= DATE '2025-11-03' AND block_date < DATE '2026-11-02'
  GROUP BY week_start
)
SELECT week_start,
  FORMAT('%.17g', o.burnt) AS outcome_burn_yocto, o.null_rows AS outcome_null_rows,
  FORMAT('%.17g', c.burnt) AS conversion_burn_yocto, c.null_rows AS conversion_null_rows
FROM outcomes AS o FULL OUTER JOIN conversions AS c USING (week_start)
ORDER BY week_start;
