#!/bin/bash
# AMPM: Claude Code hooks for session memory (MemPalace) and the knowledge graph (graphify).
# Wired in .claude/settings.json as  bash docs/tools/memory_hook.sh <event>  with the hook's JSON on stdin.
#
#   session-start  adds context to the session: the state of the project's memory wing and of the graph
#   stop           every SAVE_EVERY human messages, mines the session transcript into the wing (background)
#   precompact     mines the transcript before the context is compacted (background; the file survives)
#   session-end    final mine of the transcript (background)
#
# Every mine first runs docs/tools/redact_secrets.py on the transcript, which masks credentials in place
# (same length, so a transcript still being written is not disturbed) and writes the complete lines it
# scanned, masked, to a per-session snapshot in $STATE/redacted (0600 in a 0700 directory). The miner
# reads only that snapshot, so a line the session appends after the scan is never filed unscanned. The
# snapshot is reused by the session's next mine, which replaces it atomically and never with a shorter
# copy; a failed redaction skips the mine. Drawers an earlier mine filed under the live transcript path
# are left as they are (no longer refreshed): deleting memory is the developer's decision, not a hook's.
#
# MemPalace's own global hooks in ~/.claude/settings.json run for these sessions too. They mine the transcript into
# the project wing MemPalace derives from the cwd the transcript records (ampm for this folder and its worktrees;
# their diary checkpoints go to wing_ampm), and through docs/tools/mempalace_global_hook.sh (installed by
# install_global_memory_hooks.py) they read a --snapshot-only copy at this same snapshot path, never the live
# transcript, so both hooks' drawers share one source. The redactor
# holds an exclusive lock on the transcript while it masks it here and the global hooks a shared one while they
# read it. These hooks always name the wing, so every session run in this folder or in one of its worktrees can be
# found with  mempalace search "..." --wing ampm. Best effort throughout: a missing tool never fails the session.
set -u
EVENT="${1:-}"
WING="${AMPM_MEMORY_WING:-ampm}"
SAVE_EVERY="${AMPM_MEMORY_SAVE_EVERY:-10}"
PROJECT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
LOG="$HOME/Library/Logs/ampm-memory-hooks.log"
STATE="$HOME/.mempalace/hook_state"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
INPUT=$(cat)
mkdir -p "$(dirname "$LOG")" "$STATE" 2>/dev/null

log() { printf '%s [%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$EVENT" "$*" >> "$LOG"; }
field() {  # string field of the hook JSON, empty when absent
  printf '%s' "$INPUT" | python3 -c 'import json,sys
try: v = json.load(sys.stdin).get(sys.argv[1], "")
except Exception: v = ""
print(v if isinstance(v, str) else json.dumps(v))' "$1" 2>/dev/null
}
json_string() { python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'; }

SESSION_ID=$(field session_id); SESSION_ID="${SESSION_ID:-unknown}"
TRANSCRIPT=$(field transcript_path); TRANSCRIPT="${TRANSCRIPT/#\~/$HOME}"

valid_transcript() {
  [ -n "$1" ] || return 1
  case "$1" in *.jsonl|*.json) ;; *) return 1 ;; esac
  case "/$1/" in */../*) return 1 ;; esac
  [ -f "$1" ]
}

redact_transcript() {  # transcript, snapshot: masks the transcript in place and writes the masked snapshot;
  # non-zero means nothing may be mined
  local script="$PROJECT/docs/tools/redact_secrets.py"
  [ -f "$script" ] || { log "redact_secrets.py is missing from $PROJECT; not mining"; return 1; }
  ( umask 077; python3 "$script" --snapshot "$2" "$1" ) >> "$LOG" 2>&1 \
    || { log "secret redaction failed for $(basename "$1"); not mining"; return 1; }
}

palace_python() {  # the interpreter MemPalace runs under (its command's shebang); fails when there is none
  local py; py=$(sed -n '1s/^#!//p' "$(command -v mempalace 2>/dev/null)" 2>/dev/null)
  [ -n "$py" ] && [ -x "$py" ] && printf '%s' "$py"
}

mine_transcript() {  # mines one transcript into the wing; MemPalace skips a file it has already filed unchanged
  command -v mempalace >/dev/null 2>&1 || { log "mempalace is not installed; nothing mined"; return 0; }
  # CLAUDE.md: never file secrets or tokens. The miner gets the redacted snapshot, never the live file; a
  # snapshot that changed makes the miner purge its earlier drawers and file clean ones in their place.
  local snapshot; snapshot="$STATE/redacted/$(basename "$1")"
  redact_transcript "$1" "$snapshot" || return 0
  if mempalace mine "$snapshot" --mode convos --wing "$WING" >> "$LOG" 2>&1; then
    log "mined $(basename "$1") into wing $WING"
  else
    log "mine of $(basename "$1") failed or the palace was busy (see above)"
  fi
}

mine_in_background() { ( mine_transcript "$1" ) >/dev/null 2>&1 </dev/null & disown 2>/dev/null || true; }

human_messages() {  # number of human messages in a Claude Code transcript (MemPalace's counter, else a fallback)
  local py; py=$(palace_python)
  if [ -n "$py" ]; then "$py" -m mempalace.hook_shell count-human-messages "$1" 2>/dev/null && return; fi
  python3 - "$1" <<'PY' 2>/dev/null
import json, sys
n = 0
for line in open(sys.argv[1], encoding="utf-8", errors="replace"):
    try: d = json.loads(line)
    except Exception: continue
    if d.get("type") != "user": continue
    c = (d.get("message") or {}).get("content")
    if isinstance(c, str) or any(isinstance(p, dict) and p.get("type") == "text" for p in (c or [])): n += 1
print(n)
PY
}

case "$EVENT" in
  session-start)
    ctx="AMPM project memory and knowledge graph (hooks in .claude/settings.json, rules in CLAUDE.md)."$'\n'
    if command -v mempalace >/dev/null 2>&1; then
      wing=$(mempalace status 2>/dev/null | awk -v w="  WING: $WING" '$0==w{f=1;next} /WING:/{f=0} f && /ROOM:/{d+=$3; r=r (r?", ":"") $2 " " $3} END{if(d) printf "%d drawers (%s)", d, r; else printf "empty so far"}')
      ctx+="- MemPalace wing \"$WING\": ${wing:-unavailable}. Every session here is mined into it. Before answering about earlier sessions or past decisions, search it and quote what it returns: mempalace search \"<words>\" --wing $WING (MCP: palace_query FIND \"<words>\" IN $WING LIMIT 5); mempalace wake-up --wing $WING gives the short briefing."$'\n'
    else
      ctx+="- MemPalace is not installed on this machine (bash docs/tools/setup_memory.sh installs it); session memory is off."$'\n'
    fi
    if [ -f "$PROJECT/graphify-out/graph.json" ]; then
      gpy=$(cat "$PROJECT/graphify-out/.graphify_python" 2>/dev/null); [ -x "${gpy:-/nonexistent}" ] || gpy=$(sed -n '1s/^#!//p' "$(command -v graphify 2>/dev/null)" 2>/dev/null)
      gs=$("${gpy:-python3}" - "$PROJECT" <<'PY' 2>/dev/null
import json, sys, datetime
from pathlib import Path
root = Path(sys.argv[1]); g = root / "graphify-out" / "graph.json"
d = json.loads(g.read_text(encoding="utf-8"))
nodes = d.get("nodes", []); edges = d.get("links", d.get("edges", []))
comms = {n.get("community") for n in nodes if n.get("community") is not None}
built = datetime.date.fromtimestamp(g.stat().st_mtime).isoformat()
line = f"{len(nodes)} nodes, {len(edges)} edges, {len(comms)} communities"
try:
    from graphify.detect import detect_incremental
    from graphify.paths import out_path
    from graphify.watch import _read_build_excludes, _read_build_gitignore
    r = detect_incremental(root, extra_excludes=_read_build_excludes(out_path()), gitignore=_read_build_gitignore(out_path()))
    changed = sorted(str(Path(f).relative_to(root)) for fl in r.get("new_files", {}).values() for f in fl)
    deleted = r.get("deleted_files", [])
    if changed or deleted:
        shown = ", ".join(changed[:5]) + (f" (+{len(changed)-5} more)" if len(changed) > 5 else "")
        line += f". STALE: {len(changed)} changed and {len(deleted)} deleted file(s) since the last build ({shown}); run /graphify . --update to refresh it"
    else:
        line += ", up to date with the files"
except Exception as e:
    line += f" (freshness unknown: {type(e).__name__})"
print(line)
PY
)
      ctx+="- Knowledge graph graphify-out/graph.json: ${gs:-present}. Ask it before grepping: graphify query \"<question>\", graphify explain \"<concept>\", graphify path \"<A>\" \"<B>\" (MCP server graphify: query_graph). GRAPH_REPORT.md has the overview."$'\n'
    else
      ctx+="- No knowledge graph yet: run /graphify . to build graphify-out/ (commit it so every worktree has it)."$'\n'
    fi
    log "context injected (${#ctx} chars)"
    printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":%s}}\n' "$(printf '%s' "$ctx" | json_string)"
    ;;
  stop)
    if valid_transcript "$TRANSCRIPT"; then
      n=$(human_messages "$TRANSCRIPT"); n="${n:-0}"; case "$n" in ''|*[!0-9]*) n=0 ;; esac
      marker="$STATE/${WING}_${SESSION_ID}_last_save"; last=0
      [ -f "$marker" ] && last=$(tr -dc '0-9' < "$marker"); last="${last:-0}"
      if [ "$n" -gt 0 ] && [ $((n - last)) -ge "$SAVE_EVERY" ]; then
        printf '%s' "$n" > "$marker"; log "session $SESSION_ID at $n human messages: mining"
        mine_in_background "$TRANSCRIPT"
      fi
    fi
    printf '{}\n'
    ;;
  precompact|session-end)
    if valid_transcript "$TRANSCRIPT"; then
      log "session $SESSION_ID: mining transcript"; mine_in_background "$TRANSCRIPT"
      [ "$EVENT" = session-end ] && rm -f "$STATE/${WING}_${SESSION_ID}_last_save"
    fi
    printf '{}\n'
    ;;
  *)
    log "unknown event '$EVENT'"; printf '{}\n'
    ;;
esac
exit 0
