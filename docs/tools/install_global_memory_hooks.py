#!/usr/bin/env python3
"""Points MemPalace's global Claude Code hooks at the credential-masking wrapper, docs/tools/mempalace_global_hook.sh.

    python3 docs/tools/install_global_memory_hooks.py              install, or bring the installed copies up to date
    python3 docs/tools/install_global_memory_hooks.py --check      report; exit 1 while a hook mines unmasked, a
                                                                   MemPalace plugin is enabled, or an installed copy
                                                                   is missing or differs from this checkout
    python3 docs/tools/install_global_memory_hooks.py --uninstall  put MemPalace's own commands back
    python3 docs/tools/install_global_memory_hooks.py --wired EVENT
                                   exit 0 when MemPalace's hook for EVENT (stop, precompact, session-end) mines through
                                   the installed wrapper; memory_hook.sh then leaves the mine to it

MemPalace's hooks in ~/.claude/settings.json (Stop, PreCompact and SessionEnd as it installs them) run for every session
on the machine and mine the live transcript, credentials included (CLAUDE.md, "Session memory": never file secrets or
tokens). This copies mempalace_global_hook.sh and redact_secrets.py into ~/.mempalace/bin (0700) and rewrites every
MemPalace hook command, under any hooks key, to the wrapper for the event it names (its runner's --hook, or the event
of its mempal_*_hook.sh / mempal-*-hook.sh script):
    f="<HOME>/.mempalace/bin/mempalace_global_hook.sh"; if [ -f "$f" ]; then exec bash "$f" stop; fi; ...
which hands MemPalace a masked snapshot instead, and answers {} by itself once ~/.mempalace is removed (MemPalace's own
off switch). Each command string is replaced where it stands, so every other byte of the file stays as it is (when that
cannot be done exactly, the file is re-serialised with the same JSON values and indentation); a timestamped backup is
written next to it before any change, and a second run changes nothing. A settings file that does not parse is never
written. The commands replaced are recorded in ~/.mempalace/bin/global_hooks_original.json, which --uninstall puts back
(MemPalace's defaults when there is no record). The wrapper covers hooks in settings.json only: a MemPalace Claude Code
plugin brings hooks of its own, which --check reports. Run by docs/tools/setup_memory.sh, so a new machine gets the
same protection, and again after any change to redact_secrets.py or mempalace_global_hook.sh (the copies do not follow
the repository by themselves; memory_hook.sh session-start warns while they differ). HOME decides every path.
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
RUNNER = re.compile(r"\bmempalace\b.*\bhook\s+run\b.*--hook[=\s]+(stop|precompact|session-end)(?![\w-])")
SCRIPT = re.compile(r"mempal[-_](save|stop|precompact|session[-_]end)[-_]hook\.sh")  # its repository and plugin hooks
SCRIPT_EVENT = {"save": "stop", "stop": "stop", "precompact": "precompact"}  # session_end and session-end otherwise
LEGACY_SESSION_END = "mempal_session_end_hook.sh"
WRAPPER_EVENT = re.compile(r"""(?:mempalace_global_hook\.sh["']?|"\$f")\s+(stop|precompact|session-end)(?![\w-])""")


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
    """The command the settings get; it answers {} by itself when the wrapper is gone (~/.mempalace removed).

    wrapper_command("stop") == 'f="<HOME>/.mempalace/bin/mempalace_global_hook.sh"; if [ -f "$f" ]; then exec bash
    "$f" stop; fi; cat >/dev/null; printf '{}\\n''
    """
    script = str(bin_dir() / WRAPPER)
    quoted = f'"{script}"' if not re.search(r'["$`\\]', script) else shlex.quote(script)
    return f"f={quoted}; if [ -f \"$f\" ]; then exec bash \"$f\" {event}; fi; cat >/dev/null; printf '{{}}\\n'"


def is_wrapper(command: str) -> bool:
    return WRAPPER in command


def wrapper_event(command: str) -> str | None:
    """The event a wrapper command runs (in its current form or the earlier bash "<path>" <event>), else None."""
    match = WRAPPER_EVENT.search(command) if is_wrapper(command) else None
    return match.group(1) if match else None


def mempalace_event(command: str) -> str | None:
    """The event a MemPalace command runs, its runner's --hook or its hook script's; None for any other command."""
    if is_wrapper(command):
        return None
    match = RUNNER.search(command)
    if match:
        return match.group(1)
    match = SCRIPT.search(command)
    return SCRIPT_EVENT.get(match.group(1), "session-end") if match else None


def mempalace_default(event: str) -> str:
    """MemPalace's command when no record says what was there: its runner, and for SessionEnd its wrapper if present."""
    h = home()
    wrapper = h / "mempalace" / "hooks" / LEGACY_SESSION_END
    if event == "session-end" and wrapper.is_file():
        return f"MEMPAL_PYTHON={h}/.local/share/uv/tools/mempalace/bin/python {wrapper}"
    return f"{h}/.local/bin/mempalace hook run --hook {event} --harness claude-code"


def hook_keys(settings: dict) -> list[str]:
    hooks = settings.get("hooks")
    return [key for key in hooks if isinstance(key, str)] if isinstance(hooks, dict) else []


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


def all_commands(settings: dict) -> list[tuple[str, dict]]:
    """(key, hook) for every command hook, in file order."""
    return [(key, hook) for key in hook_keys(settings) for hook in hook_commands(settings, key)]


def mempalace_plugins(settings: dict) -> list[str]:
    """The enabled Claude Code plugins that look like MemPalace's, whose hooks never pass through the wrapper."""
    plugins = settings.get("enabledPlugins")
    if isinstance(plugins, dict):
        plugins = [name for name, enabled in plugins.items() if enabled]
    names = plugins if isinstance(plugins, list) else []
    return [name for name in names if isinstance(name, str) and "mempal" in name.lower()]


def load_settings(path: Path) -> tuple[str, dict]:
    try:
        text = path.read_bytes().decode("utf-8")
        settings = json.loads(text)
    except ValueError as error:  # UnicodeDecodeError included
        raise Refused(f"{path} does not read as UTF-8 JSON ({error}); nothing written") from None
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


def edit_in_place(original: str, changes: list[tuple[str, str]]) -> str:
    """original with each changed command string replaced where it stands, in file order; "" when one is not found.

    A command is looked for as JSON spells it, with raw UTF-8 or with \\u escapes, and the new one is spelt alike.
    """
    out, position = [], 0
    for old, new in changes:
        best = None
        for ascii_only in (False, True):
            spelling = json.dumps(old, ensure_ascii=ascii_only)
            at = original.find(spelling, position)
            if at >= 0 and (best is None or at < best[0]):
                best = (at, spelling, ascii_only)
        if best is None:
            return ""
        at, spelling, ascii_only = best
        out += [original[position:at], json.dumps(new, ensure_ascii=ascii_only)]
        position = at + len(spelling)
    return "".join(out) + original[position:]


def render(settings: dict, original: str, changes: list[tuple[str, str]]) -> str:
    """The new file text, edited in place when that reads back as exactly these settings, else re-serialised;
    refused unless the result reads back as exactly these settings."""
    for text in (edit_in_place(original, changes), serialize(settings, original)):
        try:
            if text and json.loads(text) == settings:
                return text
        except ValueError:
            continue
    raise Refused("the rewritten settings would not read back the same; nothing written")


def write_settings(path: Path, text: str) -> Path:
    """Backs the file up beside it, then replaces it atomically with text; returns the backup's path.

    A symlinked settings file (dotfiles) is written through, not replaced, and its backup goes beside the link in
    ~/.claude, not into the folder it points to.
    """
    target = path.resolve()
    stamp = time.strftime("%Y%m%d-%H%M%S")
    backup = path.with_name(f"{path.name}.backup-{stamp}")
    n = 1
    while backup.exists():
        n += 1
        backup = path.with_name(f"{path.name}.backup-{stamp}-{n}")
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
    root = bin_dir().parent
    if not root.exists():  # a fresh machine: MemPalace keeps this folder 0700 too
        root.mkdir(mode=0o700, parents=True)
        os.chmod(root, 0o700)
    target = bin_dir()
    target.mkdir(mode=0o700, exist_ok=True)
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
    if not isinstance(record, dict):
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
    path = settings_path()
    loaded = load_settings(path) if path.is_file() else None  # refused before anything is written
    copied = copy_files()
    print(f"~/.mempalace/bin: {', '.join(copied) + ' written' if copied else 'copies already up to date'}")
    if loaded is None:
        print(f"{path}: not found, so no MemPalace hook to rewrite")
        return 0
    original, settings = loaded
    record, changed, changes = read_record(), [], []
    for key, hook in all_commands(settings):
        command = hook["command"]
        event = mempalace_event(command)
        if event:
            record.setdefault(key, []).append(command)
        else:
            event = wrapper_event(command)
            if not event or command == wrapper_command(event):
                continue  # not MemPalace's, or already the wrapper exactly
        hook["command"] = wrapper_command(event)
        changed.append(key)
        changes.append((command, hook["command"]))
    if not changed:
        found = sorted({k for k, h in all_commands(settings) if wrapper_event(h["command"])})
        print(f"{path}: nothing to change ({', '.join(found) + ' already masked' if found else 'no MemPalace hook'})")
    else:
        text = render(settings, original, changes)
        write_record(record)  # first: the commands replaced are never lost, even if the write below fails
        backup = write_settings(path, text)
        print(f"{path}: {', '.join(changed)} now run the masked wrapper; backup {backup.name}")
    for plugin in mempalace_plugins(settings):
        print(f"enabledPlugins: {plugin} brings MemPalace hooks of its own, which mine unmasked; disable it")
    return 0


def uninstall() -> int:
    path = settings_path()
    if not path.is_file():
        print(f"{path}: not found, nothing to restore")
        return 0
    original, settings = load_settings(path)
    record, restored, changes = read_record(), [], []
    for key, hook in all_commands(settings):
        event = wrapper_event(hook["command"])
        if event:
            saved = record.get(key, [])
            command = saved.pop(0) if saved else mempalace_default(event)
            changes.append((hook["command"], command))
            hook["command"] = command
            restored.append(key)
    if not restored:
        print(f"{path}: no masked wrapper to remove")
        return 0
    backup = write_settings(path, render(settings, original, changes))
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
            HERE / name).read_bytes() else "differs from the repository (run the installer again)"
        problems += state != "matches the repository"
        print(f"~/.mempalace/bin/{name}: {state}")
    path = settings_path()
    if not path.is_file():
        print(f"{path}: not found")
        return 1 if problems else 0
    _, settings = load_settings(path)
    for key in list(EVENTS) + [k for k in hook_keys(settings) if k not in EVENTS]:
        commands = [h["command"] for h in hook_commands(settings, key)]
        raw = sum(bool(mempalace_event(c)) for c in commands)
        ours = sum(bool(wrapper_event(c)) and c == wrapper_command(wrapper_event(c) or "") for c in commands)
        other = sum(is_wrapper(c) for c in commands) - ours
        if key not in EVENTS and not raw + ours + other:
            continue
        problems += raw + other
        state = (f"{raw} MemPalace command(s) mine the live transcript unmasked" if raw else
                 f"{other} wrapper command(s) point at another copy or an older form" if other else
                 "runs the masked wrapper" if ours else "no MemPalace hook")
        print(f"{key}: {state}")
    for plugin in mempalace_plugins(settings):
        problems += 1
        print(f"enabledPlugins: {plugin} is enabled; its hooks mine the live transcript unmasked, past the wrapper")
    return 1 if problems else 0


def mempalace_auto_save() -> bool:
    """MemPalace's hooks.auto_save (its environment variable first, then config.json), as mempalace.config reads it."""
    value = os.environ.get("MEMPALACE_HOOKS_AUTO_SAVE")
    if value is not None:
        return value.lower() not in ("false", "0", "no")
    legacy, xdg = home() / ".mempalace", os.environ.get("XDG_CONFIG_HOME", "").strip()
    if os.environ.get("MEMPALACE_CONFIG_DIR", "").strip():
        folder = Path(os.environ["MEMPALACE_CONFIG_DIR"].strip()).expanduser()
    elif any((legacy / f).is_file() for f in ("config.json", "people_map.json", "palace/chroma.sqlite3")):
        folder = legacy
    elif xdg and Path(xdg).expanduser().is_absolute():
        folder = Path(xdg).expanduser() / "mempalace"
    else:
        folder = home() / ".config" / "mempalace"
    try:
        hooks = json.loads((folder / "config.json").read_text(encoding="utf-8")).get("hooks", {})
    except (OSError, ValueError, AttributeError):
        return True
    return not isinstance(hooks, dict) or hooks.get("auto_save", True) is not False


def wired(event: str) -> int:
    """0 when MemPalace's hook for event runs the installed wrapper (so it mines a masked snapshot), else 1."""
    key = {v: k for k, v in EVENTS.items()}.get(event)
    if key is None:
        print(__doc__.strip())
        return 2
    if not all((bin_dir() / name).is_file() for name in FILES) or not settings_path().is_file():
        return 1
    try:
        _, settings = load_settings(settings_path())
    except Refused:
        return 1
    if not any(h["command"] == wrapper_command(event) for h in hook_commands(settings, key)):
        return 1
    return 0 if mempalace_auto_save() else 1


def main(argv: list[str]) -> int:
    actions = {(): install, ("--check",): check, ("--uninstall",): uninstall}
    action = actions.get(tuple(argv))
    if argv[:1] == ["--wired"] and len(argv) == 2:
        return wired(argv[1])
    if action is None:
        print(__doc__.strip())
        return 2
    try:
        return action()
    except Refused as reason:
        print(f"refused: {reason}")
        return 1
    except OSError as error:
        print(f"failed: {error.strerror or error} ({error.filename or ''}); the settings file was not changed")
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
