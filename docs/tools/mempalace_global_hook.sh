#!/bin/bash
# MemPalace's global Claude Code hooks, made to mine only a credential-masked snapshot of the transcript.
# Installed by docs/tools/install_global_memory_hooks.py into ~/.mempalace/bin, next to a copy of redact_secrets.py,
# and wired in ~/.claude/settings.json in place of MemPalace's own commands, as a command that answers {} by itself
# when this file is gone (MemPalace's off switch is removing ~/.mempalace):
#
#   f="<HOME>/.mempalace/bin/mempalace_global_hook.sh"; if [ -f "$f" ]; then exec bash "$f" stop; fi; ...
#                                                      (stop, precompact or session-end; hook JSON on stdin)
#
# These hooks run for every Claude Code session on the machine, whatever the project (CLAUDE.md, "Session memory":
# never file secrets or tokens). The hook only reads stdin, answers {} and exits 0 at once, for every event: a
# 142 MB transcript must not delay the end of a turn or a compaction. A worker (this script, --worker), detached into
# a session of its own so a closing terminal does not end it, then
#
#   1. stops when ~/.mempalace is gone, and drops MEMPAL_DIR, with which MemPalace would mine a folder unmasked. It
#      makes its folders only inside an existing ~/.mempalace (so does the redactor), and checks again, for the
#      folder and for this installed copy, after the scan and just before MemPalace runs: a ~/.mempalace removed
#      before MemPalace starts stays removed and MemPalace is not run. Once MemPalace has started, its own run and
#      the mine it detaches can make ~/.mempalace again, as its unwrapped hooks always could;
#   2. takes a per-session lock, a flock(2) on $STATE/global_hooks/<session>.lock: a Stop worker skips when one for
#      the session is still running; PreCompact and SessionEnd wait for it, at most $WAIT seconds, and then run anyway,
#      so a final save is never skipped. The kernel drops the lock of a worker that died, and a worker that locked a
#      lock file since removed (by SessionEnd, or the sweep of files untouched for a day) opens the new one. A lock
#      that cannot be opened at all is logged as such, and the worker runs without it;
#   3. validates transcript_path as MemPalace does (.jsonl or .json once resolved, no ".." part) and also requires a
#      regular file;
#   4. writes the masked complete lines to $STATE/redacted/<basename> (0600 in a 0700 directory) with
#      redact_secrets.py --snapshot-only, which only reads the live transcript: another project's transcript is never
#      edited. It replaces whatever else is at that path (a link, a stale copy) and keeps only a newer masked copy of
#      the same transcript; the worker refuses a snapshot that is a link or has another link. AMPM's project hooks
#      (memory_hook.sh) write the same path, and leave the mine to this hook where it is wired;
#   5. pipes to mempalace hook run --hook <event> --harness claude-code a payload of only the fields MemPalace reads
#      (session_id, stop_hook_active, hook_event_name, cwd) and transcript_path set to the snapshot, and checks it
#      names nothing else. When anything before this fails, MemPalace is not run. The redactor and MemPalace each run
#      under a time limit ($TIMEOUT seconds), past which their process group is ended, so a hung call frees the lock;
#   6. at SessionEnd, removes the snapshots whose transcript Claude Code has deleted (redact_secrets.py --sweep).
#
# Every python3 runs isolated (-I) from /, and MemPalace without PYTHONPATH, so a json.py in the session's folder, or
# in a folder PYTHONPATH names, is never loaded. One
# line per run goes to ~/Library/Logs/mempalace-global-hooks.log: time, event, session, transcript name and outcome,
# with what MemPalace's hook.log says of its diary checkpoint and ingest (lines of another session can interleave),
# never the payload. The immediate {} gives up MemPalace's "checkpoint saved" systemMessage (cosmetic) and its legacy
# block mode (hooks.silent_save false in MemPalace's config.json, off by default), in which Stop asked Claude to save
# through MCP tools; the Stop worker logs a warning when that mode is on. Runs under macOS /bin/bash 3.2 and the
# minimal PATH a hook gets.
set -u
EVENT="${1:-}"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:${PATH:-/usr/bin:/bin}"
HERE="$(cd "$(dirname "$0")" && pwd)"
SELF="$HERE/$(basename "$0")"
cd / 2>/dev/null  # nothing below loads code from the session's folder
STATE="$HOME/.mempalace/hook_state"
LOG="$HOME/Library/Logs/mempalace-global-hooks.log"
number() { case "$1" in '' | *[!0-9]*) printf '%s' "$2" ;; *) printf '%s' "$1" ;; esac; }
WAIT=$(number "${MEMPALACE_GLOBAL_HOOK_WAIT:-}" 120)        # seconds a PreCompact or SessionEnd worker waits
TIMEOUT=$(number "${MEMPALACE_GLOBAL_HOOK_TIMEOUT:-}" 600)  # seconds the redactor, and MemPalace, may each take
SWEEP_DAYS=7                                                # a deleted transcript's snapshot is kept this long
SESSION="unknown"; NAME="-"

# The Python the hook needs, one subcommand per step; stdlib only, so any python3 runs it.
HELPER='
import fcntl, json, os, re, signal, stat, subprocess, sys, time
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
elif command == "fields":  # stdin: the payload; prints session id, transcript_path and its log name, NUL-separated
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
elif command == "lock":  # args: seconds, the lock file; locks fd 9, which the worker opened on it: exit 0 locked,
    # 4 held by another worker after the wait, 3 the file was removed or replaced meanwhile (reopen it), else an error
    try:
        deadline = time.monotonic() + float(args[0])
        while True:
            try:
                fcntl.flock(9, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    sys.exit(4)
                time.sleep(0.2)
        try:
            same = os.path.samestat(os.fstat(9), os.stat(args[1]))
        except FileNotFoundError:
            same = False
        if same:
            os.utime(args[1])  # in use: the sweep of lock files untouched for a day leaves it
        sys.exit(0 if same else 3)
    except (OSError, ValueError):
        sys.exit(2)
elif command == "run":  # args: seconds, then a command, run in a process group of its own with this stdio;
    # past the deadline the group is ended (TERM, then KILL) and the exit status is 124
    child = subprocess.Popen(args[1:], start_new_session=True)
    try:
        sys.exit(child.wait(timeout=float(args[0])))
    except subprocess.TimeoutExpired:
        for sig in (signal.SIGTERM, signal.SIGKILL):
            try:
                os.killpg(child.pid, sig)
                child.wait(timeout=5)
                break
            except ProcessLookupError:
                break
            except subprocess.TimeoutExpired:
                continue
        sys.exit(124)
elif command == "safe":  # args: the snapshot; exit 0 when it is a regular file of this user with one link, 0600
    try:
        info = os.lstat(args[0])
    except OSError:
        sys.exit(print("is missing") or 1)
    problem = ("is a symbolic link" if stat.S_ISLNK(info.st_mode) else
               "is not a regular file" if not stat.S_ISREG(info.st_mode) else
               "has another link" if info.st_nlink != 1 else
               "belongs to another user" if info.st_uid != os.geteuid() else
               "can be read by others" if info.st_mode & 0o077 else "")
    sys.exit(print(problem) or 1 if problem else 0)
elif command == "cwd":  # args: the snapshot; exit 0 when one of its first 200 lines records a cwd (as MemPalace reads)
    try:
        with open(args[0], encoding="utf-8", errors="replace") as handle:
            for number, line in enumerate(handle):
                if number >= 200:
                    break
                if "\"cwd\"" in line:
                    try:
                        cwd = json.loads(line).get("cwd")
                    except (ValueError, AttributeError):
                        continue
                    if isinstance(cwd, str) and cwd.strip("/\\"):
                        sys.exit(0)
    except OSError:
        pass
    sys.exit(1)
elif command == "rewrite":  # args: snapshot path; stdin: the payload; prints only the fields MemPalace reads, with
    # transcript_path set to the snapshot: nothing else of the payload (custom_instructions, say) reaches MemPalace
    data = json.loads(sys.stdin.read())
    kept = {key: data[key] for key in ("session_id", "stop_hook_active", "hook_event_name", "cwd")
            if isinstance(data.get(key), (str, bool))}
    kept["transcript_path"] = args[0]
    sys.stdout.write(json.dumps(kept))
elif command == "forwarded":  # args: snapshot, resolved and raw transcript_path; stdin: the payload to forward;
    # exit 0 only when its transcript_path is the snapshot and no other field names the live transcript
    data = json.loads(sys.stdin.read())
    live = [path for path in args[1:] if path]
    ok = isinstance(data, dict) and data.get("transcript_path") == args[0] and set(data) <= {
        "session_id", "stop_hook_active", "hook_event_name", "cwd", "transcript_path"}
    ok = ok and not any(isinstance(value, str) and any(path in value for path in live)
                        for key, value in data.items() if key != "transcript_path")
    sys.exit(0 if ok else 1)
elif command == "size":  # args: a file; prints its size, 0 when it does not exist
    try:
        print(os.path.getsize(args[0]))
    except OSError:
        print(0)
elif command == "outcome":  # args: MemPalace hook.log, its size before the run, the snapshot name, the session id;
    # prints what MemPalace logged since of its diary checkpoint and its ingest, in fixed words, never its text
    try:
        with open(args[0], "rb") as handle:
            offset = int(args[1])
            handle.seek(offset if offset <= os.fstat(handle.fileno()).st_size else 0)
            lines = handle.read(1 << 20).decode("utf-8", "replace").splitlines()
    except (OSError, ValueError):
        sys.exit(0)
    seen = []
    for line in lines:
        said = ("diary saved" if "iary checkpoint saved" in line else
                ("diary failed (palace busy)" if "held by" in line or "in progress" in line else "diary failed")
                if "iary checkpoint failed" in line or "iary checkpoint error" in line else
                "diary deferred" if "iary checkpoint deferred" in line else
                "no diary (no recent messages)" if "No recent messages to save" in line else
                "ingest started" if "ingest started: " + args[2] in line else
                "ingest sent to the daemon" if "ingest submitted to daemon: " + args[2] in line else
                "an ingest was already running" if "Skipping mine: target already running" in line else
                "ingest failed" if "ingest failed" in line or "ingest hook failed" in line else
                "a write was skipped (MemPalace write routing)" if "Operation skipped" in line else
                "no checkpoint due" if line.split("] ", 1)[-1].startswith("Session " + args[3] + ":") else "")
        if said and said not in seen:
            seen.append(said)
    if "no checkpoint due" in seen and len(seen) > 1:
        seen.remove("no checkpoint due")
    print(", ".join(seen))
elif command == "sweep-locks":  # args: the session lock folder, this worker lock file; removes lock files no worker
    # has taken for a day, each only while it is free (a worker still waiting on one then opens the new file)
    cutoff = time.time() - 86400
    for name in os.listdir(args[0]):
        path = os.path.join(args[0], name)
        if not name.endswith(".lock") or path == args[1]:
            continue
        try:
            fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
        except OSError:
            continue
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            if os.fstat(fd).st_mtime < cutoff:
                os.unlink(path)
        except OSError:
            pass
        finally:
            os.close(fd)
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
py() { python3 -I -c "$HELPER" "$@"; }

log_run() {  # outcome: the one line this run writes; never the payload
  mkdir -p "$(dirname "$LOG")" 2>/dev/null
  printf '%s %s session=%s transcript=%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$EVENT" "$SESSION" "$NAME" "$1" \
    >> "$LOG" 2>/dev/null
}

OFF="not run: ~/.mempalace is gone (MemPalace is switched off)"
switched_off() {  # MemPalace's off switch is removing ~/.mempalace; this file, installed in it, goes with it
  [ ! -d "$HOME/.mempalace" ] || [ ! -f "$SELF" ]
}

make_dir() {  # makes $1 (0700) inside a folder that exists, never a parent: a removed ~/.mempalace stays removed
  [ -d "$1" ] || mkdir -m 700 "$1" 2>/dev/null || [ -d "$1" ]
}

mempalace_command() {  # $HOME/.local/bin/mempalace, else the one on PATH; fails when there is none
  local found="$HOME/.local/bin/mempalace"
  [ -x "$found" ] || found=$(command -v mempalace 2>/dev/null)
  [ -n "$found" ] && [ -x "$found" ] && printf '%s' "$found"
}

take_lock() {  # sets locked=yes, or lock_problem to why not ("held" when another worker has it)
  local tries rc
  { make_dir "$STATE" && make_dir "$STATE/global_hooks" && chmod 700 "$STATE/global_hooks"; } 2>/dev/null \
    || { lock_problem="its folder could not be made"; return; }
  for tries in 1 2 3 4 5; do
    { exec 9>>"$lock_file"; } 2>/dev/null || { lock_problem="it could not be opened"; return; }
    py lock "$([ "$EVENT" = stop ] && echo 0 || echo "$WAIT")" "$lock_file"; rc=$?
    case "$rc" in
      0) locked=yes; return ;;
      4) lock_problem=held; return ;;
      3) exec 9>&-; lock_problem="it kept being replaced" ;;  # removed meanwhile: open the new one
      *) lock_problem="it could not be locked"; return ;;
    esac
  done
}

work() {  # the detached worker: lock, validate, snapshot, then MemPalace on the snapshot
  local input transcript resolved snapshot mp out status payload reason offset outcome note="" locked=no
  local lock_file lock_problem=""
  input=$(cat)
  command -v python3 >/dev/null 2>&1 || { log_run "not run: python3 is not installed"; return; }
  { IFS= read -r -d '' SESSION; IFS= read -r -d '' transcript; IFS= read -r -d '' NAME; } \
    < <(printf '%s' "$input" | py fields 2>/dev/null)
  SESSION="${SESSION:-unknown}"; NAME="${NAME:--}"; transcript="${transcript:-}"
  # MemPalace's off switch: nothing here recreates ~/.mempalace once the user removed it, even mid-run.
  switched_off && { log_run "$OFF"; return; }
  if [ -n "${MEMPAL_DIR+set}" ]; then  # MemPalace would mine that folder, unmasked, on every save
    note=" (warning: MEMPAL_DIR was set; MemPalace ran without it, so no folder was mined unmasked)"
    unset MEMPAL_DIR
  fi
  unset PYTHONPATH PYTHONHOME  # MemPalace runs from its own environment, never from modules the session points at

  # One worker per session at a time: Stop gives way, PreCompact and SessionEnd wait (bounded), then go on.
  lock_file="$STATE/global_hooks/$SESSION.lock"
  take_lock
  if [ "$locked" = no ]; then
    exec 9>&- 2>/dev/null
    if [ "$lock_problem" = held ]; then
      [ "$EVENT" = stop ] && { log_run "skipped: a worker for this session is still running$note"; return; }
      note="$note (ran without the session lock: still held after ${WAIT} s)"
    else
      note="$note (ran without the session lock: $lock_problem)"
    fi
  fi

  resolved=$(py validate "$transcript" 2>/dev/null) \
    || { log_run "not run: ${resolved:-transcript_path refused}$note"; return; }
  [ -f "$HERE/redact_secrets.py" ] || { log_run "not run: redact_secrets.py is missing from $HERE$note"; return; }
  mp=$(mempalace_command) || { log_run "not run: mempalace is not installed$note"; return; }

  # CLAUDE.md: never file secrets or tokens. MemPalace reads only this masked copy, never the live transcript.
  snapshot="$STATE/redacted/$(basename "$resolved")"
  if ! { make_dir "$STATE" && make_dir "$STATE/redacted"; }; then
    if switched_off; then log_run "$OFF$note"; else log_run "not run: the snapshot folder could not be made$note"; fi
    return
  fi
  out=$( (umask 077; py run "$TIMEOUT" python3 -I "$HERE/redact_secrets.py" --snapshot-only "$snapshot" "$resolved") \
    2>&1 9>&- )
  status=$?
  switched_off && { log_run "$OFF$note"; return; }  # removed during the scan (the redactor made no folder again)
  if [ "$status" -ne 0 ]; then
    [ "$status" -eq 124 ] && { log_run "not run: the redaction timed out after ${TIMEOUT} s$note"; return; }
    out=$(printf '%s\n' "$out" | sed -n 's/.*not redacted (\(.*\))$/\1/p' | head -1)
    log_run "not run: redaction failed (${out:-exit $status})$note"; return
  fi
  reason=$(py safe "$snapshot" 2>/dev/null) \
    || { log_run "not run: the snapshot ${reason:-could not be checked}$note"; return; }
  case "$out" in *"snapshot kept"*) note="$note (a newer masked copy of the transcript was kept)" ;; esac
  out=$(printf '%s\n' "$out" | sed -n 's/.*: \([0-9][0-9]*\) credential.*/\1/p' | head -1)
  py cwd "$snapshot" 2>/dev/null \
    || note="$note (warning: no cwd in the snapshot's first 200 lines, so MemPalace files it in wing sessions)"
  payload=$(printf '%s' "$input" | py rewrite "$snapshot" 2>/dev/null) \
    && printf '%s' "$payload" | py forwarded "$snapshot" "$resolved" "$transcript" 2>/dev/null \
    || { log_run "not run: the payload could not be cut down to the snapshot$note"; return; }
  [ "$EVENT" = stop ] && py block-mode 2>/dev/null \
    && note="$note (warning: MemPalace's hooks.silent_save is off: its Stop would ask Claude to save; this hook answers {})"

  offset=$(py size "$STATE/hook.log" 2>/dev/null)
  switched_off && { log_run "$OFF$note"; return; }  # the last moment it can still be honoured
  printf '%s' "$payload" | py run "$TIMEOUT" "$mp" hook run --hook "$EVENT" --harness claude-code > /dev/null 2>&1 9>&-
  status=$?
  outcome=$(py outcome "$STATE/hook.log" "${offset:-0}" "$(basename "$snapshot")" "$SESSION" 2>/dev/null)
  outcome="${out:-0} credential(s) masked${outcome:+; MemPalace: $outcome}"
  case "$status" in
    0) log_run "ran mempalace hook run on the snapshot ($outcome)$note" ;;
    124) log_run "mempalace hook run timed out after ${TIMEOUT} s on the snapshot ($outcome)$note" ;;
    *) log_run "mempalace hook run failed on the snapshot ($outcome; see its hook.log)$note" ;;
  esac
  if [ "$EVENT" = session-end ]; then  # the session is over: tidy up, the lock still held
    py run "$TIMEOUT" python3 -I "$HERE/redact_secrets.py" --sweep "$STATE/redacted" "$SWEEP_DAYS" >/dev/null 2>&1 9>&-
    py sweep-locks "$STATE/global_hooks" "$lock_file" 2>/dev/null 9>&-
    [ "$locked" = yes ] && rm -f "$lock_file"  # a worker waiting on it opens a new one (py lock)
  fi
  return 0
}

case "$EVENT" in
  stop|precompact|session-end)
    INPUT=$(cat)
    printf '{}\n'
    # The worker runs in a new session with no tie to the hook's stdout, so Claude Code is never held up by it.
    if ! { printf '%s' "$INPUT" | py detach "${BASH:-/bin/bash}" "$SELF" --worker "$EVENT"; } >/dev/null 2>&1; then
      ( trap '' HUP; printf '%s' "$INPUT" | "${BASH:-/bin/bash}" "$SELF" --worker "$EVENT" ) \
        </dev/null >/dev/null 2>&1 &
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
