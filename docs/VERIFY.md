# Verify the evidence

Run these commands from the repository root with Node.js 22 or newer. The tests
and rebuild use committed public data, require no credentials or raw pages, and
do not run BigQuery, refresh sources or change the research rules.

```sh
node --version
npm run check
npm test
npm run rebuild
git diff --exit-code
git diff --cached --exit-code
```

Expected: all tests pass; rebuild prints `T1 FAIL, T2 CAN'T TELL, T3 FAIL`;
both diff commands produce no output and exit zero in a clean checkout.
No final position-check results are claimed by this guide.

Query change: on 2026-11-09 only the ranking step of `sql/signer_split.sql`
changed, after its first job failed on memory with 0 bytes billed and no result
seen. The cohort definition did not change; see `docs/query-changes.md`.

## Verify each timestamp against its actual file

Install `uv` and use the OpenTimestamps client. Verification of Bitcoin
attestations requires access to a fully synced Bitcoin Core node, using its
normal local configuration or the client's `--bitcoin-node` option.

```sh
uvx --from opentimestamps-client ots info docs/position-rule.md.ots
uvx --from opentimestamps-client ots verify -f docs/position-rule.md docs/position-rule.md.ots
uvx --from opentimestamps-client ots info docs/position-rule-addendum-2.md.ots
uvx --from opentimestamps-client ots verify -f docs/position-rule-addendum-2.md docs/position-rule-addendum-2.md.ots
```

If a proof is still pending, upgrade it and run verification again:

```sh
uvx --from opentimestamps-client ots upgrade docs/position-rule.md.ots
uvx --from opentimestamps-client ots upgrade docs/position-rule-addendum-2.md.ots
```

Upgrading changes proof files, not rule text, and may create `.ots.bak` files.
A pending proof or a missing Bitcoin node is not successful Bitcoin verification.
The client can exit nonzero while a timestamp waits for confirmations.

### Proof status checked on 2026-11-09

| Proof target | SHA-256 of the target file | Bitcoin attestation |
|---|---|---|
| `docs/position-rule.md` (including addendum 1) | `8ff52110226d8d00abeed330b25389e6d034eabef806f12ceb06564e76c03ce9` | Blocks 975204 and 975212 |
| `docs/position-rule-addendum-2.md` | `804a5924916162d58db4c9a03d6d7792de62a0dd292634dbf6edd96832a65345` | Pending; no Bitcoin attestation in the proof at this check |

| Bitcoin height | Reported mined time (UTC, block-header timestamp) | Public explorer |
|---|---|---|
| 975204 | 2026-11-09T17:52:47Z | [Blockstream](https://blockstream.info/block/00000000000000000000c363f8758e3c374f28fce5eb2098f384ebf07eb647b9) |
| 975212 | 2026-11-09T20:01:24Z | [Blockstream](https://blockstream.info/block/000000000000000000013919c63197af6079db7cdce98e9c70f33310a6ecd858) |

The explorer API (`/api/block/<block-hash>`) supplied these header times and
Merkle roots. Both proof paths were checked against those roots, and each proof's
file digest was checked against its target. Full-node `ots verify` could not
complete in the build environment because no Bitcoin Core node was configured.
Explorer-backed checks are not independent validation of the full Bitcoin chain.
Bitcoin header timestamps are miner-reported times, not precise wall-clock
certificates of file creation.

## Recorded order of work

These are full commit hashes and committer times converted to UTC. The commits
are successive ancestors in this repository, with other work between some rows.

| Milestone | Commit | UTC time | What its contents establish |
|---|---|---|---|
| Rule lock | `9afd9c8cbcdf15121410e88d162f3257e44e2324` | 2026-11-09T17:22:17Z | Adds the original position rule, before the first flow-data commit in this history. It does not contain addendum 1. |
| First flow data | `096bfa1ceecccffa902bd47322bd626e3cb61cd8` | 2026-11-09T17:24:55Z | Adds 52 weekly NEAR-flow aggregates and their manifest hash. Recipient exclusions were not applied, so Check 1 was provisional. |
| Addendum 1 | `f87045a348d966e1ba858963b6236c5ac83a812b` | 2026-11-09T17:41:21Z | Adds participant reconciliation, final exclusions and descriptive cuts after the provisional totals. The text records that ordering explicitly. |
| Addendum 2 | `58f5d9444d16e0b5befa634faa9c9964fd744e79` | 2026-11-09T20:18:39Z | Adds call meanings, review dates, non-overlapping Own eligibility and downgrade/Broken rules. It states that final checks and descriptive cuts had not been computed. |

Inspect the recorded times and the actual changes:

```sh
TZ=UTC git show --no-patch --date=iso-strict-local --format='%H %cd %s' 9afd9c8cbcdf15121410e88d162f3257e44e2324 096bfa1ceecccffa902bd47322bd626e3cb61cd8 f87045a348d966e1ba858963b6236c5ac83a812b 58f5d9444d16e0b5befa634faa9c9964fd744e79
git show 9afd9c8cbcdf15121410e88d162f3257e44e2324 -- docs/position-rule.md
git show 096bfa1ceecccffa902bd47322bd626e3cb61cd8 -- data/public/near_flows.json data/public/manifest.json
git show f87045a348d966e1ba858963b6236c5ac83a812b -- docs/position-rule.md
git show 58f5d9444d16e0b5befa634faa9c9964fd744e79 -- docs/position-rule-addendum-2.md
```

**Git times alone can be changed. Only completed Bitcoin proofs provide outside
timestamp evidence here.** Commit ancestry records content order, not independently
certified execution times. The completed proof covers the rule *with addendum 1*,
and anchors it no later than the cited Bitcoin commitment. It does not separately
timestamp the original rule before the first flow data, nor prove when analysis
was actually run. Addendum 2 remains pending at this check. Final-result commits
will be added to this guide only after owner review.
