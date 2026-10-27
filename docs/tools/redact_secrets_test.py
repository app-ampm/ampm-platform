#!/usr/bin/env python3
"""Tests for redact_secrets.py, run by  python3 docs/tools/redact_secrets.py --self-test  (or this file).

Every sample is a transcript line built the way Claude Code writes one: a json.dumps of a record, so
the escaped form (\\" around keys and values, \\n between lines, \\u001b for an escape byte) is what
gets tested. Samples are assembled at run time so this file never holds a credential-shaped literal.
The rule under test is CLAUDE.md, "Session memory": never file secrets or tokens into the wing.

    python3 docs/tools/redact_secrets_test.py   # prints "self-test passed" or each failure
"""

from __future__ import annotations

import contextlib
import fcntl
import io
import json
import os
import subprocess
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import redact_secrets as rs  # noqa: E402

Case = tuple[str, str, int, list[str]]  # name, transcript line, expected count, fragments that must vanish


def tool_result(text: str, ascii_only: bool = True) -> str:
    """A user record carrying one tool result, as a transcript line (raw UTF-8 when not ascii_only)."""
    content = [{"type": "tool_result", "tool_use_id": "toolu_01ABCDEFGHJKLMNPQRSTUVWX", "content": text}]
    return json.dumps({"type": "user", "message": {"content": content}}, ensure_ascii=ascii_only)


def pem(body_lines: list[str], kind: str = "") -> str:
    """A PEM private key with the given body lines; kind is e.g. "RSA " or "PGP "."""
    label = f"{kind}PRIVATE KEY" + (" BLOCK" if kind == "PGP " else "")
    return f"-----BEGIN {label}-----\n" + "\n".join(body_lines) + f"\n-----END {label}-----\n"


def numbered(lines: list[str], separator: str = "\t") -> str:
    """Lines as the Read tool shows a file: cat -n numbers, then a tab (or an arrow) before each line."""
    return "".join(f"{n:6}{separator}{line}\n" for n, line in enumerate(lines, 1))


def tool_use(command: str) -> str:
    """An assistant record running one Bash command, as a transcript line."""
    call = {"type": "tool_use", "id": "toolu_02ABCDEFGHJKLMNPQRSTUVWX", "name": "Bash", "input": {"command": command}}
    return json.dumps({"type": "assistant", "message": {"content": [call]}})


def apply(data: bytes, edits: list[tuple[int, bytes]]) -> bytes:
    """data with the redactor's edits written over it, as redact_file writes them."""
    out = bytearray(data)
    for offset, replacement in edits:
        out[offset : offset + len(replacement)] = replacement
    return bytes(out)


def samples() -> dict[str, str]:
    """Synthetic credentials, assembled at run time."""
    return {
        "gh": "gh" + "o_" + "Ab1" * 12,
        "pat": "github" + "_pat_" + "11AB" * 6,
        "aws_id": "AS" + "IA" + "ABCDEFGHIJKLMNOP",
        "aws_secret": "wJal" + "rXUtnFEMI/K7MDENG/bPxRfiCY" + "EXAMPLEKEY",
        "session": "IQoJb3JpZ2luX2VjE" + "Zm9v" * 60,
        "jwt": "ey" + "JhbGciOiJIUzI1" + "." + "ey" + "JzdWIiOiJsb2Nh" + "." + "c2lnbmF0dXJlMTI",
        "jwe": "ey" + "JjdHkiOiJKV1QiLCJlbmMiOiJBMjU2R0NNIn0" + "." + "Qm9n" * 30 + "." + "aXZp" * 4
        + "." + "Y2lw" * 40 + "." + "dGFn" * 6,
        "pw": "S3cr3t" + "-Value-99",
        "b64": "MIIEvQIBADANBgkqhkiG9w0BAQEFAASC" * 2,
        "b64_2": "BKcwggSjAgEAAoIBAQC7" * 3,
    }


def baseline_cases() -> list[Case]:
    """The shapes the first version already masked, now as transcript lines."""
    s = samples()
    return [
        ("github token", tool_result(json.dumps({"t": s["gh"]})), 1, [s["gh"]]),
        ("token after an escaped newline", tool_result(f"keychain dump\n{s['gh']}\n"), 1, [s["gh"]]),
        ("github pat", tool_result(f"token {s['pat']} end"), 1, [s["pat"]]),
        ("aws access key id", tool_result(f"id={s['aws_id']}"), 1, [s["aws_id"]]),
        ("jwt", tool_use(f"curl -H 'Authorization: Bearer {s['jwt']}' x"), 1, [s["jwt"]]),
        ("local ampm password", tool_result("postgresql://ampm:ampm@localhost:5432/ampm"), 0, []),
        ("url password", tool_result(f"postgresql://svc:{s['pw']}@db.internal:5432/ampm"), 1, [s["pw"]]),
        ("ordinary text", tool_result("ordinary text about gho_ prefixes and eyJ examples"), 0, []),
        ("token-shaped tail of an identifier", tool_result(f"const x{s['gh']} = 1"), 0, []),
    ]


def ops01_cases() -> list[Case]:
    """OPS-01: AWS secrets with JSON-escaped quotes, session tokens and five-part JWE tokens."""
    s = samples()
    sts = json.dumps(
        {"Credentials": {"AccessKeyId": s["aws_id"], "SecretAccessKey": s["aws_secret"], "SessionToken": s["session"]}},
        indent=4,
    )
    return [
        ("aws sts json", tool_result(sts), 3, [s["aws_id"], s["aws_secret"], s["session"]]),
        ("aws export", tool_use(f'export AWS_SECRET_ACCESS_KEY="{s["aws_secret"]}"'), 1, [s["aws_secret"]]),
        ("aws ini", tool_result(f"[default]\naws_secret_access_key = {s['aws_secret']}\n"), 1, [s["aws_secret"]]),
        ("aws session env", tool_result(f"AWS_SESSION_TOKEN={s['session']}"), 1, [s["session"]]),
        ("cognito refresh", tool_result(json.dumps({"RefreshToken": s["jwe"]})), 1, [s["jwe"]]),
    ]


def ops04_cases() -> list[Case]:
    """OPS-04: password-only URLs, tokens after an ANSI colour, PGP keys and a PEM with no END marker."""
    s = samples()
    npm = "npm" + "_" + "Zx9" * 12
    encrypted = "-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-128-CBC,0A1B\n\n"
    head = ["-----BEGIN PRIVATE KEY-----", s["b64"], s["b64_2"]]  # a Read with a limit, or head | cat -n
    return [
        ("password-only url", tool_result(f"REDIS_URL=redis://:{s['pw']}@localhost:6379"), 1, [s["pw"]]),
        ("token after an ansi colour", tool_result(f"\x1b[32m{s['gh']}\x1b[0m"), 1, [s["gh"]]),
        ("token after a 256-colour escape", tool_result(f"\x1b[38;5;196m{npm}\x1b[0m"), 1, [npm]),
        ("token after grep --color", tool_result(f"a.env:\x1b[01;31m\x1b[K{s['gh']}\x1b[m\x1b[K"), 1, [s["gh"]]),
        ("aws key id after grep --color", tool_result(f"a.env:\x1b[01;31m\x1b[K{s['aws_id']}\x1b[m\x1b[K"), 1,
         [s["aws_id"]]),
        ("aws key id inside a longer upper-case run", tool_result(f"X{s['aws_id']} {s['aws_id']}Q"), 0, []),
        ("pgp private key", tool_result(pem(["", s["b64"], s["b64_2"], "=AbCd"], "PGP ")), 1, [s["b64"], s["b64_2"]]),
        ("pem with no end", tool_result(f"-----BEGIN PRIVATE KEY-----\n{s['b64']}\n{s['b64_2']}\n"), 1,
         [s["b64"], s["b64_2"]]),
        ("encrypted pem with no end", tool_result(f"{encrypted}{s['b64']}\n"), 1, [s["b64"]]),
        ("pgp key with no end", tool_result(f"-----BEGIN PGP PRIVATE KEY BLOCK-----\n\n{s['b64']}"), 1, [s["b64"]]),
        ("begin marker then prose", tool_result("-----BEGIN PRIVATE KEY-----\nnot a key here"), 0, []),
        ("key cut short by the Read tool", tool_result(numbered(head)), 1, [s["b64"], s["b64_2"]]),
        ("key cut short, arrow numbering", tool_result(numbered(head, "\u2192"), False), 1, [s["b64"], s["b64_2"]]),
        ("key cut short, escaped arrow", tool_result(numbered(head, "\u2192")), 1, [s["b64"], s["b64_2"]]),
        ("basic auth header", tool_use(f"curl -H 'Authorization: Basic {s['b64_2']}' x"), 1, [s["b64_2"]]),
    ]


def check_head_stops_at_prose() -> list[str]:
    """A PEM with no END marker is masked up to the first line that is not base64, and no further."""
    s = samples()
    data = tool_result(f"-----BEGIN PRIVATE KEY-----\n{s['b64']}\n$ ls docs\nREADMEfileswithlongnames").encode()
    masked = apply(data, rs.find(data))
    if s["b64"].encode() in masked or b"READMEfileswithlongnames" not in masked:
        return ["pem with no end: masked too little or past the first non-base64 line"]
    return []


def ops05_cases() -> list[Case]:
    """OPS-05: a key stays inside one JSON string, escapes and UTF-8 characters survive masking."""
    s = samples()
    gcp = json.dumps({"type": "service_account", "private_key": pem([s["b64"], s["b64_2"]])})
    split = [{"type": "text", "text": "-----BEGIN PRIVATE KEY-----"}]
    split.append({"type": "text", "text": "toolu_01ABCDEFGHJKLMNPQRSTUVWX -----END PRIVATE KEY-----"})
    escaped_body = pem([s["b64"], "Caf\u00e9menuitemsandmoretext \u001b[0m", s["b64_2"]])
    return [
        ("pem", tool_result(pem([s["b64"], s["b64_2"]])), 1, [s["b64"], s["b64_2"]]),
        ("pem in a service-account json", tool_result(gcp), 1, [s["b64"], s["b64_2"]]),
        ("pem with \\u escapes in the body", tool_result(escaped_body), 1, [s["b64"], s["b64_2"]]),
        ("pem markers in two json strings", json.dumps({"type": "user", "message": {"content": split}}), 0, []),
        ("url password with a multi-byte character", tool_result("postgresql://svc:ppp\u00e4secretvalue@db", False), 1,
         ["secretvalue"]),
    ]


def check_lines_kept_apart() -> list[str]:
    """A BEGIN marker on one transcript line never pairs with an END marker on a later line."""
    begin = tool_result("src/x.ts:3: -----BEGIN PRIVATE KEY-----")
    middle = {"parentUuid": "a1", "isCompactSummary": False, "cwd": "/Users/dev/Desktop/AMPMworktreesampm"}
    middle["requestId"] = "req_011CUXabcdefghijklmnop"
    end = json.dumps({"type": "assistant", "message": {"content": "It ends with -----END PRIVATE KEY----- as usual."}})
    data = "\n".join([begin, json.dumps(middle), tool_use('printf "\\u00e9\\u00e9" > a'), end, ""]).encode()
    return [] if not rs.find(data) else ["lines kept apart: a key matched across transcript lines"]


def check_nested_json_survives() -> list[str]:
    """A key inside JSON printed by a tool keeps its inner escapes, so the inner JSON still parses."""
    s = samples()
    data = tool_result(json.dumps({"private_key": pem([s["b64"]])})).encode()
    masked = apply(data, rs.find(data))
    try:
        json.loads(json.loads(masked)["message"]["content"][0]["content"])
    except ValueError:
        return ["nested json: the inner JSON no longer parses after masking"]
    return []


def check_snapshot() -> list[str]:
    """OPS-03: --snapshot writes the masked complete lines it scanned (0600) and masks the live file too."""
    s = samples()
    complete = (tool_result(f"token {s['gh']}") + "\n" + tool_result("plain") + "\n").encode()
    partial = tool_result(f"still being written {s['pat']}").encode()
    with tempfile.TemporaryDirectory() as scratch:
        live, out = os.path.join(scratch, "t.jsonl"), os.path.join(scratch, "redacted", "t.jsonl")
        with open(live, "wb") as handle:
            handle.write(complete + partial)
        with contextlib.redirect_stdout(io.StringIO()):
            status = rs.main(["--snapshot", out, live])
        problems = [] if status == 0 else [f"--snapshot exited {status}"]
        if not os.path.isfile(out):
            return problems + ["snapshot: no file written"]
        with open(out, "rb") as handle:
            snapshot = handle.read()
        with open(live, "rb") as handle:
            now = handle.read()
        problems += [] if snapshot == apply(complete, rs.find(complete)) else ["snapshot: not the masked complete lines"]
        problems += [] if now == snapshot + partial else ["snapshot: the live file was not masked in place"]
        problems += [] if os.stat(out).st_mode & 0o777 == 0o600 else ["snapshot: not created 0600"]
        problems += [] if os.stat(os.path.dirname(out)).st_mode & 0o777 == 0o700 else ["snapshot: directory not 0700"]
    return problems


def check_snapshot_only_grows() -> list[str]:
    """A mine whose scan finishes late never replaces a newer, longer snapshot with its shorter one."""
    with tempfile.TemporaryDirectory() as scratch:
        out = os.path.join(scratch, "redacted", "t.jsonl")
        rs.write_snapshot(out, b"line 1\nline 2\n")
        rs.write_snapshot(out, b"line 1\n")
        with open(out, "rb") as handle:
            kept = handle.read() == b"line 1\nline 2\n"
        rs.write_snapshot(out, b"line 1\nline 2\nline 3\n")
        with open(out, "rb") as handle:
            grew = handle.read() == b"line 1\nline 2\nline 3\n"
        left_over = [name for name in os.listdir(os.path.dirname(out)) if name.endswith(".tmp")]
    problems = [] if kept else ["snapshot: a shorter copy replaced a longer one"]
    problems += [] if grew else ["snapshot: a longer copy did not replace the snapshot"]
    return problems + ([f"snapshot: temporary files left: {left_over}"] if left_over else [])


def check_snapshot_only() -> list[str]:
    """--snapshot-only (MemPalace's global hooks, any project) writes the masked snapshot and never touches FILE."""
    s = samples()
    complete = (tool_result(f"token {s['gh']}") + "\n" + tool_result("plain") + "\n").encode()
    partial = tool_result(f"still being written {s['pat']}").encode()
    with tempfile.TemporaryDirectory() as scratch:
        live, out = os.path.join(scratch, "t.jsonl"), os.path.join(scratch, "redacted", "t.jsonl")
        with open(live, "wb") as handle:
            handle.write(complete + partial)
        os.utime(live, (1_000_000_000, 1_000_000_000))
        printed = io.StringIO()
        with contextlib.redirect_stdout(printed):
            status = rs.main(["--snapshot-only", out, live])
        problems = [] if status == 0 else [f"--snapshot-only exited {status}"]
        if not os.path.isfile(out):
            return problems + ["snapshot-only: no file written"]
        with open(out, "rb") as handle:
            snapshot = handle.read()
        with open(live, "rb") as handle:
            now = handle.read()
        masked = apply(complete, rs.find(complete))
        problems += [] if snapshot == masked and masked != complete else ["snapshot-only: not the masked complete lines"]
        problems += [] if now == complete + partial else ["snapshot-only: the live file was edited"]
        problems += [] if os.stat(live).st_mtime == 1_000_000_000 else ["snapshot-only: the live file was written to"]
        problems += [] if os.stat(out).st_mode & 0o777 == 0o600 else ["snapshot-only: not created 0600"]
        problems += [] if os.stat(os.path.dirname(out)).st_mode & 0o777 == 0o700 else ["snapshot-only: dir not 0700"]
        problems += [] if "1 credential(s) masked in the snapshot" in printed.getvalue() else ["snapshot-only: no count"]
        with contextlib.redirect_stdout(io.StringIO()):
            rs.main(["--snapshot-only", out, live])  # nothing new: the snapshot stays as it was
        with open(out, "rb") as handle:
            problems += [] if handle.read() == snapshot else ["snapshot-only: a second run changed the snapshot"]
    return problems


def _held_while(live: str, held: int, argv: list[str], out: str) -> tuple[bool, bool]:
    """Runs the redactor with argv while this process holds a flock on live: (it waited for the lock, it then finished)."""
    script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "redact_secrets.py")
    with open(live, "rb") as handle:
        fcntl.flock(handle.fileno(), held)
        child = subprocess.Popen([sys.executable, script, *argv], stdout=subprocess.DEVNULL)
        time.sleep(0.6)
        waited = child.poll() is None and not os.path.exists(out)
        fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
        finished = child.wait(timeout=30) == 0
    return waited, finished


def check_locks() -> list[str]:
    """A read never sees a half-written mask: the in-place modes lock FILE exclusively, the read-only ones shared."""
    s = samples()
    problems = []
    with tempfile.TemporaryDirectory() as scratch:
        live, out = os.path.join(scratch, "t.jsonl"), os.path.join(scratch, "redacted", "t.jsonl")
        with open(live, "wb") as handle:
            handle.write((tool_result(f"token {s['gh']}") + "\n").encode())
        waited, finished = _held_while(live, fcntl.LOCK_EX, ["--snapshot-only", out, live], out)
        problems += [] if waited and finished else ["snapshot-only did not wait for an exclusive lock (a masker)"]
        os.unlink(out)
        waited, finished = _held_while(live, fcntl.LOCK_SH, ["--snapshot-only", out, live], out)
        problems += [] if not waited and finished else ["snapshot-only waited for another reader"]
        os.unlink(out)
        waited, finished = _held_while(live, fcntl.LOCK_SH, ["--snapshot", out, live], out)
        problems += [] if waited and finished else ["--snapshot masked in place while a reader held the file"]
    return problems


def check_fifo_refused() -> list[str]:
    """A FIFO where a transcript should be is refused at once, never read (a blocking open would hang the hook)."""
    script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "redact_secrets.py")
    with tempfile.TemporaryDirectory() as scratch:
        fifo, out = os.path.join(scratch, "f.jsonl"), os.path.join(scratch, "redacted", "f.jsonl")
        os.mkfifo(fifo)
        try:
            done = subprocess.run([sys.executable, script, "--snapshot-only", out, fifo], capture_output=True,
                                  text=True, timeout=10)
        except subprocess.TimeoutExpired:
            return ["fifo: the redactor blocked on a FIFO"]
    ok = done.returncode == 2 and "not a regular file" in done.stdout
    return [] if ok else [f"fifo: exited {done.returncode} ({done.stdout.strip()})"]


TOOL_TESTS = [
    "python3 docs/tools/redact_secrets.py --self-test",
    "bash docs/tools/memory_hook_test.sh",
    "bash docs/tools/setup_memory_test.sh",
    "bash docs/tools/mempalace_global_hook_test.sh",
    "python3 docs/tools/install_global_memory_hooks_test.py",
]


def check_wired_into_pnpm_check() -> list[str]:
    """pnpm check, the required check in CLAUDE.md and CI, runs these tests and the hook tests."""
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    with open(os.path.join(root, "package.json"), encoding="utf-8") as handle:
        scripts = json.load(handle).get("scripts", {})
    problems = [] if "pnpm run test:tools" in scripts.get("check", "") else ["pnpm check does not run test:tools"]
    tools = scripts.get("test:tools", "")
    return problems + [f"test:tools does not run {test}" for test in TOOL_TESTS if test not in tools]


def check_case(name: str, line: str, expected: int, fragments: list[str]) -> list[str]:
    """Problems with one case: count, byte length, JSON validity, idempotence and what stayed in clear."""
    data = line.encode()
    edits = rs.find(data)
    masked = apply(data, edits)
    problems = []
    if len(edits) != expected:
        problems.append(f"expected {expected} credential(s), found {len(edits)}")
    if len(masked) != len(data):
        problems.append("byte length changed")
    try:
        json.loads(masked.decode("utf-8"))
    except ValueError as error:
        problems.append(f"masked line no longer parses ({type(error).__name__})")
    if rs.find(masked):
        problems.append("masking is not idempotent")
    problems += [f"fragment {i + 1} still in clear" for i, f in enumerate(fragments) if f.encode() in masked]
    return [f"{name}: {problem}" for problem in problems]


def run() -> int:
    """Runs every case; prints each failure and returns 1 when any failed."""
    failures: list[str] = []
    for case in baseline_cases() + ops01_cases() + ops04_cases() + ops05_cases():
        failures += check_case(*case)
    failures += check_head_stops_at_prose() + check_lines_kept_apart() + check_nested_json_survives()
    failures += check_snapshot() + check_snapshot_only_grows() + check_wired_into_pnpm_check()
    failures += check_snapshot_only() + check_locks() + check_fifo_refused()
    for failure in failures:
        print(f"FAIL: {failure}")
    print("self-test passed" if not failures else f"self-test: {len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(run())
