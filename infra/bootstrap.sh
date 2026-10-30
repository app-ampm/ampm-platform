#!/usr/bin/env bash
# Host bootstrap for the AMPM VPS (vps-setup.md §5, feature 6.5, D-052). Turns a fresh Ubuntu LTS box into
# the hardened host the Compose stacks run on: a non-root sudo user, SSH key-only with no root login, a
# default-deny firewall, version-pinned Docker, unattended security upgrades, fail2ban, time sync, swap,
# log rotation, and SSH/sudo logs shipped off the box. Every security-affecting host change goes through
# this script, never by hand (.claude/rules/infra.md). Operator guide: infra/runbooks/bootstrap.md.
#
# IDEMPOTENT: a second run makes no configuration changes. Managed files are rewritten only when their
# content differs and the affected service is reloaded only then; package installs, apt-mark holds and ufw
# rules are themselves idempotent (ufw skips existing rules).
#
# LOCKOUT SAFETY: the authorized key is installed before root/password login is disabled, the config is
# validated with `sshd -t` (and reverted on failure) before any reload, and the run ends with a loud
# reminder to confirm the new login works from a second terminal BEFORE closing the bootstrap session.
#
# Usage (as root on the target box):
#   BOOTSTRAP_SSH_KEYS="$(cat ~/.ssh/id_ed25519.pub)" bash infra/bootstrap.sh
#   DRY_RUN=1 BOOTSTRAP_SSH_KEYS=... bash infra/bootstrap.sh    # print the plan, change nothing
set -euo pipefail

# --- configuration (override via the environment) ---
BOOTSTRAP_USER="${BOOTSTRAP_USER:-deploy}"      # the non-root sudo user that owns deploys
BOOTSTRAP_SSH_KEYS="${BOOTSTRAP_SSH_KEYS:-}"    # REQUIRED: authorized public key(s), one per line
SSH_PORT="${SSH_PORT:-22}"
SSH_ALLOW_FROM="${SSH_ALLOW_FROM:-}"            # optional space/comma-separated allowlist for the SSH rule; empty = anywhere
DOCKER_VERSION="${DOCKER_VERSION:-}"            # empty = install the latest, then pin it with apt-mark hold
SWAP_SIZE="${SWAP_SIZE:-2G}"                    # N, NM or NG
JOURNAL_MAX_USE="${JOURNAL_MAX_USE:-500M}"
DOCKER_LOG_MAX_SIZE="${DOCKER_LOG_MAX_SIZE:-20m}"
DOCKER_LOG_MAX_FILE="${DOCKER_LOG_MAX_FILE:-5}"
LOG_UPLOAD_URL="${LOG_UPLOAD_URL:-}"            # systemd-journal-upload target (feature 6.7); empty = installed, inactive
DRY_RUN="${DRY_RUN:-}"

export DEBIAN_FRONTEND=noninteractive

# --- output helpers ---
log() { printf '\033[1;34m[bootstrap]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[bootstrap] WARN:\033[0m %s\n' "$*" >&2; }
die() {
	printf '\033[1;31m[bootstrap] ERROR:\033[0m %s\n' "$*" >&2
	exit 1
}

# Run an external command, or print it under DRY_RUN. Only for simple argv (no pipes/redirects).
run() {
	if [[ -n "$DRY_RUN" ]]; then
		printf '[dry-run] %s\n' "$*"
	else
		"$@"
	fi
}

# Rewrite $1 (mode $2) from stdin only when the content differs. Returns 0 if it changed (so a caller can
# reload the affected service), 1 if it was already correct. Always call it in a conditional (set -e).
write_file_if_changed() {
	local path="$1" mode="$2" tmp
	tmp="$(mktemp)"
	cat >"$tmp"
	if [[ -f "$path" ]] && cmp -s "$tmp" "$path"; then
		rm -f "$tmp"
		return 1
	fi
	if [[ -n "$DRY_RUN" ]]; then
		printf '[dry-run] would write %s (mode %s)\n' "$path" "$mode"
		rm -f "$tmp"
		return 0
	fi
	install -D -m "$mode" "$tmp" "$path"
	rm -f "$tmp"
	log "wrote $path"
	return 0
}

# SWAP_SIZE (N, NM or NG) -> MiB integer, for the dd fallback block count.
swap_mib() {
	case "$SWAP_SIZE" in
	*G) printf '%d' "$((${SWAP_SIZE%G} * 1024))" ;;
	*M) printf '%d' "${SWAP_SIZE%M}" ;;
	*) printf '%d' "$SWAP_SIZE" ;;
	esac
}

# --- preconditions ---
check_preconditions() {
	[[ "$(id -u)" -eq 0 ]] || die "run as root on the target host"
	[[ -r /etc/os-release ]] || die "/etc/os-release missing — not a Linux host?"
	# shellcheck source=/dev/null
	. /etc/os-release
	[[ "${ID:-}" == "ubuntu" ]] || die "this bootstrap targets Ubuntu LTS (found ID=${ID:-unknown})"
	[[ "$BOOTSTRAP_USER" =~ ^[a-z_][a-z0-9_-]*$ ]] || die "BOOTSTRAP_USER '$BOOTSTRAP_USER' is not a valid username"
	if ! [[ "$SSH_PORT" =~ ^[0-9]+$ ]] || ((SSH_PORT < 1 || SSH_PORT > 65535)); then
		die "SSH_PORT '$SSH_PORT' must be an integer 1-65535"
	fi
	[[ "$SWAP_SIZE" =~ ^[0-9]+[GM]?$ ]] || die "SWAP_SIZE '$SWAP_SIZE' must be like 2G, 512M or a MiB count"
	[[ -n "$BOOTSTRAP_SSH_KEYS" ]] ||
		die "BOOTSTRAP_SSH_KEYS is required — set it to the user's public key(s) before hardening SSH, or you will be locked out"
	# Accept a key with or without a leading options field (e.g. from="1.2.3.0/24" ssh-ed25519 ...).
	grep -qE '(ssh-(ed25519|rsa|dss)|ecdsa-sha2-|sk-(ssh|ecdsa))' <<<"$BOOTSTRAP_SSH_KEYS" ||
		die "BOOTSTRAP_SSH_KEYS does not look like OpenSSH public key(s)"
	log "target: ${PRETTY_NAME:-Ubuntu}; user: $BOOTSTRAP_USER; ssh port: $SSH_PORT${DRY_RUN:+; DRY-RUN}"
}

apt_base() {
	log "installing base packages"
	run apt-get update -qq
	# python3-systemd is only a Recommends of fail2ban but its systemd backend needs it, so install it
	# explicitly (works even on images with Install-Recommends off).
	run apt-get install -y -qq \
		ca-certificates curl gnupg ufw fail2ban python3-systemd unattended-upgrades chrony logrotate
}

setup_user() {
	log "user $BOOTSTRAP_USER (sudo, key-only)"
	if ! id -u "$BOOTSTRAP_USER" >/dev/null 2>&1; then
		run useradd --create-home --shell /bin/bash "$BOOTSTRAP_USER"
	fi
	run usermod -aG sudo "$BOOTSTRAP_USER"
	# Passwordless sudo: the user has no password (key-only login) and deploys run sudo non-interactively.
	# sudo still logs every command (shipped off-box below); the SSH key is the access control.
	write_file_if_changed "/etc/sudoers.d/90-$BOOTSTRAP_USER" 440 <<EOF || true
$BOOTSTRAP_USER ALL=(ALL) NOPASSWD:ALL
EOF
	[[ -n "$DRY_RUN" ]] && return 0
	run install -d -m 700 -o "$BOOTSTRAP_USER" -g "$BOOTSTRAP_USER" "/home/$BOOTSTRAP_USER/.ssh"
	write_file_if_changed "/home/$BOOTSTRAP_USER/.ssh/authorized_keys" 600 <<EOF || true
$BOOTSTRAP_SSH_KEYS
EOF
	run chown -R "$BOOTSTRAP_USER:$BOOTSTRAP_USER" "/home/$BOOTSTRAP_USER/.ssh"
}

harden_ssh() {
	log "SSH: key-only, no root, port $SSH_PORT"
	local dropin=/etc/ssh/sshd_config.d/10-ampm-hardening.conf changed=0
	if write_file_if_changed "$dropin" 644 <<EOF; then
# Managed by infra/bootstrap.sh (feature 6.5). Overrides the stock sshd_config (first match wins).
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
PermitEmptyPasswords no
X11Forwarding no
AllowUsers $BOOTSTRAP_USER
Port $SSH_PORT
EOF
		changed=1
	fi
	[[ "$changed" -eq 1 ]] || return 0
	# Validate the merged config before activating; a bad drop-in must never persist to strand the next
	# sshd (re)start (which an openssh security upgrade or a reboot will trigger).
	if [[ -z "$DRY_RUN" ]] && ! sshd -t; then
		rm -f "$dropin"
		systemctl reload ssh 2>/dev/null || true
		die "generated sshd config is invalid — reverted the drop-in (check SSH_PORT / BOOTSTRAP_USER)"
	fi
	# Ubuntu 24.04 is socket-activated: ssh.socket owns the listener and the Port directive is ignored.
	# For a non-default port, switch to the classic service so Port takes effect; the current session (an
	# established connection) survives either way.
	if [[ "$SSH_PORT" != "22" ]] && systemctl is-enabled ssh.socket >/dev/null 2>&1; then
		run systemctl disable --now ssh.socket
		run systemctl enable --now ssh.service
	else
		run systemctl reload ssh
	fi
}

setup_firewall() {
	log "ufw: default-deny, allow ${SSH_PORT}/80/443"
	# Reconcile the SSH rule so a re-run with a tighter SSH_ALLOW_FROM actually tightens: drop any prior
	# broad allow on the SSH port before (re)adding the intended rule(s). Deleting an absent rule is a no-op.
	run ufw delete allow "$SSH_PORT/tcp" 2>/dev/null || true
	if [[ -n "$SSH_ALLOW_FROM" ]]; then
		local src
		# shellcheck disable=SC2086  # intentional split of the allowlist into one rule per source
		for src in ${SSH_ALLOW_FROM//,/ }; do
			run ufw allow from "$src" to any port "$SSH_PORT" proto tcp
		done
	else
		run ufw allow "$SSH_PORT/tcp"
	fi
	run ufw allow 80/tcp
	run ufw allow 443/tcp
	run ufw --force default deny incoming
	run ufw --force default allow outgoing
	run ufw --force enable
	# NOTE: ufw does NOT filter Docker-published ports — Docker's DNAT is traversed before ufw's INPUT
	# chain. The AMPM model relies on only Caddy publishing 80/443 (Postgres/Redis are on the internal
	# network with no `ports:`); a DOCKER-USER restriction to enforce this at the firewall is a follow-up
	# that must be written and tested on a real host (D-052). Never add a stray `-p` to a backend service.
}

install_docker() {
	if ! command -v docker >/dev/null 2>&1; then
		log "Docker: installing from Docker's apt repo"
		run install -m 0755 -d /etc/apt/keyrings
		if [[ -z "$DRY_RUN" && ! -f /etc/apt/keyrings/docker.asc ]]; then
			curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
			chmod a+r /etc/apt/keyrings/docker.asc
		fi
		# shellcheck source=/dev/null
		. /etc/os-release
		local codename="${VERSION_CODENAME:-${UBUNTU_CODENAME:-}}"
		[[ -n "$codename" ]] || die "/etc/os-release has no VERSION_CODENAME"
		write_file_if_changed /etc/apt/sources.list.d/docker.list 644 <<EOF || true
deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${codename} stable
EOF
		run apt-get update -qq
		local pkgs=(docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin)
		if [[ -n "$DOCKER_VERSION" ]]; then
			run apt-get install -y -qq "docker-ce=$DOCKER_VERSION" "docker-ce-cli=$DOCKER_VERSION" \
				containerd.io docker-buildx-plugin docker-compose-plugin
		else
			run apt-get install -y -qq "${pkgs[@]}"
		fi
	else
		log "Docker: already installed"
	fi
	# Pin every Docker package at the installed version so an unattended upgrade cannot change it mid-wedding.
	run apt-mark hold docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
	run usermod -aG docker "$BOOTSTRAP_USER"
	# Log rotation on every container, and no TCP socket (the default; we never add one).
	if write_file_if_changed /etc/docker/daemon.json 644 <<EOF; then
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "$DOCKER_LOG_MAX_SIZE", "max-file": "$DOCKER_LOG_MAX_FILE" },
  "live-restore": true
}
EOF
		run systemctl restart docker
	fi
	run systemctl enable --now docker
	if [[ -z "$DRY_RUN" ]]; then
		local ver
		ver="$(dpkg-query -W -f='${Version}' docker-ce 2>/dev/null || echo unknown)"
		log "Docker pinned at $ver — set DOCKER_VERSION=$ver for a reproducible rebuild, and record it in the vault"
	fi
}

setup_unattended_upgrades() {
	log "unattended security upgrades"
	# Assert security-only here rather than inheriting the package default, so the policy lives in the repo.
	write_file_if_changed /etc/apt/apt.conf.d/51ampm-unattended 644 <<'EOF' || true
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
EOF
	run systemctl enable --now unattended-upgrades
}

setup_fail2ban() {
	log "fail2ban: sshd jail"
	local reload=0
	if write_file_if_changed /etc/fail2ban/jail.d/ampm.conf 644 <<EOF; then
[sshd]
enabled = true
port    = $SSH_PORT
backend = systemd
maxretry = 5
bantime  = 1h
findtime = 10m
EOF
		reload=1
	fi
	run systemctl enable fail2ban
	if [[ "$reload" -eq 1 ]]; then
		run systemctl restart fail2ban
	else
		run systemctl start fail2ban
	fi
}

setup_time_sync() {
	log "time sync: chrony"
	run systemctl enable --now chrony
}

setup_swap() {
	if swapon --show --noheadings 2>/dev/null | grep -q .; then
		log "swap: already active"
		return 0
	fi
	log "swap: enabling $SWAP_SIZE at /swapfile"
	if [[ -n "$DRY_RUN" ]]; then
		printf '[dry-run] would create and enable a %s swapfile\n' "$SWAP_SIZE"
		return 0
	fi
	[[ -f /swapfile ]] || fallocate -l "$SWAP_SIZE" /swapfile ||
		dd if=/dev/zero of=/swapfile bs=1M count="$(swap_mib)" status=none
	chmod 600 /swapfile
	# Always (re)format when swap is not active, so a half-made /swapfile from an interrupted run is fixed
	# rather than failing swapon forever.
	mkswap /swapfile >/dev/null
	swapon /swapfile
	grep -qE '^[[:space:]]*/swapfile[[:space:]]' /etc/fstab || printf '/swapfile none swap sw 0 0\n' >>/etc/fstab
}

setup_log_rotation() {
	log "journald: persistent, capped at $JOURNAL_MAX_USE"
	if write_file_if_changed /etc/systemd/journald.conf.d/10-ampm.conf 644 <<EOF; then
[Journal]
Storage=persistent
SystemMaxUse=$JOURNAL_MAX_USE
EOF
		run systemctl restart systemd-journald
	fi
}

# Ship the journal (which captures sshd logins and sudo) off the box to the monitoring service. The
# destination is feature 6.7: when LOG_UPLOAD_URL is set the uploader runs; when it is empty the package
# is installed but left inactive, so 6.7 only has to set the URL (and, for an https sink, the TLS certs).
setup_log_shipping() {
	log "log shipping: systemd-journal-upload"
	run apt-get install -y -qq systemd-journal-remote
	if [[ -z "$LOG_UPLOAD_URL" ]]; then
		run systemctl disable --now systemd-journal-upload 2>/dev/null || true
		warn "LOG_UPLOAD_URL unset — journal uploader installed but inactive (wired by feature 6.7)"
		return 0
	fi
	local reload=0
	if write_file_if_changed /etc/systemd/journal-upload.conf 644 <<EOF; then
[Upload]
URL=$LOG_UPLOAD_URL
EOF
		reload=1
	fi
	run systemctl enable systemd-journal-upload
	if [[ "$reload" -eq 1 ]]; then
		run systemctl restart systemd-journal-upload
	else
		run systemctl start systemd-journal-upload
	fi
}

main() {
	check_preconditions
	apt_base
	setup_user
	harden_ssh
	setup_firewall
	install_docker
	setup_unattended_upgrades
	setup_fail2ban
	setup_time_sync
	setup_swap
	setup_log_rotation
	setup_log_shipping
	log "bootstrap complete${DRY_RUN:+ (dry-run — nothing changed)}"
	if [[ -z "$DRY_RUN" ]]; then
		warn "VERIFY BEFORE DISCONNECTING: from a second terminal confirm 'ssh -p $SSH_PORT $BOOTSTRAP_USER@<host>' logs in and 'sudo -n true' works. Root and password login are now disabled — this session is your only fallback until you do."
	fi
}

main "$@"
