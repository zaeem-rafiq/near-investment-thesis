-- Frozen cohorts: rank receivers by distinct (UTC day, signer) pairs in the earlier year.
-- One table read, including failed transactions, like signers.sql.
-- Receivers are ranked once at receiver grain: a row-level global ORDER BY exceeded BigQuery memory.
WITH signer_receiver_days AS (
  SELECT DISTINCT block_date, signer_account_id, receiver_account_id
  FROM `bigquery-public-data.crypto_near_mainnet_us.transactions`
  WHERE block_date >= DATE '2024-11-01' AND block_date < DATE '2026-11-01'
), receiver_scores AS (
  SELECT receiver_account_id, COUNTIF(block_date < DATE '2025-11-01') AS earlier_signer_days
  FROM signer_receiver_days GROUP BY receiver_account_id
), top10 AS (
  SELECT receiver_account_id FROM receiver_scores WHERE earlier_signer_days > 0
  ORDER BY earlier_signer_days DESC, receiver_account_id LIMIT 10
), ranked AS (
  SELECT d.*, t.receiver_account_id IS NOT NULL AS is_top10
  FROM signer_receiver_days AS d LEFT JOIN top10 AS t ON d.receiver_account_id = t.receiver_account_id
), grains AS (
  SELECT IF(GROUPING(receiver_account_id) = 1, 'day', 'receiver_period') AS grain,
    block_date, receiver_account_id, year_start,
    LOGICAL_OR(is_top10) AS in_top10,
    COUNTIF(block_date >= year_start AND block_date < DATE_ADD(year_start, INTERVAL 1 YEAR)) AS signer_days
  FROM ranked
  CROSS JOIN UNNEST([DATE '2024-11-01', DATE '2025-11-01']) AS year_start
  GROUP BY GROUPING SETS (
    (block_date, signer_account_id),
    (receiver_account_id, year_start)
  )
)
SELECT grain, COALESCE(block_date, year_start) AS period_start, receiver_account_id,
  IF(grain = 'day', COUNTIF(in_top10), NULL) AS top10,
  IF(grain = 'day', COUNTIF(NOT in_top10), NULL) AS everyone_else,
  IF(grain = 'receiver_period', SUM(signer_days) / 365.0, NULL) AS mean_daily_signers
FROM grains
GROUP BY grain, period_start, receiver_account_id
ORDER BY grain, period_start, receiver_account_id;
