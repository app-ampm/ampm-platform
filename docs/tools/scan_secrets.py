#!/usr/bin/env python3
"""Fail if a plaintext secret is committed (feature 6.4, D-051).

Extends the transcript-redactor discipline (docs/tools/redact_secrets.py): it runs the SAME detector,
`redact_secrets.find()`, over every tracked text file, so any provider token or key the redactor would
mask in a session transcript also fails here — one set of rules, no drift. On top of that it:

  * refuses any private-key body (an age secret key or a PEM) found in ANY file, by content;
  * refuses any plaintext-secret file by name/location (a decrypted Compose .env, a non-encrypted secret
    yaml, an age/PEM/*.key file);
  * refuses a `*.enc.yaml` that is NOT actually sops ciphertext (a mis-encrypted/mis-copied plaintext),
    rather than trusting it by extension.

Only the redactor + its tests, this scanner, and the generated graph are fully exempt (they carry sample
secrets by design). Confirmed synthetic/test values are allowlisted by the sha1 of their PLAINTEXT in
scan_secrets_allowlist.txt. vault_sync.py runs the same checks (scan_paths) over the Obsidian vault before
every vault commit (D-167). Usage: python3 docs/tools/scan_secrets.py [--self-test].
"""

from __future__ import annotations

import hashlib
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Callable, NamedTuple

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import redact_secrets  # noqa: E402  — the shared redactor; reuse its detector so the rules never drift

ROOT = Path(__file__).resolve().parents[2]
MAX_BYTES = 2_000_000
ALLOWLIST_FILE = HERE / "scan_secrets_allowlist.txt"

# Fully exempt: the redactor + its test corpus (hold sample tokens/keys by design), this scanner, and the
# generated knowledge graph (derived from the design docs, not a secret source).
CORPUS_EXEMPT_PATHS = {
    "docs/tools/redact_secrets.py",
    "docs/tools/redact_secrets_test.py",
    "docs/tools/scan_secrets.py",
}
CORPUS_EXEMPT_PREFIXES = ("graphify-out/",)

# A private-key body is forbidden wherever it appears (outside the corpus): an age secret key or a PEM.
PRIVATE_KEY = re.compile(
    rb"AGE-SECRET-KEY-1[0-9A-Z]{40,}|-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY(?: BLOCK)?-----"
)


def load_allowlist() -> set[str]:
    """Fingerprints (`path:sha1(plaintext)[:12]`) of confirmed non-secrets — synthetic test/dev values the
    detector flags but which are safe. One per line in scan_secrets_allowlist.txt; `#` starts a comment.
    A value only the vault's notes hold is listed under `vault/<path>` (vault_sync.py, D-167)."""
    if not ALLOWLIST_FILE.exists():
        return set()
    out: set[str] = set()
    for raw in ALLOWLIST_FILE.read_text().splitlines():
        line = raw.split("#", 1)[0].strip()
        if line:
            out.add(line)
    return out


def _tracked_files() -> list[str]:
    out = subprocess.run(
        ["git", "-C", str(ROOT), "ls-files", "-z"], capture_output=True, check=True
    ).stdout
    return [p for p in out.decode().split("\0") if p]


def _basename(path: str) -> str:
    return path.rsplit("/", 1)[-1]


def is_corpus_exempt(path: str) -> bool:
    return path in CORPUS_EXEMPT_PATHS or any(path.startswith(p) for p in CORPUS_EXEMPT_PREFIXES)


def is_forbidden_file(path: str) -> bool:
    """True if a tracked file is a plaintext secret by name/location — never permitted in the repo."""
    name = _basename(path)
    if name.endswith(".env.example"):
        return False
    if name.endswith(".env"):
        return True  # decrypted Compose secrets or any stray plaintext env
    if path.startswith("infra/secrets/") and name.endswith(".yaml"):
        # only sops ciphertext (*.enc.yaml) and the examples/ placeholders may be committed
        return not name.endswith(".enc.yaml") and not path.startswith("infra/secrets/examples/")
    if name.endswith((".agekey", ".age", ".key", ".pem", ".p12", ".pfx")):
        return True  # private-key / age-key files by extension (incl. the runbook's age.key)
    if name in {"keys.txt", "key.txt"} or (name.startswith("age-key") and name.endswith(".txt")):
        return True
    return False


def _is_sops_ciphertext(data: bytes) -> bool:
    """A real sops yaml carries ENC[...] values and a `sops:` metadata block; plaintext has neither."""
    return b"ENC[" in data or data.lstrip().startswith(b"sops:") or b"\nsops:" in data


def _is_placeholder(value: bytes) -> bool:
    """A template placeholder, not a secret: the `change-me...` convention or an all-x stand-in. A real
    token (rzp_live_…, a 32-char key) does not match, so a real secret in a template is still caught."""
    v = value.lower()
    return b"change-me" in v or (len(v) >= 8 and v.strip(b"x") == b"")


class Finding(NamedTuple):
    """A flagged value: its file and line, and the sha1 of its plaintext (first 12 hex digits), never the value."""

    path: str
    line: int
    fingerprint: str
    length: int


def scan_paths(
    root: Path, paths: list[str], is_allowed: Callable[[str, str], bool]
) -> tuple[list[str], list[Finding], list[str]]:
    """Scans the files at `paths` (relative to `root`). Returns the files refused outright (a printable line
    each, with the reason), the flagged values `is_allowed(path, fingerprint)` does not accept, and the files
    too large to scan. scan() runs it over the tracked tree, vault_sync.py over the vault before every commit.

    _, flagged, _ = scan_paths(ROOT, ["docs/README.md"], lambda path, fingerprint: False)
    """
    forbidden: list[str] = []
    flagged: list[Finding] = []
    skipped_large: list[str] = []
    for path in paths:
        if is_forbidden_file(path):
            forbidden.append(f"  {path}  (plaintext-secret file by name/location)")
            continue
        abspath = root / path
        try:
            if abspath.stat().st_size > MAX_BYTES:
                skipped_large.append(path)
                continue
            data = abspath.read_bytes()
        except OSError:
            continue
        if b"\0" in data[:4096]:
            continue  # binary
        if PRIVATE_KEY.search(data):
            forbidden.append(f"  {path}  (contains a private key — age or PEM)")
            continue
        if _basename(path).endswith(".enc.yaml"):
            if not _is_sops_ciphertext(data):
                forbidden.append(f"  {path}  (named .enc.yaml but not sops-encrypted — plaintext?)")
            continue  # real sops ciphertext is exempt from the token scan
        for start, replacement in redact_secrets.find(data):
            # find() returns the mask, which has the matched length, so the plaintext is this slice.
            plaintext = data[start : start + len(replacement)]
            if _is_placeholder(plaintext):
                continue  # a template stand-in (change-me…/xxxx), not a secret
            fingerprint = hashlib.sha1(plaintext).hexdigest()[:12]
            if not is_allowed(path, fingerprint):
                line = data.count(b"\n", 0, start) + 1
                flagged.append(Finding(path, line, fingerprint, len(plaintext)))
    return forbidden, flagged, skipped_large


def scan() -> int:
    tracked = _tracked_files()
    allowlist = load_allowlist()
    forbidden, flagged, skipped_large = scan_paths(
        ROOT,
        [p for p in tracked if not is_corpus_exempt(p)],
        lambda path, fingerprint: f"{path}:{fingerprint}" in allowlist,
    )
    findings = [f"  {f.path}:{f.line}  [{f.path}:{f.fingerprint}]  ({f.length}-char value)" for f in flagged]

    if skipped_large:
        print(f"scan_secrets: WARNING — {len(skipped_large)} file(s) over {MAX_BYTES} bytes not scanned:", file=sys.stderr)
        for p in skipped_large:
            print(f"  {p}", file=sys.stderr)
    if forbidden:
        print("scan_secrets: plaintext-secret files must not be committed:", file=sys.stderr)
        for line in forbidden:
            print(line, file=sys.stderr)
    if findings:
        print("scan_secrets: possible plaintext secrets detected:", file=sys.stderr)
        for line in findings:
            print(line, file=sys.stderr)
        print(
            "\nIf a finding is a real secret: remove it and encrypt with sops (infra/runbooks/secrets.md).\n"
            "If it is a confirmed synthetic/test value: add its [fingerprint] to\n"
            "docs/tools/scan_secrets_allowlist.txt with a one-line reason.",
            file=sys.stderr,
        )
    if forbidden or findings:
        return 1
    print(f"scan_secrets: clean ({len(tracked)} tracked files, {len(allowlist)} allowlisted)")
    return 0


def self_test() -> int:
    age = b"AGE-SECRET-KEY-1" + b"ACDEFGHJKLMNPQRSTUVWXYZ023456789" * 2
    assert redact_secrets.find(b"RAZORPAY_KEY_ID=rzp_live_A1b2C3d4E5f6G7h8"), "razorpay key must be detected"
    assert redact_secrets.find(age), "age secret key must be detected by the redactor"
    assert not redact_secrets.find(b"PGPASSWORD=change-me-via-sops\n"), "placeholder must stay clean"
    assert PRIVATE_KEY.search(age) and PRIVATE_KEY.search(b"-----BEGIN OPENSSH PRIVATE KEY-----")
    assert is_forbidden_file("infra/compose/production/app.env")
    assert is_forbidden_file("infra/secrets/production.app.yaml")
    assert is_forbidden_file("age.key") and is_forbidden_file("etc/tls/server.key")
    assert is_forbidden_file("deploy.agekey")
    assert not is_forbidden_file("infra/secrets/production.app.enc.yaml")
    assert not is_forbidden_file("infra/secrets/examples/app.yaml")
    assert not is_forbidden_file("infra/compose/production/app.env.example")
    assert _is_sops_ciphertext(b"x: ENC[AES256_GCM,data:zz]\nsops:\n  age: []\n")
    assert not _is_sops_ciphertext(b"POSTGRES_PASSWORD: realplaintextvalue\n")
    assert _is_placeholder(b"change-me-via-sops") and _is_placeholder(b"xxxxxxxxxx")
    assert not _is_placeholder(b"rzp_live_A1b2C3d4E5f6G7h8")
    with tempfile.TemporaryDirectory() as tmp:  # scan_paths, as vault_sync.py runs it over the vault
        Path(tmp, "note.md").write_bytes(b"A note.\nRAZORPAY_KEY_ID=rzp_live_A1b2C3d4E5f6G7h8\n")
        _, flagged, _ = scan_paths(Path(tmp), ["note.md"], lambda path, fingerprint: False)
        assert flagged and {f.line for f in flagged} == {2}, "scan_paths must flag the key on its line"
        accepted = {f.fingerprint for f in flagged}
        assert not scan_paths(Path(tmp), ["note.md"], lambda path, fp: fp in accepted)[1], "accepted values pass"
    print("scan_secrets self-test: ok")
    return 0


if __name__ == "__main__":
    sys.exit(self_test() if "--self-test" in sys.argv[1:] else scan())
