#!/usr/bin/env python3
"""Tests for install_global_memory_hooks.py: it rewrites only MemPalace's three global hook commands, so every session
on the machine is mined from a masked snapshot (CLAUDE.md, "Session memory": never file secrets or tokens), and
leaves everything else in ~/.claude/settings.json exactly as it was.

    python3 docs/tools/install_global_memory_hooks_test.py   # prints "installer tests passed", exit 0

Every run uses a scratch HOME holding a settings file in the shape of the development Mac's (the obsidian hooks on
SessionStart and PostToolUse, MemPalace on Stop, PreCompact and SessionEnd). Never touches the real ~/.claude or
~/.mempalace.
"""

from __future__ import annotations

import glob
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
INSTALLER = os.path.join(HERE, "install_global_memory_hooks.py")
EVENTS = {"Stop": "stop", "PreCompact": "precompact", "SessionEnd": "session-end"}


def settings_shape(home: str) -> dict:
    """The development Mac's settings, every path under the scratch HOME."""
    obsidian = {"type": "command", "command": f"{home}/.claude/hooks/obsidian-log-reminder.sh", "timeout": 10}
    mempalace = f"{home}/.local/bin/mempalace hook run --hook"
    session_end = (f"MEMPAL_PYTHON={home}/.local/share/uv/tools/mempalace/bin/python "
                   f"{home}/mempalace/hooks/mempal_session_end_hook.sh")
    return {
        "skipWorkflowUsageWarning": True,
        "switchModelsOnFlag": True,
        "hooks": {
            "SessionStart": [{"hooks": [dict(obsidian)]}],
            "PostToolUse": [{"matcher": "Bash", "hooks": [dict(obsidian)]}],
            "Stop": [{"matcher": "*", "hooks": [
                {"type": "command", "command": f"{mempalace} stop --harness claude-code", "timeout": 60}]}],
            "PreCompact": [{"hooks": [
                {"type": "command", "command": f"{mempalace} precompact --harness claude-code", "timeout": 60}]}],
            "SessionEnd": [{"hooks": [{"type": "command", "command": session_end, "timeout": 30}]}],
        },
    }


def run(home: str, *args: str) -> subprocess.CompletedProcess:
    env = {"HOME": home, "PATH": os.environ.get("PATH", "/usr/bin:/bin")}
    return subprocess.run([sys.executable, INSTALLER, *args], capture_output=True, text=True, env=env, timeout=60)


def read(path: str) -> str:
    with open(path, encoding="utf-8") as handle:
        return handle.read()


def scratch_home(scratch: str) -> tuple[str, str, str]:
    """A scratch HOME with the settings written as Claude Code writes them; returns home, settings path, its text."""
    home = os.path.join(scratch, "home")
    os.makedirs(os.path.join(home, ".claude"))
    path = os.path.join(home, ".claude", "settings.json")
    text = json.dumps(settings_shape(home), indent=2) + "\n"
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(text)
    os.chmod(path, 0o600)
    return home, path, text


def wrapper(home: str, event: str) -> str:
    return f'bash "{home}/.mempalace/bin/mempalace_global_hook.sh" {event}'


def check_install_rewrites_only_the_three_commands() -> list[str]:
    problems = []
    with tempfile.TemporaryDirectory() as scratch:
        home, path, original = scratch_home(scratch)
        first = run(home)
        if first.returncode != 0:
            return [f"install exited {first.returncode}: {first.stdout}{first.stderr}"]
        expected_settings = settings_shape(home)
        expected = original
        for key, event in EVENTS.items():
            hook = expected_settings["hooks"][key][0]["hooks"][0]
            expected = expected.replace(json.dumps(hook["command"]), json.dumps(wrapper(home, event)))
        now = read(path)
        problems += [] if now == expected else ["install changed more than the three commands (or their layout)"]
        backups = glob.glob(path + ".backup-*")
        problems += [] if len(backups) == 1 and read(backups[0]) == original else ["no backup of the original"]
        problems += [] if os.stat(path).st_mode & 0o777 == 0o600 else ["the settings file lost its mode"]
        bin_dir = os.path.join(home, ".mempalace", "bin")
        problems += [] if os.stat(bin_dir).st_mode & 0o777 == 0o700 else ["~/.mempalace/bin is not 0700"]
        for name in ("mempalace_global_hook.sh", "redact_secrets.py"):
            with open(os.path.join(bin_dir, name), "rb") as copy, open(os.path.join(HERE, name), "rb") as source:
                problems += [] if copy.read() == source.read() else [f"the installed {name} differs from the repo"]
        record = os.path.join(bin_dir, "global_hooks_original.json")
        originals = {key: [hooks[0]["hooks"][0]["command"]] for key, hooks in settings_shape(home)["hooks"].items()
                     if key in EVENTS}
        recorded = json.loads(read(record)) if os.path.isfile(record) else None
        problems += [] if recorded == originals else ["the replaced commands were not recorded for --uninstall"]
        problems += [] if recorded is None or os.stat(record).st_mode & 0o777 == 0o600 else ["the record is not 0600"]
        check = run(home, "--check")
        problems += [] if check.returncode == 0 else [f"--check after install exited {check.returncode}: {check.stdout}"]

        second = run(home)
        problems += [] if second.returncode == 0 and read(path) == expected else ["a second install changed the file"]
        problems += [] if len(glob.glob(path + ".backup-*")) == 1 else ["a second install wrote another backup"]
        problems += [] if "nothing to change" in second.stdout else [f"second install said: {second.stdout}"]

        with open(os.path.join(bin_dir, "redact_secrets.py"), "a", encoding="utf-8") as handle:
            handle.write("# edited by hand\n")
        stale = run(home, "--check")
        problems += [] if stale.returncode == 1 and "differs" in stale.stdout else ["--check missed a stale copy"]
        run(home)
        problems += [] if run(home, "--check").returncode == 0 else ["install did not refresh a stale copy"]

        undo = run(home, "--uninstall")
        problems += [] if undo.returncode == 0 and read(path) == original else ["--uninstall did not restore the original"]
        unmasked = run(home, "--check")
        problems += [] if unmasked.returncode == 1 and "unmasked" in unmasked.stdout else ["--check missed raw hooks"]
    return problems


def check_uninstall_without_a_record_restores_mempalace_defaults() -> list[str]:
    with tempfile.TemporaryDirectory() as scratch:
        home, path, original = scratch_home(scratch)
        run(home)
        record = os.path.join(home, ".mempalace", "bin", "global_hooks_original.json")
        if os.path.exists(record):
            os.unlink(record)
        os.makedirs(os.path.join(home, "mempalace", "hooks"))
        open(os.path.join(home, "mempalace", "hooks", "mempal_session_end_hook.sh"), "w").close()
        run(home, "--uninstall")
        return [] if read(path) == original else ["--uninstall with no record did not put MemPalace's commands back"]


def check_invalid_json_is_refused() -> list[str]:
    with tempfile.TemporaryDirectory() as scratch:
        home, path, original = scratch_home(scratch)
        broken = original.rstrip().rstrip("}") + ",\n"  # a truncated file, as an editor might leave it
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(broken)
        problems = []
        for args in ((), ("--uninstall",), ("--check",)):
            done = run(home, *args)
            name = " ".join(("install",) + args)
            problems += [] if done.returncode == 1 and "refused" in done.stdout else [f"{name} accepted invalid JSON"]
        problems += [] if read(path) == broken else ["a settings file that does not parse was written"]
        problems += [] if not glob.glob(path + ".backup-*") else ["a backup was written for a refused file"]
    return problems


def check_legacy_shell_hooks_and_other_hooks() -> list[str]:
    """MemPalace's older shell hooks are rewritten too; a hook that only mentions mempalace is left alone."""
    with tempfile.TemporaryDirectory() as scratch:
        home, path, _ = scratch_home(scratch)
        settings = settings_shape(home)
        settings["hooks"]["Stop"][0]["hooks"][0]["command"] = f"{home}/mempalace/hooks/mempal_save_hook.sh"
        unrelated = {"type": "command", "command": "echo mempalace search tips", "timeout": 5}
        settings["hooks"]["Stop"][0]["hooks"].append(unrelated)
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(settings, handle, indent=4)
        run(home)
        after = json.loads(read(path))
        stop = after["hooks"]["Stop"][0]["hooks"]
        problems = [] if stop[0]["command"] == wrapper(home, "stop") else ["the legacy Stop shell hook was not rewritten"]
        problems += [] if stop[1] == unrelated else ["a hook that is not MemPalace's was changed"]
        problems += [] if read(path).startswith('{\n    "') else ["the file's four-space indentation was not kept"]
    return problems


def check_no_settings_file() -> list[str]:
    with tempfile.TemporaryDirectory() as scratch:
        home = os.path.join(scratch, "home")
        os.makedirs(home)
        done = run(home)
        problems = [] if done.returncode == 0 else [f"install without a settings file exited {done.returncode}"]
        problems += [] if not os.path.exists(os.path.join(home, ".claude", "settings.json")) else ["settings created"]
    return problems


def main() -> int:
    failures = (check_install_rewrites_only_the_three_commands()
                + check_uninstall_without_a_record_restores_mempalace_defaults()
                + check_invalid_json_is_refused() + check_legacy_shell_hooks_and_other_hooks() + check_no_settings_file())
    for failure in failures:
        print(f"FAIL: {failure}")
    print("installer tests passed" if not failures else f"installer tests: {len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
