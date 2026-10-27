#!/bin/bash
# MemPalace's global Claude Code hooks, made to mine only a credential-masked snapshot of the transcript.
# Installed by docs/tools/install_global_memory_hooks.py into ~/.mempalace/bin, next to a copy of redact_secrets.py,
# and wired in ~/.claude/settings.json in place of MemPalace's own three commands:
#
#   bash "<HOME>/.mempalace/bin/mempalace_global_hook.sh" stop|precompact|session-end   (hook JSON on stdin)
#
# These hooks run for every Claude Code session on the machine, whatever the project (CLAUDE.md, "Session memory":
# never file secrets or tokens). The hook only reads stdin, answers {} and exits 0 at once, for every event: a
# 142 MB transcript must not delay the end of a turn or a compaction. A detached worker (this script, --worker) then
#
#   1. takes a per-session lock, a flock(2) on $STATE/global_hooks/<session>.lock: a Stop worker skips when one for
#      the session is still running; PreCompact and SessionEnd wait for it, at most $WAIT seconds, and then run anyway,
#      so a final save is never skipped. The kernel drops the lock of a worker that died, so a stale lock file left
#      behind is simply locked again by the next worker;
#   2. validates transcript_path as MemPalace does (.jsonl or .json once resolved, no ".." part) and also requires a
#      regular file;
#   3. writes the masked complete lines to $STATE/redacted/<basename> (0600 in a 0700 directory) with
#      redact_secrets.py --snapshot-only, which only reads the live transcript: another project's transcript is never
#      edited. AMPM's project hooks (memory_hook.sh) write the same path, so both hooks' drawers share one source;
#   4. pipes the payload, with only transcript_path replaced by the snapshot path, to
#      mempalace hook run --hook <event> --harness claude-code. When anything before this fails, MemPalace is not run.
#
# One line per run goes to ~/Library/Logs/mempalace-global-hooks.log: time, event, session, transcript name and
# outcome, never the payload. The immediate {} gives up MemPalace's "checkpoint saved" systemMessage (cosmetic) and
# its legacy block mode (hooks.silent_save false in MemPalace's config.json, off by default), in which Stop asked
# Claude to save through MCP tools; the Stop worker logs a warning when that mode is on. Runs under macOS /bin/bash
# 3.2 and the minimal PATH a hook gets.
set -u
EVENT="${1:-}"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:${PATH:-/usr/bin:/bin}"
HERE="$(cd "$(dirname "$0")" && pwd)"
SELF="$HERE/$(basename "$0")"
STATE="$HOME/.mempalace/hook_state"
LOG="$HOME/Library/Logs/mempalace-global-hooks.log"
WAIT="${MEMPALACE_GLOBAL_HOOK_WAIT:-120}"  # seconds a PreCompact or SessionEnd worker waits for a running one
SESSION="unknown"; NAME="-"

# The Python the hook needs, one subcommand per step; stdlib only, so any python3 runs it.
HELPER='
import fcntl, json, os, re, stat, subprocess, sys, time
from pathlib import Path

command, args = sys.argv[1], sys.argv[2:]
if command == "detach":  # args: the worker command; stdin: the payload, handed to the worker in a new session
    payload = sys.stdin.buffer.read()
    worker = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                              close_fds=True, start_new_session=True)
    try:
        worker.stdin.write(payload)
        worker.stdin.close()
    except OSError:
        pass  # spawned: never start a second worker for this event
elif command == "fields":  # stdin: the payload; prints session id, transcript_path and its name for the log, NUL-separated
    try:
        data = json.loads(sys.stdin.read())
    except ValueError:
        data = None
    data = data if isinstance(data, dict) else {}
    session = re.sub(r"[^a-zA-Z0-9_-]", "", str(data.get("session_id", ""))) or "unknown"  # as MemPalace sanitizes it
    path = data.get("transcript_path", "")
    path = path if isinstance(path, str) and "\0" not in path else ""  # a NUL could not reach the next step intact
    name = re.sub(r"[\x00-\x1f\x7f\s]", "_", os.path.basename(path))[:120] or "-"
    sys.stdout.write("\0".join([session, path, name]) + "\0")
elif command == "validate":  # args: transcript_path; prints the resolved path, or the reason it is refused (exit 1)
    raw = args[0]
    if not raw:
        sys.exit(print("no transcript_path") or 1)
    if ".." in Path(raw).parts:  # MemPalace: the path as given, before expanduser and resolve
        sys.exit(print("transcript_path has a .. part") or 1)
    path = Path(raw).expanduser().resolve()
    if path.suffix not in (".jsonl", ".json"):
        sys.exit(print("transcript_path is not .jsonl or .json") or 1)
    try:
        mode = os.stat(path).st_mode
    except (OSError, ValueError):
        sys.exit(print("transcript_path does not exist") or 1)
    if not stat.S_ISREG(mode):
        sys.exit(print("transcript_path is not a regular file") or 1)
    sys.stdout.write(str(path))
elif command == "lock":  # args: seconds; locks fd 9, the session lock file the worker opened: exit 0 locked, 1 held
    deadline = time.monotonic() + float(args[0])
    while True:
        try:
            fcntl.flock(9, fcntl.LOCK_EX | fcntl.LOCK_NB)
            sys.exit(0)
        except BlockingIOError:
            if time.monotonic() >= deadline:
                sys.exit(1)
            time.sleep(0.2)
elif command == "rewrite":  # args: snapshot path; stdin: the payload; prints it with only transcript_path replaced
    data = json.loads(sys.stdin.read())
    data["transcript_path"] = args[0]
    sys.stdout.write(json.dumps(data))
elif command == "block-mode":  # exit 0 when MemPalace config.json turns its legacy block mode on (silent_save off)
    home = Path.home()
    legacy = home / ".mempalace"
    xdg = os.environ.get("XDG_CONFIG_HOME", "").strip()
    if os.environ.get("MEMPALACE_CONFIG_DIR", "").strip():  # the order of mempalace.config._default_config_dir
        folder = Path(os.environ["MEMPALACE_CONFIG_DIR"].strip()).expanduser()
    elif any((legacy / f).is_file() for f in ("config.json", "people_map.json", "palace/chroma.sqlite3")):
        folder = legacy
    elif xdg and Path(xdg).expanduser().is_absolute():
        folder = Path(xdg).expanduser() / "mempalace"
    else:
        folder = home / ".config" / "mempalace"
    try:
        hooks = json.loads((folder / "config.json").read_text(encoding="utf-8")).get("hooks", {})
    except (OSError, ValueError, AttributeError):
        sys.exit(1)
    sys.exit(0 if isinstance(hooks, dict) and not hooks.get("silent_save", True) else 1)
'
py() { python3 -c "$HELPER" "$@"; }

log_run() {  # outcome: the one line this run writes; never the payload
  mkdir -p "$(dirname "$LOG")" 2>/dev/null
  printf '%s %s session=%s transcript=%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$EVENT" "$SESSION" "$NAME" "$1" \
    >> "$LOG" 2>/dev/null
}

mempalace_command() {  # $HOME/.local/bin/mempalace, else the one on PATH; fails when there is none
  local found="$HOME/.local/bin/mempalace"
  [ -x "$found" ] || found=$(command -v mempalace 2>/dev/null)
  [ -n "$found" ] && [ -x "$found" ] && printf '%s' "$found"
}

work() {  # the detached worker: lock, validate, snapshot, then MemPalace on the snapshot
  local input transcript resolved snapshot mp out status payload note="" locked=no lock_file
  input=$(cat)
  command -v python3 >/dev/null 2>&1 || { log_run "not run: python3 is not installed"; return; }
  { IFS= read -r -d '' SESSION; IFS= read -r -d '' transcript; IFS= read -r -d '' NAME; } \
    < <(printf '%s' "$input" | py fields 2>/dev/null)
  SESSION="${SESSION:-unknown}"; NAME="${NAME:--}"; transcript="${transcript:-}"

  # One worker per session at a time: Stop gives way, PreCompact and SessionEnd wait (bounded), then go on.
  mkdir -p "$STATE/global_hooks" 2>/dev/null && chmod 700 "$STATE/global_hooks" 2>/dev/null
  lock_file="$STATE/global_hooks/$SESSION.lock"
  if { exec 9>>"$lock_file"; } 2>/dev/null; then
    py lock "$([ "$EVENT" = stop ] && echo 0 || echo "$WAIT")" && locked=yes
  fi
  if [ "$locked" = no ]; then
    [ "$EVENT" = stop ] && { log_run "skipped: a worker for this session is still running"; return; }
    note=" (ran without the session lock: not free after ${WAIT} s)"
  fi

  resolved=$(py validate "$transcript" 2>/dev/null) || { log_run "not run: ${resolved:-transcript_path refused}$note"; return; }
  [ -f "$HERE/redact_secrets.py" ] || { log_run "not run: redact_secrets.py is missing from $HERE$note"; return; }
  mp=$(mempalace_command) || { log_run "not run: mempalace is not installed$note"; return; }

  # CLAUDE.md: never file secrets or tokens. MemPalace reads only this masked copy, never the live transcript.
  snapshot="$STATE/redacted/$(basename "$resolved")"
  out=$( (umask 077; python3 "$HERE/redact_secrets.py" --snapshot-only "$snapshot" "$resolved") 2>&1 9>&- )
  status=$?
  if [ "$status" -ne 0 ] || [ ! -f "$snapshot" ]; then
    out=$(printf '%s\n' "$out" | sed -n 's/.*not redacted (\(.*\))$/\1/p' | head -1)
    log_run "not run: redaction failed (${out:-exit $status})$note"; return
  fi
  out=$(printf '%s\n' "$out" | sed -n 's/.*: \([0-9][0-9]*\) credential.*/\1/p' | head -1)
  payload=$(printf '%s' "$input" | py rewrite "$snapshot" 2>/dev/null) \
    || { log_run "not run: the payload could not be rewritten$note"; return; }
  [ "$EVENT" = stop ] && py block-mode 2>/dev/null \
    && note="$note (warning: MemPalace's hooks.silent_save is off, so its Stop would ask Claude to save; this hook answers {})"

  if printf '%s' "$payload" | "$mp" hook run --hook "$EVENT" --harness claude-code > /dev/null 2>&1 9>&-; then
    log_run "ran mempalace hook run on the snapshot (${out:-0} credential(s) masked)$note"
  else
    log_run "mempalace hook run failed on the snapshot (${out:-0} credential(s) masked; see its hook.log)$note"
  fi
  # The session is over: drop its lock file while still holding the lock (a later worker makes a new one).
  [ "$EVENT" = session-end ] && [ "$locked" = yes ] && rm -f "$lock_file"
  return 0
}

case "$EVENT" in
  stop|precompact|session-end)
    INPUT=$(cat)
    printf '{}\n'
    # The worker runs in a new session with no tie to the hook's stdout, so Claude Code is never held up by it.
    if ! { printf '%s' "$INPUT" | py detach "${BASH:-/bin/bash}" "$SELF" --worker "$EVENT"; } >/dev/null 2>&1; then
      ( printf '%s' "$INPUT" | "${BASH:-/bin/bash}" "$SELF" --worker "$EVENT" ) </dev/null >/dev/null 2>&1 &
    fi
    ;;
  --worker)
    EVENT="${2:-}"
    case "$EVENT" in stop|precompact|session-end) work ;; *) log_run "not run: unknown event" ;; esac
    ;;
  *)
    cat >/dev/null; printf '{}\n'; log_run "not run: unknown event"
    ;;
esac
exit 0
