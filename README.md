This repository tests the long-term investment case for NEAR against public on-chain activity, NEAR Intents 1Click swaps and supply data, and publishes the result as a reproducible dashboard and one-page thesis. It is written for investors and judges who want to check each number themselves, offline, from committed public data.

Not yet: public data through <!-- metric:presentation.publicDate -->November 1, 2026<!-- /metric --> does not support opening or adding to a NEAR position for a hold through <!-- metric:position.holdHorizon -->2031<!-- /metric -->, because only one of three locked tests passed and three accounts made up <!-- metric:position.top3Share -->96.6%<!-- /metric --> of that pass.

- Check 1 passed: final net buying was <!-- metric:position.check1.coverage -->77.75%<!-- /metric --> of issuance value; the top three accounts supplied <!-- metric:position.top3Share -->96.6%<!-- /metric --> of that total.
- Check 2 failed: burn plus measured outside wallet receipts covered <!-- metric:position.check2.coveragePercent -->15.08%<!-- /metric --> of issuance. Check 3 failed: signers outside the ten biggest apps grew <!-- metric:position.check3.growthPercent -->14.58%<!-- /metric -->.
- Beyond those checks, overall daily signers fell <!-- metric:presentation.signersDecline -->73.1%<!-- /metric -->, burn offset <!-- metric:t3.offset -->1.56%<!-- /metric --> of new issuance, and NEAR appeared on one side of <!-- metric:position.oneClick.nearPercent -->2.07%<!-- /metric --> of 1Click input volume.

## Run locally

Requires Node.js 22 or newer. The project uses standard libraries only; no install step is needed.

1. Run `npm run check`. See syntax checks complete successfully.
2. Run `npm test`. See the offline rule, evidence and model tests pass.
3. Run `npm run rebuild`. See `dashboard/` rebuilt from committed public data and the verified results `T1 FAIL, T2 CAN'T TELL, T3 FAIL`. The rebuild does not rewrite `THESIS.md`.
4. Open `dashboard/index.html` in a browser. See the position call “Not yet.” with the rating line under it, the new supply issued in the 52 weeks, the links to the model, thesis and verification, then the three checks with Pass and Fail badges, followed by the concentration comparison.

## Model

Open [`dashboard/model.html`](dashboard/model.html) from a local HTTP server; for example, run `python3 -m http.server 8765 --bind 127.0.0.1 --directory dashboard` and visit `http://127.0.0.1:8765/model.html`. See the 2031 result and its chart side by side from 1024 px wide, stacked below that. Try Bear, Base and Bull, adjust the assumptions, then use Reset or share the URL. The model shows supply and float scenarios through <!-- metric:position.holdHorizon -->2031<!-- /metric -->; it is arithmetic under stated assumptions, not a forecast.

## Libraries and AI assistance

- Runtime, build and tests use only the Node.js 22 standard library. `package.json` declares no dependencies, and `package-lock.json` lists no packages beyond this project.
- The dashboard ships two open-licensed fonts in `web/fonts/`, Newsreader and IBM Plex Sans, under the SIL Open Font License; the license texts sit beside them. The Beforehand name, mark and colors were made for this project; see `brand/BRAND.md`.
- Timestamp proofs use the OpenTimestamps client, run on demand with `uvx --from opentimestamps-client`. It is a verification tool, not part of the build or tests.
- Code, tests and text in this repository were written with AI coding agents (Factory Droid) under the owner's direction and review. Every commit records the agent as co-author.

## Verify evidence and rule chronology

Follow [`docs/VERIFY.md`](docs/VERIFY.md) for the offline verification commands, source hashes, timestamp proofs and exact commit references.

The original T1–T3 results and press coverage were known before `docs/position-rule.md` was locked. That position rule was recorded before the first provisional flow-data commit, not before all available flow results. Addendum 1 was added after provisional flow totals but before participant reconciliation, wallet histories and exclusive signer-split pulls. Addendum 2 came after preliminary results, press coverage, the external revenue comparison and current balances, but before the final position checks and descriptive cuts. The timestamp proof covers the rule with Addendum 1; Addendum 3 came before the peer pull and size bands. The timestamp proof for the rule with Addendum 1 has Bitcoin attestations; the Addendum 2 and Addendum 3 proofs were still pending at the last check. Git commit times establish content order, not when analysis actually ran.
