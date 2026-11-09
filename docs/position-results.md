# Position calculation snapshot

The aggregate-only snapshot is `data/public/position-results.json`. Its hash is
registered in `data/public/manifest.json`. It does not replace the original
T1/T2/T3 results, fixed rules, thesis or dashboard wording.

## Reproduce

With the completed private participant pulls, NEARBlocks histories, exchange
label source and signer daily rows already present in ignored `data/raw/`, run:

```sh
node scripts/position-results.mjs export
npm run check
npm test
npm run rebuild
```

Export is offline and refuses account-like strings outside the three approved
revenue wallets, wrap.near and source hosts. The public snapshot can be inspected
and hash-verified without the private rows, but recomputing participant cuts
requires those rows. Rebuild remains offline and prints
`T1 FAIL, T2 CAN'T TELL, T3 FAIL`.

## Results and boundaries

| Check | Metric | Result |
| --- | ---: | --- |
| 1 final | Net buying / 52-week issuance value: 77.7492% | PASS |
| 2 | (Burn + outside receipts) / 36-week issuance: 15.0774% | FAIL |
| 3 | Growth in mean daily everyone_else signers: 14.5783% | FAIL |

One check passes: **Not yet**. Exact values and weekly series are in the JSON.
Two-way, exchange, lead/follow and concentration cuts do not change any check.
The refundTo two-way variant and concentration cut are after-the-fact descriptive.
Sender coverage is 64.3432% of sell rows and 35.4438% of sell USD.

Check 2 uses successful native TRANSFER receipts and outside wNEAR receipts
(zero found). It excludes transfers among the three revenue wallets and treats
wrap.near/system returns as not_received. Both literal and internal-move-adjusted
balance gaps are reported at block 223823013. Only adjusted gaps govern the 5%
stop rule; all are below 0.41%. Receipt outcomes are present, with no failed
transfers in these histories. Function-call deposits are reported separately and
are not counted as Check 2 revenue.

There are **three**, not one, 1cs-to-buybacks moves: 7,274 NEAR on July 14,
1 NEAR on August 28, and 502,793 NEAR on September 9 (all 2026, UTC).
Their 510,068 NEAR total affects reconciliation only.

The signer split has 730 daily rows, each independently checked against the
existing signers totals. The 363,988,830 receiver-period rows were not downloaded;
receiver-level decline attribution remains unmeasured. Exchange labels cover
17 accounts and are not an exhaustive exchange census. NEARBlocks has already
rounded many amounts to approximately 16 significant digits, so exact original
yocto values cannot be recovered. Addendum 2's Bitcoin timestamp upgrade remains
pending.

## Query cost

No wallet_flows scan was run. Its 1,053 GB projection exceeded the owner's gate;
the SQL remains outside the run path. The signer rewrite was committed before
the full run. The four-day comparison found zero differences across 18,503,984
rows. Sample jobs plus comparison billed 4.207935488 GB, not the earlier
approximately 1.6 GB expectation. The full signer job billed 148.435369984 GB;
extracting daily rows billed another 9.100591104 GB. A resource-exhausted first
job billed zero. Cumulative ledger billing is 404.610875392 GB, below the 900 GB
position-work gate. All GB here are decimal (bytes / 1,000,000,000).
