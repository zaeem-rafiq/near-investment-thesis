-- Check 2, 36 complete UTC weeks. Only the three locked wallets leave this query.
-- Argument encoding and success statuses follow near/near-public-lakehouse,
-- src/lakehouse/notebooks/Silver Lake Mainnet.sql (commit 4de8e1a).
-- Receipt creation determines the week. Outcomes get two extra days to settle;
-- missing outcomes and malformed arguments are reported, never silently zeroed.
WITH actions AS (
  SELECT block_date, receipt_id, action_kind, receipt_predecessor_account_id,
    receipt_receiver_account_id, args
  FROM `bigquery-public-data.crypto_near_mainnet_us.receipt_actions`
  WHERE block_date >= DATE '2026-02-23' AND block_date < DATE '2026-11-02'
    AND (
      (action_kind = 'TRANSFER' AND (
        receipt_predecessor_account_id IN ('fefundsadmin.sputnik-dao.near', '1csfundsadmin.sputnik-dao.near', 'buybacks.multisignature.near')
        OR receipt_receiver_account_id IN ('fefundsadmin.sputnik-dao.near', '1csfundsadmin.sputnik-dao.near', 'buybacks.multisignature.near')))
      OR (action_kind = 'FUNCTION_CALL' AND receipt_receiver_account_id = 'wrap.near'
        AND JSON_VALUE(args, '$.method_name') IN ('ft_transfer', 'ft_transfer_call'))
    )
), outcomes AS (
  SELECT receipt_id, ANY_VALUE(status) AS status, COUNT(*) AS outcome_rows
  FROM `bigquery-public-data.crypto_near_mainnet_us.execution_outcomes`
  WHERE block_date >= DATE '2026-02-23' AND block_date < DATE '2026-11-04'
  GROUP BY receipt_id
), decoded AS (
  SELECT actions.*, outcomes.status, outcomes.outcome_rows,
    SAFE_CONVERT_BYTES_TO_STRING(SAFE.FROM_BASE64(JSON_VALUE(args, '$.args_base64'))) AS token_args
  FROM actions LEFT JOIN outcomes USING (receipt_id)
), transfers AS (
  SELECT block_date, status, outcome_rows,
    IF(action_kind = 'TRANSFER', 'NEAR', 'wNEAR') AS asset,
    receipt_predecessor_account_id AS sender,
    IF(action_kind = 'TRANSFER', receipt_receiver_account_id,
      JSON_VALUE(token_args, '$.receiver_id')) AS receiver,
    SAFE_CAST(IF(action_kind = 'TRANSFER', JSON_VALUE(args, '$.deposit'),
      JSON_VALUE(token_args, '$.amount')) AS BIGNUMERIC) AS amount
  FROM decoded
), classified AS (
  SELECT *,
    sender IN ('fefundsadmin.sputnik-dao.near', '1csfundsadmin.sputnik-dao.near', 'buybacks.multisignature.near') AS sender_is_wallet,
    receiver IN ('fefundsadmin.sputnik-dao.near', '1csfundsadmin.sputnik-dao.near', 'buybacks.multisignature.near') AS receiver_is_wallet
  FROM transfers
), expanded AS (
  SELECT *, wallet IS NULL AS audit,
    CASE WHEN receiver = wallet THEN 'in' WHEN sender = wallet THEN 'out' END AS direction
  FROM classified CROSS JOIN UNNEST([
    CAST(NULL AS STRING), 'fefundsadmin.sputnik-dao.near',
    '1csfundsadmin.sputnik-dao.near', 'buybacks.multisignature.near'
  ]) AS wallet
)
SELECT IF(audit, 'audit', 'week') AS grain,
  IF(audit, NULL, DATE_TRUNC(block_date, WEEK(MONDAY))) AS week,
  wallet, asset, IF(audit, NULL, direction) AS direction,
  COUNT(*) AS candidate_actions,
  COUNTIF(status IN ('SUCCESS_VALUE', 'SUCCESS_RECEIPT_ID')) AS successful_actions,
  IF(audit, NULL, CAST(SUM(IF(status IN ('SUCCESS_VALUE', 'SUCCESS_RECEIPT_ID')
    AND outcome_rows = 1 AND amount >= 0 AND amount = TRUNC(amount), amount, 0)) AS STRING)) AS amount_yocto,
  COUNTIF(amount IS NULL OR amount < 0 OR amount != TRUNC(amount) OR receiver IS NULL) AS invalid_arguments,
  COUNTIF(status IS NULL) AS missing_outcomes,
  COUNTIF(outcome_rows > 1) AS duplicate_outcomes,
  COUNTIF(status = 'FAILURE') AS failed_actions,
  COUNTIF(status IS NOT NULL AND status NOT IN ('SUCCESS_VALUE', 'SUCCESS_RECEIPT_ID', 'FAILURE')) AS unknown_outcomes,
  COUNTIF(sender_is_wallet AND receiver_is_wallet) AS internal_actions
FROM expanded
WHERE audit OR (direction IS NOT NULL AND NOT COALESCE(sender_is_wallet AND receiver_is_wallet, FALSE))
GROUP BY grain, week, wallet, asset, audit, IF(audit, NULL, direction)
ORDER BY grain, week, wallet, asset, direction;
