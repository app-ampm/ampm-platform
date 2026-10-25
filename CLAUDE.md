# AMPM platform: notes for Claude Code sessions

Read [docs/README.md](docs/README.md) first: the reading order of the design package, how the identifiers work (Q1 to Q25, CF/GP/AM/RK findings, the assumption prefixes), and which files are generated and must never be edited by hand. AMPM's decisions are in `docs/decisions.json` and `docs/decision-log.md`; the points still to confirm are listed there. Sessions run in worktrees under `.claude/worktrees/`; every tool below treats them as this project.

## Session memory (MemPalace)

Every session in this folder or one of its worktrees is mined into the MemPalace wing `ampm` by the hooks in `.claude/settings.json` (every ten human messages, before compaction and at session end); the design docs are filed into the same wing by the checkpoint after each commit. The palace is local (`~/.mempalace`), nothing leaves the machine.

- Before answering about earlier sessions, past decisions or why something was done, search the wing and quote what it returns verbatim; if it has nothing, say so rather than guessing. CLI: `mempalace search "<words>" --wing ampm`; the short briefing is `mempalace wake-up --wing ampm`. MCP server `mempalace` (tool `palace_query`): `FIND "<words>" IN ampm LIMIT 5`.
- File a durable outcome of the session (a decision taken with the user, a confirmed fact, a correction) with `palace_exec` as a drawer in wing `ampm`, or `mempalace mine <file> --wing ampm` for a written note. Never file secrets or tokens.
- `bash docs/tools/setup_memory.sh` installs the tools on a new machine and backfills the wing; `~/Library/Logs/ampm-memory-hooks.log` shows what the hooks did.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.

The graph covers the design package, the generators and AMPM's source documents (`.graphifyignore` lists what is left out: generated tables and tooling). `graphify-out/` is committed so every checkout and worktree has the same graph; when `.md` documents change, refresh it with `/graphify . --update` in a session (the semantic pass needs the model; `graphify update .` alone only re-reads the code). Commit the refreshed `graphify-out/` with the change.

## Commits and the vault

Every turn ends with `docs/tools/checkpoint.sh` (Stop hook): it commits and pushes the project if anything changed, syncs the Obsidian vault (`vault/`, its own repository), and files the docs into the memory wing. Write proper commit messages when you commit yourself; rebuild generated files with the generators listed in docs/README.md instead of editing them.
