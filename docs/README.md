# AMPM Platform — Design Package

**Status:** drafts, version 0.2, 25 October 2026. AMPM answered all 25 questions on 25 October; the answers are applied to every draft (each opens with a "Changes from AMPM's decisions" section) and stamped on every assumption. Eleven points remain to confirm, listed in the decision log. Nothing is signed off yet.

The package has two parts. Part A is written for AMPM and needs no technical background. Part B is the developer drafts behind it, for reference.

## Part A — for AMPM to review and decide

| # | Document | What it is | What AMPM should do with it |
|---|---|---|---|
| A1 | This guide | Reading order and how the identifiers work | Read first |
| A2 | [Decision brief](review/decision-brief.md) | The short version, now with AMPM's answers under every question and the eleven points still to confirm | Confirm the remaining eleven points |
| A3 | [Your brief, annotated](review/annotated-brief.md) | Your five documents reproduced in full, with every finding placed at the passage it concerns | Read your own text with the callouts; most findings take a sentence to understand |
| A4 | [Your flowcharts, redrawn](review/redesigned-flowcharts.md) | Your two flowcharts and the customer journey, as supplied and as upgraded, with additions in green and changes in amber | Approve the structure, or mark boxes to change |
| A5 | [Decisions we need from you](review/open-decisions.md) | The 25 questions in plain language with choices, what we assumed, and a box for your answer | Answer the ten Tier 1 questions first |
| A6 | [Assumptions we took](review/assumptions-taken.md) | Every assumption made in place of an answer, grouped by theme, with a confirm column | Tick or correct each line |

## Part B — developer drafts, for reference

| # | Document | What it is |
|---|---|---|
| B0 | [decision-log.md](decision-log.md) | AMPM's answer to every question, what it does to each assumption, and the items still to confirm (generated) |
| B1 | [requirements-audit.md](requirements-audit.md) | The audit of the brief: 9 conflicts, 44 gaps, 15 ambiguities, 8 risks, 25 decisions |
| B2 | [decision-register.md](decision-register.md) | Every assumption indexed by the question it depends on (generated) |
| B3 | [user-flows.md](user-flows.md) | Twelve end-to-end flows with statuses, notifications and screens |
| B4 | [wireframes.md](wireframes.md) | Screen-by-screen specification, 124 screens, with sketches |
| B5 | [data-model.md](data-model.md) | Entity-relationship model, 106 tables in 17 diagrams |
| B6 | [permission-matrix.md](permission-matrix.md) | Roles, entitlements, visibility classes, transitions, audited actions |
| B7 | [field-matrix.md](field-matrix.md) ([csv](field-matrix.csv)) | Every field: type, validation, editor, visibility, when required, automation (generated) |
| B8 | [architecture.md](architecture.md) | Technology, hosting, security, backups, maintenance, integration plan |
| B9 | [test-cases.md](test-cases.md) | 36 acceptance criteria, 208 tests, phase exit packs, test data |

Not yet drafted: the milestone schedule and cost estimate, held until the platform (Q1) and volume (Q15) questions are answered.

## How the identifiers work

| Prefix | Meaning | Defined in |
|---|---|---|
| Q1 to Q25 | A decision only AMPM can make | Part A2 and A5, and requirements-audit.md §11 |
| CF, GP, AM, RK | Audit findings: conflict, gap, ambiguity, risk | requirements-audit.md §4 to §10; placed in context in Part A3 |
| A, P, T, U, W, V | Assumptions made in place of an answer: data model, permissions, technology, flows, screens, testing | Part A6, and §0 of each developer draft |
| PUB, AUTH, DM, CP, TW, GR | Screens: public site, sign-in, demo, client portal, team workspace, guest RSVP portal | wireframes.md |
| AC-nn.m | Test cases under acceptance criterion nn | test-cases.md |

When AMPM answers a question, the assumption lines that cite it (Part A6, or the decision register) are confirmed or replaced; then the tables, screens and tests that cite those lines; then the generated files are rebuilt.

## Generated files

These are generated and must not be edited by hand:

```bash
python3 docs/tools/field_matrix_build.py
```

rebuilds `field-matrix.md` and `field-matrix.csv` from the diagrams in `data-model.md` and the rules in `docs/tools/field_rules.py`.

```bash
python3 docs/tools/decision_register_build.py
```

rebuilds `decision-register.md` from the assumption registers and the audit's question list.

```bash
python3 docs/tools/assumptions_sheet_build.py
```

rebuilds `review/assumptions-taken.md` from the same registers, grouped by theme.

```bash
python3 docs/tools/apply_decisions.py && python3 docs/tools/decision_log_build.py
```

stamps AMPM's decisions from `decisions.json` on every assumption register and rebuilds `decision-log.md`. Edit `decisions.json` when AMPM confirms a remaining point, then run these and the three generators above.

```bash
node docs/tools/site_build.mjs
```

rebuilds `site/index.html`, the whole package rendered as one shareable page; add `--brief` to rebuild `site/brief.html`, the decision brief on its own (needs the `marked` package, installed with `npm install` inside `docs/tools`). The published copy for AMPM is the private artifact at https://claude.ai/artifact/55fJPFQnnqi8sVVU7FUFcv; republish it after rebuilding so the link stays the same.

Diagrams are Mermaid and render on GitHub, GitLab, VS Code with the Mermaid preview extension, Obsidian, and on the shared page.

## Obsidian vault

The project folder is an Obsidian vault (open `/Users/amardeepsingh/Desktop/AMPM` in Obsidian; the configuration is in `.obsidian/`). `Home.md` at the root is the hub. Under `notes/` there is one note per question with AMPM's decision, one per assumption with its status, one per audit finding, one per open item, and a log. Decision, assumption and finding notes are generated and rebuilt by:

```bash
python3 docs/tools/vault_build.py
```

Open-item and log notes are written once and kept, so record AMPM's confirmations in the open item's note, then update `decisions.json` and rebuild. The documents in `docs/` render in Obsidian with their diagrams.

## Source documents

The brief AMPM supplied is in `../reference_docs/`: the business explanation, the "Why AMPM App" note, the Developer Technical Specification v1.0, and two Level-1 flowcharts. The drafts cite them as BIZ, WHY, SPEC, TEAM-FLOW and PORTAL-FLOW. AMPM's answers of 25 October 2026 are in `../reference_docs/answers/`.
