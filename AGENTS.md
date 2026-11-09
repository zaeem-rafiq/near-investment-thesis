# Agent instructions

## Project

Node.js 22+, standard libraries only, no dependencies. Run `npm run check`, `npm test`, and `npm run rebuild` after changes. Rebuild reads `data/public/` offline and verifies, never rewrites, `THESIS.md`. Keep results, fixed rules, research data, SQL and thesis reasoning unchanged unless the owner explicitly approves a research change.

Never print `.env` values, tokens or deposit addresses. Never commit secrets or raw swap pages. Leave `.agents/`, `skills-lock.json` and `dashboard/preview.png` untouched; they belong to another session. Treat other existing changes as user work.

No new BigQuery scans for presentation work. Cumulative billed scans are 242.87 GB; the absolute stop is 1 TB. Do not run refresh, plan, pull or export commands unless the owner requests source work.

## Hackathon

- Event: **NEAR HACKATHON**, https://nearhackathon.com.
- Track: **Investment Thesis (`thesis`)**. The idea is frozen as of **2026-11-09**: test the long-term NEAR investment case against public on-chain activity, 1Click swaps and supply evidence, with a reproducible dashboard and thesis.
- Rules: local [HACKATHON.md](HACKATHON.md); live https://nearhackathon.com/HACKATHON.md. Deadline **2026-11-14T23:59:00Z**, copied from the local HACKATHON.md read on **2026-11-09**. Re-read the live version before any submission, since rules and dates may change.
- Build window: from the **2026-10-19 announcement** through the deadline, per Q-001: https://x.com/nearprotocol/status/2112257967818997891. Earlier commits are baseline. Submissions open 2026-11-01T00:00:00Z.
- Judging: **Claude Code and Codex screen every project; human judges decide** (Q-017). Screening checks reproducibility and features and supplies a report and preliminary score; a low AI score alone cannot reject. Write README steps as “do X, see Y”.
- Submission form: https://nearhackathon.com/#apply. API: `POST https://nearhackathon.com/api/applications`. Changes to an existing submission: https://nearhackathon.com/request-changes.
- Track examples: https://github.com/nearai/near-hackathon-prompt-examples. NEAR docs: https://docs.near.org/.

### Binding rule summary (Q-000–Q-017)

- Q-000: NEAR AI credits and keys come from the Cloud dashboard; optional Builders credit is described in HACKATHON.md.
- Q-001–Q-004: work from the announcement is eligible; earlier work is baseline. Existing products need a separately identified in-window NEAR integration or feature, not an unchanged old product. Use a dedicated branch or baseline/submission tags and README diff links when relevant; there is no minimum code size.
- Q-005: libraries, templates and AI code are allowed and must be disclosed in README; own older libraries remain baseline.
- Q-006: a 1Click JWT is optional; no-JWT swaps have a 0.2% fee.
- Q-007–Q-010: Intents has no testnet; use separate dev accounts, tiny mainnet amounts and `dry: true` quotes if needed. Testnet NEAR and public RPC are available; mainnet costs are not reimbursed by default. Testnet-only projects are eligible, except integrations available only on mainnet.
- Q-011: no mandatory integrations. Track hints and named protocols are suggestions.
- Q-012: local-only demos are allowed with a public repo, reproducible README and X video; screenshots alone are insufficient if judges cannot open the demo. Hosted demos are a plus and should stay available through November 18, ideally November 25.
- Q-013–Q-014: the team keeps code rights; organizers receive non-exclusive promotional rights. Any license is allowed; include LICENSE and keep the repo public through judging once publication is approved.
- Q-015: one person may submit at most two independent, mutually disclosed projects, not the same project twice.
- Q-016: prize payout is one payment, no vesting, within 30 days of results.
- Q-017: AI screening informs, but does not replace, human judging.

### Never without the human

Nothing is pushed, made public, posted or submitted without explicit owner approval. The repository may stay private during building; its public-by-deadline requirement does not authorize an agent to publish it.

- Never push, force-push or make the repository public without explicit confirmation.
- Never post on X or any network on the owner's behalf without explicit confirmation. The hackathon procedure asks the human to publish the demo post, identifying NEAR HACKATHON and including @NEARProtocol and #NEARHackathon.
- Never submit without collecting the actual human-decided fields and consent, showing the exact full JSON payload, and receiving confirmation. Do not invent identity, email, payout account, links, team size or consent.
- One submission per project/repository. Never submit twice to fix a mistake; the human requests changes. Reuse the same requestId only for retries of the same submission. Follow the response handling in HACKATHON.md; do not bypass a 403 or 409.
- Never sign transactions, spend tokens or deploy to mainnet without explicit confirmation.
- Never commit secrets. Keep submission payloads out of Git because they contain personal data.
