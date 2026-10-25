#!/bin/bash
# One-time setup per machine for session memory (MemPalace) and the knowledge graph (graphify). Safe to re-run.
# Installs both CLIs with uv, then backfills the project's memory wing with every Claude Code transcript of this
# folder (worktrees included) and with the design docs. The project files that use them are committed:
# .claude/settings.json (hooks), .mcp.json (MCP servers), .claude/skills/graphify (the /graphify skill),
# CLAUDE.md (rules) and graphify-out/ (the graph itself).
set -e
cd "$(dirname "$0")/../.."
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
WING=ampm
MEMPALACE_VERSION=3.11.0      # tested versions; bump deliberately and re-run
GRAPHIFY_VERSION=0.9.95
command -v uv >/dev/null 2>&1 || { echo "uv is required (brew install uv): https://docs.astral.sh/uv/"; exit 1; }
uv tool install "mempalace==$MEMPALACE_VERSION"
uv tool install "graphifyy[pdf,office,mcp,leiden]==$GRAPHIFY_VERSION"
echo "mempalace $(mempalace --version 2>&1 | tail -1) / $(graphify --version 2>&1 | tail -1) installed under ~/.local/bin"

# The folder whose sessions belong to this project: the main checkout, not a worktree under .claude/worktrees/
MAIN="$PWD"; case "$MAIN" in */.claude/worktrees/*) MAIN="${MAIN%%/.claude/worktrees/*}" ;; esac
ENC=$(printf '%s' "$MAIN" | sed 's#[/. ]#-#g')      # Claude Code's transcript folder name for a project path
for d in "$HOME/.claude/projects/$ENC" "$HOME/.claude/projects/$ENC--claude-worktrees-"*; do
  [ -d "$d" ] || continue
  echo "== mining transcripts in $d into wing $WING"
  mempalace mine "$d" --mode convos --wing "$WING" || echo "   (skipped: palace busy or mine failed)"
done
echo "== mining docs/ into wing $WING"
mempalace mine docs --mode projects --wing "$WING" || echo "   (skipped: palace busy or mine failed)"

if [ ! -f graphify-out/graph.json ]; then
  echo "No knowledge graph in graphify-out/: in a Claude Code session here run  /graphify .  and commit graphify-out/."
fi
if grep -q "mempal_save_hook.sh" "$HOME/.claude/settings.json" 2>/dev/null; then
  cat <<EOT

Note: ~/.claude/settings.json runs MemPalace's own shell hooks (mempal_save_hook.sh / mempal_precompact_hook.sh). They file a
running session under the shared wing wing_api and overwrite the wing set by this project's hooks until the session ends.
To keep AMPM sessions in wing $WING while they run, change those two global hook commands to
  mempalace hook run --hook stop --harness claude-code      (Stop)
  mempalace hook run --hook precompact --harness claude-code (PreCompact)
and re-key the shared wing with: mempalace wings split --wing wing_api  (then --yes to apply the plan).
EOT
fi
cat <<EOT

Done. In Claude Code, approve the project MCP servers "mempalace" and "graphify" (.mcp.json) when asked.
Logs: ~/Library/Logs/ampm-memory-hooks.log (hooks), ~/.mempalace/hook_state/hook.log (MemPalace).
EOT
