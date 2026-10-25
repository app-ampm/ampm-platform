# AMPM Platform

Wedding-planning platform for AMPM: native iOS and Android apps with offline use, a public site and an API. The project is at the design stage: requirements audit, design package v0.2 with AMPM's decisions of 25 October 2026 applied, schedule and estimate held until eleven remaining points are confirmed.

Start with [docs/README.md](docs/README.md), the reading order for the design package. AMPM's own brief and answers are in [reference_docs](reference_docs/).

Decisions, assumptions, findings and open items are tracked as notes in the Obsidian vault, a separate private repository, [ampm-vault](https://github.com/app-ampm/ampm-vault), checked out at `vault/` and kept in sync automatically. "Repositories and the Obsidian vault" in docs/README.md explains the layout and the automation; after cloning run `bash docs/tools/setup_git.sh`.

Every Claude Code session here is remembered: transcripts are mined into a local MemPalace wing and a graphify knowledge graph of the package lives in `graphify-out/`. "Session memory and the knowledge graph" in docs/README.md explains both; `bash docs/tools/setup_memory.sh` installs the tools on a new machine.
