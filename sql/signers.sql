-- Transaction signers per UTC day: an activity proxy, not unique people.
-- Includes failed transactions and relayer accounts. One scan feeds three grains:
-- day (signers, transactions), month (accounts signing on 2+ days) and 12-month period
-- (transactions by the period's 10 largest signers). Partial November 2026 is excluded from month/period.
WITH per_signer_day AS (
  SELECT block_date, signer_account_id, COUNT(*) AS transactions
  FROM `bigquery-public-data.crypto_near_mainnet_us.transactions`
  WHERE block_date >= DATE '2024-11-01' AND block_date < DATE '2026-11-02'
  GROUP BY block_date, signer_account_id
), complete_months AS (
  SELECT * FROM per_signer_day WHERE block_date < DATE '2026-11-01'
), per_signer_month AS (
  SELECT DATE_TRUNC(block_date, MONTH) AS month, signer_account_id, COUNT(*) AS active_days
  FROM complete_months GROUP BY month, signer_account_id
), per_signer_period AS (
  SELECT IF(block_date < DATE '2025-11-01', DATE '2024-11-01', DATE '2025-11-01') AS period_start,
    signer_account_id, SUM(transactions) AS transactions
  FROM complete_months GROUP BY period_start, signer_account_id
), periods AS (
  SELECT period_start, SUM(transactions) AS transactions, COUNT(*) AS signers,
    ARRAY_AGG(transactions ORDER BY transactions DESC LIMIT 10) AS top10
  FROM per_signer_period GROUP BY period_start
)
SELECT 'day' AS grain, block_date AS period_start, SUM(transactions) AS transactions,
  COUNT(*) AS signers, CAST(NULL AS INT64) AS accounts_2plus_days, CAST(NULL AS INT64) AS top10_transactions
FROM per_signer_day GROUP BY block_date
UNION ALL
SELECT 'month', month, NULL, COUNT(*), COUNTIF(active_days >= 2), NULL
FROM per_signer_month GROUP BY month
UNION ALL
SELECT 'period', period_start, transactions, signers, NULL,
  (SELECT SUM(t) FROM UNNEST(top10) AS t)
FROM periods
ORDER BY grain, period_start;
