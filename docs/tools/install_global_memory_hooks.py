#!/usr/bin/env python3
"""Points MemPalace's global Claude Code hooks at the credential-masking wrapper, docs/tools/mempalace_global_hook.sh.

    python3 docs/tools/install_global_memory_hooks.py              install, or bring the installed copies up to date
    python3 docs/tools/install_global_memory_hooks.py --check      report; exit 1 while a hook mines unmasked
                                                                   or an installed copy is missing or stale
    python3 docs/tools/install_global_memory_hooks.py --uninstall  put MemPalace's own three commands back

MemPalace's Stop, PreCompact and SessionEnd hooks in ~/.claude/settings.json run for every session on the machine and
mine the live transcript, credentials included (CLAUDE.md, "Session memory": never file secrets or tokens). This
copies mempalace_global_hook.sh and redact_secrets.py into ~/.mempalace/bin (0700) and rewrites only those three
commands to
    bash "<HOME>/.mempalace/bin/mempalace_global_hook.sh" stop|precompact|session-end
which hands MemPalace a masked snapshot instead. Every other key, hook, matcher and timeout stays as it is, the file
keeps its indentation, a timestamped backup is written next to it before any change, and a second run changes
nothing. A settings file that does not parse is never written. The commands replaced are recorded in
~/.mempalace/bin/global_hooks_original.json, which --uninstall puts back (MemPalace's defaults when there is no
record). Called by docs/tools/setup_memory.sh, so a new machine gets the same protection. HOME decides every path.
"""

from __future__ import annotations

import json
import os
import re
import shlex
import shutil
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
FILES = ("mempalace_global_hook.sh", "redact_secrets.py")
WRAPPER = FILES[0]
EVENTS = {"Stop": "stop", "PreCompact": "precompact", "SessionEnd": "session-end"}  # settings key -> hook event
LEGACY_SCRIPTS = {"stop": "mempal_save_hook.sh", "precompact": "mempal_precompact_hook.sh",
                  "session-end": "mempal_session_end_hook.sh"}


class Refused(Exception):
    """A reason to write nothing at all."""


def home() -> Path:
    return Path(os.path.expanduser("~"))


def bin_dir() -> Path:
    return home() / ".mempalace" / "bin"


def settings_path() -> Path:
    return home() / ".claude" / "settings.json"


def record_path() -> Path:
    return bin_dir() / "global_hooks_original.json"


def wrapper_command(event: str) -> str:
    """The command the settings get: bash "<HOME>/.mempalace/bin/mempalace_global_hook.sh" stop"""
    script = str(bin_dir() / WRAPPER)
    quoted = f'"{script}"' if not re.search(r'["$`\\]', script) else shlex.quote(script)
    return f"bash {quoted} {event}"


def is_wrapper(command: str) -> bool:
    return WRAPPER in command


def is_mempalace(command: str, event: str) -> bool:
    """MemPalace's own command for this event: its hook runner, its python module or its shell hook scripts."""
    runner = rf"\bmempalace\b.*\bhook\s+run\b.*--hook[=\s]+{re.escape(event)}(?![\w-])"
    return not is_wrapper(command) and bool(re.search(runner, command) or LEGACY_SCRIPTS[event] in command)


def mempalace_default(event: str) -> str:
    """MemPalace's command when no record says what was there: its runner, and for SessionEnd its wrapper if present."""
    h = home()
    wrapper = h / "mempalace" / "hooks" / LEGACY_SCRIPTS["session-end"]
    if event == "session-end" and wrapper.is_file():
        return f"MEMPAL_PYTHON={h}/.local/share/uv/tools/mempalace/bin/python {wrapper}"
    return f"{h}/.local/bin/mempalace hook run --hook {event} --harness claude-code"


def hook_commands(settings: dict, key: str) -> list[dict]:
    """Every command hook under settings["hooks"][key], in file order (the dicts themselves, to edit in place)."""
    found = []
    groups = settings.get("hooks", {}).get(key, []) if isinstance(settings.get("hooks"), dict) else []
    for group in groups if isinstance(groups, list) else []:
        hooks = group.get("hooks", []) if isinstance(group, dict) else []
        for hook in hooks if isinstance(hooks, list) else []:
            if isinstance(hook, dict) and isinstance(hook.get("command"), str):
                found.append(hook)
    return found


def load_settings(path: Path) -> tuple[str, dict]:
    text = path.read_text(encoding="utf-8")
    try:
        settings = json.loads(text)
    except ValueError as error:
        raise Refused(f"{path} does not parse as JSON ({error}); nothing written") from None
    if not isinstance(settings, dict):
        raise Refused(f"{path} is not a JSON object; nothing written")
    return text, settings


def serialize(settings: dict, original: str) -> str:
    """settings in the layout of the original text: its indentation (or none) and its final newline."""
    indent_match = re.search(r"^[ \t]+(?=\S)", original, re.M)
    if "\n" not in original.strip():
        text = json.dumps(settings, ensure_ascii=False, separators=(",", ":"))
    else:
        indent = indent_match.group(0) if indent_match else "  "
        text = json.dumps(settings, ensure_ascii=False, indent=len(indent) if set(indent) == {" "} else indent)
    return text + ("\n" if original.endswith("\n") else "")


def render(settings: dict, original: str) -> str:
    """The new file text; refused unless it reads back as exactly these settings."""
    text = serialize(settings, original)
    if json.loads(text) != settings:
        raise Refused("the rewritten settings would not read back the same; nothing written")
    return text


def write_settings(path: Path, text: str) -> Path:
    """Backs the file up, then replaces it atomically with text; returns the backup's path."""
    target = path.resolve()  # a symlinked settings file (dotfiles) is written through, not replaced
    stamp = time.strftime("%Y%m%d-%H%M%S")
    backup = target.with_name(f"{target.name}.backup-{stamp}")
    n = 1
    while backup.exists():
        n += 1
        backup = target.with_name(f"{target.name}.backup-{stamp}-{n}")
    shutil.copy2(target, backup)
    fd, temporary = tempfile.mkstemp(prefix=f".{target.name}.", dir=target.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, target.stat().st_mode & 0o777)
        os.replace(temporary, target)
    except BaseException:
        if os.path.exists(temporary):
            os.unlink(temporary)
        raise
    return backup


def copy_files() -> list[str]:
    """Copies the wrapper and the redactor into ~/.mempalace/bin (0700); returns the names it (re)wrote."""
    target = bin_dir()
    target.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(target, 0o700)
    written = []
    for name in FILES:
        data = (HERE / name).read_bytes()
        dest = target / name
        if dest.is_file() and not dest.is_symlink() and dest.read_bytes() == data:
            os.chmod(dest, 0o700)
            continue
        fd, temporary = tempfile.mkstemp(prefix=f".{name}.", dir=target)
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
        os.chmod(temporary, 0o700)
        os.replace(temporary, dest)
        written.append(name)
    return written


def read_record() -> dict[str, list[str]]:
    try:
        record = json.loads(record_path().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return {k: [c for c in v if isinstance(c, str)] for k, v in record.items() if isinstance(v, list)}


def write_record(record: dict[str, list[str]]) -> None:
    fd, temporary = tempfile.mkstemp(prefix=".global_hooks_original.", dir=bin_dir())
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump(record, handle, indent=2)
        handle.write("\n")
    os.chmod(temporary, 0o600)
    os.replace(temporary, record_path())


def install() -> int:
    copied = copy_files()
    print(f"~/.mempalace/bin: {', '.join(copied) + ' written' if copied else 'copies already up to date'}")
    path = settings_path()
    if not path.is_file():
        print(f"{path}: not found, so no MemPalace hook to rewrite")
        return 0
    original, settings = load_settings(path)
    record, changed = read_record(), []
    for key, event in EVENTS.items():
        for hook in hook_commands(settings, key):
            command = hook["command"]
            if is_mempalace(command, event):
                record.setdefault(key, []).append(command)
            elif not (is_wrapper(command) and command != wrapper_command(event)):
                continue  # not MemPalace's, or already the wrapper exactly
            hook["command"] = wrapper_command(event)
            changed.append(key)
    if not changed:
        found = [k for k in EVENTS if any(is_wrapper(h["command"]) for h in hook_commands(settings, k))]
        print(f"{path}: nothing to change ({', '.join(found) + ' already masked' if found else 'no MemPalace hook'})")
        return 0
    text = render(settings, original)
    write_record(record)  # first: the commands replaced are never lost, even if the write below fails
    backup = write_settings(path, text)
    print(f"{path}: {', '.join(changed)} now run the masked wrapper; backup {backup.name}")
    return 0


def uninstall() -> int:
    path = settings_path()
    if not path.is_file():
        print(f"{path}: not found, nothing to restore")
        return 0
    original, settings = load_settings(path)
    record, restored = read_record(), []
    for key, event in EVENTS.items():
        for hook in hook_commands(settings, key):
            if is_wrapper(hook["command"]):
                saved = record.get(key, [])
                hook["command"] = saved.pop(0) if saved else mempalace_default(event)
                restored.append(key)
    if not restored:
        print(f"{path}: no masked wrapper to remove")
        return 0
    backup = write_settings(path, render(settings, original))
    if record_path().is_file():
        record_path().unlink()
    print(f"{path}: MemPalace's own command restored for {', '.join(restored)}; backup {backup.name}")
    print("~/.mempalace/bin keeps its copies, which nothing runs now")
    return 0


def check() -> int:
    problems = 0
    for name in FILES:
        dest = bin_dir() / name
        state = "missing" if not dest.is_file() else "matches the repository" if dest.read_bytes() == (
            HERE / name).read_bytes() else "differs from the repository"
        problems += state != "matches the repository"
        print(f"~/.mempalace/bin/{name}: {state}")
    path = settings_path()
    if not path.is_file():
        print(f"{path}: not found")
        return 1 if problems else 0
    _, settings = load_settings(path)
    for key, event in EVENTS.items():
        commands = [h["command"] for h in hook_commands(settings, key)]
        raw = sum(is_mempalace(c, event) for c in commands)
        ours = sum(c == wrapper_command(event) for c in commands)
        other = sum(is_wrapper(c) and c != wrapper_command(event) for c in commands)
        problems += raw + other
        state = (f"{raw} MemPalace command(s) mine the live transcript unmasked" if raw else
                 f"{other} wrapper command(s) point at another copy" if other else
                 "runs the masked wrapper" if ours else "no MemPalace hook")
        print(f"{key}: {state}")
    return 1 if problems else 0


def main(argv: list[str]) -> int:
    actions = {(): install, ("--check",): check, ("--uninstall",): uninstall}
    action = actions.get(tuple(argv))
    if action is None:
        print(__doc__.strip())
        return 2
    try:
        return action()
    except Refused as reason:
        print(f"refused: {reason}")
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
