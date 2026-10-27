#!/usr/bin/env python3
"""Tests for redact_secrets.py, run by  python3 docs/tools/redact_secrets.py --self-test  (or this file).

Every sample is a transcript line built the way Claude Code writes one: a json.dumps of a record, so
the escaped form (\\" around keys and values, \\n between lines, \\u001b for an escape byte) is what
gets tested. Samples are assembled at run time so this file never holds a credential-shaped literal.
The rule under test is CLAUDE.md, "Session memory": never file secrets or tokens into the wing.

    python3 docs/tools/redact_secrets_test.py   # prints "self-test passed" or each failure
"""

from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import redact_secrets as rs  # noqa: E402

Case = tuple[str, str, int, list[str]]  # name, transcript line, expected count, fragments that must vanish


def tool_result(text: str) -> str:
    """A user record carrying one tool result, as a transcript line."""
    content = [{"type": "tool_result", "tool_use_id": "toolu_01ABCDEFGHJKLMNPQRSTUVWX", "content": text}]
    return json.dumps({"type": "user", "message": {"content": content}})


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
    for case in baseline_cases() + ops01_cases():
        failures += check_case(*case)
    for failure in failures:
        print(f"FAIL: {failure}")
    print("self-test passed" if not failures else f"self-test: {len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(run())
