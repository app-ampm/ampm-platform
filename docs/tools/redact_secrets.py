#!/usr/bin/env python3
"""Masks credentials in session transcripts before they are mined into the memory palace.

    python3 docs/tools/redact_secrets.py FILE...          mask every credential in place
    python3 docs/tools/redact_secrets.py --check FILE...  count them only; exit 1 when any is found
    python3 docs/tools/redact_secrets.py --snapshot OUT FILE
                                   mask FILE in place and write the masked complete lines to OUT
    python3 docs/tools/redact_secrets.py --snapshot-only OUT FILE
                                   write the masked complete lines of FILE to OUT; FILE is only read
    python3 docs/tools/redact_secrets.py --sweep DIR [DAYS]
                                   remove the snapshots in DIR whose transcript is gone, DAYS (7) old
    python3 docs/tools/redact_secrets.py --self-test      run the pattern tests

Called by docs/tools/memory_hook.sh before every mine (CLAUDE.md: never file secrets or tokens), which
mines the --snapshot copy: lines appended after the scan never reach the miner unscanned. A
credential is overwritten in place with the same number of bytes, its first characters kept so the
kind stays readable and the rest turned to '*'; JSON escapes and UTF-8 characters are never split,
and no match reaches past one JSON string, so every masked line still parses. Same-length writes at
fixed offsets keep the file's size and every other byte, so a transcript Claude Code is still
appending to is never truncated or reordered. A line still being written (no trailing newline yet) is
left for the next run. Nothing matched is ever printed: the output is a count per file.

OUT is replaced atomically (0600 in a 0700 folder) and never followed: a link or a stale or foreign file
there is replaced, not read. Only a newer masked copy of the same transcript, starting with what this run
masked, is kept (a scan that finished late); OUT.lock records which transcript OUT was written from, which
is also what --sweep reads. --snapshot-only makes OUT's folder only inside one that exists, so a scan that
ends after the user removed ~/.mempalace (MemPalace's off switch) fails instead of making it again.

MemPalace's global hooks (docs/tools/mempalace_global_hook.sh) run for every project's sessions, so
they use --snapshot-only: another project's transcript is never edited, only its snapshot is masked.
The in-place modes hold an exclusive flock(2) on FILE from the read to the last write; --snapshot-only
and --check hold a shared one while they read, so a read never sees a mask half written. The lock is
advisory and Claude Code takes none, so its appends are never held up.
"""

from __future__ import annotations

import contextlib
import errno
import fcntl
import io
import json
import os
import re
import stat
import sys
import time
from collections.abc import Callable, Iterator

KEEP = 4  # characters left readable at the start of a match

# A token with a known prefix must not be the tail of a longer identifier: it follows a non-word byte
# (for some kinds also not a dash, for an AWS key id no upper-case letter or digit), a JSON escape
# (\n, \t, \r, \b, \f, or a \uXXXX such as the em dash or < that json.dumps or Go print before it) or
# a terminal control sequence: any CSI (\u001b[32m, \u001b[2K, \u001b[?25h), or an OSC such as an
# OSC 8 link, ended by BEL or ST. Checked after the match, so each search keeps its fast prefix.
WORD = frozenset(b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_")
WORD_DASH = WORD | {ord("-")}
UPPER_DIGIT = frozenset(b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
BASE64_RUN = WORD_DASH | frozenset(b"+/")  # a prefix that base64 data holds by chance: never inside a base64 run
ANY: frozenset[int] = frozenset()
JSON_ESCAPE_TAIL = re.compile(rb"\\(?:[ntrbf]|u[0-9a-fA-F]{4})\Z")
ESC = rb"\\+u001[bB]"  # the escape byte as a JSON string holds it, escaped once or more
CONTROL_TAIL = re.compile(
    rb"(?:\[[0-9;]{0,12}[mK]"  # a colour or an erase, even with its escape byte lost
    rb"|" + ESC + rb"\[[0-9;?<=>]{0,16}[ -/]{0,2}[@-~]"  # any CSI
    rb"|" + ESC + rb"\][^\"\n]{0,512}?(?:\\+u0007|" + ESC + rb"\\+))\Z"  # an OSC, ended by BEL or ST
)
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

# A key whose name says it holds a secret (.env, JSON, YAML, an HTTP header): DATABASE_PASSWORD, client_secret,
# SECRET_KEY, x-api-key, accessToken, SMTP_PASS, DB_PWD, a Docker "auth", and a --password or --api-token flag whose
# value follows a space. The name is the last word of the key; _named_secret_value checks what comes before it and
# masks the value only when it looks like a credential, not code, a type, a path, an expansion or a word of prose.
SECRET_WORDS = (b"pass", b"secret", b"token", b"key", b"auth", b"pwd")
NAMED_SECRET = (
    rb"(?i:(?P<name>pass(?:word|wd|phrase)?|secret|token|key|auth|pwd))"
    rb"(?:(?:\\{0,7}[\"'])?[ \t]*[:=][ \t]*|(?P<space>[ \t]+))(?P<quote>\\{0,7}[\"'])?"
    rb"(?P<secret>[A-Za-z0-9+/=_.~!@#$%^*-]{8,512})"
)
KEY_OWNER = re.compile(rb"(?:api|access|private|client|encryption|signing|master|secret)[_-]?\Z")  # api_key, apiKey
# A pass that ends another word is not a password (bypass, compass), unless that word names what it opens: DBPASS.
PASS_OWNER = re.compile(rb"(?:db|sql|smtp|mail|ftp|ldap|root|admin|user|redis)\Z")
FLAG = re.compile(rb"(?:\A|[\s\"'=(])--(?:[a-z0-9]+-)*\Z")  # --password, --db-password, --api-token
# The start of a .env or YAML line up to the secret's name: a line break, the start of a JSON string, the Read
# tool's line number or a shell command separator (cd api && PGPASSWORD=...), then indentation, "export " or a YAML
# "- ", and the UPPER_SNAKE words of the key before the name (DB_PASSWORD=, POSTGRES_PASSWORD:, PGPASSWORD=).
ENV_LINE = re.compile(
    rb"(?:\A|\n|\\+n|\"|&&|\|\||[;|])(?:[ ]*[0-9]+(?:\\+t|\t|\xe2\x86\x92|\\+u2192))?(?:[ \t]|\\+t)*"
    rb"(?:export[ \t]+|-[ \t]+)?[A-Z0-9_]*\Z"
)
# dbPasswordValue, hashedPassword: an identifier, not a password; words of three letters or more, so a random
# mixed-case value (qWeRtYuIoPaS) is not taken for one.
LOWER_CAMEL = re.compile(rb"[a-z]{2,}(?:[A-Z][a-z]{2,})+")
ALNUM = frozenset(b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789")
LETTERS = frozenset(b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz")
DIGITS = frozenset(b"0123456789")
URL_SAFE = ALNUM | {ord("_"), ord("-")}
# Code, not a value: os.environ, settings.API_KEY, process.env.X! and a TypeScript non-null password! or session!
DOTTED = re.compile(rb"[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+!?|[A-Za-z_$]+!")
RANDOM_BYTES = frozenset(b"0123456789+/=!@#$%^*~")
WRAP = re.compile(rb"(?:\\+r)?\\+n")  # a line break inside a JSON string, escaped once or more



class Prefiltered:
    """A pattern tried only where one of its words occurs, in any case: re is slow at a case-insensitive
    alternation over a whole transcript, bytes.find is not. Prefiltered(SECRET_WORDS, NAMED_SECRET).finditer(data,
    accept) yields the matches that start at one of those words and that accept takes, in order. Every word is tried,
    also one inside an earlier match, so a match hides no credential after it ("key": "password=...", or an empty
    KEY= whose value swallows the next variable's name); _spans merges the matches that overlap."""

    CHUNK = 1 << 23  # lower-cased a piece at a time, so a large transcript is never copied whole

    def __init__(self, words: tuple[bytes, ...], pattern: bytes) -> None:
        self.words, self.pattern = words, re.compile(pattern)
        self.overlap = max(len(word) for word in words) - 1

    def finditer(self, data: bytes, accept: Callable[[re.Match[bytes]], bool]) -> Iterator[re.Match[bytes]]:
        starts: set[int] = set()
        for offset in range(0, len(data), self.CHUNK):
            piece = data[offset : offset + self.CHUNK + self.overlap].lower()
            for word in self.words:
                found = piece.find(word)
                while found >= 0:
                    starts.add(offset + found)
                    found = piece.find(word, found + 1)
        for start in sorted(starts):
            match = self.pattern.match(data, start)
            if match and accept(match):
                yield match


# Each pattern's group "secret" is what gets masked; the set holds the bytes that must not precede it.
PATTERNS: list[tuple[str, re.Pattern[bytes] | Prefiltered, frozenset[int]]] = [
    ("github-token", re.compile(rb"(?P<secret>gh[pousr]_[A-Za-z0-9]{36,255})"), WORD),
    # A GitHub token that a terminal or a narrow column wrapped onto the next line (_wrapped_token).
    (
        "github-token-wrapped",
        re.compile(rb"(?P<secret>gh[pousr]_[A-Za-z0-9]{1,35}(?:(?:\\+r)?\\+n[A-Za-z0-9]{1,36})+)"),
        WORD,
    ),
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
    ("slack-token", re.compile(rb"(?P<secret>(?:xox[abeoprs]|xapp)-[A-Za-z0-9-]{10,})"), WORD),
    (
        "slack-webhook",
        re.compile(rb"hooks\.slack\.com/(?:services|workflows|triggers)/(?P<secret>[A-Za-z0-9_/]{20,255})"),
        ANY,
    ),
    ("gitlab-token", re.compile(rb"(?P<secret>gl(?:pat|dt|rt|ptt|cbt)-[A-Za-z0-9_-]{20,255})"), WORD_DASH),
    ("huggingface-token", re.compile(rb"(?P<secret>hf_[A-Za-z0-9]{34,255})"), WORD),
    ("google-oauth-secret", re.compile(rb"(?P<secret>GOCSPX-[A-Za-z0-9_-]{28,255})"), WORD_DASH),
    ("sendgrid-key", re.compile(rb"(?P<secret>SG\.[A-Za-z0-9_-]{16,32}\.[A-Za-z0-9_-]{32,64})"), WORD_DASH),
    ("digitalocean-token", re.compile(rb"(?P<secret>do[opr]_v1_[a-f0-9]{64})"), WORD),
    ("razorpay-key", re.compile(rb"(?P<secret>rzp_(?:live|test)_[A-Za-z0-9]{14,64})"), WORD),
    ("shopify-token", re.compile(rb"(?P<secret>shp(?:at|ss|ca|pa)_[a-fA-F0-9]{32})"), WORD),
    ("atlassian-token", re.compile(rb"(?P<secret>ATATT3[A-Za-z0-9_=-]{50,})"), WORD_DASH),
    ("mailgun-key", re.compile(rb"(?P<secret>key-[0-9a-f]{32})(?![0-9A-Za-z])"), WORD),
    ("square-token", re.compile(rb"(?P<secret>EAAA[A-Za-z0-9_-]{60,})"), BASE64_RUN),
    # A legacy FCM server key, AAAA and seven characters then :APA91 and the key: masked from APA91 on.
    ("fcm-server-key", re.compile(rb":(?P<secret>APA91[A-Za-z0-9_-]{100,})"), ANY),
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
    # The password of mysql -p<password> and of curl -u user:<password>, in the same shell command; never an
    # expansion ($VAR) or the empty one of a password prompt (mysql -p, curl -u user:).
    (
        "mysql-password",
        re.compile(
            rb"mysql(?:dump|admin)?[ \t](?:[^\n|;&]{0,200}?[ \t])?-p(?:\\{0,7}[\"'])?"
            rb"(?P<secret>[^\s\"'\\$|;&<>`]{4,128})"
        ),
        ANY,
    ),
    (
        "curl-password",
        re.compile(
            rb"curl[ \t](?:[^\n|;&]{0,300}?[ \t])?(?:-u|--user)(?:[ \t]+|=)?(?:\\{0,7}[\"'])?[^\s:\"'\\$]{1,128}:"
            rb"(?P<secret>[^\s\"'\\$@]{4,128})"
        ),
        ANY,
    ),
    # A session cookie in a Cookie or Set-Cookie header: sessionid=, PHPSESSID=, connect.sid=, _app_session=, whose
    # value mixes letters and digits, as a generated session id does. The lookaheads keep that test inside the
    # pattern, so a session-named cookie holding a word (ui_session=compact) does not hide the next one.
    (
        "cookie-session",
        re.compile(
            rb"ookie(?:\\{0,7}[\"'])?[ \t]*:[ \t]*(?:\\{0,7}[\"'])?(?:[^\n;\"\\]{0,256};[ \t]*){0,16}?"
            rb"[A-Za-z0-9_.-]*(?i:sess(?:ion)?(?:[_.-]?id)?|sid)="
            rb"(?P<secret>(?=[A-Za-z%._~+/-]*[0-9])(?=[0-9%._~+/-]*[A-Za-z])[A-Za-z0-9%._~+/-]{16,512})"
        ),
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
    ("named-secret", Prefiltered(SECRET_WORDS, NAMED_SECRET), ANY),
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
    """True when the byte before start is not in not_before, or ends a JSON escape or a terminal control sequence.

    _clean_start(b"xghp_", 1, WORD) is False; _clean_start(b"[32mghp_", 4, WORD) is True
    """
    if start == 0 or data[start - 1] not in not_before:
        return True
    if JSON_ESCAPE_TAIL.search(data, max(0, start - 6), start):
        return True
    return CONTROL_TAIL.search(data, max(0, start - 600), start) is not None


def _generated(value: bytes) -> bool:
    """True when a value looks generated, as an API key is: letters and digits mixed, 20 or more URL-safe characters
    or 32 or more base64 ones (hex included). A word, a name or a path is not: _generated(b"user-settings") is False."""
    if not (any(byte in DIGITS for byte in value) and any(byte in LETTERS for byte in value)):
        return False
    if len(value) >= 20 and all(byte in URL_SAFE for byte in value):
        return True
    return len(value) >= 32 and all(byte in BASE64 for byte in value)


def _env_line_word(data: bytes, match: re.Match[bytes]) -> bool:
    """True for a letters-only value of an UPPER_SNAKE key at the start of a .env or YAML line: DB_PASSWORD=Hunter,
    POSTGRES_PASSWORD: supersecret. A lower-camel-case value is an identifier, and a value after a space is prose."""
    value, name = match.group("secret"), match.group("name")
    if match.group("space") is not None or not value.isalpha() or LOWER_CAMEL.fullmatch(value) or not name.isupper():
        return False
    return ENV_LINE.search(data, max(0, match.start("name") - 200), match.start("name")) is not None


def _flag_word(data: bytes, match: re.Match[bytes]) -> bool:
    """True for a letters-only value given to a --flag with '=': --password=<word>, --db-password=<word>. After a
    space it stays (--password interactively is prose), and so does a lower-camel-case identifier."""
    value, start = match.group("secret"), match.start("name")
    if match.group("space") is not None or not value.isalpha() or LOWER_CAMEL.fullmatch(value):
        return False
    equals = data[match.end("name") : match.end("name") + 1] == b"="
    return equals and FLAG.search(data, max(0, start - 40), start) is not None


def _named_secret_value(data: bytes, match: re.Match[bytes]) -> bool:
    """True when the value of a secret-named key looks like a credential, not code, a type, an expansion or a word.

    A password may be a plain word, so a quoted value of a password or secret is masked as it is, and so is a
    letters-only value of an UPPER_SNAKE key on a .env or YAML line (_env_line_word) or of a --flag= (_flag_word);
    any other value must hold a digit or a symbol, or be
    20 characters or more, as a generated token or key does. A key whose owner is not a secret's (MSG91_AUTH_KEY,
    Ocp-Apim-Subscription-Key, AccountKey) is masked only when its value looks generated (_generated).
    _named_secret_value(b"PASSWORD=hashed_password,", m) is False; DATABASE_PASSWORD=Pw9Pw9Pw9x is True.
    """
    name, start = match.group("name").lower(), match.start("name")
    value = match.group("secret")
    if match.group("space") is not None and not FLAG.search(data, max(0, start - 40), start):
        return False  # a word after the name in prose: only a --flag takes its value after a space
    if name == b"key" and not KEY_OWNER.search(data[max(0, start - 12) : start].lower()) and not _generated(value):
        return False  # a key that names no secret, and holds a word: PRIMARY_KEY, sort_key, ssh key
    if name in (b"pass", b"auth") and start > 0 and data[start - 1] in ALNUM:
        if not JSON_ESCAPE_TAIL.search(data, max(0, start - 2), start):
            if name == b"auth" or not PASS_OWNER.search(data[max(0, start - 6) : start].lower()):
                return False  # bypass, OAuth: the end of another word
    if name == b"pwd" and data[start - 1 : start] not in (b"_", b"-"):
        return False  # PWD and OLDPWD are the working directory
    if value.startswith((b"$", b"-----", b"*")):
        return False  # $VAR, $(cmd), ${{ secrets.X }}; a PEM marker, whose body the private-key rules mask; ** or ***
    if value.lower() == name:
        return False  # a label: "password": "Password"
    if data[match.end("secret") : match.end("secret") + 1] in (b"(", b"[", b"{"):
        return False  # a call or an index: code
    if match.group("quote") and (name.startswith(b"pass") or name in (b"pwd", b"secret")):
        return True
    if DOTTED.fullmatch(value):
        return False
    if len(value) >= 20 or any(byte in RANDOM_BYTES for byte in value):
        return True
    return name != b"key" and (_env_line_word(data, match) or _flag_word(data, match))


def _wrapped_token(data: bytes, match: re.Match[bytes]) -> bool:
    """True when a GitHub token broken by line breaks still has its 36 characters after the prefix."""
    return len(WRAP.sub(b"", match.group("secret")[4:])) >= 36


CHECKS = {
    "named-secret": _named_secret_value,
    "github-token-wrapped": _wrapped_token,
}


def _matches(
    data: bytes, kind: str, pattern: re.Pattern[bytes] | Prefiltered, not_before: frozenset[int]
) -> Iterator[re.Match[bytes]]:
    """The matches of one pattern that start clean and pass its check (CHECKS), in order."""
    check = CHECKS.get(kind)

    def accept(match: re.Match[bytes]) -> bool:
        return _clean_start(data, match.start("secret"), not_before) and (check is None or check(data, match))

    if isinstance(pattern, Prefiltered):
        return pattern.finditer(data, accept)
    return filter(accept, pattern.finditer(data))


def _spans(data: bytes) -> list[tuple[int, int, bool]]:
    """(start, end, base64_only) of every match, overlapping matches merged into one credential."""
    found = []
    for kind, pattern, not_before in PATTERNS:
        for match in _matches(data, kind, pattern, not_before):
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


def _complete_part(data: bytes) -> bytes:
    """data up to and including its last newline: a line still being written is left for the next run."""
    cut = data.rfind(b"\n")
    return data[: cut + 1] if cut >= 0 else b""


def _apply(data: bytes, edits: list[tuple[int, bytes]]) -> bytes:
    out = bytearray(data)
    for offset, replacement in edits:
        out[offset : offset + len(replacement)] = replacement
    return bytes(out)


def _record(lock: int) -> dict:
    """What write_snapshot recorded in the snapshot's lock file: the transcript it was written from ({} when none)."""
    try:
        record = json.loads(os.pread(lock, 65536, 0).decode("utf-8") or "{}")
    except (OSError, ValueError):
        return {}
    return record if isinstance(record, dict) else {}


def _starts_with(path: str, data: bytes) -> bool:
    """True when the file at path begins with data, read a piece at a time."""
    with open(path, "rb") as handle:
        for offset in range(0, len(data), 1 << 22):
            piece = data[offset : offset + (1 << 22)]
            if handle.read(len(piece)) != piece:
                return False
    return True


def _is_newer_copy(out_path: str, lock: int, data: bytes, source: tuple[str, os.stat_result] | None) -> bool:
    """True when out_path already holds data, or data and more, masked from the same transcript, safe to hand on.

    That is a regular file of this user with one link and no group or other access, whose lock file names the same
    transcript (device and inode) as source, which has not shrunk since, and which starts with data.
    """
    try:
        info = os.lstat(out_path)
    except FileNotFoundError:
        return False
    if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_uid != os.geteuid() or info.st_mode & 0o077:
        return False  # a symbolic or hard link (to the live transcript, say), or a file another user could read
    if source is None or info.st_size < len(data):
        return False
    path, read = source
    record = _record(lock)
    if (record.get("dev"), record.get("ino")) != (read.st_dev, read.st_ino):
        return False  # written from another transcript, or from one since replaced, or by an older redactor
    try:
        if os.stat(path).st_size < record.get("size", 0):
            return False  # rewritten shorter since that copy: the copy is stale
    except OSError:
        pass
    return _starts_with(out_path, data)


def _open_lock(out_path: str) -> int:
    """Opens and locks out_path's lock file, the same file every writer uses (reopened if it was swept meanwhile)."""
    for _ in range(5):
        lock = os.open(out_path + ".lock", os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0), 0o600)
        fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            if os.path.samestat(os.fstat(lock), os.stat(out_path + ".lock")):
                return lock
        except FileNotFoundError:
            pass
        os.close(lock)
    raise OSError(errno.EAGAIN, "the snapshot's lock file keeps being replaced", out_path + ".lock")


def write_snapshot(
    out_path: str, data: bytes, source: tuple[str, os.stat_result] | None = None, make_parents: bool = True
) -> str:
    """Writes data to out_path atomically, 0600 in a 0700 directory; returns "written", "unchanged" or "kept".

    source is the transcript data was read from, as (path, its stat when read). A snapshot that already holds data is
    left as it is ("unchanged", so a miner does not re-mine it). A mine started earlier can finish its scan later; it
    then keeps the newer, longer snapshot of the same transcript ("kept", _is_newer_copy), so every miner reads the
    newest redacted copy. Anything else at out_path is replaced, never followed or read: a symbolic or hard link, a
    stale or foreign file, a copy of a transcript since rewritten shorter. The lock file records the source.
    With make_parents=False (--snapshot-only) only out_path's own directory is made, inside one that exists: once
    the user removed ~/.mempalace (MemPalace's off switch) the write fails with ENOENT instead of making it again.
    write_snapshot(os.path.expanduser("~/.mempalace/hook_state/redacted/<session>.jsonl"), masked, (path, info))
    """
    directory = os.path.dirname(os.path.abspath(out_path))
    if make_parents:
        os.makedirs(directory, mode=0o700, exist_ok=True)
    else:
        with contextlib.suppress(FileExistsError):
            os.mkdir(directory, 0o700)
    os.chmod(directory, 0o700)
    lock = _open_lock(out_path)
    try:
        if _is_newer_copy(out_path, lock, data, source):
            return "unchanged" if os.lstat(out_path).st_size == len(data) else "kept"
        temporary = f"{out_path}.{os.getpid()}.tmp"
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            with os.fdopen(fd, "wb") as handle:
                handle.write(data)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, out_path)  # a link at out_path is replaced itself, its target left alone
        except BaseException:
            with contextlib.suppress(FileNotFoundError):
                os.unlink(temporary)
            raise
        record = {}
        if source is not None:
            path, read = source
            record = {"source": os.path.abspath(path), "dev": read.st_dev, "ino": read.st_ino, "size": read.st_size}
        os.ftruncate(lock, 0)
        os.pwrite(lock, json.dumps(record).encode("utf-8"), 0)
        return "written"
    finally:
        os.close(lock)


def sweep(directory: str, days: float) -> int:
    """Removes the snapshots whose transcript is gone (Claude Code's cleanup) and that are days old; returns how many.

    Only a snapshot whose lock file records its transcript is ever removed, with that lock file, and never while a
    writer holds it. The drawers mined from it keep their text. sweep("~/.mempalace/hook_state/redacted", 7)
    """
    removed, cutoff = 0, time.time() - days * 86400
    try:
        names = sorted(os.listdir(directory))
    except FileNotFoundError:
        return 0
    for name in names:
        if not name.endswith(".lock"):
            continue
        lock_path = os.path.join(directory, name)
        snapshot = lock_path[: -len(".lock")]
        try:
            lock = os.open(lock_path, os.O_RDWR | getattr(os, "O_NOFOLLOW", 0))
        except OSError:
            continue
        try:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                continue  # being written now
            source = _record(lock).get("source")
            if not isinstance(source, str) or os.path.lexists(source):
                continue  # no record (written by an older redactor), or its transcript is still there
            try:
                info = os.lstat(snapshot)
            except FileNotFoundError:
                info = None
            if info is not None and (not stat.S_ISREG(info.st_mode) or info.st_mtime > cutoff):
                continue
            if info is not None:
                os.unlink(snapshot)
            os.unlink(lock_path)
            removed += 1
        finally:
            os.close(lock)
    return removed


def _mask_in_place(path: str, handle: io.BufferedReader, edits: list[tuple[int, bytes]]) -> None:
    """Writes the edits over the file handle has open (its exclusive lock held by the caller)."""
    fd = os.open(path, os.O_RDWR)
    try:
        if not os.path.samestat(os.fstat(fd), os.fstat(handle.fileno())):
            raise OSError(errno.ESTALE, "the file was replaced while it was being scanned", path)
        for offset, replacement in edits:
            os.pwrite(fd, replacement, offset)
        os.fsync(fd)
    finally:
        os.close(fd)


def redact_file(path: str, check_only: bool, snapshot: str | None = None, in_place: bool = True) -> tuple[int, str]:
    """Masks (or counts) the credentials in the file's complete lines; returns how many, and what became of snapshot.

    With snapshot, also writes those masked complete lines there (write_snapshot: "written", "unchanged", or "kept"
    when a newer copy is there), so a miner can read a copy in which every byte has been scanned:
    redact_file("t.jsonl", False, "redacted/t.jsonl") == (1, "written").
    With in_place=False (--snapshot-only) the file is opened read-only and never written: only the
    snapshot is masked. redact_file("other.jsonl", False, "redacted/other.jsonl", in_place=False)
    """
    writes = in_place and not check_only
    # Non-blocking, so a FIFO put where a transcript was expected is refused instead of hanging the hook.
    with os.fdopen(os.open(path, os.O_RDONLY | getattr(os, "O_NONBLOCK", 0)), "rb") as handle:
        read = os.fstat(handle.fileno())
        if not stat.S_ISREG(read.st_mode):
            raise OSError(errno.EINVAL, "not a regular file", path)
        # Exclusive while this run may write, shared while it only reads: a read never sees a half-written mask.
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX if writes else fcntl.LOCK_SH)
        data = _complete_part(handle.read())
        if not writes:
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)  # what it needs is read: let a masker go on
        edits = find(data)
        if writes and edits:
            _mask_in_place(path, handle, edits)
    if check_only or snapshot is None:
        return len(edits), ""
    return len(edits), write_snapshot(snapshot, _apply(data, edits), (path, read), make_parents=in_place)


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
    main(["--snapshot-only", "redacted/t.jsonl", "t.jsonl"])  # 0, "... masked in the snapshot"; t.jsonl as it was
    """
    if argv[:1] == ["--self-test"]:
        return self_test()
    if argv[:1] == ["--sweep"] and len(argv) in (2, 3):
        try:
            removed = sweep(argv[1], float(argv[2]) if len(argv) == 3 else 7)
        except (OSError, ValueError) as error:
            print(f"sweep: not done ({getattr(error, 'strerror', None) or error})")
            return 2
        print(f"sweep: {removed} snapshot(s) of deleted transcripts removed")
        return 0
    check_only = argv[:1] == ["--check"]
    in_place = argv[:1] != ["--snapshot-only"]
    snapshot = argv[1] if argv[:1] in (["--snapshot"], ["--snapshot-only"]) and len(argv) == 3 else None
    paths = argv[1:] if check_only else argv[2:] if snapshot else argv
    if not paths or paths[0].startswith("--"):
        print(__doc__.strip())
        return 2
    found_any = False
    for path in paths:
        try:
            count, state = redact_file(path, check_only, snapshot, in_place)
        except OSError as error:
            print(f"{os.path.basename(path)}: not redacted ({error.strerror})")
            return 2
        found_any = found_any or count > 0
        verb = "found" if check_only else "masked" if in_place else "masked in the snapshot"
        note = {"kept": "; snapshot kept: a newer masked copy of the same transcript is there",
                "unchanged": "; snapshot unchanged"}.get(state, "")
        print(f"{os.path.basename(path)}: {count} credential(s) {verb}{note}")
    return 1 if check_only and found_any else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
