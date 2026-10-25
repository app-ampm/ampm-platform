#!/usr/bin/env python3
"""Sync the design package into the Obsidian vault and commit the vault repository.

Default run: copy docs/ (without tools and site) and reference_docs/ into vault/, rebuild the generated notes,
append a line to today's sync log, then commit and push the vault if anything changed.
--vault-only: skip the copy and rebuild; just commit and push edits made inside Obsidian (used by the timer).
Safe to run anywhere, including from a git hook of the project repository.
"""
from __future__ import annotations

import datetime
import os
import subprocess
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[2]
VAULT = Path(os.environ.get("AMPM_VAULT", PROJECT / "vault"))
LOG_DIR = VAULT / "notes" / "Log"
TRAILER = "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
ENV = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}  # never inherit a hook's git context


def git(args, cwd):
    return subprocess.run(["git", *args], cwd=cwd, text=True, capture_output=True, env=ENV)


def project_ref():
    r = git(["rev-parse", "--short", "HEAD"], PROJECT)
    sha = r.stdout.strip() if r.returncode == 0 else "no-commit"
    s = git(["log", "-1", "--pretty=%s"], PROJECT)
    return sha, (s.stdout.strip() if s.returncode == 0 else "")


def sync_files():
    for src, dst, excludes in ((PROJECT / "docs", VAULT / "docs", ["tools/", "site/", ".DS_Store"]),
                               (PROJECT / "reference_docs", VAULT / "reference_docs", [".DS_Store"])):
        cmd = ["rsync", "-a", "--delete"] + [f"--exclude={e}" for e in excludes] + [f"{src}/", f"{dst}/"]
        subprocess.run(cmd, check=True)


def rebuild_notes():
    subprocess.run([sys.executable, str(PROJECT / "docs" / "tools" / "vault_build.py")], check=True, env={**ENV, "AMPM_VAULT": str(VAULT)})


def append_log(line):
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    today = datetime.date.today().isoformat()
    p = LOG_DIR / f"{today} Sync log.md"
    if not p.exists():
        p.write_text(f"---\ntype: log\ndate: {today}\ntags: [ampm, log, sync]\n---\n# Sync log {today}\n\n", encoding="utf8")
    with p.open("a", encoding="utf8") as fh:
        fh.write(f"- {datetime.datetime.now().strftime('%H:%M')} {line}\n")


def commit_vault(message, trailer):
    if not (VAULT / ".git").exists():
        print("vault: not a git repository yet, nothing committed")
        return
    if not git(["config", "--local", "user.email"], VAULT).stdout.strip():
        print("vault: no repository-local git identity (user.email), nothing committed")
        return
    git(["add", "-A"], VAULT)
    if not git(["status", "--porcelain"], VAULT).stdout.strip():
        print("vault: nothing to commit")
        return
    args = ["commit", "-q", "-m", message] + (["-m", TRAILER] if trailer else [])
    r = git(args, VAULT)
    if r.returncode != 0:
        print("vault: commit failed:", r.stderr.strip()[:300])
        return
    print("vault: committed:", message)
    if git(["remote"], VAULT).stdout.strip():
        p = git(["push", "-q"], VAULT)
        print("vault: pushed" if p.returncode == 0 else "vault: push failed: " + p.stderr.strip()[:300])


def vault_dirty():
    if not (VAULT / ".git").exists():
        return True
    return bool(git(["status", "--porcelain"], VAULT).stdout.strip())


def main():
    vault_only = "--vault-only" in sys.argv
    if not VAULT.exists():
        sys.exit(f"vault folder not found: {VAULT}")
    if vault_only:
        commit_vault(f"Obsidian edits {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}", trailer=False)
        return
    sync_files()
    rebuild_notes()
    if not vault_dirty():
        print("vault: up to date")
        return
    sha, subject = project_ref()
    append_log(f"Synced from ampm-platform {sha}" + (f": {subject}" if subject else ""))
    commit_vault(f"Sync from ampm-platform {sha}" + (f": {subject}" if subject else ""), trailer=True)


if __name__ == "__main__":
    main()
