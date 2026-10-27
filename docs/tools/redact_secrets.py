#!/usr/bin/env python3
"""Masks credentials in session transcripts before they are mined into the memory palace.

    python3 docs/tools/redact_secrets.py FILE...          mask every credential in place
    python3 docs/tools/redact_secrets.py --check FILE...  count them only; exit 1 when any is found
    python3 docs/tools/redact_secrets.py --snapshot OUT FILE
                                   mask FILE in place and write the masked complete lines to OUT
    python3 docs/tools/redact_secrets.py --self-test      run the pattern tests

Called by docs/tools/memory_hook.sh before every mine (CLAUDE.md: never file secrets or tokens), which
mines the --snapshot copy: lines appended after the scan never reach the miner unscanned. A
credential is overwritten in place with the same number of bytes, its first characters kept so the
kind stays readable and the rest turned to '*'; JSON escapes and UTF-8 characters are never split,
and no match reaches past one JSON string, so every masked line still parses. Same-length writes at
fixed offsets keep the file's size and every other byte, so a transcript Claude Code is still
appending to is never truncated or reordered. A line still being written (no trailing newline yet) is
left for the next run. Nothing matched is ever printed: the output is a count per file.
"""

from __future__ import annotations

import contextlib
import fcntl
import os
import re
import sys

KEEP = 4  # characters left readable at the start of a match

# A token with a known prefix must not be the tail of a longer identifier: it follows a non-word byte
# (for some kinds also not a dash, for an AWS key id no upper-case letter or digit), a JSON escape
# (\n, \t, \r) or an ANSI colour or erase escape (\u001b[32m, \u001b[38;5;196m, \u001b[K). Checked
# after the match, so each search keeps its fast prefix.
WORD = frozenset(b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_")
WORD_DASH = WORD | {ord("-")}
UPPER_DIGIT = frozenset(b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
ANY: frozenset[int] = frozenset()
ANSI_TAIL = re.compile(rb"\[[0-9;]{0,12}[mK]\Z")
# Between a key and its value: a quote that may be JSON-escaped once or more (\" inside a transcript),
# then = or :, on the same line.
KEY_SEP = rb"(?:\\{0,7}[\"'])?[ \t]*[:=][ \t]*(?:\\{0,7}[\"'])?"
# One character of a JSON string as a transcript line holds it: an escape, or anything but a quote.
JSON_CHAR = rb"(?:\\.|[^\"\\\n])"
# PEM and PGP armour: the label after BEGIN or END, and the lines of a key as a JSON string holds them
# (\n between lines, escaped again when the key sits in JSON a tool printed).
KEY_LABEL = rb"(?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----"
# A line break, then the line number and tab (or arrow) the Read tool and cat -n print before each line.
NEXT_LINE = rb"(?:\\+r)?\\+n(?:[ ]*[0-9]+(?:\\+t|\xe2\x86\x92|\\+u2192))?"
HEADER_LINE = rb"[A-Za-z][A-Za-z0-9-]*:[^\\\"\n]*"  # Proc-Type: 4,ENCRYPTED, or Version: in PGP armour
BASE64_LINE = rb"[A-Za-z0-9+/=]+(?=[\\\"\n]|\Z)"

# Each pattern's group "secret" is what gets masked; the set holds the bytes that must not precede it.
PATTERNS: list[tuple[str, re.Pattern[bytes], frozenset[int]]] = [
    ("github-token", re.compile(rb"(?P<secret>gh[pousr]_[A-Za-z0-9]{36,255})"), WORD),
    ("github-pat", re.compile(rb"(?P<secret>github_pat_[A-Za-z0-9_]{22,255})"), WORD),
    ("aws-access-key", re.compile(rb"(?P<secret>(?:AKIA|ASIA)[0-9A-Z]{16})(?![A-Z0-9])"), UPPER_DIGIT),
    ("aws-secret-key", re.compile(rb"(?i:secret_?access_?key)" + KEY_SEP + rb"(?P<secret>[A-Za-z0-9/+]{40})"), ANY),
    (
        "aws-session-token",
        re.compile(rb"(?i:session_?token|security_?token)" + KEY_SEP + rb"(?P<secret>[A-Za-z0-9/+=]{100,})"),
        ANY,
    ),
    ("jwt", re.compile(rb"(?P<secret>eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})"), WORD_DASH),
    # A JWE (a Cognito refresh token): five segments, only the header is base64url JSON.
    ("jwe", re.compile(rb"(?P<secret>eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]{8,}){3})"), WORD_DASH),
    (
        "auth-header",
        re.compile(rb"(?i:authorization)" + KEY_SEP + rb"(?i:basic|bearer) +(?P<secret>[A-Za-z0-9+/=._~-]{12,})"),
        ANY,
    ),
    ("slack-token", re.compile(rb"(?P<secret>xox[abprs]-[A-Za-z0-9-]{10,})"), WORD),
    ("api-key-sk", re.compile(rb"(?P<secret>sk-(?:ant-|proj-)?[A-Za-z0-9_-]{32,})"), WORD_DASH),
    ("stripe-key", re.compile(rb"(?P<secret>[sr]k_(?:live|test)_[A-Za-z0-9]{16,})"), WORD),
    ("google-api-key", re.compile(rb"(?P<secret>AIza[0-9A-Za-z_-]{35})"), WORD_DASH),
    ("npm-token", re.compile(rb"(?P<secret>npm_[A-Za-z0-9]{36})"), WORD),
    # A password inside a connection URL, the user part may be empty (redis://:pw@host); eight characters
    # or more, so the local ampm:ampm stays.
    (
        "url-password",
        re.compile(rb"[a-z][a-z0-9+.-]{1,20}://[^:/@\s\"'\\]{0,64}:(?P<secret>[^:/@\s\"'\\]{8,128})@"),
        ANY,
    ),
    # The body of a PEM private key, kept inside one JSON string of one transcript line (no re.S); only
    # its base64 characters are masked, the markers and escapes stay.
    (
        "private-key",
        re.compile(rb"-----BEGIN " + KEY_LABEL + rb"(?P<secret>" + JSON_CHAR + rb"{16,12000}?)-----END " + KEY_LABEL),
        ANY,
    ),
    # A key cut short (head -n 5 key.pem): the base64 lines after BEGIN, up to the first other line.
    (
        "private-key-head",
        re.compile(
            rb"-----BEGIN " + KEY_LABEL + rb"(?P<secret>(?:" + NEXT_LINE + rb"(?:" + HEADER_LINE + rb")?)*?"
            rb"(?:" + NEXT_LINE + BASE64_LINE + rb")+)"
        ),
        ANY,
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


def _clean_start(data: bytes, start: int, not_before: frozenset[int]) -> bool:
    """True when the byte before start is not in not_before, or ends a JSON or ANSI escape.

    _clean_start(b"xghp_", 1, WORD) is False; _clean_start(b"[32mghp_", 4, WORD) is True
    """
    if start == 0 or data[start - 1] not in not_before:
        return True
    if start >= 2 and data[start - 2] == BACKSLASH and data[start - 1] in b"ntr":
        return True
    return ANSI_TAIL.search(data, max(0, start - 16), start) is not None


def _spans(data: bytes) -> list[tuple[int, int, bool]]:
    """(start, end, base64_only) of every match, overlapping matches merged into one credential."""
    found = []
    for kind, pattern, not_before in PATTERNS:
        for match in pattern.finditer(data):
            if not _clean_start(data, match.start("secret"), not_before):
                continue
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


def _apply(data: bytes, edits: list[tuple[int, bytes]]) -> bytes:
    out = bytearray(data)
    for offset, replacement in edits:
        out[offset : offset + len(replacement)] = replacement
    return bytes(out)


def write_snapshot(out_path: str, data: bytes) -> None:
    """Replaces out_path atomically with data, mode 0600 in a 0700 directory; never with a shorter copy.

    A mine started earlier can finish its scan later; it then leaves the longer snapshot in place, so
    the file at out_path only grows and every miner reads the newest redacted copy.
    write_snapshot(os.path.expanduser("~/.mempalace/hook_state/redacted/<session>.jsonl"), masked)
    """
    directory = os.path.dirname(os.path.abspath(out_path))
    os.makedirs(directory, mode=0o700, exist_ok=True)
    os.chmod(directory, 0o700)
    lock = os.open(out_path + ".lock", os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0), 0o600)
    try:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if os.path.isfile(out_path) and os.path.getsize(out_path) > len(data):
            return
        temporary = f"{out_path}.{os.getpid()}.tmp"
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            with os.fdopen(fd, "wb") as handle:
                handle.write(data)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, out_path)
        except BaseException:
            with contextlib.suppress(FileNotFoundError):
                os.unlink(temporary)
            raise
    finally:
        os.close(lock)


def redact_file(path: str, check_only: bool, snapshot: str | None = None) -> int:
    """Masks (or counts) the credentials in the file's complete lines; returns how many it found.

    With snapshot, also writes those masked complete lines there (write_snapshot), so a miner can read a
    copy in which every byte has been scanned: redact_file("t.jsonl", False, "redacted/t.jsonl")
    """
    data = _complete_part(path)
    edits = find(data)
    if check_only:
        return len(edits)
    if edits:
        fd = os.open(path, os.O_RDWR)
        try:
            for offset, replacement in edits:
                os.pwrite(fd, replacement, offset)
            os.fsync(fd)
        finally:
            os.close(fd)
    if snapshot is not None:
        write_snapshot(snapshot, _apply(data, edits))
    return len(edits)


def self_test() -> int:
    """Runs redact_secrets_test.py, the pattern tests that sit next to this file.

    python3 docs/tools/redact_secrets.py --self-test   # prints "self-test passed", exit 0
    """
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import redact_secrets_test

    return redact_secrets_test.run()


def main(argv: list[str]) -> int:
    """The command line in the module docstring; returns the exit status.

    main(["--snapshot", "redacted/t.jsonl", "t.jsonl"])  # 0, prints "t.jsonl: 1 credential(s) masked"
    """
    if argv[:1] == ["--self-test"]:
        return self_test()
    check_only = argv[:1] == ["--check"]
    snapshot = argv[1] if argv[:1] == ["--snapshot"] and len(argv) == 3 else None
    paths = argv[1:] if check_only else argv[2:] if snapshot else argv
    if not paths or paths[0].startswith("--"):
        print(__doc__.strip())
        return 2
    found_any = False
    for path in paths:
        try:
            count = redact_file(path, check_only, snapshot)
        except OSError as error:
            print(f"{os.path.basename(path)}: not redacted ({error.strerror})")
            return 2
        found_any = found_any or count > 0
        verb = "found" if check_only else "masked"
        print(f"{os.path.basename(path)}: {count} credential(s) {verb}")
    return 1 if check_only and found_any else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
