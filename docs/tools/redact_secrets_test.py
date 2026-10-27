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


def named_and_prefix_cases() -> list[Case]:
    """Values of keys that name a secret (.env, JSON, YAML, headers) and the prefixes of more providers."""
    a = "Zq7" * 20
    secret52, pw16, hex32 = "k3" * 26, "Pw9" * 5 + "x", "a1b2" * 8
    b64 = "dXNl" + "cjpwYXNzd29yZDEy"
    gh = "gh" + "p_" + a[:36]
    sendgrid = "S" + "G." + a[:22] + "." + a[:43]
    webhook = "https://hooks.slack.com/services/" + "T0" + "0000000/B0" + "0000000/" + a[:24]
    return [
        ("client secret in a .env line", tool_result(f"COGNITO_CLIENT_SECRET={secret52}\n"), 1, [secret52]),
        ("password in a .env line", tool_result(f"DATABASE_PASSWORD={pw16}\n"), 1, [pw16]),
        ("quoted django secret key", tool_result(f'SECRET_KEY="{secret52}"'), 1, [secret52]),
        ("password in json", tool_result(json.dumps({"password": pw16})), 1, [pw16]),
        ("client secret in camel-case json", tool_result(json.dumps({"ClientSecret": secret52})), 1, [secret52]),
        ("password in yaml", tool_result(f"db:\n  password: {pw16}\n"), 1, [pw16]),
        ("x-api-key header", tool_use(f"curl -H 'x-api-key: {hex32}' https://api.example.com"), 1, [hex32]),
        ("a _PASS variable", tool_result(f"SMTP_PASS={pw16}"), 1, [pw16]),
        ("a _PWD variable", tool_result(f"DB_PWD={pw16}"), 1, [pw16]),
        ("a letters-only quoted password", tool_result(json.dumps({"password": "correcthorsebattery"})), 1,
         ["correcthorsebattery"]),
        ("a password with a digit and a bang", tool_result("ADMIN_PASSWORD=Welcome1!"), 1, ["come1!"]),
        ("quoted api token", tool_result(json.dumps({"api_token": "tk" + a[:30]})), 1, [a[4:30]]),
        ("docker registry auth", tool_result(json.dumps({"auths": {"ghcr.io": {"auth": b64}}})), 1, [b64]),
        ("password in a nested json string",
         tool_result(json.dumps({"SecretString": json.dumps({"password": pw16})})), 1, [pw16]),
        ("gitlab token", tool_result("glp" + "at-" + a[:20]), 1, [a[:20]]),
        ("hugging face token", tool_result("h" + "f_" + a[:34]), 1, [a[:34]]),
        ("google oauth client secret", tool_result("GOC" + "SPX-" + a[:28]), 1, [a[:28]]),
        ("sendgrid key", tool_result(sendgrid), 1, [a[:22], a[:43]]),
        ("slack webhook url", tool_result(webhook), 1, [a[:24]]),
        ("slack app token", tool_result("xa" + "pp-1-" + "A0" + a[:30]), 1, [a[:30]]),
        ("digitalocean token", tool_result("do" + "p_v1_" + "ab12" * 16), 1, ["ab12" * 16]),
        ("razorpay key", tool_result("rz" + "p_live_" + a[:14]), 1, [a[:14]]),
        ("github token wrapped onto a second line", tool_result(gh[:30] + "\n" + gh[30:] + " done"), 1,
         [gh[4:30], gh[30:]]),
    ]


def residual_cases() -> list[Case]:
    """Forms the first named-secret rule left in clear: letters-only passwords on .env and YAML lines, keys of any
    owner, a value after a --flag, mysql -p, curl -u, a session cookie, more prefixes, and a value inside a match
    the check rejects."""
    letters, mixed, hex32 = "Qwertyuiopasdfgh", "Pw9" * 5 + "x", "a1b2c3d4" * 4
    b64 = "Zq7+" * 21 + "Zq7=" + "="
    fcm = "AA" + "AA" + "Bc9-xYz" + ":" + "AP" + "A91b" + "Zq7_" * 34
    compose = f"services:\n  db:\n    environment:\n      POSTGRES_PASSWORD: {letters[:13]}\n"
    azure = f"DefaultEndpointsProtocol=https;AccountName=ampm;Account{'Key'}={b64};EndpointSuffix=core.windows.net"
    return [
        ("a letters-only password in a .env line", tool_result(f"DB_PASSWORD={letters[:12]}\n"), 1, [letters[4:12]]),
        ("a letters-only password in docker compose", tool_result(compose), 1, [letters[4:13]]),
        ("a letters-only password in a compose list", tool_result(f"    - SMTP_PASS={letters}\n"), 1, [letters[4:]]),
        ("a letters-only password read with line numbers", tool_result(numbered(["# db", f"PGPASSWORD={letters}"])),
         1, [letters[4:]]),
        ("PGPASSWORD before psql", tool_use(f"PGPASSWORD={letters[:13]} psql -h db -U ampm"), 1, [letters[4:13]]),
        ("an exported letters-only password", tool_use(f"export ADMIN_SECRET={letters}"), 1, [letters[4:]]),
        ("a letters-only api token", tool_result(f"API_TOKEN={letters + 'jkl'}\n"), 1, [letters[4:]]),
        ("a pass after db", tool_result(f"DBPASS={mixed}\n"), 1, [mixed[4:]]),
        ("a key of another owner", tool_result(f"MSG91_AUTH_KEY={'Zq7' * 8}\n"), 1, ["Zq7" * 7]),
        ("a hex key of another owner", tool_result(f"ALGOLIA_ADMIN_KEY={hex32}\n"), 1, [hex32[4:]]),
        ("a write key", tool_result(json.dumps({"SEGMENT_WRITE_KEY": hex32})), 1, [hex32[4:]]),
        ("a key with no owner", tool_result(f"LICENSE_KEY={hex32}\n"), 1, [hex32[4:]]),
        ("a subscription key header", tool_use(f"curl -H 'Ocp-Apim-Subscription-Key: {hex32}' https://x"), 1,
         [hex32[4:]]),
        ("an azure account key", tool_result(azure), 1, [b64[4:40]]),
        ("a password after a --flag and a space", tool_use(f"ampm-cli login --password {mixed}"), 1, [mixed[4:]]),
        ("a quoted token after a --flag", tool_use(f"ampm-cli deploy --api-token '{'Zq7' * 8}'"), 1, ["Zq7" * 7]),
        ("mysql -p", tool_use(f"mysql -u root -p{mixed} ampm"), 1, [mixed[4:]]),
        ("mysqldump -p quoted", tool_use(f"mysqldump -uroot -p'{mixed}' ampm > a.sql"), 1, [mixed[4:]]),
        ("curl -u", tool_use(f"curl -u admin:{mixed} https://api.example.com"), 1, [mixed[4:]]),
        ("curl --user=", tool_use(f"curl -s --user=admin:{mixed} https://api.example.com"), 1, [mixed[4:]]),
        ("a session cookie", tool_result(f"< set-cookie: sessionid={hex32}; Path=/; HttpOnly"), 1, [hex32[4:]]),
        ("a session cookie after others", tool_use(f"curl -H 'Cookie: theme=dark; PHPSESSID={hex32}' x"), 1,
         [hex32[4:]]),
        ("a shopify token", tool_result("shp" + "at_" + hex32), 1, [hex32]),
        ("a shopify shared secret", tool_result("shp" + "ss_" + hex32), 1, [hex32]),
        ("an atlassian api token", tool_result("ATA" + "TT3x" + "Zq7" * 60), 1, ["Zq7" * 50]),
        ("a mailgun key", tool_result(json.dumps({"api": "ke" + "y-" + hex32})), 1, [hex32]),
        ("a square access token", tool_result("EA" + "AA" + "Zq7" * 20), 1, ["Zq7" * 19]),
        ("an fcm server key", tool_result(f"server key {fcm}"), 1, ["Zq7_" * 34]),
        ("a password inside a rejected key match", tool_result(json.dumps({"key": "password=" + mixed[:14]})), 1,
         [mixed[4:14]]),
    ]


def residual_code_cases() -> list[Case]:
    """What the residual rules must leave alone: code, labels, prompts, expansions and paths."""
    return [
        ("a camel-case value on a .env-like line", tool_result("DB_PASSWORD: dbPasswordValue,\n"), 0, []),
        ("a snake-case value on a .env-like line", tool_result("DB_PASSWORD=hashed_password\n"), 0, []),
        ("a letters-only value after a lower-case key", tool_result("  password: undefined,\n  token: required\n"), 0,
         []),
        ("a letters-only value in prose", tool_result("set API_TOKEN=yourtokenhere in the file"), 0, []),
        ("a word after a --flag", tool_result("the CLI asks for --password interactively"), 0, []),
        ("a word after a secret name in prose", tool_result("token management overview and key components"), 0, []),
        ("a short key value", tool_result(json.dumps({"key": "user-settings", "PARTITION_KEY": "tenantIdentifier"})),
         0, []),
        ("an s3 object key", tool_result(json.dumps({"Key": "uploads/2026/10/27/site-photo-0001.jpg"})), 0, []),
        ("mysql prompting for the password", tool_use("mysql -u root -p ampm; mysql -uroot -p\"$MYSQL_PWD\" ampm"), 0,
         []),
        ("curl prompting or expanding", tool_use('curl -u admin: https://x; curl -u "$USER:$PASS" https://x'), 0, []),
        ("curl with a user agent", tool_use('curl --user-agent "Mozilla/5.0 (X11; Linux x86_64)" https://x'), 0, []),
        ("a cookie with no session", tool_result("Cookie: theme=dark; lang=en-GB; consent=essentialonly"), 0, []),
        ("claude code session ids", json.dumps({"sessionId": "12345678-9abc-4def-8123-456789abcdef", "cwd": "/x"}),
         0, []),
        ("a compass, not a pass", tool_result("COMPASS=Northeast2026"), 0, []),
        ("a square-like run inside base64", tool_result("Zq7Q" * 10 + "+" + "EA" + "AA" + "Zq7Q" * 20 + "/Zq7Q"), 0,
         []),
    ]


def code_and_prose_cases() -> list[Case]:
    """Secret-named keys whose value is code, a type, an expansion, a path or a count: nothing to mask."""
    return [
        ("environment lookup", tool_result('password = os.environ["DB_PASSWORD"]'), 0, []),
        ("function call", tool_result("token = get_token(session)"), 0, []),
        ("settings attribute", tool_result("api_key=settings.API_KEY,"), 0, []),
        ("non-null env lookup", tool_result("secret: process.env.JWT_SECRET!,"), 0, []),
        ("zod schema", tool_result("password: z.string().min(8),"), 0, []),
        ("type annotation", tool_result("token: CancellationToken;"), 0, []),
        ("keyword argument", tool_result("connect(user=user, password=hashed_password, port=5432)"), 0, []),
        ("working directory", tool_result("PWD=/Users/dev/code/other\nOLDPWD=/Users/dev/code/other2\n"), 0, []),
        ("token counts", tool_result(json.dumps({"max_tokens": 32000, "cache_read_input_tokens": 123456789})), 0, []),
        ("shell expansions", tool_use('export API_KEY="$(security find-generic-password -w)"; token=${GH}'), 0, []),
        ("actions secret", tool_result("token: ${{ secrets.GITHUB_TOKEN }}"), 0, []),
        ("already masked", tool_result(json.dumps({"password": "Pw9*************"})), 0, []),
        ("the local ampm password", tool_result("PASSWORD=ampm"), 0, []),
        ("a word after prose", tool_result("the token: a short-lived credential"), 0, []),
        ("a design token name", tool_result("{ file: 'wireframes.md', token: 'wireframes' }"), 0, []),
        ("typescript non-null", tool_result("signIn({ email, password: password! }); x = { auth: session! }"), 0, []),
        ("a ui label", tool_result(json.dumps({"password": "Password", "email": "Email"})), 0, []),
        ("markdown bold", tool_result("- auth: **required everywhere**"), 0, []),
        ("a dotted token path", tool_result(json.dumps({"token": "color.primary.default"})), 0, []),
    ]


def escape_cases() -> list[Case]:
    """A token right after a JSON \\uXXXX, \\b or \\f escape, or after any terminal control sequence."""
    s = samples()
    gh, aws, jwt = s["gh"], s["aws_id"], s["jwt"]
    sk = "s" + "k-" + "x" * 40
    return [
        ("token after \\u2014 in printed json", tool_result(json.dumps({"note": "\u2014" + gh})), 1, [gh[4:]]),
        ("token after \\u003c in go json", tool_result('{"v":"\\u003c' + gh + '\\u003e"}'), 1, [gh[4:]]),
        ("aws key id after \\u00a0", tool_result(json.dumps({"k": "\u00a0" + aws})), 1, [aws[4:]]),
        ("jwt after \\u201c", tool_result(json.dumps({"k": "\u201c" + jwt})), 1, [jwt[4:]]),
        ("sk- key after \\u2018", tool_result(json.dumps({"k": "\u2018" + sk})), 1, [sk[4:]]),
        ("token after \\b", tool_result("\b" + gh), 1, [gh[4:]]),
        ("token after \\f", tool_result("\f" + gh), 1, [gh[4:]]),
        ("token after erase line and column 1", tool_result("\x1b[2K\x1b[1G" + gh), 1, [gh[4:]]),
        ("token after show cursor", tool_result("\x1b[?25h" + gh), 1, [gh[4:]]),
        ("token after an osc 8 link ended by bel", tool_result("\x1b]8;;https://example.com/x\x07" + gh), 1, [gh[4:]]),
        ("token after an osc 8 link ended by st", tool_result("\x1b]8;;https://example.com/x\x1b\\" + gh), 1, [gh[4:]]),
        ("a csi-like tail with no escape before it", tool_result("arr[A" + gh), 0, []),
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


def _source(path: str) -> tuple[str, os.stat_result]:
    """A transcript as redact_file passes it to write_snapshot: its path and its stat when read."""
    return path, os.stat(path)


def _write(path: str, data: bytes) -> None:
    with open(path, "wb") as handle:
        handle.write(data)


def _read(path: str) -> bytes:
    with open(path, "rb") as handle:
        return handle.read()


def check_snapshot_only_grows() -> list[str]:
    """A mine whose scan finishes late never replaces a newer, longer snapshot of the same transcript."""
    with tempfile.TemporaryDirectory() as scratch:
        live, out = os.path.join(scratch, "t.jsonl"), os.path.join(scratch, "redacted", "t.jsonl")
        _write(live, b"line 1\n")
        early = _source(live)  # a scan that read one line, and finishes last
        _write(live, b"line 1\nline 2\n")
        first = rs.write_snapshot(out, b"line 1\nline 2\n", _source(live))
        late = rs.write_snapshot(out, b"line 1\n", early)
        kept = _read(out) == b"line 1\nline 2\n"
        _write(live, b"line 1\nline 2\nline 3\n")
        rs.write_snapshot(out, b"line 1\nline 2\nline 3\n", _source(live))
        grew = _read(out) == b"line 1\nline 2\nline 3\n"
        left_over = [name for name in os.listdir(os.path.dirname(out)) if name.endswith(".tmp")]
    kept = kept and (first, late) == ("written", "kept")
    problems = [] if kept else ["snapshot: a shorter copy replaced a longer one"]
    problems += [] if grew else ["snapshot: a longer copy did not replace the snapshot"]
    return problems + ([f"snapshot: temporary files left: {left_over}"] if left_over else [])


def check_snapshot_replaces_what_is_not_a_newer_copy() -> list[str]:
    """A link, a stale or foreign file, or a copy of a transcript since rewritten shorter is replaced, never read."""
    s = samples()
    clear = (tool_result(f"token {s['gh']}") + "\n").encode()
    masked = apply(clear, rs.find(clear))
    problems = []
    with tempfile.TemporaryDirectory() as scratch:
        live, redacted = os.path.join(scratch, "t.jsonl"), os.path.join(scratch, "redacted")
        os.makedirs(redacted, mode=0o700)
        out = os.path.join(redacted, "t.jsonl")
        _write(live, clear + b'{"partial')
        states = {
            "a symbolic link to the transcript": lambda: os.symlink(live, out),
            "a hard link to the transcript": lambda: os.link(live, out),
            "a larger stale file, 0644": lambda: (_write(out, clear * 3), os.chmod(out, 0o644)),
            "a newer copy from a stale source record": lambda: (
                rs.write_snapshot(out, masked * 2, (live, os.stat(scratch))), None),
        }
        for name, make in states.items():
            for leftover in (out, out + ".lock"):
                if os.path.lexists(leftover):
                    os.unlink(leftover)
            make()
            with contextlib.redirect_stdout(io.StringIO()):
                status = rs.main(["--snapshot-only", out, live])
            info = os.lstat(out)
            ok = status == 0 and not os.path.islink(out) and info.st_nlink == 1 and _read(out) == masked
            problems += [] if ok and info.st_mode & 0o777 == 0o600 else [f"snapshot over {name}: not replaced"]
            problems += [] if _read(live) == clear + b'{"partial' else [f"snapshot over {name}: the transcript changed"]
        os.unlink(live)
        _write(live, clear * 3)  # a new file in its place, longer
        rs.write_snapshot(out, apply(clear * 3, rs.find(clear * 3)), _source(live))
        with open(live, "r+b") as handle:  # rewritten shorter in place, as /compact may
            handle.truncate(len(clear))
        rs.write_snapshot(out, masked, _source(live))
        problems += [] if _read(out) == masked else ["snapshot: a transcript rewritten shorter kept its stale copy"]
        before = os.stat(out).st_mtime_ns
        unchanged = rs.write_snapshot(out, masked, _source(live))
        same = unchanged == "unchanged" and os.stat(out).st_mtime_ns == before
        problems += [] if same else ["snapshot: an unchanged copy was rewritten"]
        printed = io.StringIO()
        with contextlib.redirect_stdout(printed):
            rs.main(["--snapshot-only", out, live])
        reported = "snapshot unchanged" in printed.getvalue()
        problems += [] if reported else ["snapshot: an unchanged copy is not reported"]
    return problems


def check_newer_redactor_replaces_an_older_copy() -> list[str]:
    """A snapshot written by an older redactor (one rule fewer: an installed copy behind the repository, or a rule
    added since) is replaced when the full redactor rescans the transcript, at the same size or when the older copy
    is longer: only its content shows that the value is still in clear there."""
    value = "Pw9" * 5 + "x"
    record = {"type": "user", "cwd": "/x", "message": {"content": "DB_PASS" + "WORD=" + value}}
    line = (json.dumps(record) + "\n").encode()
    full = rs.PATTERNS
    older = [pattern for pattern in full if pattern[0] != "named-secret"]
    problems = []
    with tempfile.TemporaryDirectory() as scratch:
        live, out = os.path.join(scratch, "t.jsonl"), os.path.join(scratch, "redacted", "t.jsonl")
        for variant in ("same size", "older copy longer"):
            for leftover in (out, out + ".lock"):
                if os.path.lexists(leftover):
                    os.unlink(leftover)
            _write(live, line)
            early = _source(live)  # the full redactor's scan read this much, and finishes last
            if variant == "older copy longer":
                with open(live, "ab") as handle:
                    handle.write(b'{"type": "user", "message": {"content": "more"}}\n')
            rs.PATTERNS = older
            try:
                with contextlib.redirect_stdout(io.StringIO()):
                    rs.main(["--snapshot-only", out, live])
            finally:
                rs.PATTERNS = full
            if value.encode() not in _read(out):
                problems.append(f"newer redactor, {variant}: the older redactor's copy already masked the value")
                continue
            state = rs.write_snapshot(out, apply(line, rs.find(line)), early)
            if state != "written" or value.encode() in _read(out):
                problems.append(f"newer redactor, {variant}: the older copy was {state}, its value left in clear")
    return problems


def check_snapshot_only_makes_no_parent_folder() -> list[str]:
    """--snapshot-only makes the snapshot's folder only inside one that exists: MemPalace's off switch is removing
    ~/.mempalace, and a scan that ends after the user removed it must not bring it back."""
    with tempfile.TemporaryDirectory() as scratch:
        live = os.path.join(scratch, "t.jsonl")
        _write(live, b"{}\n")
        gone = os.path.join(scratch, "mempalace")
        out = os.path.join(gone, "hook_state", "redacted", "t.jsonl")
        printed = io.StringIO()
        with contextlib.redirect_stdout(printed):
            status = rs.main(["--snapshot-only", out, live])
        refused = status == 2 and "not redacted (No such file or directory)" in printed.getvalue()
        problems = [] if refused else [f"snapshot-only into a removed folder: exited {status}"]
        problems += ["snapshot-only: a removed folder was made again"] if os.path.exists(gone) else []
        os.makedirs(os.path.join(gone, "hook_state"), exist_ok=True)
        with contextlib.redirect_stdout(io.StringIO()):
            status = rs.main(["--snapshot-only", out, live])
        made = os.path.dirname(out)
        ok = status == 0 and os.path.isdir(made) and os.stat(made).st_mode & 0o777 == 0o700
        return problems + ([] if ok else ["snapshot-only: the snapshot's own folder was not made 0700"])


def check_link_with_a_matching_record_is_replaced() -> list[str]:
    """A link put where a snapshot was, its record still naming the transcript, is replaced, never handed on: a link
    to the live transcript would show MemPalace the lines appended after the scan."""
    problems = []
    for kind in ("hard", "symbolic"):
        with tempfile.TemporaryDirectory() as scratch:
            live, out = os.path.join(scratch, "t.jsonl"), os.path.join(scratch, "redacted", "t.jsonl")
            _write(live, b"{}\n")  # nothing to mask: the copy and the transcript start alike
            rs.write_snapshot(out, b"{}\n", _source(live))
            os.unlink(out)
            (os.link if kind == "hard" else os.symlink)(live, out)
            with open(live, "ab") as handle:
                handle.write(b'{"still being written')
            state = rs.write_snapshot(out, b"{}\n", _source(live))
            info = os.lstat(out)
            ok = state == "written" and not os.path.islink(out) and info.st_nlink == 1 and _read(out) == b"{}\n"
            problems += [] if ok else [f"snapshot: a {kind} link with a matching record was kept ({state})"]
    return problems


def check_sweep() -> list[str]:
    """--sweep removes a snapshot only when the transcript it was written from is gone and it is DAYS old."""
    problems = []
    with tempfile.TemporaryDirectory() as scratch:
        redacted = os.path.join(scratch, "redacted")
        old = time.time() - 9 * 86400
        names = {"gone": False, "recent": True, "present": True, "unrecorded": True, "busy": True}
        for name in names:
            live = os.path.join(scratch, f"{name}.jsonl")
            _write(live, b"line\n")
            out = os.path.join(redacted, f"{name}.jsonl")
            rs.write_snapshot(out, b"line\n", _source(live))
            if name != "recent":
                os.utime(out, (old, old))
            if name in ("gone", "recent", "busy"):
                os.unlink(live)
        with open(os.path.join(redacted, "unrecorded.jsonl.lock"), "w"):
            pass  # an empty lock file, as an older redactor left it
        holder = os.open(os.path.join(redacted, "busy.jsonl.lock"), os.O_RDWR)
        fcntl.flock(holder, fcntl.LOCK_EX)
        try:
            with contextlib.redirect_stdout(io.StringIO()):
                status = rs.main(["--sweep", redacted, "7"])
        finally:
            os.close(holder)
        problems += [] if status == 0 else [f"--sweep exited {status}"]
        for name, stays in names.items():
            there = os.path.exists(os.path.join(redacted, f"{name}.jsonl"))
            problems += [] if there == stays else [f"sweep: snapshot '{name}' {'removed' if stays else 'left'}"]
        problems += [] if not os.path.exists(os.path.join(redacted, "gone.jsonl.lock")) else ["sweep: lock file left"]
    return problems


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
    cases = baseline_cases() + ops01_cases() + ops04_cases() + ops05_cases()
    cases += named_and_prefix_cases() + residual_cases() + code_and_prose_cases() + residual_code_cases()
    for case in cases + escape_cases():
        failures += check_case(*case)
    failures += check_head_stops_at_prose() + check_lines_kept_apart() + check_nested_json_survives()
    failures += check_snapshot() + check_snapshot_only_grows() + check_wired_into_pnpm_check()
    failures += check_snapshot_replaces_what_is_not_a_newer_copy() + check_link_with_a_matching_record_is_replaced()
    failures += check_newer_redactor_replaces_an_older_copy() + check_snapshot_only_makes_no_parent_folder()
    failures += check_sweep()
    failures += check_snapshot_only() + check_locks() + check_fifo_refused()
    for failure in failures:
        print(f"FAIL: {failure}")
    print("self-test passed" if not failures else f"self-test: {len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(run())
