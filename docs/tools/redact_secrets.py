#!/usr/bin/env python3
"""Masks credentials in session transcripts before they are mined into the memory palace.

    python3 docs/tools/redact_secrets.py FILE...          mask every credential in place
    python3 docs/tools/redact_secrets.py --check FILE...  count them only; exit 1 when any is found
    python3 docs/tools/redact_secrets.py --self-test      run the pattern tests

Called by docs/tools/memory_hook.sh before every mine (CLAUDE.md: never file secrets or tokens). A
credential is overwritten in place with the same number of bytes, its first characters kept so the
kind stays readable and the rest turned to '*'; JSON escapes and UTF-8 characters are never split, and
no match reaches past one JSON string, so every masked line still parses. Same-length writes at fixed offsets keep the file's
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
# One character of a JSON string as a transcript line holds it: an escape, or anything but a quote.
JSON_CHAR = rb"(?:\\.|[^\"\\\n])"

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
    # The body of a PEM private key, kept inside one JSON string of one transcript line (no re.S); only
    # its base64 characters are masked, the markers and escapes stay.
    (
        "private-key",
        re.compile(
            rb"-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----(?P<secret>" + JSON_CHAR + rb"{16,12000}?)"
            rb"-----END (?:[A-Z0-9]+ )*PRIVATE KEY-----"
        ),
    ),
]
BASE64 = frozenset(b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=")
HEX = frozenset(b"0123456789abcdefABCDEF")
BACKSLASH, STAR = 0x5C, 0x2A


def _in_escape(data: bytes, p: int) -> bool:
    """True when byte p belongs to a JSON escape: a backslash, the letter after one, or the hex of \\uXXXX.

    Escapes stay whole at every nesting depth, so a masked line (and JSON printed inside it) still parses.
    """
    if data[p] == BACKSLASH or (p > 0 and data[p - 1] == BACKSLASH):
        return True
    for distance in range(1, 5):
        u = p - distance
        if u >= 1 and data[u] == ord("u") and data[u - 1] == BACKSLASH:
            return all(byte in HEX for byte in data[u + 1 : p + 1])
    return False


def _widen(data: bytes, start: int, end: int) -> tuple[int, int]:
    """Moves start and end out to UTF-8 character boundaries, so no character is ever split."""
    while start > 0 and 0x80 <= data[start] < 0xC0:
        start -= 1
    while end < len(data) and 0x80 <= data[end] < 0xC0:
        end += 1
    return start, end


def _render(data: bytes, start: int, end: int, base64_only: bool) -> bytes:
    """The masked bytes of data[start:end]: same length, escapes kept, every other byte turned to '*'.

    _render(b"x=Abcdefgh", 2, 10, False) == b"Ab******"  # the first characters stay readable
    """
    out = bytearray(data[start:end])
    keep = 0 if base64_only else min(KEEP, len(out) // 4)
    while keep > 0 and 0x80 <= out[keep] < 0xC0:
        keep -= 1  # a kept prefix never ends inside a multi-byte character
    for i in range(keep, len(out)):
        if _in_escape(data, start + i) or (base64_only and out[i] not in BASE64):
            continue
        out[i] = STAR
    return bytes(out)


def _spans(data: bytes) -> list[tuple[int, int, bool]]:
    """(start, end, base64_only) of every match, overlapping matches merged into one credential."""
    found = []
    for kind, pattern in PATTERNS:
        for match in pattern.finditer(data):
            start, end = _widen(data, *match.span("secret"))
            found.append((start, end, kind.startswith("private-key")))
    merged: list[tuple[int, int, bool]] = []
    for start, end, base64_only in sorted(found):
        if merged and start < merged[-1][1]:
            first, last_end, first_base64 = merged[-1]
            merged[-1] = (first, max(last_end, end), first_base64 and base64_only)
        else:
            merged.append((start, end, base64_only))
    return merged


def find(data: bytes) -> list[tuple[int, bytes]]:
    """Returns (offset, replacement) pairs, one per credential not yet masked, each the matched length.

    find(b'{"t":"' + token + b'"}')  # -> [(6, token[:4] + b"*" * (len(token) - 4))]
    """
    edits = []
    for start, end, base64_only in _spans(data):
        replacement = _render(data, start, end, base64_only)
        if replacement != data[start:end]:  # an already masked credential renders unchanged
            edits.append((start, replacement))
    return edits


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
