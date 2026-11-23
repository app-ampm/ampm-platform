#!/usr/bin/env python3
"""Tests for the vault's secret guard (D-167): the session journal masks credentials before it quotes the user's
messages, and vault_sync.py refuses to commit a vault whose staged files hold a credential-shaped value.

    python3 docs/tools/vault_guard_test.py   # unittest; every vault here is a scratch repository

The sample value is assembled at run time, so this file holds nothing the platform repo's secret scan flags.
"""
from __future__ import annotations

import contextlib
import io
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import session_journal  # noqa: E402
import vault_sync  # noqa: E402

SAMPLE = "rzp" + "_live_" + "Q7w8E9r0T1y2U3i4"  # the shape of a Razorpay live key, never a real one


def sh(cwd, *args):
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True).stdout


class JournalMaskingTest(unittest.TestCase):
    def test_a_credential_keeps_its_kind_and_loses_the_rest(self):
        text = f"This is the new key ID - {SAMPLE}"
        out = session_journal.masked(text)
        self.assertNotIn(SAMPLE[4:], out)
        self.assertTrue(out.startswith("This is the new key ID - rzp_"), out)
        self.assertEqual(len(out), len(text))

    def test_plain_text_is_left_alone(self):
        text = "Yes, all three; merge #164 when CI is green (c032a9d)"
        self.assertEqual(session_journal.masked(text), text)

    def test_the_requests_section_never_quotes_a_pasted_credential(self):
        with tempfile.TemporaryDirectory() as tmp:
            transcript = Path(tmp, "session.jsonl")
            entry = {"type": "user", "timestamp": "2026-11-23T08:00:00Z",
                     "message": {"role": "user", "content": f"Store {SAMPLE} on the box, then deploy"}}
            transcript.write_text(json.dumps(entry) + "\n", encoding="utf8")
            requests = session_journal.requests_from(str(transcript))
        self.assertEqual(len(requests), 1, requests)
        self.assertNotIn(SAMPLE[4:], requests[0])
        self.assertIn("Store rzp_", requests[0])
        self.assertTrue(requests[0].endswith("on the box, then deploy"), requests[0])


class VaultGuardTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.vault = Path(self.tmp.name)
        sh(self.vault, "init", "-q", "-b", "main")
        sh(self.vault, "config", "user.name", "Vault Guard Test")
        sh(self.vault, "config", "user.email", "test@example.invalid")
        sh(self.vault, "config", "commit.gpgsign", "false")
        (self.vault / "Home.md").write_text("# Home\n", encoding="utf8")
        sh(self.vault, "add", "-A")
        sh(self.vault, "commit", "-q", "-m", "start")
        self.saved, vault_sync.VAULT = vault_sync.VAULT, self.vault

    def tearDown(self):
        vault_sync.VAULT = self.saved
        self.tmp.cleanup()

    def commit(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            done = vault_sync.commit_vault("test", trailer=False)
        return done, out.getvalue()

    def commits(self):
        return int(sh(self.vault, "rev-list", "--count", "HEAD"))

    def note(self, text):
        path = self.vault / "notes" / "Sessions" / "a.md"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf8")

    def test_a_note_holding_a_credential_is_neither_committed_nor_left_staged(self):
        self.note(f"# A session\n\nThe key is {SAMPLE}\n")
        done, out = self.commit()
        self.assertFalse(done)
        self.assertIn("vault: blocked", out)
        self.assertIn("notes/Sessions/a.md:3", out)
        self.assertNotIn(SAMPLE[4:], out)  # the report names the place and a fingerprint, never the value
        self.assertEqual(self.commits(), 1)
        self.assertEqual(sh(self.vault, "diff", "--cached", "--name-only"), "")

    def test_the_note_is_committed_once_the_credential_is_masked(self):
        self.note(f"The key is {SAMPLE}\n")
        self.assertFalse(self.commit()[0])
        self.note(session_journal.masked(f"The key is {SAMPLE}\n"))
        done, out = self.commit()
        self.assertTrue(done, out)
        self.assertIn("vault: committed", out)
        self.assertEqual(self.commits(), 2)

    def test_a_value_the_allowlist_confirms_under_any_path_passes(self):
        self.note(f"Public by design: {SAMPLE}\n")
        sh(self.vault, "add", "-A")
        flagged = vault_sync.secret_findings(allowlist=set())
        self.assertEqual(len(flagged), 1, flagged)
        fingerprint = flagged[0].split("[", 1)[1].split("]", 1)[0].rsplit(":", 1)[1]
        self.assertEqual(vault_sync.secret_findings(allowlist={f"apps/web/src/env.test.ts:{fingerprint}"}), [])

    def test_a_private_key_file_is_refused_by_name(self):
        (self.vault / "deploy.pem").write_text("not even a key\n", encoding="utf8")
        done, out = self.commit()
        self.assertFalse(done)
        self.assertIn("deploy.pem", out)


if __name__ == "__main__":
    unittest.main()
