#!/bin/bash
# Tests for docs/tools/mempalace_global_hook.sh, the wrapper MemPalace's global hooks run through: MemPalace only ever
# gets a masked snapshot of the transcript (CLAUDE.md, "Session memory": never file secrets or tokens), the hook
# answers {} at once whatever the transcript's size, and the live transcript is never edited.
#
#   bash docs/tools/mempalace_global_hook_test.sh   # prints "global hook tests passed", exit 0
#
# Runs every hook with a scratch HOME and the minimal environment a hook gets (HOME and PATH=/usr/bin:/bin), and a
# stand-in mempalace in $HOME/.local/bin that records, per call, its argv, the payload it read and a copy of the file
# transcript_path named, then sleeps for the seconds in $HOME/slow. Never touches ~/.mempalace, ~/.claude or
# ~/Library/Logs.
set -u
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
HOOK="$REPO/docs/tools/mempalace_global_hook.sh"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/ampm-global-hook-test.XXXXXX")"
H="$SCRATCH/home"; LOG="$H/Library/Logs/mempalace-global-hooks.log"; CALLS="$H/calls"
REDACTED="$H/.mempalace/hook_state/redacted"; LOCKS="$H/.mempalace/hook_state/global_hooks"
PROJECTS="$SCRATCH/projects/-Users-dev-code-other"; FAILURES=0
PYTHON3="$(command -v python3)"
cleanup() {
  [ -n "${HOLDER:-}" ] && kill "$HOLDER" 2>/dev/null
  chmod -R u+rwx "$SCRATCH" 2>/dev/null; rm -rf "$SCRATCH"
}
trap cleanup EXIT
mkdir -p "$H/.local/bin" "$PROJECTS"

fail() { echo "FAIL: $*"; FAILURES=$((FAILURES + 1)); }
token() { printf 'gh%s_%s' p "$(printf 'Zq%.0s' $(seq 1 18))$1"; }  # assembled at run time
record() { python3 -c 'import json,sys; print(json.dumps({"type": "user", "message": {"content": sys.argv[1]}}))' "$1"; }
mode() { python3 -c 'import os,sys; print(oct(os.stat(sys.argv[1]).st_mode & 0o777))' "$1" 2>/dev/null; }
payload() {  # session, transcript path: a hook payload with fields MemPalace never reads, which must pass unchanged
  python3 -c 'import json,sys
print(json.dumps({"session_id": sys.argv[1], "transcript_path": sys.argv[2], "cwd": "/Users/dev/code/other",
  "hook_event_name": "Stop", "stop_hook_active": True, "reason": "other", "marker": "payload-marker-7f3",
  "nested": {"list": [1, 2.5, None, "café"], "empty": {}}}))' "$1" "$2"
}

{ printf '#!%s\n' "$PYTHON3"; cat <<'STANDIN'
"""Stand-in for mempalace: one directory per call with argv, the payload and a copy of transcript_path's file."""
import json, os, shutil, sys, tempfile, time
start = time.time()
calls = os.path.expanduser("~/calls")
os.makedirs(calls, exist_ok=True)
call = tempfile.mkdtemp(prefix="call-", dir=calls)
with open(os.path.join(call, "argv"), "w") as out:
    out.write(" ".join(sys.argv[1:]))
payload = sys.stdin.read()
with open(os.path.join(call, "payload"), "w") as out:
    out.write(payload)
try:
    shutil.copy(json.loads(payload)["transcript_path"], os.path.join(call, "transcript"))
except Exception:
    pass
try:
    time.sleep(float(open(os.path.expanduser("~/slow")).read()))
except (OSError, ValueError):
    pass
with open(os.path.join(call, "times"), "w") as out:
    out.write(f"{start} {time.time()}")
print("{}")
STANDIN
} > "$H/.local/bin/mempalace"
chmod +x "$H/.local/bin/mempalace"

cat > "$SCRATCH/timed.py" <<'PY'
"""Runs the hook as Claude Code does, with a minimal environment; prints seconds, exit status and stdout."""
import os, subprocess, sys, time
hook, event, payload = sys.argv[1:4]
env = {"HOME": os.environ["H"], "PATH": "/usr/bin:/bin"}
env.update(e.split("=", 1) for e in sys.argv[4:])
start = time.monotonic()
done = subprocess.run(["/bin/bash", hook, event], input=payload.encode(), capture_output=True, env=env, timeout=60)
print(f"{time.monotonic() - start:.3f} {done.returncode} {done.stdout.decode().strip()}")
PY

cat > "$SCRATCH/calls.py" <<'PY'
"""What the stand-in got: one line per call of the session given, oldest first: start end event transcript_path."""
import glob, json, os, sys
rows = []
for call in glob.glob(os.path.join(sys.argv[1], "call-*")):
    try:
        payload = json.load(open(os.path.join(call, "payload")))
        start, end = open(os.path.join(call, "times")).read().split()
    except (OSError, ValueError):
        continue  # still running
    if payload.get("session_id") == sys.argv[2]:
        argv = open(os.path.join(call, "argv")).read().split()
        rows.append((float(start), float(end), argv[3] if len(argv) > 3 else "?", payload["transcript_path"], call))
for row in sorted(rows):
    print(*row)
PY

run_hook() {  # event, payload[, VAR=value...]: runs the hook; fails unless it answers {} with status 0 in under 1 s
  local event="$1" json="$2" seconds status out; shift 2
  read -r seconds status out < <(H="$H" python3 "$SCRATCH/timed.py" "$HOOK" "$event" "$json" "$@")
  [ "$status" = 0 ] && [ "$out" = "{}" ] || fail "$event: the hook answered '$out' with status $status"
  python3 -c 'import sys; sys.exit(0 if float(sys.argv[1]) < 1 else 1)' "$seconds" \
    || fail "$event: the hook took $seconds s to answer (must be under 1 s)"
}
log_lines() { local n; n=$(grep -c " session=$1 " "$LOG" 2>/dev/null); echo "${n:-0}"; }  # runs a session logged
wait_for_runs() {  # session, count: waits (up to 30 s) until the session's workers have logged count runs
  for _ in $(seq 1 150); do [ "$(log_lines "$1")" -ge "$2" ] && return 0; sleep 0.2; done
  fail "session $1: $(log_lines "$1") of $2 run(s) logged"; return 1
}
calls_of() { python3 "$SCRATCH/calls.py" "$CALLS" "$1"; }

test_events_answer_at_once_and_mempalace_reads_only_the_snapshot() {
  local live="$PROJECTS/big.jsonl" expected="$SCRATCH/big.expected" first second third event session
  first=$(token A); second=$(token B); third=$(token C)
  python3 - "$live" <<'PY'
import json, sys
filler = json.dumps({"type": "assistant", "message": {"content": "x" * 2000}}) + "\n"
with open(sys.argv[1], "w") as out:
    out.write(filler * 8000)  # about 16 MB: the hook must still answer at once
PY
  record "first turn $first" >> "$live"; record "plain turn" >> "$live"; cp "$live" "$expected"
  echo 1 > "$H/slow"
  for event in stop precompact session-end; do
    session="big-$event"
    run_hook "$event" "$(payload "$session" "$live")"
    record "appended while the worker runs $second" | tee -a "$expected" >> "$live"  # complete: scanned if read
    printf '%s' "$(record "half written $third")" | tee -a "$expected" >> "$live"   # no newline: never read
    sleep 0.3; printf '\n' | tee -a "$expected" >> "$live"
  done
  for event in stop precompact session-end; do
    wait_for_runs "big-$event" 1 || continue
    local rows; rows=$(calls_of "big-$event")
    [ "$(printf '%s\n' "$rows" | grep -c .)" = 1 ] || { fail "$event: expected one MemPalace call, got: $rows"; continue; }
    local call; call=$(printf '%s' "$rows" | awk '{print $5}')
    [ "$(cat "$call/argv")" = "hook run --hook $event --harness claude-code" ] \
      || fail "$event: MemPalace was called as: $(cat "$call/argv")"
    [ "$(printf '%s' "$rows" | awk '{print $4}')" = "$REDACTED/big.jsonl" ] \
      || fail "$event: transcript_path was not the snapshot: $(printf '%s' "$rows" | awk '{print $4}')"
    grep -q "$live" "$call/argv" "$call/payload" && fail "$event: MemPalace was given the live transcript path"
    grep -q -e "$first" -e "$second" -e "$third" "$call/transcript" "$call/payload" \
      && fail "$event: a token reached MemPalace in clear"
    python3 - "$call/payload" "$(payload "big-$event" "$live")" <<'PY' || fail "$event: a payload field changed"
import json, sys
got, sent = json.load(open(sys.argv[1])), json.loads(sys.argv[2])
got.pop("transcript_path"), sent.pop("transcript_path")
sys.exit(0 if got == sent else 1)
PY
    grep " session=big-$event " "$LOG" | grep -q "transcript=big.jsonl ran mempalace hook run on the snapshot" \
      || fail "$event: no 'ran mempalace hook run' line: $(grep " session=big-$event " "$LOG")"
  done
  cmp -s "$live" "$expected" || fail "the live transcript was edited"
  grep -q "$first" "$live" || fail "the live transcript lost its token: it was masked in place"
  [ "$(mode "$REDACTED/big.jsonl")" = 0o600 ] || fail "the snapshot is not 0600: $(mode "$REDACTED/big.jsonl")"
  [ "$(mode "$REDACTED")" = 0o700 ] || fail "the snapshot directory is not 0700: $(mode "$REDACTED")"
  grep -q -e "payload-marker-7f3" -e "$first" -e "$second" "$LOG" && fail "the log holds payload content"
  [ -e "$LOCKS/big-session-end.lock" ] && fail "the session-end worker left its lock file"
  rm -f "$H/slow"
}

test_refused_transcripts_never_reach_mempalace() {
  local locked="$PROJECTS/locked.jsonl" lonely="$SCRATCH/lonely" before session
  record "secret $(token D)" > "$locked"; chmod 000 "$locked"
  record "x" > "$PROJECTS/notes.txt"; mkdir -p "$PROJECTS/dir.jsonl"; mkfifo "$PROJECTS/fifo.jsonl"
  mkdir -p "$lonely"; cp "$HOOK" "$lonely/"; record "y" > "$PROJECTS/ok.jsonl"
  before=$(ls "$CALLS" 2>/dev/null | wc -l)
  run_hook stop "$(payload r-unreadable "$locked")"
  run_hook stop '{"session_id": "r-missing"}'
  run_hook precompact "$(payload r-absent "$PROJECTS/absent.jsonl")"
  run_hook stop "$(payload r-dotdot "$PROJECTS/../-Users-dev-code-other/ok.jsonl")"
  run_hook stop "$(payload r-suffix "$PROJECTS/notes.txt")"
  run_hook session-end "$(payload r-directory "$PROJECTS/dir.jsonl")"
  run_hook stop "$(payload r-fifo "$PROJECTS/fifo.jsonl")"
  run_hook stop 'not json at all'
  read -r _ status out < <(H="$H" python3 "$SCRATCH/timed.py" "$lonely/mempalace_global_hook.sh" stop \
    "$(payload r-lonely "$PROJECTS/ok.jsonl")")
  [ "$out" = "{}" ] || fail "the hook without its redactor answered '$out'"
  for session in r-unreadable r-missing r-absent r-dotdot r-suffix r-directory r-fifo unknown r-lonely; do
    wait_for_runs "$session" 1
  done
  sleep 0.5
  [ "$(ls "$CALLS" 2>/dev/null | wc -l)" -eq "$before" ] || fail "a refused transcript reached MemPalace"
  grep " session=r-unreadable " "$LOG" | grep -q "not run: redaction failed (Permission denied)" \
    || fail "no 'redaction failed' line: $(grep " session=r-unreadable " "$LOG")"
  grep " session=r-lonely " "$LOG" | grep -q "not run: redact_secrets.py is missing" || fail "no 'missing redactor' line"
  grep " session=r-fifo " "$LOG" | grep -q "not a regular file" || fail "no 'not a regular file' line for a FIFO"
  grep " session=r-dotdot " "$LOG" | grep -q "has a .. part" || fail "no '..' refusal line"
  [ -e "$REDACTED/locked.jsonl" ] && fail "an unreadable transcript left a snapshot"
  chmod 600 "$locked"; rm -f "$PROJECTS/fifo.jsonl"
}

test_stop_gives_way_and_session_end_waits() {
  local live="$PROJECTS/busy.jsonl" rows
  record "busy session" > "$live"; echo 2 > "$H/slow"
  run_hook stop "$(payload busy "$live")"
  for _ in $(seq 1 100); do ls "$CALLS"/call-*/argv >/dev/null 2>&1 && grep -lq busy "$CALLS"/call-*/payload 2>/dev/null \
    && break; sleep 0.1; done  # the first worker is inside MemPalace now
  run_hook stop "$(payload busy "$live")"
  run_hook session-end "$(payload busy "$live")"
  wait_for_runs busy 3
  sleep 0.5; rm -f "$H/slow"
  grep " session=busy " "$LOG" | grep -q "^.* stop session=busy .*skipped: a worker for this session is still running" \
    || fail "the second Stop did not skip: $(grep " session=busy " "$LOG")"
  rows=$(calls_of busy)
  [ "$(printf '%s\n' "$rows" | grep -c .)" = 2 ] || { fail "expected 2 MemPalace calls for busy, got: $rows"; return; }
  printf '%s\n' "$rows" | awk 'NR==1{end=$2; ev1=$3} NR==2{exit !(ev1=="stop" && $3=="session-end" && $1>=end)}' \
    || fail "SessionEnd did not wait for the running Stop worker: $rows"
}

test_stale_and_stuck_locks() {
  local live="$PROJECTS/stale.jsonl"
  record "stale lock" > "$live"; mkdir -p "$LOCKS"; : > "$LOCKS/stale.lock"  # left by a worker that died
  run_hook stop "$(payload stale "$live")"
  wait_for_runs stale 1 && grep " session=stale " "$LOG" | grep -q "ran mempalace hook run" \
    || fail "a stale lock file stopped the worker: $(grep " session=stale " "$LOG")"
  python3 -c 'import fcntl,os,sys,time
fd = os.open(sys.argv[1], os.O_WRONLY | os.O_CREAT | os.O_APPEND); fcntl.flock(fd, fcntl.LOCK_EX); time.sleep(30)' \
    "$LOCKS/stuck.lock" & HOLDER=$!
  sleep 0.5; record "stuck lock" > "$PROJECTS/stuck.jsonl"
  run_hook session-end "$(payload stuck "$PROJECTS/stuck.jsonl")" MEMPALACE_GLOBAL_HOOK_WAIT=1
  wait_for_runs stuck 1 && grep " session=stuck " "$LOG" | grep -q "ran mempalace hook run.*ran without the session lock" \
    || fail "SessionEnd did not run after its bounded wait: $(grep " session=stuck " "$LOG")"
  kill "$HOLDER" 2>/dev/null; wait "$HOLDER" 2>/dev/null; HOLDER=""
}

test_block_mode_is_reported() {
  record "block mode" > "$PROJECTS/block.jsonl"
  printf '{"hooks": {"silent_save": false}}\n' > "$H/.mempalace/config.json"
  run_hook stop "$(payload block "$PROJECTS/block.jsonl")"
  wait_for_runs block 1 && grep " session=block " "$LOG" | grep -q "warning: MemPalace's hooks.silent_save is off" \
    || fail "no block-mode warning: $(grep " session=block " "$LOG")"
  rm -f "$H/.mempalace/config.json"
}

test_only_hook_run_is_called_and_one_line_per_run() {
  local argv bad=0
  for argv in "$CALLS"/call-*/argv; do
    grep -Eq '^hook run --hook (stop|precompact|session-end) --harness claude-code$' "$argv" || bad=$((bad + 1))
  done
  [ "$bad" -eq 0 ] || fail "$bad MemPalace call(s) were not 'hook run'"
  awk '$3 !~ /^(stop|precompact|session-end)$/ || $4 !~ /^session=/ || $5 !~ /^transcript=/' "$LOG" | grep -q . \
    && fail "a log line is not 'time event session transcript outcome': $(head -3 "$LOG")"
  return 0
}

test_events_answer_at_once_and_mempalace_reads_only_the_snapshot
test_refused_transcripts_never_reach_mempalace
test_stop_gives_way_and_session_end_waits
test_stale_and_stuck_locks
test_block_mode_is_reported
test_only_hook_run_is_called_and_one_line_per_run
[ -n "${SHOW_LOG:-}" ] && cat "$LOG"  # SHOW_LOG=1 bash docs/tools/mempalace_global_hook_test.sh prints what the hooks logged
[ "$FAILURES" -eq 0 ] && echo "global hook tests passed" || echo "global hook tests: $FAILURES failure(s)"
[ "$FAILURES" -eq 0 ]
