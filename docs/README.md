# AMPM Platform — Design Package

**Status:** drafts, version 0.2, 25 October 2026. AMPM answered all 25 questions on 25 October; the answers are applied to every draft (each opens with a "Changes from AMPM's decisions" section) and stamped on every assumption. Eleven points remain to confirm, listed in the decision log; with the points raised while applying the answers they are the nineteen questions of Part A7, of which R1 to R4 and R17 were answered on 26 October 2026 and R5 carries a working decision. Nothing is signed off yet.

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
| A7 | [The questions still open](review/remaining-questions.md) | Round two: the nineteen points still open after the 25 October answers (R1 to R19), each with what AMPM's documents already say, our proposal and an answer box | Answer R1 to R19; a tick is enough where you agree with the proposal |
| A8 | [Short version](review/remaining-questions-short.md) | The same nineteen questions as one line each, with the proposal and tick boxes; three pages when printed | Decide from this page, read A7 for the reasons |
| A9 | [Platform blueprint](review/platform-blueprint.md) | The platforms, how they connect, what each carries, the data model, the roles and the flows, each point marked locked, proposed or open (R number); the document to finalise the architecture and data model against | Read platform by platform; lock each section or mark what changes |
| A10 | [Blueprint, short version](review/platform-blueprint-short.md) | The same blueprint as a sign-off sheet: one page per platform plus the data model, flows and architecture tables, with a lock box for each | Sign off from this sheet, read A9 for the detail |
| A11 | [Build plan](review/build-plan.md) | The end-to-end build plan for one developer with Claude Code: how the work is done, the six phases with sprint themes and gates, effort in developer-days with the rates shown, cost, the decision calendar and AMPM's dates, the pilot and the launch, risks | Choose the capacity, the commercial form and the levers; then sign |
| A12 | [Build plan, short version](review/build-plan-short.md) | The same plan on a few pages: phases, effort, cost, AMPM's dates, decisions by sprint, levers, sign-off | Decide from this page, read A11 for the reasoning |

## Part B — developer drafts, for reference

| # | Document | What it is |
|---|---|---|
| B0 | [decision-log.md](decision-log.md) | AMPM's answer to every question, what it does to each assumption, and the items still to confirm (generated) |
| B1 | [requirements-audit.md](requirements-audit.md) | The audit of the brief: 9 conflicts, 44 gaps, 15 ambiguities, 8 risks, 25 decisions |
| B2 | [decision-register.md](decision-register.md) | Every assumption indexed by the question it depends on (generated) |
| B3 | [user-flows.md](user-flows.md) | Twelve end-to-end flows with statuses, notifications and screens |
| B4 | [wireframes.md](wireframes.md) | Screen-by-screen specification, 126 screens, with sketches |
| B5 | [data-model.md](data-model.md) | Entity-relationship model, 108 tables in 18 diagrams |
| B6 | [permission-matrix.md](permission-matrix.md) | Roles, entitlements, visibility classes, transitions, audited actions |
| B7 | [field-matrix.md](field-matrix.md) ([csv](field-matrix.csv)) | Every field: type, validation, editor, visibility, when required, automation (generated) |
| B8 | [architecture.md](architecture.md) | Technology, hosting, security, backups, maintenance, integration plan |
| B9 | [test-cases.md](test-cases.md) | 36 acceptance criteria, 208 tests, phase exit packs, test data |

The milestone schedule and cost estimate are Part A11, the build plan (version 0.1, 26 October 2026), drafted on the proposed defaults with a decision calendar; its capacity and commercial assumptions wait on the developer's planning inputs in [docs/planning/risk-questions.md](planning/risk-questions.md). The delivery model is one developer building with Claude Code (CLAUDE.md, decision D-012).

## How the identifiers work

| Prefix | Meaning | Defined in |
|---|---|---|
| Q1 to Q25 | A decision only AMPM can make | Part A2 and A5, and requirements-audit.md §11 |
| R1 to R19 | A point still open after AMPM's answers of 25 October 2026 | Part A7 |
| K1 to K22 | A planning risk question for the developer, answered before the schedule and estimate | docs/planning/risk-questions.md |
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

rebuilds `site/index.html`, the whole package rendered as one shareable page; add `--brief` to rebuild `site/brief.html`, the decision brief on its own, `--questions` for `site/questions.html`, the round-two questions with the short version first, `--short` for `site/short.html`, the short version alone, `--blueprint` for `site/blueprint.html`, the platform blueprint with its short version first, `--blueprint-short` for the sign-off sheet alone, `--plan` for `site/plan.html`, the build plan with its short version first, or `--plan-short` for the short plan alone (needs the `marked` package, installed with `npm install` inside `docs/tools`). The published copies for AMPM are private artifacts: the package at https://claude.ai/artifact/55fJPFQnnqi8sVVU7FUFcv, the brief at https://claude.ai/artifact/1VSdFMEAXfqj8V6NzkjPG3, the questions at https://claude.ai/artifact/8DGAsEb4hZX46wUoaLjLhH; republish after rebuilding so the links stay the same.

```bash
python3 docs/tools/pdf_build.py docs/site/questions.html "docs/site/AMPM Open Questions.pdf"
```

prints a built page to an A4 PDF with headless Google Chrome, rendering the diagrams first; the same works for `site/short.html` and the other pages. The PDFs live in `site/`, which is not committed.

Diagrams are Mermaid and render on GitHub, GitLab, VS Code with the Mermaid preview extension, Obsidian, and on the shared page.

## Engineering standards

The engineering layer under the blueprint is [docs/engineering/standards.md](engineering/standards.md): the review of the universal-app standards against AMPM's decisions, the AMPM edition of the standards (stack, layout, enforcement, rules in brief, the policy package, offline, the bootstrap plan) and the day-one checklist. The enforceable parts live in `.claude/rules/`, `.claude/hooks/` and `packages/config/eslint/boundaries.mjs`.

The data platform and identity service are compared with prices in [docs/engineering/platform-options.md](engineering/platform-options.md) (26 October 2026); the choice is the developer's and is recorded as R13.

The build as it stood on 27 October 2026 (main at d176d1a, the skeleton plus the offline spike) is checked against these standards and the build plan in [docs/engineering/build-verification-2026-10-27.md](engineering/build-verification-2026-10-27.md): a fresh clone set up from the README and a verified multi-agent audit, with what to fix before the next phase.

## Repositories and the Obsidian vault

The project is two private GitHub repositories under the project's own GitHub account, `app-ampm`:

| Repository | Folder | Holds |
|---|---|---|
| [ampm-platform](https://github.com/app-ampm/ampm-platform) | this folder | the design package, the audit, AMPM's source documents, the generators, and later the code |
| [ampm-vault](https://github.com/app-ampm/ampm-vault) | `vault/`, ignored by the project repository | the Obsidian vault: generated notes, a synced copy of `docs/`, a copy of `reference_docs/`, the Obsidian configuration |

Both repositories carry their own git identity (the `app-ampm` account's address) and a credential helper, `docs/tools/git-credential-ampm.sh`, which takes that account's token from the GitHub CLI keyring whichever `gh` account is active. Nothing committed in these folders is recorded under another account, and both scripts below refuse to commit if a repository has no identity of its own. After cloning, `bash docs/tools/setup_git.sh` restores the identity, the credential helper, the post-commit hook and the vault clone.

### Vault layout

Open `vault/` in Obsidian (File, Open folder as vault). `Home.md` is the hub. `notes/` holds one note per question with AMPM's decision, one per assumption with its status, one per audit finding, one per open item, and a log. `docs/` and `reference_docs/` are synced copies that render with their diagrams: edit the documents here in the project, not in the vault, because the next sync overwrites the copy. Notes written in Obsidian (open items, the log, your own notes) are kept and committed.

Three more things live in the vault. `notes/Sessions/` has one note per Claude Code session, created by the SessionStart hook and refreshed at the end of every turn with the requests made (the first line of each message), the commits and the files changed; Claude writes the Narrative section at wrap-up with what was decided and why. `notes/Build decisions/` holds D-nnn records for technical and process decisions taken during the build (context, decision, alternatives, consequences), created with `python3 docs/tools/new_decision.py "Title" --area <area>`; AMPM's own answers stay under `notes/Decisions/`. `AMPM Dashboard.base` is an Obsidian Bases file with live tables of open items, build decisions, sessions, AMPM's decisions, assumptions and findings, driven by the notes' properties, so it needs no generator.

### What runs automatically

| Trigger | Runs | Effect |
|---|---|---|
| Start of a Claude Code session in this folder (SessionStart hook) | `docs/tools/session_journal.py --start` | creates the session's journal note and tells Claude where it is |
| End of every Claude Code turn in this folder (Stop hook in `.claude/settings.json`) | `docs/tools/checkpoint.sh --hook` | commits and pushes the project if anything changed, then syncs the vault; shows a one-line message only when it committed |
| Every project commit (post-commit hook, installed by `setup_git.sh`) | `docs/tools/vault_sync.py` | copies `docs/` and `reference_docs/` into the vault, rebuilds the generated notes, appends to the day's sync log note, commits and pushes the vault when something changed |
| Every ten minutes (launchd agent `com.ampm.vault-sync`, definition in `docs/tools/`) | `docs/tools/vault_sync.py --vault-only` | commits and pushes edits made inside Obsidian |
| Start of every Claude Code session here (SessionStart hook) | `docs/tools/memory_hook.sh session-start` | tells the session what the memory wing and the knowledge graph hold and whether the graph is stale |
| Every ten human messages, before compaction, and at session end (Stop, PreCompact and SessionEnd hooks) | `docs/tools/memory_hook.sh` | masks credentials in the session transcript in place and mines it into the MemPalace wing `ampm`, in the background; where MemPalace's masking wrapper is installed it leaves the mine to MemPalace's own hook, which files the same snapshot into the same wing |
| Every project commit made by the checkpoint | `mempalace mine docs --wing ampm` | files new or changed design docs into the same wing |
| End of every turn, before compaction and at session end of every Claude Code session on the machine, any project (MemPalace's own hooks in `~/.claude/settings.json`), once `install_global_memory_hooks.py` has run | `~/.mempalace/bin/mempalace_global_hook.sh` | answers at once, then in the background hands MemPalace a credential-masked snapshot of the transcript instead of the live file; at session end removes the snapshots of transcripts Claude Code has deleted. Until the installer has run, MemPalace's hooks mine the live transcript, and the SessionStart context says so |
| Before every search or file read by Claude Code (PreToolUse hook, installed by `graphify install --project`) | `graphify hook-guard` | points the session at the knowledge graph instead of grepping when the graph can answer |

The checkpoint and the vault log to `~/Library/Logs/ampm-vault-sync.log`, the memory hooks to `~/Library/Logs/ampm-memory-hooks.log`, MemPalace's global hooks to `~/Library/Logs/mempalace-global-hooks.log`. By hand: `bash docs/tools/checkpoint.sh "message"` commits with your own message, `python3 docs/tools/vault_sync.py` syncs the vault without touching the project, and `python3 docs/tools/vault_build.py` only rebuilds the notes. Stop the timer with `launchctl bootout gui/$(id -u)/com.ampm.vault-sync`.

### Session memory and the knowledge graph

Two open-source tools, installed with `uv tool install` and wired into this repository, keep the work of every Claude Code session available to the next one:

| Tool | Upstream | What it holds here | How to use it |
|---|---|---|---|
| [MemPalace](https://github.com/mempalace/mempalace) 3.11 | local palace in `~/.mempalace`, wing `ampm` | the transcript of every session run in this folder or its worktrees, and the design docs; verbatim text, semantic search, no API calls | `mempalace search "<words>" --wing ampm`, `mempalace wake-up --wing ampm`; in a session the MCP server `mempalace` (`palace_query`, `palace_exec`) |
| [graphify](https://github.com/Graphify-Labs/graphify) 0.9 | `graphify-out/` in this repository | a knowledge graph of the design package, the generators and AMPM's source documents: concepts, screens, flows, decisions and the edges between them, each tagged as extracted or inferred | `/graphify .` builds or rebuilds it, `/graphify . --update` refreshes changed files; `graphify query "<question>"`, `graphify explain "<concept>"`, `graphify path "<A>" "<B>"`; `graphify-out/graph.html` in a browser; the MCP server `graphify` |

What is committed: `.claude/settings.json` (the hooks), `.mcp.json` (the two MCP servers, approved once per machine when Claude Code asks), `.claude/skills/graphify/` (the `/graphify` skill), `.graphifyignore` (generated tables and tooling are left out of the graph), `CLAUDE.md` (the rules every session follows) and `graphify-out/` (the graph, its report, the extraction cache and the manifest, so a fresh worktree queries the same graph without rebuilding). Not committed: the palace itself, which stays on the machine.

Credentials never reach the palace in clear (CLAUDE.md: never file secrets or tokens). The project hooks run `docs/tools/redact_secrets.py --snapshot` before every mine: it masks the transcript in place and writes the masked complete lines to `~/.mempalace/hook_state/redacted/<session>.jsonl` (0600 in a 0700 folder), and only that snapshot is mined. The redactor knows the token formats of GitHub, GitLab, AWS, Slack, Stripe, Razorpay, Google, SendGrid, Hugging Face, DigitalOcean, Shopify, Atlassian, Mailgun, Square, Firebase Cloud Messaging, npm and the `sk-` keys, JWTs, private keys, passwords in URLs, after `mysql -p` and in `curl -u`, session cookies, the value of any key whose name says it holds a secret (`DATABASE_PASSWORD=`, `"client_secret":`, `SECRET_KEY`, `x-api-key:`, `--password`), a letters-only password of an UPPER_SNAKE `.env` or YAML key or of a `--password=` flag included, and the value of a key of any other owner when it looks generated (`ALGOLIA_ADMIN_KEY=`, `AccountKey=`), unless that value is code, a type, a path or a shell expansion; it replaces a link or a stale file at the snapshot path instead of reading it.

MemPalace's own hooks in `~/.claude/settings.json` run for every Claude Code session on the machine, whatever the project, and mine the live transcript. `python3 docs/tools/install_global_memory_hooks.py` (run by `setup_memory.sh`) copies `mempalace_global_hook.sh` and the redactor into `~/.mempalace/bin` and rewrites every MemPalace hook command there, under any hooks key, to that wrapper for the event it runs, with a timestamped backup beside the file and every other byte left as it is. The new command answers `{}` by itself once `~/.mempalace` is removed, MemPalace's own off switch. The wrapper answers `{}` at once and leaves the work to a worker detached into a session of its own. The worker takes a per-session lock (a Stop gives way to a running worker, PreCompact and SessionEnd wait for it, at most two minutes), writes a snapshot with `--snapshot-only` to the same path, which reads the transcript and never edits it, since another project's transcript is not ours to change, and runs `mempalace hook run` on that snapshot with a payload of only the fields MemPalace reads, without `MEMPAL_DIR` (with which MemPalace would mine a folder raw) and under a ten-minute limit; a failed redaction, or a snapshot that is a link, runs nothing, and so does a `~/.mempalace` removed before MemPalace starts: the worker and the redactor make their folders only inside an existing `~/.mempalace`, and the worker checks for it, and for its own installed copy, again after the scan and just before MemPalace runs (once MemPalace has started, its run and the mine it detaches can make `~/.mempalace` again, as its own hooks always could). AMPM's project hooks do nothing either while `~/.mempalace` is gone. Its Python runs isolated (`-I`) from `/`, so no module of the session's folder is ever loaded. It logs one line per run, with what MemPalace's own log says of its diary checkpoint and ingest. MemPalace derives the same wing for the snapshot as for the live file when the transcript records the session's working directory in its first 200 lines, as every transcript on the development Mac does (228 of 228, 27 October 2026); AMPM sessions land in `ampm`, MemPalace's diary checkpoints in `wing_ampm`, as before, and the worker logs a warning for a transcript without one, which MemPalace would file in `sessions`. Once the wrapper is wired, the project hooks still mask the transcript in place but leave the mine to MemPalace's hook: two mines of one snapshot at once made MemPalace's diary checkpoint fail, and its ingest files the same snapshot into the same wing. What the immediate answer gives up is MemPalace's "checkpoint saved" line in the terminal and its legacy block mode (`hooks.silent_save: false`, off by default), for which the worker logs a warning. Snapshot drawers keep their path under `~/.mempalace/hook_state/redacted`, outside `~/.claude/projects`, so `mempalace audit` and `mempalace wings split` do not list them, as for AMPM's own snapshots before.

The installed copies do not follow the repository: re-run the installer after any change to `redact_secrets.py` or `mempalace_global_hook.sh`, from the checkout whose version should apply (normally main). `--check` exits 1 while a hook still mines unmasked, a MemPalace Claude Code plugin is enabled (its hooks do not pass through the wrapper), or an installed copy differs from the checkout; `memory_hook.sh session-start` runs it and puts a warning in the session's context while it fails. `--uninstall` puts MemPalace's own commands back. The installer also replaces MemPalace's older shell hooks (`mempal_save_hook.sh`, `mempal_precompact_hook.sh`), which filed running sessions under the shared wing `wing_api`; re-key what they left there with `mempalace wings split --wing wing_api` (plan first, then `--yes`, then `mempalace hallways --rebuild`), as was done on the development Mac on 26 October 2026. `setup_memory.sh` prints this reminder when it finds them.

On a new machine run `bash docs/tools/setup_memory.sh`: it installs the two CLIs at the tested versions, runs the global hook installer, and backfills the wing with the project's transcripts (each redacted snapshot mined on its own, since the snapshot folder also holds other projects' sessions) and docs. Memory and graph are independent of the vault: the vault is the human-readable record for Obsidian (including the session journal and the build decision records), the palace and the graph are what a session reads.

### Recording a confirmation from AMPM

Open-item and log notes are written once and kept, so record the confirmation in the open item's note (set `status: confirmed`), update `docs/decisions.json`, then run `apply_decisions.py`, `decision_log_build.py`, `decision_register_build.py`, `assumptions_sheet_build.py`, `vault_build.py` and `site_build.mjs` (with `--brief` too) and republish the two shared pages. The next checkpoint commits everything and the vault follows.

## Source documents

The brief AMPM supplied is in `../reference_docs/`: the business explanation, the "Why AMPM App" note, the Developer Technical Specification v1.0, and two Level-1 flowcharts. The drafts cite them as BIZ, WHY, SPEC, TEAM-FLOW and PORTAL-FLOW. AMPM's answers of 25 October 2026 are in `../reference_docs/answers/`.
