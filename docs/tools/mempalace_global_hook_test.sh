#!/bin/bash
# Tests for docs/tools/mempalace_global_hook.sh, the wrapper MemPalace's global hooks run through: MemPalace only ever
# gets a masked snapshot of the transcript and a payload cut down to the fields it reads (CLAUDE.md, "Session memory":
# never file secrets or tokens), the hook answers {} at once whatever the transcript's size, and the live transcript
# is never edited.
#
#   bash docs/tools/mempalace_global_hook_test.sh   # prints "global hook tests passed", exit 0
#
# Runs every hook with a scratch HOME and the minimal environment a hook gets (HOME and PATH=/usr/bin:/bin), and a
# stand-in mempalace in $HOME/.local/bin that records, per call, its argv, the payload it read, its MEMPAL* environment,
# whether it inherited fd 9, and a copy of the file transcript_path named; it appends $HOME/hooklog to MemPalace's
# hook.log, then sleeps for the seconds in $HOME/slow. A python3 shim beside it fails the helper step named in
# $HOME/fail_step (detach, lock...), or makes the one in $HOME/echo_step hand its input back unchanged. Never touches
# ~/.mempalace, ~/.claude or ~/Library/Logs.
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
  pkill -f "$H/.local/bin/mempalace" 2>/dev/null
  chmod -R u+rwx "$SCRATCH" 2>/dev/null; rm -rf "$SCRATCH"
}
trap cleanup EXIT
mkdir -p "$H/.local/bin" "$H/.mempalace" "$PROJECTS"

fail() { echo "FAIL: $*"; FAILURES=$((FAILURES + 1)); }
token() { printf 'gh%s_%s' p "$(printf 'Zq%.0s' $(seq 1 18))$1"; }  # assembled at run time
record() { python3 -c 'import json,sys; print(json.dumps({"type": "user", "message": {"content": sys.argv[1]}}))' "$1"; }
record_cwd() { python3 -c 'import json,sys
print(json.dumps({"type": "user", "cwd": "/Users/dev/code/other", "message": {"content": sys.argv[1]}}))' "$1"; }
mode() { python3 -c 'import os,sys; print(oct(os.stat(sys.argv[1]).st_mode & 0o777))' "$1" 2>/dev/null; }
links() { python3 -c 'import os,sys; i = os.lstat(sys.argv[1]); print(os.path.islink(sys.argv[1]), i.st_nlink)' "$1"; }
payload() {  # session, transcript path: a hook payload with fields MemPalace never reads, which must not reach it
  python3 -c 'import json,sys
print(json.dumps({"session_id": sys.argv[1], "transcript_path": sys.argv[2], "cwd": "/Users/dev/code/other",
  "hook_event_name": "Stop", "stop_hook_active": True, "reason": "other", "marker": "payload-marker-7f3",
  "custom_instructions": "keep " + sys.argv[3], "nested": {"list": [1, 2.5, None, "café"], "empty": {}}}))' \
    "$1" "$2" "$(token P)"
}

{ printf '#!%s\n' "$PYTHON3"; cat <<'STANDIN'
"""Stand-in for mempalace: one directory per call with what it was given; then it waits for the seconds in ~/slow."""
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
with open(os.path.join(call, "env"), "w") as out:
    out.write("".join(f"{k}={v}\n" for k, v in os.environ.items() if k.startswith("MEMPAL")))
try:
    os.fstat(9)
    fd9 = "open"
except OSError:
    fd9 = "closed"
with open(os.path.join(call, "fd9"), "w") as out:
    out.write(fd9)
try:
    shutil.copy(json.loads(payload)["transcript_path"], os.path.join(call, "transcript"))
except Exception:
    pass
try:
    lines = open(os.path.expanduser("~/hooklog")).read()
    with open(os.path.expanduser("~/.mempalace/hook_state/hook.log"), "a") as out:
        out.write(lines)
except OSError:
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
cat > "$H/.local/bin/python3" <<SHIM
#!/bin/bash
# python3 for the hook, failing only the helper step named in \$HOME/fail_step, or echoing for \$HOME/echo_step
[ -f "\$HOME/fail_step" ] && [ "\${4:-}" = "\$(cat "\$HOME/fail_step")" ] && exit 1
[ -f "\$HOME/echo_step" ] && [ "\${4:-}" = "\$(cat "\$HOME/echo_step")" ] && { cat; exit 0; }
exec "$PYTHON3" "\$@"
SHIM
chmod +x "$H/.local/bin/mempalace" "$H/.local/bin/python3"

cat > "$SCRATCH/timed.py" <<'PY'
"""Runs the hook as Claude Code does, with a minimal environment, in its own process group; prints seconds, exit
status and stdout. VAR=value arguments add to the environment; cwd=DIR runs it there; hangup ends its group after."""
import os, signal, subprocess, sys, time
hook, event, payload = sys.argv[1:4]
env = {"HOME": os.environ["H"], "PATH": "/usr/bin:/bin"}
cwd, hangup = None, False
for extra in sys.argv[4:]:
    if extra == "hangup":
        hangup = True
    elif extra.startswith("cwd="):
        cwd = extra[4:]
    else:
        env.update([extra.split("=", 1)])
start = time.monotonic()
child = subprocess.Popen(["/bin/bash", hook, event], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE, env=env, cwd=cwd, start_new_session=True)
out, _ = child.communicate(payload.encode(), timeout=60)
seconds = time.monotonic() - start
if hangup:  # a closing terminal, or Claude Code exiting: the hook's whole process group goes
    for sig in (signal.SIGHUP, signal.SIGTERM, signal.SIGKILL):
        try:
            os.killpg(child.pid, sig)
        except ProcessLookupError:
            pass
print(f"{seconds:.3f} {child.returncode} {out.decode().strip()}")
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

run_hook() {  # event, payload[, VAR=value | cwd=DIR | hangup...]: fails unless it answers {} with status 0 in under 1 s
  local event="$1" json="$2" seconds status out; shift 2
  read -r seconds status out < <(H="$H" python3 "$SCRATCH/timed.py" "$HOOK" "$event" "$json" "$@")
  [ "$status" = 0 ] && [ "$out" = "{}" ] || fail "$event: the hook answered '$out' with status $status"
  python3 -c 'import sys; sys.exit(0 if float(sys.argv[1]) < 1 else 1)' "$seconds" \
    || fail "$event: the hook took $seconds s to answer (must be under 1 s)"
}
log_lines() { local n; n=$(grep -c " session=$1 " "$LOG" 2>/dev/null); echo "${n:-0}"; }  # runs a session logged
log_of() { grep " session=$1 " "$LOG" 2>/dev/null; }
wait_for_runs() {  # session, count: waits (up to 30 s) until the session's workers have logged count runs
  for _ in $(seq 1 150); do [ "$(log_lines "$1")" -ge "$2" ] && return 0; sleep 0.2; done
  fail "session $1: $(log_lines "$1") of $2 run(s) logged"; return 1
}
calls_of() { python3 "$SCRATCH/calls.py" "$CALLS" "$1"; }
call_of() { calls_of "$1" | tail -1 | awk '{print $5}'; }  # the session's last finished MemPalace call
no_overlap() {  # session: its MemPalace calls never ran at the same time
  calls_of "$1" | awk 'NR > 1 && $1 < end {bad = 1} {end = $2} END {exit bad}'
}

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
    grep -q -e "$first" -e "$second" -e "$third" -e "$(token P)" "$call/transcript" "$call/payload" \
      && fail "$event: a token reached MemPalace in clear"
    python3 - "$call/payload" "$(payload "big-$event" "$live")" "$REDACTED/big.jsonl" <<'PY' \
      || fail "$event: the payload holds more, or other, than the fields MemPalace reads: $(cat "$call/payload")"
import json, sys
got, sent = json.load(open(sys.argv[1])), json.loads(sys.argv[2])
wanted = {key: sent[key] for key in ("session_id", "stop_hook_active", "hook_event_name", "cwd")}
sys.exit(0 if got == dict(wanted, transcript_path=sys.argv[3]) else 1)
PY
    [ "$(cat "$call/fd9")" = closed ] || fail "$event: MemPalace inherited the session lock (fd 9)"
    log_of "big-$event" | grep -q "transcript=big.jsonl ran mempalace hook run on the snapshot" \
      || fail "$event: no 'ran mempalace hook run' line: $(log_of "big-$event")"
  done
  cmp -s "$live" "$expected" || fail "the live transcript was edited"
  grep -q "$first" "$live" || fail "the live transcript lost its token: it was masked in place"
  [ "$(mode "$REDACTED/big.jsonl")" = 0o600 ] || fail "the snapshot is not 0600: $(mode "$REDACTED/big.jsonl")"
  [ "$(mode "$REDACTED")" = 0o700 ] || fail "the snapshot directory is not 0700: $(mode "$REDACTED")"
  grep -q -e "payload-marker-7f3" -e "$first" -e "$second" -e "$(token P)" "$LOG" && fail "the log holds payload content"
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
  log_of r-unreadable | grep -q "not run: redaction failed (Permission denied)" \
    || fail "no 'redaction failed' line: $(log_of r-unreadable)"
  log_of r-lonely | grep -q "not run: redact_secrets.py is missing" || fail "no 'missing redactor' line"
  log_of r-fifo | grep -q "not a regular file" || fail "no 'not a regular file' line for a FIFO"
  log_of r-dotdot | grep -q "has a .. part" || fail "no '..' refusal line"
  [ -e "$REDACTED/locked.jsonl" ] && fail "an unreadable transcript left a snapshot"
  chmod 600 "$locked"; rm -f "$PROJECTS/fifo.jsonl"
}

test_links_and_stale_files_at_the_snapshot_path_are_replaced() {
  local secret name live call
  secret=$(token L); mkdir -p "$REDACTED"
  for name in l-symlink l-hardlink l-stale; do
    live="$PROJECTS/$name.jsonl"; record "secret $secret" > "$live"; record "more" >> "$live"
    printf '%s' '{"partial' >> "$live"
  done
  ln -s "$PROJECTS/l-symlink.jsonl" "$REDACTED/l-symlink.jsonl"
  ln "$PROJECTS/l-hardlink.jsonl" "$REDACTED/l-hardlink.jsonl"
  { record "an older copy $secret"; record "padding padding padding padding padding padding"; } > "$REDACTED/l-stale.jsonl"
  chmod 644 "$REDACTED/l-stale.jsonl"
  for name in l-symlink l-hardlink l-stale; do run_hook stop "$(payload "$name" "$PROJECTS/$name.jsonl")"; done
  for name in l-symlink l-hardlink l-stale; do
    wait_for_runs "$name" 1 || continue
    call=$(call_of "$name")
    [ -n "$call" ] && ! grep -q "$secret" "$call/transcript" || fail "$name: MemPalace read the token in clear"
    [ "$(links "$REDACTED/$name.jsonl")" = "False 1" ] && [ "$(mode "$REDACTED/$name.jsonl")" = 0o600 ] \
      || fail "$name: the snapshot is still a link or not 0600: $(links "$REDACTED/$name.jsonl")"
    grep -q "$secret" "$PROJECTS/$name.jsonl" || fail "$name: the live transcript was written through the link"
  done
  # A redactor that leaves a link there anyway: the wrapper refuses it.
  local lonely="$SCRATCH/linky"; mkdir -p "$lonely"; cp "$HOOK" "$lonely/"
  cat > "$lonely/redact_secrets.py" <<'PY'
import os, sys
out, live = sys.argv[2:4]
os.makedirs(os.path.dirname(out), exist_ok=True)
if os.path.lexists(out):
    os.unlink(out)
os.symlink(live, out)
print(os.path.basename(live) + ": 0 credential(s) masked in the snapshot")
PY
  record "secret $secret" > "$PROJECTS/l-refused.jsonl"
  read -r _ _ _ < <(H="$H" python3 "$SCRATCH/timed.py" "$lonely/mempalace_global_hook.sh" stop \
    "$(payload l-refused "$PROJECTS/l-refused.jsonl")")
  wait_for_runs l-refused 1 && log_of l-refused | grep -q "not run: the snapshot is a symbolic link" \
    || fail "a linked snapshot was handed on: $(log_of l-refused)"
  [ -z "$(calls_of l-refused)" ] || fail "MemPalace was called on a linked snapshot"
  rm -f "$REDACTED/l-refused.jsonl"
}

test_no_code_from_the_session_folder_and_no_mempal_dir() {
  local project="$SCRATCH/project-with-json" call
  mkdir -p "$project"
  printf 'open(%s, "a").write("imported\\n")\n' "'$SCRATCH/json-imported'" > "$project/json.py"
  cp "$project/json.py" "$project/fcntl.py"; cp "$project/json.py" "$project/subprocess.py"
  record_cwd "from a folder with a json.py" > "$PROJECTS/c-json.jsonl"
  run_hook stop "$(payload c-json "$PROJECTS/c-json.jsonl")" "cwd=$project" "PYTHONPATH=$project" \
    "MEMPAL_DIR=$SCRATCH/projects"
  wait_for_runs c-json 1
  [ -e "$SCRATCH/json-imported" ] && fail "a module of the session's folder was imported: $(wc -l < "$SCRATCH/json-imported")"
  log_of c-json | grep -q "ran mempalace hook run" || fail "MemPalace did not run beside a json.py: $(log_of c-json)"
  log_of c-json | grep -q "warning: MEMPAL_DIR was set" || fail "no MEMPAL_DIR warning: $(log_of c-json)"
  log_of c-json | grep -q "no cwd in the snapshot" && fail "a cwd warning for a transcript that records one"
  call=$(call_of c-json)
  [ -n "$call" ] && ! grep -q MEMPAL_DIR "$call/env" || fail "MEMPAL_DIR reached MemPalace"
}

test_a_payload_that_still_names_the_transcript_is_refused() {  # the rewrite step hands the payload back unchanged
  record "secret $(token E)" > "$PROJECTS/echoed.jsonl"; echo rewrite > "$H/echo_step"
  run_hook precompact "$(payload echoed "$PROJECTS/echoed.jsonl")"
  wait_for_runs echoed 1; rm -f "$H/echo_step"
  log_of echoed | grep -q "not run: the payload could not be cut down to the snapshot" \
    || fail "a payload naming the live transcript was not refused: $(log_of echoed)"
  [ -z "$(calls_of echoed)" ] || fail "MemPalace got a payload that names the live transcript"
}

test_no_cwd_is_reported() {
  record "no cwd anywhere" > "$PROJECTS/c-none.jsonl"
  run_hook precompact "$(payload c-none "$PROJECTS/c-none.jsonl")"
  wait_for_runs c-none 1 && log_of c-none | grep -q "no cwd in the snapshot's first 200 lines" \
    || fail "no warning for a snapshot without a cwd: $(log_of c-none)"
}

test_stop_gives_way_and_session_end_waits() {
  local live="$PROJECTS/busy.jsonl" rows
  record "busy session" > "$live"; echo 2 > "$H/slow"
  run_hook stop "$(payload busy "$live")"
  for _ in $(seq 1 100); do ls "$CALLS"/call-*/argv >/dev/null 2>&1 && grep -lq '"busy"' "$CALLS"/call-*/payload 2>/dev/null \
    && break; sleep 0.1; done  # the first worker is inside MemPalace now
  run_hook stop "$(payload busy "$live")"
  run_hook session-end "$(payload busy "$live")"
  wait_for_runs busy 3
  sleep 0.5; rm -f "$H/slow"
  log_of busy | grep -q "^.* stop session=busy .*skipped: a worker for this session is still running" \
    || fail "the second Stop did not skip: $(log_of busy)"
  rows=$(calls_of busy)
  [ "$(printf '%s\n' "$rows" | grep -c .)" = 2 ] || { fail "expected 2 MemPalace calls for busy, got: $rows"; return; }
  printf '%s\n' "$rows" | awk 'NR==1{end=$2; ev1=$3} NR==2{exit !(ev1=="stop" && $3=="session-end" && $1>=end)}' \
    || fail "SessionEnd did not wait for the running Stop worker: $rows"
}

test_a_lock_file_removed_while_waited_on_still_serialises() {
  local live="$PROJECTS/relock.jsonl"
  record "relock" > "$live"; echo 2 > "$H/slow"
  run_hook session-end "$(payload relock "$live")"; sleep 0.7
  run_hook precompact "$(payload relock "$live")"    # waits on the lock file SessionEnd removes when it is done
  sleep 2.2; run_hook stop "$(payload relock "$live")"
  wait_for_runs relock 3; sleep 2.5; rm -f "$H/slow"
  no_overlap relock || fail "two workers of one session ran at once after SessionEnd removed the lock: $(calls_of relock)"
}

test_stale_and_stuck_locks() {
  local live="$PROJECTS/stale.jsonl"
  record "stale lock" > "$live"; mkdir -p "$LOCKS"; : > "$LOCKS/stale.lock"  # left by a worker that died
  run_hook stop "$(payload stale "$live")"
  wait_for_runs stale 1 && log_of stale | grep -q "ran mempalace hook run" \
    || fail "a stale lock file stopped the worker: $(log_of stale)"
  python3 -c 'import fcntl,os,sys,time
fd = os.open(sys.argv[1], os.O_WRONLY | os.O_CREAT | os.O_APPEND); fcntl.flock(fd, fcntl.LOCK_EX); time.sleep(30)' \
    "$LOCKS/stuck.lock" & HOLDER=$!
  sleep 0.5; record "stuck lock" > "$PROJECTS/stuck.jsonl"
  run_hook session-end "$(payload stuck "$PROJECTS/stuck.jsonl")" MEMPALACE_GLOBAL_HOOK_WAIT=1
  wait_for_runs stuck 1 && log_of stuck | grep -q "ran mempalace hook run.*ran without the session lock: still held after 1 s" \
    || fail "SessionEnd did not run after its bounded wait: $(log_of stuck)"
  kill "$HOLDER" 2>/dev/null; wait "$HOLDER" 2>/dev/null; HOLDER=""
}

test_a_lock_that_cannot_be_opened_is_not_a_busy_worker() {
  record "no lock folder" > "$PROJECTS/nolock.jsonl"
  mv "$LOCKS" "$LOCKS.saved"; : > "$LOCKS"  # a file where the lock folder should be
  run_hook stop "$(payload nolock "$PROJECTS/nolock.jsonl")"
  wait_for_runs nolock 1
  run_hook precompact "$(payload nolock "$PROJECTS/nolock.jsonl")"
  wait_for_runs nolock 2
  rm -f "$LOCKS"; mv "$LOCKS.saved" "$LOCKS"
  [ "$(log_of nolock | grep -c "ran mempalace hook run.*without the session lock: its folder could not be made")" = 2 ] \
    || fail "an unopenable lock was not reported as such, or MemPalace did not run: $(log_of nolock)"
  log_of nolock | grep -q -e "still running" -e "still held" && fail "an unopenable lock was logged as a busy worker"
  echo lock > "$H/fail_step"  # the lock step itself fails (a broken python3): not a busy worker either
  run_hook stop "$(payload nolock2 "$PROJECTS/nolock.jsonl")"
  wait_for_runs nolock2 1; rm -f "$H/fail_step"
  log_of nolock2 | grep -q "ran mempalace hook run.*ran without the session lock: it could not be locked" \
    || fail "a failed lock step was not reported as such: $(log_of nolock2)"
}

test_a_hung_mempalace_is_ended() {
  record "hangs" > "$PROJECTS/hung.jsonl"; echo 3600 > "$H/slow"
  run_hook stop "$(payload hung "$PROJECTS/hung.jsonl")" MEMPALACE_GLOBAL_HOOK_TIMEOUT=2
  wait_for_runs hung 1
  log_of hung | grep -q "mempalace hook run timed out after 2 s" || fail "a hung MemPalace was not ended: $(log_of hung)"
  pgrep -f "$H/.local/bin/mempalace" >/dev/null && fail "the hung MemPalace process is still running"
  rm -f "$H/slow"
  run_hook stop "$(payload hung "$PROJECTS/hung.jsonl")"
  wait_for_runs hung 2 && log_of hung | tail -1 | grep -q "ran mempalace hook run" \
    || fail "the session lock was not freed after the timeout: $(log_of hung)"
}

test_the_worker_outlives_the_hook_and_has_a_fallback() {
  record "hung up" > "$PROJECTS/hangup.jsonl"; echo 1 > "$H/slow"
  run_hook session-end "$(payload hangup "$PROJECTS/hangup.jsonl")" hangup
  wait_for_runs hangup 1 && sleep 1.5 && [ -n "$(calls_of hangup)" ] \
    || fail "the worker did not outlive the hook's process group: $(log_of hangup)"
  rm -f "$H/slow"; echo detach > "$H/fail_step"
  record "no detach" > "$PROJECTS/fallback.jsonl"
  run_hook stop "$(payload fallback "$PROJECTS/fallback.jsonl")"
  wait_for_runs fallback 1 && log_of fallback | grep -q "ran mempalace hook run" \
    || fail "no worker ran when the detach step failed: $(log_of fallback)"
  rm -f "$H/fail_step"
}

test_mempalace_outcome_is_logged() {
  record "outcome" > "$PROJECTS/outcome.jsonl"
  printf '%s\n' "[12:00:00] Session outcome: 31 exchanges, 16 since last save" "[12:00:00] TRIGGERING SAVE at exchange 31" \
    "[12:00:01] Diary checkpoint failed: another mine is in progress: palace /p is held by PID 7 (mempalace mine /x)" \
    "[12:00:01] Transcript ingest started: outcome.jsonl -> other" > "$H/hooklog"
  run_hook stop "$(payload outcome "$PROJECTS/outcome.jsonl")"
  wait_for_runs outcome 1 && log_of outcome | grep -q "MemPalace: diary failed (palace busy), ingest started)" \
    || fail "MemPalace's diary and ingest outcome is not in the log: $(log_of outcome)"
  log_of outcome | grep -q "/x" && fail "text from MemPalace's hook.log was copied into the log"
  rm -f "$H/hooklog"
}

test_session_end_sweeps_snapshots_of_deleted_transcripts() {
  local live
  for live in gone kept; do
    record "sweep $live" > "$PROJECTS/sweep-$live.jsonl"
    python3 -I "$REPO/docs/tools/redact_secrets.py" --snapshot-only "$REDACTED/sweep-$live.jsonl" \
      "$PROJECTS/sweep-$live.jsonl" >/dev/null
    touch -t 202001010000 "$REDACTED/sweep-$live.jsonl"
  done
  rm "$PROJECTS/sweep-gone.jsonl"
  mkdir -p "$LOCKS"; : > "$LOCKS/old-session.lock"; touch -t 202001010000 "$LOCKS/old-session.lock"
  record "sweeper" > "$PROJECTS/sweeper.jsonl"
  run_hook session-end "$(payload sweeper "$PROJECTS/sweeper.jsonl")"
  wait_for_runs sweeper 1; sleep 0.5
  [ -e "$REDACTED/sweep-gone.jsonl" ] || [ -e "$REDACTED/sweep-gone.jsonl.lock" ] \
    && fail "the snapshot of a deleted transcript was not swept"
  [ -e "$REDACTED/sweep-kept.jsonl" ] || fail "the snapshot of a transcript still there was swept"
  [ -e "$LOCKS/old-session.lock" ] && fail "a lock file untouched for a day was not swept"
  [ -e "$REDACTED/big.jsonl" ] || fail "a recent snapshot was swept"
}

test_block_mode_is_reported() {
  record "block mode" > "$PROJECTS/block.jsonl"
  printf '{"hooks": {"silent_save": false}}\n' > "$H/.mempalace/config.json"
  run_hook stop "$(payload block "$PROJECTS/block.jsonl")"
  wait_for_runs block 1 && log_of block | grep -q "warning: MemPalace's hooks.silent_save is off" \
    || fail "no block-mode warning: $(log_of block)"
  rm -f "$H/.mempalace/config.json"
}

test_only_hook_run_is_called_and_one_line_per_run() {
  local argv bad=0
  for argv in "$CALLS"/call-*/argv; do
    grep -Eq '^hook run --hook (stop|precompact|session-end) --harness claude-code$' "$argv" || bad=$((bad + 1))
  done
  [ "$bad" -eq 0 ] || fail "$bad MemPalace call(s) were not 'hook run'"
  grep -l open "$CALLS"/call-*/fd9 >/dev/null 2>&1 && fail "a MemPalace call inherited the session lock (fd 9)"
  awk '$3 !~ /^(stop|precompact|session-end)$/ || $4 !~ /^session=/ || $5 !~ /^transcript=/' "$LOG" | grep -q . \
    && fail "a log line is not 'time event session transcript outcome': $(head -3 "$LOG")"
  return 0
}

test_mempalace_off_switch_is_honoured() {  # last: it removes the scratch ~/.mempalace
  record "switched off" > "$PROJECTS/off.jsonl"
  rm -rf "$H/.mempalace"
  run_hook stop "$(payload off "$PROJECTS/off.jsonl")"
  wait_for_runs off 1 && log_of off | grep -q "not run: ~/.mempalace is gone" \
    || fail "the worker ran with ~/.mempalace removed: $(log_of off)"
  [ -e "$H/.mempalace" ] && fail "the worker recreated ~/.mempalace, MemPalace's off switch"
  return 0
}

test_events_answer_at_once_and_mempalace_reads_only_the_snapshot
test_refused_transcripts_never_reach_mempalace
test_links_and_stale_files_at_the_snapshot_path_are_replaced
test_no_code_from_the_session_folder_and_no_mempal_dir
test_a_payload_that_still_names_the_transcript_is_refused
test_no_cwd_is_reported
test_stop_gives_way_and_session_end_waits
test_a_lock_file_removed_while_waited_on_still_serialises
test_stale_and_stuck_locks
test_a_lock_that_cannot_be_opened_is_not_a_busy_worker
test_a_hung_mempalace_is_ended
test_the_worker_outlives_the_hook_and_has_a_fallback
test_mempalace_outcome_is_logged
test_session_end_sweeps_snapshots_of_deleted_transcripts
test_block_mode_is_reported
test_only_hook_run_is_called_and_one_line_per_run
test_mempalace_off_switch_is_honoured
[ -n "${SHOW_LOG:-}" ] && cat "$LOG"  # SHOW_LOG=1 bash docs/tools/mempalace_global_hook_test.sh prints what the hooks logged
[ "$FAILURES" -eq 0 ] && echo "global hook tests passed" || echo "global hook tests: $FAILURES failure(s)"
[ "$FAILURES" -eq 0 ]
