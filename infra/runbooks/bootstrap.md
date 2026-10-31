# Host bootstrap runbook (feature 6.5, D-052)

`infra/bootstrap.sh` turns a fresh Ubuntu LTS VPS into the hardened host the Compose stacks run on. Run it
as root on the target box. It is idempotent — re-run it after any change; a clean re-run makes no changes.

## Run it

```bash
# as root on the fresh box (repo checked out, or the script copied over)
BOOTSTRAP_SSH_KEYS="$(cat ~/.ssh/id_ed25519.pub)" bash infra/bootstrap.sh
```

Preview without changing anything:

```bash
DRY_RUN=1 BOOTSTRAP_SSH_KEYS="ssh-ed25519 AAAA... you@host" bash infra/bootstrap.sh
```

## ⚠️ Verify before you disconnect

The script disables root login and password authentication and allows only `BOOTSTRAP_USER`. The current
session is kept alive (sshd is reloaded, not killed), but it is your ONLY fallback. Before closing it,
from a **second** terminal:

```bash
ssh -p <SSH_PORT> <BOOTSTRAP_USER>@<host>   # must log in with your key
sudo -n true                                # must succeed (passwordless sudo)
```

If either fails, fix it from the still-open first session (or the provider's console) — do not disconnect.

## Configuration (environment variables)

| Var                  | Default      | Meaning                                                                       |
| -------------------- | ------------ | ----------------------------------------------------------------------------- |
| `BOOTSTRAP_SSH_KEYS` | — (required) | Authorized public key(s) for the user, one per line                           |
| `BOOTSTRAP_USER`     | `deploy`     | The non-root sudo user                                                        |
| `SSH_PORT`           | `22`         | sshd/ufw/fail2ban port; a non-22 port switches off `ssh.socket` so it applies |
| `SSH_ALLOW_FROM`     | — (anywhere) | Space/comma-separated allowlist of sources for the SSH rule                   |
| `DOCKER_VERSION`     | — (latest)   | Pin the Docker engine version (see below)                                     |
| `SWAP_SIZE`          | `2G`         | Swapfile size (`N`, `NM` or `NG`)                                             |
| `LOG_UPLOAD_URL`     | — (inactive) | `systemd-journal-upload` target (feature 6.7)                                 |

## What it does

Base packages; a key-only sudo user; SSH hardened (no root, no password, `AllowUsers`, validated with
`sshd -t` before reload); `ufw` default-deny allowing `SSH_PORT`/80/443; Docker from Docker's apt repo,
pinned with `apt-mark hold`, json-file log rotation, no exposed socket; `unattended-upgrades` (security
origins only, no auto-reboot); `fail2ban` sshd jail; `chrony`; a swapfile; persistent capped journald; and
`systemd-journal-upload` (installed; active only when `LOG_UPLOAD_URL` is set).

## Reproducible rebuilds (Docker version)

With `DOCKER_VERSION` unset the script installs the latest engine and `apt-mark hold`s it (no drift on the
running box), then prints the exact version. For a reproducible rebuild (vps-setup §6, the quarterly
rebuild drill), record that version in the vault and set `DOCKER_VERSION=<it>` on later runs.

## Known limitations

- **ufw does not filter Docker-published ports** (Docker's DNAT is traversed before ufw's INPUT chain).
  The baseline relies on only Caddy publishing 80/443; never add a `-p` to a backend service. A
  `DOCKER-USER` firewall restriction enforcing this is a follow-up to write and test on a real host (D-052).
- **Log shipping is wired but inactive by default.** The journal captures sshd + sudo; `LOG_UPLOAD_URL`
  (and, for an https sink, the TLS certs) are set by the monitoring work (feature 6.7); the sink must speak
  the systemd journal-remote format.

## Re-running

Safe any time; a clean re-run rewrites no files and reloads no services. Changing `SSH_ALLOW_FROM` /
`SSH_PORT` reconciles the SSH firewall rule on the next run; switching between different allowlists may
leave a stale `ufw` rule — check `ufw status numbered` and delete by number if so.
