#!/usr/bin/env python3
"""Session journal for the AMPM Obsidian vault: one note per Claude Code session.

SessionStart hook:   python3 docs/tools/session_journal.py --start     (Claude Code hook JSON on stdin)
    Creates vault/notes/Sessions/<date> Session <id8>.md if it does not exist, records its path in vault/.current-session
    and prints one line, which Claude Code adds to the session's context so Claude knows where to write the narrative.
Stop hook:           checkpoint.sh --hook exports the hook JSON as AMPM_SESSION_JSON and vault_sync.py calls update_facts(),
    which refreshes the automatic sections (Requests, Commits, Changed files) and never touches the Narrative.
The Requests section holds the first line of each of the user's messages (headlines, 160 characters at most), read from the
session transcript; tool results, system reminders and pasted blocks are skipped.
"""
from __future__ import annotations

import datetime
import json
import os
import re
import subprocess
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[2]
VAULT = Path(os.environ.get("AMPM_VAULT", PROJECT / "vault"))
SESSIONS = VAULT / "notes" / "Sessions"
POINTER = VAULT / ".current-session"
FACTS_MARKER = "## Requests"
SKIP_PREFIXES = ("<", "This session is being continued", "[Request interrupted")
ENV = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}


def short(session_id):
    return (session_id or "")[:8]


def git(args, cwd):
    r = subprocess.run(["git", *args], cwd=cwd, text=True, capture_output=True, env=ENV)
    return r.stdout if r.returncode == 0 else ""


def repo_url():
    url = git(["remote", "get-url", "origin"], PROJECT).strip()
    url = re.sub(r"^https://[^@/]+@", "https://", url)
    return re.sub(r"\.git$", "", url)


def local_time(ts):
    try:
        return datetime.datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone()
    except (ValueError, AttributeError):
        return None


def first_timestamp(transcript):
    try:
        with open(transcript, encoding="utf8") as fh:
            for line in fh:
                if '"timestamp"' in line:
                    when = local_time(json.loads(line).get("timestamp"))
                    if when:
                        return when
    except (OSError, ValueError):
        pass
    return None


def find_note(sid):
    hits = sorted(SESSIONS.glob(f"* Session {sid}.md"))
    return hits[-1] if hits else None


def create_note(info):
    sid = short(info.get("session_id"))
    started = first_timestamp(info.get("transcript_path", "")) or datetime.datetime.now().astimezone()
    path = SESSIONS / f"{started:%Y-%m-%d} Session {sid}.md"
    text = f"""---
type: session
date: {started:%Y-%m-%d}
session: {sid}
started: "{started:%Y-%m-%d %H:%M}"
title: ""
requests: 0
commits: 0
tags: [ampm, session]
---
# Session {started:%Y-%m-%d} {sid}

> The Narrative is written by Claude at wrap-up (what was decided and why, what was built, what remains) and is never overwritten. The sections from Requests down are refreshed automatically at the end of every Claude Code turn.

## Narrative

## Requests

## Commits (ampm-platform)

## Changed files
"""
    SESSIONS.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf8")
    return path


def requests_from(transcript):
    out, last = [], None
    try:
        fh = open(transcript, encoding="utf8")
    except OSError:
        return out
    with fh:
        for line in fh:
            if '"type":"user"' not in line and '"type": "user"' not in line:
                continue
            try:
                obj = json.loads(line)
            except ValueError:
                continue
            if obj.get("type") != "user" or obj.get("isMeta") or obj.get("isCompactSummary"):
                continue
            content = (obj.get("message") or {}).get("content")
            if isinstance(content, str):
                text = content
            elif isinstance(content, list):
                if any(isinstance(c, dict) and c.get("type") == "tool_result" for c in content):
                    continue
                text = "\n".join(c.get("text", "") for c in content if isinstance(c, dict) and c.get("type") == "text")
            else:
                continue
            text = text.strip()
            if not text or text.startswith(SKIP_PREFIXES):
                continue
            line1 = next((l.strip() for l in text.splitlines() if l.strip()), "")
            line1 = re.sub(r"\s+", " ", line1)
            if len(line1) > 160:
                line1 = line1[:157].rstrip() + "..."
            if line1 == last:
                continue
            last = line1
            when = local_time(obj.get("timestamp") or "")
            out.append(f"- {when:%H:%M} {line1}" if when else f"- {line1}")
    return out


def commits_since(started):
    url = repo_url()
    lines, files = [], []
    for row in git(["log", f"--since={started}", "--reverse", "--format=%H%x09%h%x09%s"], PROJECT).splitlines():
        parts = row.split("\t", 2)
        if len(parts) == 3:
            full, sha, subject = parts
            link = f"[{sha}]({url}/commit/{full})" if url else f"`{sha}`"
            lines.append(f"- {link} {subject}")
    for name in git(["log", f"--since={started}", "--name-only", "--format="], PROJECT).splitlines():
        if name and name not in files:
            files.append(name)
    return lines, files


def update_facts(info):
    """Refresh the automatic sections of this session's note. Returns (path, changed)."""
    sid = short(info.get("session_id"))
    if not sid or not VAULT.exists():
        return None, False
    path = find_note(sid) or create_note(info)
    text = path.read_text(encoding="utf8")
    head = text.split(FACTS_MARKER)[0].rstrip() + "\n\n"
    m = re.search(r'^started: "?([^"\n]+)"?$', text, re.M)
    started = m.group(1) if m else path.name[:10]
    reqs = requests_from(info.get("transcript_path", ""))
    commits, files = commits_since(started)
    shown = files[:12] + ([f"(+{len(files) - 12} more)"] if len(files) > 12 else [])
    body = [FACTS_MARKER, ""] + (reqs or ["- (none recorded)"]) + ["", "## Commits (ampm-platform)", ""] + (commits or ["- (none yet)"]) \
        + ["", "## Changed files", ""] + ([f"- {f}" for f in shown] or ["- (none yet)"])
    new = head + "\n".join(body) + "\n"
    new = re.sub(r"^requests: \d+$", f"requests: {len(reqs)}", new, count=1, flags=re.M)
    new = re.sub(r"^commits: \d+$", f"commits: {len(commits)}", new, count=1, flags=re.M)
    if new != text:
        path.write_text(new, encoding="utf8")
    POINTER.write_text(str(path.relative_to(VAULT)) + "\n")
    return path, new != text


def main():
    info = {}
    if not sys.stdin.isatty():
        raw = sys.stdin.read().strip()
        if raw:
            try:
                info = json.loads(raw)
            except ValueError:
                info = {}
    sid = short(info.get("session_id"))
    if not sid or not VAULT.exists():
        return
    if "--start" in sys.argv:
        path = find_note(sid) or create_note(info)
        POINTER.write_text(str(path.relative_to(VAULT)) + "\n")
        print(f"AMPM session journal: {path.relative_to(PROJECT)} . At wrap-up, write the Narrative section of that note "
              f"(what was decided and why, what was built, what remains) and record each technical or process decision with "
              f"python3 docs/tools/new_decision.py \"Title\" --area <area>; the Stop hook commits both.")
    else:
        path, changed = update_facts(info)
        if path:
            print(f"session journal: {path.name} {'updated' if changed else 'unchanged'}")


if __name__ == "__main__":
    main()
