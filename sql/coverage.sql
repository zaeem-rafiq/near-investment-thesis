-- Presence and UTC timestamp span are quality checks, not proof of full ingestion.
SELECT block_date, COUNT(*) AS block_count,
  COUNT(DISTINCT block_hash) AS distinct_block_count,
  MIN(block_timestamp_utc) AS first_block_utc,
  MAX(block_timestamp_utc) AS last_block_utc
FROM `bigquery-public-data.crypto_near_mainnet_us.blocks`
WHERE block_date >= DATE '2024-11-01' AND block_date < DATE '2026-11-02'
GROUP BY block_date
ORDER BY block_date;
