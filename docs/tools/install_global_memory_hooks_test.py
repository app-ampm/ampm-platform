#!/usr/bin/env python3
"""Tests for install_global_memory_hooks.py: it rewrites only MemPalace's hook commands, so every session on the
machine is mined from a masked snapshot (CLAUDE.md, "Session memory": never file secrets or tokens), and leaves every
other byte of ~/.claude/settings.json as it was.

    python3 docs/tools/install_global_memory_hooks_test.py   # prints "installer tests passed", exit 0

Every run uses a scratch HOME holding a settings file in the shape of the development Mac's (the obsidian hooks on
SessionStart and PostToolUse, MemPalace on Stop, PreCompact and SessionEnd). Never touches the real ~/.claude or
~/.mempalace.
"""

from __future__ import annotations

import glob
import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
INSTALLER = os.path.join(HERE, "install_global_memory_hooks.py")
EVENTS = {"Stop": "stop", "PreCompact": "precompact", "SessionEnd": "session-end"}


def settings_shape(home: str) -> dict:
    """The development Mac's settings, every path under the scratch HOME."""
    obsidian = {"type": "command", "command": f"{home}/.claude/hooks/obsidian-log-reminder.sh", "timeout": 10}
    session_end = (f"MEMPAL_PYTHON={home}/.local/share/uv/tools/mempalace/bin/python "
                   f"{home}/mempalace/hooks/mempal_session_end_hook.sh")
    return {
        "skipWorkflowUsageWarning": True,
        "switchModelsOnFlag": True,
        "hooks": {
            "SessionStart": [{"hooks": [dict(obsidian)]}],
            "PostToolUse": [{"matcher": "Bash", "hooks": [dict(obsidian)]}],
            "Stop": [{"matcher": "*", "hooks": [{"type": "command", "command": runner(home, "stop"), "timeout": 60}]}],
            "PreCompact": [{"hooks": [{"type": "command", "command": runner(home, "precompact"), "timeout": 60}]}],
            "SessionEnd": [{"hooks": [{"type": "command", "command": session_end, "timeout": 30}]}],
        },
    }


def runner(home: str, event: str) -> str:
    return f"{home}/.local/bin/mempalace hook run --hook {event} --harness claude-code"


def run(home: str, *args: str, **env: str) -> subprocess.CompletedProcess:
    full = {"HOME": home, "PATH": os.environ.get("PATH", "/usr/bin:/bin"), **env}
    return subprocess.run([sys.executable, INSTALLER, *args], capture_output=True, text=True, env=full, timeout=60)


def read(path: str) -> str:
    with open(path, encoding="utf-8") as handle:
        return handle.read()


def write(path: str, text: str) -> None:
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(text)


def scratch_home(scratch: str, settings: dict | None = None, text: str | None = None) -> tuple[str, str, str]:
    """A scratch HOME with the settings written as Claude Code writes them; returns home, settings path, its text."""
    home = os.path.join(scratch, "home")
    os.makedirs(os.path.join(home, ".claude"))
    path = os.path.join(home, ".claude", "settings.json")
    text = text if text is not None else json.dumps(settings or settings_shape(home), indent=2) + "\n"
    write(path, text)
    os.chmod(path, 0o600)
    return home, path, text


def wrapper(home: str, event: str) -> str:
    """The command the installer writes: the wrapper when it is there, {} by itself when ~/.mempalace is gone."""
    script = f"{home}/.mempalace/bin/mempalace_global_hook.sh"
    return f'f="{script}"; if [ -f "$f" ]; then exec bash "$f" {event}; fi; cat >/dev/null; printf ' + "'{}\\n'"


def replaced(text: str, pairs: list[tuple[str, str]]) -> str:
    """text with each command string replaced as JSON spells it, which is all the installer may change."""
    for old, new in pairs:
        text = text.replace(json.dumps(old, ensure_ascii=False), json.dumps(new, ensure_ascii=False))
    return text


def mode(path: str) -> int:
    return os.stat(path).st_mode & 0o777


def check_install_rewrites_only_the_three_commands() -> list[str]:
    problems = []
    with tempfile.TemporaryDirectory() as scratch:
        home, path, original = scratch_home(scratch)
        inode = os.stat(path).st_ino
        first = run(home)
        if first.returncode != 0:
            return [f"install exited {first.returncode}: {first.stdout}{first.stderr}"]
        shape = settings_shape(home)["hooks"]
        pairs = [(shape[key][0]["hooks"][0]["command"], wrapper(home, event)) for key, event in EVENTS.items()]
        expected = replaced(original, pairs)
        problems += [] if read(path) == expected else ["install changed more than the three commands (or their layout)"]
        backups = glob.glob(path + ".backup-*")
        problems += [] if len(backups) == 1 and read(backups[0]) == original else ["no backup of the original"]
        problems += [] if mode(path) == 0o600 else ["the settings file lost its mode"]
        problems += [] if os.stat(path).st_ino != inode else ["the settings were written in place, not replaced"]
        bin_dir = os.path.join(home, ".mempalace", "bin")
        problems += [] if mode(bin_dir) == 0o700 else ["~/.mempalace/bin is not 0700"]
        problems += [] if mode(os.path.dirname(bin_dir)) == 0o700 else ["a fresh ~/.mempalace is not 0700"]
        for name in ("mempalace_global_hook.sh", "redact_secrets.py"):
            with open(os.path.join(bin_dir, name), "rb") as copy, open(os.path.join(HERE, name), "rb") as source:
                problems += [] if copy.read() == source.read() else [f"the installed {name} differs from the repo"]
            problems += [] if mode(os.path.join(bin_dir, name)) == 0o700 else [f"the installed {name} is not 0700"]
        record = os.path.join(bin_dir, "global_hooks_original.json")
        originals = {key: [old] for key, (old, _) in zip(EVENTS, pairs)}
        recorded = json.loads(read(record)) if os.path.isfile(record) else None
        problems += [] if recorded == originals else ["the replaced commands were not recorded for --uninstall"]
        problems += [] if recorded is None or mode(record) == 0o600 else ["the record is not 0600"]
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


def check_the_installed_command_honours_mempalace_off_switch() -> list[str]:
    """With ~/.mempalace removed, each installed command answers {} and exits 0, as MemPalace's own hooks do."""
    problems = []
    with tempfile.TemporaryDirectory() as scratch:
        home, path, _ = scratch_home(scratch)
        run(home)
        shutil.rmtree(os.path.join(home, ".mempalace"))
        for key in EVENTS:
            command = json.loads(read(path))["hooks"][key][0]["hooks"][0]["command"]
            done = subprocess.run(["/bin/sh", "-c", command], input='{"session_id": "s"}', capture_output=True,
                                  text=True, env={"HOME": home, "PATH": "/usr/bin:/bin"}, timeout=30)
            ok = done.returncode == 0 and done.stdout == "{}\n" and not done.stderr
            problems += [] if ok else [f"{key} without ~/.mempalace: exit {done.returncode}, {done.stderr.strip()}"]
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
    problems = []
    for name, data in (("truncated", None), ("latin-1", "{\"x\": \"caf\xe9\"}\n".encode("latin-1"))):
        with tempfile.TemporaryDirectory() as scratch:
            home, path, original = scratch_home(scratch)
            # truncated as an editor may leave it, or in another encoding
            broken = original.rstrip().rstrip("}").encode() + b",\n" if data is None else data
            with open(path, "wb") as handle:
                handle.write(broken)
            for args in ((), ("--uninstall",), ("--check",)):
                done = run(home, *args)
                label = " ".join(("install",) + args)
                ok = done.returncode == 1 and "refused" in done.stdout and "Traceback" not in done.stderr
                problems += [] if ok else [f"{label} accepted a {name} file: {done.stdout}{done.stderr[-200:]}"]
            with open(path, "rb") as handle:
                problems += [] if handle.read() == broken else [f"a {name} settings file was written"]
            problems += [] if not glob.glob(path + ".backup-*") else [f"a backup was written for a {name} file"]
            problems += [] if not os.path.exists(os.path.join(home, ".mempalace")) else [
                f"install wrote its copies although the {name} settings were refused"]
    return problems


def check_legacy_shell_hooks_and_other_hooks() -> list[str]:
    """MemPalace's older shell hooks are rewritten too; a hook that only mentions mempalace is left alone."""
    with tempfile.TemporaryDirectory() as scratch:
        home, path, _ = scratch_home(scratch)
        settings = settings_shape(home)
        settings["hooks"]["Stop"][0]["hooks"][0]["command"] = f"{home}/mempalace/hooks/mempal_save_hook.sh"
        unrelated = {"type": "command", "command": "echo mempalace search tips", "timeout": 5}
        settings["hooks"]["Stop"][0]["hooks"].append(unrelated)
        write(path, json.dumps(settings, indent=4))
        run(home)
        after = json.loads(read(path))
        stop = after["hooks"]["Stop"][0]["hooks"]
        problems = [] if stop[0]["command"] == wrapper(home, "stop") else ["the legacy Stop shell hook was not rewritten"]
        problems += [] if stop[1] == unrelated else ["a hook that is not MemPalace's was changed"]
        problems += [] if read(path).startswith('{\n    "') else ["the file's four-space indentation was not kept"]
    return problems


def check_every_mempalace_form_under_every_key() -> list[str]:
    """Plugin-style scripts, a runner whose --hook differs from its key, SubagentStop: each gets the wrapper of the
    event it runs; an enabled MemPalace plugin keeps --check failing."""
    problems = []
    with tempfile.TemporaryDirectory() as scratch:
        home, path, _ = scratch_home(scratch)
        hook = lambda command: [{"hooks": [{"type": "command", "command": command}]}]  # noqa: E731
        plugin = f"{home}/mempalace/.claude-plugin/hooks"
        settings = {"enabledPlugins": {"mempalace@mempalace": True, "other@x": True}, "hooks": {
            "Stop": hook(f"bash {plugin}/mempal-stop-hook.sh"),
            "SessionEnd": hook(f"bash {plugin}/mempal-session-end-hook.sh"),
            "PreCompact": hook(runner(home, "precompact")),
            "SubagentStop": hook(runner(home, "stop")),
            "UserPromptSubmit": [{"hooks": [{"type": "command", "command": f"{home}/.local/bin/mempalace hook run "
                                             "--hook session-start --harness claude-code"}]}],
        }}
        write(path, json.dumps(settings, indent=2) + "\n")
        before = run(home, "--check")
        problems += [] if before.returncode == 1 and "SubagentStop: 1 MemPalace" in before.stdout else [
            f"--check passed hooks that mine unmasked: {before.stdout}"]
        run(home)
        after = json.loads(read(path))["hooks"]
        want = {"Stop": "stop", "SessionEnd": "session-end", "PreCompact": "precompact", "SubagentStop": "stop"}
        for key, event in want.items():
            got = after[key][0]["hooks"][0]["command"]
            problems += [] if got == wrapper(home, event) else [f"{key} was not given the {event} wrapper: {got}"]
        problems += [] if "session-start" in after["UserPromptSubmit"][0]["hooks"][0]["command"] else [
            "a MemPalace command that mines nothing was rewritten"]
        still = run(home, "--check")
        problems += [] if still.returncode == 1 and "mempalace@mempalace is enabled" in still.stdout else [
            f"--check passed an enabled MemPalace plugin: {still.stdout}"]
        settings = json.loads(read(path))
        settings["enabledPlugins"]["mempalace@mempalace"] = False
        write(path, json.dumps(settings, indent=2) + "\n")
        problems += [] if run(home, "--check").returncode == 0 else ["--check failed once the plugin was disabled"]
    return problems


def check_wrappers_of_another_copy_or_form_are_repointed() -> list[str]:
    problems = []
    with tempfile.TemporaryDirectory() as scratch:
        home, path, _ = scratch_home(scratch)
        settings = settings_shape(home)
        for key, event in EVENTS.items():
            elsewhere = "/Users/old" if key != "Stop" else home  # Stop: this copy, in the form of the first version
            script = f"{elsewhere}/.mempalace/bin/mempalace_global_hook.sh"
            settings["hooks"][key][0]["hooks"][0]["command"] = f'bash "{script}" {event}'
        write(path, json.dumps(settings, indent=2) + "\n")
        run(home)  # installs the copies first, then rewrites
        write(path, json.dumps(settings, indent=2) + "\n")
        before = run(home, "--check")
        problems += [] if before.returncode == 1 and "another copy" in before.stdout else [
            f"--check passed wrappers of another copy: {before.stdout}"]
        run(home)
        after = json.loads(read(path))["hooks"]
        for key, event in EVENTS.items():
            got = after[key][0]["hooks"][0]["command"]
            problems += [] if got == wrapper(home, event) else [f"{key} still points elsewhere: {got}"]
        problems += [] if run(home, "--check").returncode == 0 else ["--check failed after the re-pointing"]
    return problems


def check_symlinked_settings_are_written_through() -> list[str]:
    with tempfile.TemporaryDirectory() as scratch:
        home, path, original = scratch_home(scratch)
        dotfiles = os.path.join(scratch, "dotfiles")
        os.makedirs(dotfiles)
        target = os.path.join(dotfiles, "settings.json")
        shutil.move(path, target)
        os.symlink(target, path)
        run(home)
        problems = [] if os.path.islink(path) and os.readlink(path) == target else ["the settings symlink was replaced"]
        stop = json.loads(read(target))["hooks"]["Stop"][0]["hooks"][0]["command"]
        problems += [] if stop == wrapper(home, "stop") else ["the symlink's target was not rewritten"]
        backups = glob.glob(path + ".backup-*")
        beside = len(backups) == 1 and read(backups[0]) == original
        problems += [] if beside else ["no backup beside the link in ~/.claude"]
        problems += [] if not glob.glob(target + ".backup-*") else ["a backup was written into the dotfiles folder"]
    return problems


def check_the_record_survives_a_failed_write() -> list[str]:
    with tempfile.TemporaryDirectory() as scratch:
        home, path, original = scratch_home(scratch)
        claude = os.path.dirname(path)
        os.chmod(claude, 0o500)  # the backup and the new file cannot be written
        try:
            done = run(home)
        finally:
            os.chmod(claude, 0o700)
        record = os.path.join(home, ".mempalace", "bin", "global_hooks_original.json")
        problems = [] if done.returncode == 1 and "failed" in done.stdout and "Traceback" not in done.stderr else [
            f"a failed write was not reported cleanly: {done.stdout}{done.stderr[-200:]}"]
        problems += [] if read(path) == original else ["the settings changed although the write failed"]
        problems += [] if os.path.isfile(record) and json.loads(read(record)).get("Stop") else [
            "the record of the replaced commands was not written before the settings"]
    return problems


def check_other_bytes_are_kept() -> list[str]:
    """Only the command strings change, whatever the layout; --uninstall then gives back the very same bytes."""
    problems = []
    for name, layout in (("single-line", None), ("escapes and numbers", 2)):
        with tempfile.TemporaryDirectory() as scratch:
            home = os.path.join(scratch, "home")
            settings = settings_shape(home)
            if layout is None:
                text = json.dumps(settings) + "\n"  # one line, with spaces after , and :
            else:
                text = json.dumps(settings, indent=layout).replace('"switchModelsOnFlag": true',
                                                                   '"note": "caf\\u00e9 \\/ ok", "n": 1e3') + "\n"
            home, path, original = scratch_home(scratch, text=text)
            run(home)
            pairs = [(settings["hooks"][key][0]["hooks"][0]["command"], wrapper(home, event))
                     for key, event in EVENTS.items()]
            problems += [] if read(path) == replaced(original, pairs) else [f"{name}: install changed other bytes"]
            run(home, "--uninstall")
            problems += [] if read(path) == original else [f"{name}: --uninstall did not give back the same bytes"]
    with tempfile.TemporaryDirectory() as scratch:  # the command also elsewhere, before the hooks: edited once, rightly
        home = os.path.join(scratch, "home")
        settings = settings_shape(home)
        settings = {"permissions": {"allow": [runner(home, "stop")]}, **settings}
        home, path, _ = scratch_home(scratch, settings)
        run(home)
        after = json.loads(read(path))
        ok = after["permissions"]["allow"] == [runner(home, "stop")]
        ok = ok and after["hooks"]["Stop"][0]["hooks"][0]["command"] == wrapper(home, "stop")
        problems += [] if ok else ["a copy of the command outside the hooks was rewritten instead of the hook"]
    return problems


def check_a_record_that_is_not_an_object() -> list[str]:
    with tempfile.TemporaryDirectory() as scratch:
        home, path, _ = scratch_home(scratch)
        os.makedirs(os.path.join(home, ".mempalace", "bin"))
        write(os.path.join(home, ".mempalace", "bin", "global_hooks_original.json"), "[1]\n")
        problems = []
        for args in ((), ("--uninstall",)):
            done = run(home, *args)
            label = " ".join(("install",) + args)
            problems += [] if done.returncode == 0 and "Traceback" not in done.stderr else [
                f"{label} failed on a record that is a list: {done.stderr[-200:]}"]
    return problems


def check_wired() -> list[str]:
    """--wired EVENT tells memory_hook.sh whether MemPalace's hook for EVENT mines through the installed wrapper."""
    problems = []
    with tempfile.TemporaryDirectory() as scratch:
        home, path, _ = scratch_home(scratch)
        problems += [] if run(home, "--wired", "stop").returncode == 1 else ["--wired before install"]
        run(home)
        wired_all = all(run(home, "--wired", event).returncode == 0 for event in EVENTS.values())
        problems += [] if wired_all else ["--wired after install"]
        problems += [] if run(home, "--wired", "stop", MEMPALACE_HOOKS_AUTO_SAVE="false").returncode == 1 else [
            "--wired with MemPalace's auto-save off by environment"]
        write(os.path.join(home, ".mempalace", "config.json"), '{"hooks": {"auto_save": false}}\n')
        problems += [] if run(home, "--wired", "stop").returncode == 1 else ["--wired with auto_save false in config"]
        problems += [] if run(home, "--wired", "bogus").returncode == 2 else ["--wired accepted an unknown event"]
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
    checks = (check_install_rewrites_only_the_three_commands, check_the_installed_command_honours_mempalace_off_switch,
              check_uninstall_without_a_record_restores_mempalace_defaults, check_invalid_json_is_refused,
              check_legacy_shell_hooks_and_other_hooks, check_every_mempalace_form_under_every_key,
              check_wrappers_of_another_copy_or_form_are_repointed, check_symlinked_settings_are_written_through,
              check_the_record_survives_a_failed_write, check_other_bytes_are_kept,
              check_a_record_that_is_not_an_object, check_wired, check_no_settings_file)
    failures = [failure for check in checks for failure in check()]
    for failure in failures:
        print(f"FAIL: {failure}")
    print("installer tests passed" if not failures else f"installer tests: {len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
