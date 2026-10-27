#!/usr/bin/env python3
"""Masks credentials in session transcripts before they are mined into the memory palace.

    python3 docs/tools/redact_secrets.py FILE...          mask every credential in place
    python3 docs/tools/redact_secrets.py --check FILE...  count them only; exit 1 when any is found
    python3 docs/tools/redact_secrets.py --self-test      run the pattern tests

Called by docs/tools/memory_hook.sh before every mine (CLAUDE.md: never file secrets or tokens). A
credential is overwritten in place with the same number of bytes, its first characters kept so the
kind stays readable and the rest turned to '*'. Same-length writes at fixed offsets keep the file's
size and every other byte, so a transcript Claude Code is still appending to is never truncated or
reordered. A line still being written (no trailing newline yet) is left for the next run. Nothing
matched is ever printed: the output is a count per file.
"""

from __future__ import annotations

import os
import re
import sys

KEEP = 4  # characters left readable at the start of a match

# A credential starts after a non-word character or after a JSON escape (\n, \t, \r), so substrings of
# ordinary identifiers do not match while a token at the start of an escaped line still does.
START = rb"(?:(?<=\\[ntr])|(?<![A-Za-z0-9_]))"
START_DASH = rb"(?:(?<=\\[ntr])|(?<![A-Za-z0-9_-]))"
# Between a key and its value: a quote that may be JSON-escaped once or more (\" inside a transcript),
# then = or :, on the same line.
KEY_SEP = rb"(?:\\{0,7}[\"'])?[ \t]*[:=][ \t]*(?:\\{0,7}[\"'])?"

# Each pattern's group "secret" is what gets masked.
PATTERNS: list[tuple[str, re.Pattern[bytes]]] = [
    ("github-token", re.compile(START + rb"(?P<secret>gh[pousr]_[A-Za-z0-9]{36,255})")),
    ("github-pat", re.compile(START + rb"(?P<secret>github_pat_[A-Za-z0-9_]{22,255})")),
    ("aws-access-key", re.compile(rb"(?<![A-Z0-9])(?P<secret>(?:AKIA|ASIA)[0-9A-Z]{16})(?![A-Z0-9])")),
    ("aws-secret-key", re.compile(rb"(?i:secret_?access_?key)" + KEY_SEP + rb"(?P<secret>[A-Za-z0-9/+]{40})")),
    (
        "aws-session-token",
        re.compile(rb"(?i:session_?token|security_?token)" + KEY_SEP + rb"(?P<secret>[A-Za-z0-9/+=]{100,})"),
    ),
    (
        "jwt",
        re.compile(
            START_DASH + rb"(?P<secret>eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})"
        ),
    ),
    # A JWE (a Cognito refresh token): five segments, only the header is base64url JSON.
    (
        "jwe",
        re.compile(START_DASH + rb"(?P<secret>eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]{8,}){3})"),
    ),
    ("slack-token", re.compile(START + rb"(?P<secret>xox[abprs]-[A-Za-z0-9-]{10,})")),
    ("api-key-sk", re.compile(START_DASH + rb"(?P<secret>sk-(?:ant-|proj-)?[A-Za-z0-9_-]{32,})")),
    ("stripe-key", re.compile(START + rb"(?P<secret>[sr]k_(?:live|test)_[A-Za-z0-9]{16,})")),
    ("google-api-key", re.compile(START_DASH + rb"(?P<secret>AIza[0-9A-Za-z_-]{35})")),
    ("npm-token", re.compile(START + rb"(?P<secret>npm_[A-Za-z0-9]{36})")),
    # A password inside a connection URL; eight characters or more, so the local ampm:ampm stays.
    (
        "url-password",
        re.compile(rb"[a-z][a-z0-9+.-]{1,20}://[^:/@\s\"'\\]{1,64}:(?P<secret>[^:/@\s\"'\\]{8,128})@"),
    ),
    # The body of a PEM private key: only its base64 runs are masked, the markers and escapes stay.
    (
        "private-key",
        re.compile(
            rb"-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----(?P<secret>.{16,12000}?)-----END (?:[A-Z0-9]+ )*PRIVATE KEY-----",
            re.S,
        ),
    ),
]
BASE64_RUN = re.compile(rb"(?<!\\)[A-Za-z0-9+/=]{16,}")  # never the letter of an escape such as \n


def _mask(raw: bytes) -> bytes:
    keep = min(KEEP, len(raw) // 4)
    return raw[:keep] + b"*" * (len(raw) - keep)


def find(data: bytes) -> list[tuple[int, bytes]]:
    """Returns (offset, replacement) pairs for every credential in data, each the matched length."""
    edits: dict[int, bytes] = {}
    for kind, pattern in PATTERNS:
        for match in pattern.finditer(data):
            start, end = match.span("secret")
            secret = data[start:end]
            if set(secret[KEEP:]) <= {ord("*")}:
                continue  # already masked
            if kind == "private-key":
                for run in BASE64_RUN.finditer(secret):
                    edits[start + run.start()] = b"*" * (run.end() - run.start())
            else:
                edits[start] = _mask(secret)
    return sorted(edits.items())


def _complete_part(path: str) -> bytes:
    with open(path, "rb") as handle:
        data = handle.read()
    cut = data.rfind(b"\n")
    return data[: cut + 1] if cut >= 0 else b""


def redact_file(path: str, check_only: bool) -> int:
    """Masks (or counts) the credentials in the file's complete lines; returns how many it found."""
    data = _complete_part(path)
    edits = find(data)
    if check_only or not edits:
        return len(edits)
    fd = os.open(path, os.O_RDWR)
    try:
        for offset, replacement in edits:
            os.pwrite(fd, replacement, offset)
        os.fsync(fd)
    finally:
        os.close(fd)
    return len(edits)


def self_test() -> int:
    """Runs redact_secrets_test.py, the pattern tests that sit next to this file.

    python3 docs/tools/redact_secrets.py --self-test   # prints "self-test passed", exit 0
    """
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import redact_secrets_test

    return redact_secrets_test.run()


def main(argv: list[str]) -> int:
    if argv[:1] == ["--self-test"]:
        return self_test()
    check_only = argv[:1] == ["--check"]
    paths = argv[1:] if check_only else argv
    if not paths:
        print(__doc__.strip())
        return 2
    found_any = False
    for path in paths:
        try:
            count = redact_file(path, check_only)
        except OSError as error:
            print(f"{os.path.basename(path)}: unreadable ({error.strerror})")
            return 2
        found_any = found_any or count > 0
        verb = "found" if check_only else "masked"
        print(f"{os.path.basename(path)}: {count} credential(s) {verb}")
    return 1 if check_only and found_any else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
