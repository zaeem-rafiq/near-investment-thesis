# Query changes

## 2026-11-09: `sql/signer_split.sql` ranking step

The first full `signer_split` job failed with BigQuery `resourcesExceeded`
(memory, in an ORDER BY). It billed 0 bytes, and no result was seen.

Only the ranking step changed. The old query ranked every (day, signer,
receiver) row with a global `DENSE_RANK() OVER (ORDER BY earlier_signer_days
DESC, receiver_account_id)`. The new query counts each receiver's earlier-year
signer-days once, then keeps the 10 receivers with `earlier_signer_days > 0`,
ordered by those days descending and then by receiver ID. The tie-break makes
ranks unique, so this is the same top-10 set. The cohort definition, date
filters, split date, grains and output columns did not change. The dry-run
estimate is unchanged: 148,434,747,437 bytes.

Equivalence check before the change, with the owner's approval: both queries ran
on 2025-10-30 through 2025-11-02. The split stayed at 2025-11-01, and the year
starts were narrowed to 2025-10-30 and 2025-11-01 with 2-day periods. Each
returned 18,503,984 rows. A server-side comparison of every row, as JSON, found
0 rows in one result but not the other, and no duplicates. The old sample job,
the new sample job and the comparison billed 926,941,184, 926,941,184 and
2,354,053,120 bytes, all recorded in the private BigQuery ledger.
