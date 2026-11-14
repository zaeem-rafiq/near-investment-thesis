# Beforehand brand guide

Beforehand is the name and look of the NEAR investment thesis dashboard. Its one idea: the pass bars were written down before the checks were computed, and every number reruns offline. The look is a sealed record: paper, ink and one stamp violet.

## Name

- Write **Beforehand**, one word, capital B.
- The name sits in the nav and the browser tab. The repository, README and submission keep the descriptive name "NEAR investment thesis".
- Never put NEAR's logo, its "N" shape or its colors next to the mark. The dashboard must not look like an official NEAR Foundation product.
- A web search and a check of all 1,520 NEAR HACKATHON entries on 2026-11-14 found no clash. A proper trademark search is still needed before any use beyond the hackathon.

## Mark

A seal with a bar cut high across it: the bar was set before anything was measured beneath it.

| File | Use |
|---|---|
| `logo/beforehand-mark-color.svg` | Default, on paper or white |
| `logo/beforehand-mark-reversed.svg` | On ink or other dark backgrounds |
| `logo/beforehand-mark-black.svg`, `logo/beforehand-mark-white.svg` | One-color printing and embossing |
| `web/favicon.svg` | Browser tab; switches to the light tint in dark browser themes |
| `web/mark.svg` | The nav mark on the dashboard |

- Minimum size: 16 px. Clear space: half the mark's width on every side.
- Do not rotate, outline, add a gradient, or place text inside the seal.
- The wordmark is "Beforehand" set in Newsreader 600, next to the mark at its cap height.

## Color

| Role | Hex | Use |
|---|---|---|
| Paper | `#F5F0E6` | Page background |
| Surface | `#FFFDF8` | Cards, tables |
| Rule | `#D9D1C1` | Borders and dividers |
| Ink | `#1E1B2E` | Headings |
| Body | `#3A3546` | Body text |
| Muted | `#5E5868` | Captions, sources, secondary text |
| Stamp violet | `#3B2F73` | The mark, links, buttons, the call |
| Violet strong | `#2B2257` | Button hover |
| Chart violet | `#7566C2` | Second series in charts, never text |
| Violet tint | `#E7E3F3` | Quiet highlight panels |
| Pass | `#1F6B3A` | Pass badges only |
| Fail | `#A3271F` | Fail badges only. Red always means fail. |

All 20 text and graphic pairs in `tokens.json` pass WCAG AA (run `python3 -I <skill>/scripts/contrast.py brand/tokens.json`). `tokens.css` holds the same values as CSS variables.

## Type

| Style | Font | Size and weight |
|---|---|---|
| The call ("Not yet.") | Newsreader italic | 56 px, 500 (48 px on phones) |
| Page title | Newsreader | 24 to 30 px, 600 |
| Section heading | Newsreader | 18 to 24 px, 600 |
| Rating line | IBM Plex Sans | 20 px, 400 with 600 for the label |
| Body | IBM Plex Sans | 15 px, 400 |
| Numbers | IBM Plex Sans | tabular figures, 600 |
| Caption, source | IBM Plex Sans | 13 px, 400, muted |

Numbers always use IBM Plex Sans, never Newsreader. Both fonts are stored in `web/fonts/` under the SIL Open Font License, so the dashboard works offline.

## Voice

Formal, dated, plain. State what was set, then what was found.

- Do: "Entry for November 1, 2026: one of three checks passed. The call is not yet: hold, do not buy."
- Do not: hype, exclamation marks, "moon", or any claim of third-party certification. The rule was time-stamped; it was not certified by anyone.
- Every claim about timing must match THESIS.md and the README's rule chronology.

## Illustration

Flat shapes, paper and violet, with no outlines and no gradients. Show the product's own objects: the sealed rule card and the opened results sheet (`directions/a-illustration.svg`). Not shipped on the dashboard yet.

## Where things are

- `BRIEF.md`: the brief, the category study and the name checks.
- `directions/`: the three directions the owner chose from on 2026-11-14, kept as the record of the decision.
- `SOURCES.md`: fonts and their licenses.
