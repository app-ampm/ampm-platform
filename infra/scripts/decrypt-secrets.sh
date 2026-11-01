#!/usr/bin/env sh
# Decrypt the sops-encrypted secrets for one environment into its Compose directory as plaintext .env files
# (feature 6.4, D-051). Run on the HOST at deploy, where the age private key is available (sops reads it
# from SOPS_AGE_KEY_FILE or the age keyring). One file per trust zone, so each service loads only its own
# secrets. The produced .env files are gitignored and must never be committed.  Usage:
#   decrypt-secrets.sh production      # or staging
set -eu

ENVIRONMENT="${1:?usage: decrypt-secrets.sh <production|staging>}"
case "$ENVIRONMENT" in
	production | staging) ;;
	*)
		echo "unknown environment: $ENVIRONMENT (expected production or staging)" >&2
		exit 2
		;;
esac

command -v sops >/dev/null 2>&1 || {
	echo "sops is not installed on this host" >&2
	exit 1
}

# The non-interactive deploy SSH session carries no environment, so point sops at the host's age key by
# default (bootstrap.sh creates /etc/ampm). An operator who keeps the key elsewhere overrides it (F2).
export SOPS_AGE_KEY_FILE="${SOPS_AGE_KEY_FILE:-/etc/ampm/age.key}"

repo_root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
src_dir="$repo_root/infra/secrets"
out_dir="$repo_root/infra/compose/$ENVIRONMENT"

for zone in postgres redis app; do
	enc="$src_dir/$ENVIRONMENT.$zone.enc.yaml"
	out="$out_dir/$zone.env"
	[ -f "$enc" ] || {
		echo "missing encrypted secrets: $enc" >&2
		exit 1
	}
	# Flat YAML -> dotenv. Decrypt to a private temp file then move it into place, so a failed decrypt never
	# truncates a good .env, and the result is 0600 even if $out already existed with looser permissions.
	tmp="$out.tmp.$$"
	if (
		umask 077
		sops --decrypt --output-type dotenv "$enc" >"$tmp"
	); then
		chmod 600 "$tmp"
		mv -f "$tmp" "$out"
	else
		rm -f "$tmp"
		echo "decrypt failed for $enc" >&2
		exit 1
	fi
	echo "decrypted $ENVIRONMENT/$zone -> $out"
done

# db-metrics (feature 6.7) needs ONLY DATABASE_URL + PGPASSWORD, not the pgBackRest S3 keys and cipher
# pass that also live in the postgres zone (handing it those would let a compromised metrics container
# decrypt the entire off-site backup repo). Give it a minimal env file derived from postgres.env.
dbm_out="$out_dir/dbmetrics.env"
dbm_tmp="$dbm_out.tmp.$$"
(
	umask 077
	grep -E '^(DATABASE_URL|PGPASSWORD)=' "$out_dir/postgres.env" >"$dbm_tmp"
)
chmod 600 "$dbm_tmp"
mv -f "$dbm_tmp" "$dbm_out"
echo "wrote $ENVIRONMENT/dbmetrics.env (DATABASE_URL + PGPASSWORD only)"

# The monitoring zone (feature 6.7) is special in two ways. (1) Alertmanager reads the paging webhook from
# a FILE, not an env (url_file), so we extract just that one key to a 0600 file. (2) It is OPTIONAL: it is
# NOT app-critical, so a missing monitoring secret must never block the app deploy the way a missing
# postgres/redis/app secret does. If it is absent we write a placeholder URL (connection refused, fails
# fast) and warn loudly — the alert pipeline still runs; pages just do not deliver until the secret is set.
mon_enc="$src_dir/$ENVIRONMENT.monitoring.enc.yaml"
mon_dir="$out_dir/monitoring-secrets"
# 0711 (not 0700): Alertmanager (nobody, uid 65534) must TRAVERSE this dir to read the file below; others
# can traverse to the known filename but not list the dir, and the file itself stays 0600.
install -d -m 711 "$mon_dir"
mon_tmp="$mon_dir/webhook_url.tmp.$$"
if [ -f "$mon_enc" ]; then
	if (
		umask 077
		sops --decrypt --extract '["ALERT_WEBHOOK_URL"]' "$mon_enc" >"$mon_tmp"
	); then
		chmod 600 "$mon_tmp"
		mv -f "$mon_tmp" "$mon_dir/webhook_url"
		echo "decrypted $ENVIRONMENT/monitoring -> $mon_dir/webhook_url"
	else
		rm -f "$mon_tmp"
		echo "decrypt failed for $mon_enc (has it an ALERT_WEBHOOK_URL key?)" >&2
		exit 1
	fi
else
	# fail-safe placeholder, not a real endpoint: Alertmanager starts and the pipeline works, but pages go
	# to a port that refuses connections until a real monitoring secret is added.
	( umask 077; printf 'http://127.0.0.1:9/\n' >"$mon_tmp" )
	chmod 600 "$mon_tmp"
	mv -f "$mon_tmp" "$mon_dir/webhook_url"
	echo "WARNING: $mon_enc is absent — ALERT PAGING IS NOT CONFIGURED for $ENVIRONMENT (placeholder webhook)." >&2
fi

# webhook_url is read by the Alertmanager PROCESS (the prom/alertmanager image's `nobody`, uid 65534),
# not by the host docker CLI the way the .env files are. So the 0600 file must be owned by that uid or
# Alertmanager gets EACCES and paging silently fails. The deploy user is non-root but has passwordless
# sudo (bootstrap.sh); chown the file (not the dir — the dir stays deploy-owned so the next deploy can
# replace the file). If that is impossible, fall back to world-readable so paging still works, and warn.
am_uid=65534
if [ "$(id -u)" = 0 ]; then
	chown "$am_uid:$am_uid" "$mon_dir/webhook_url" 2>/dev/null || chown_failed=1
else
	sudo chown "$am_uid:$am_uid" "$mon_dir/webhook_url" 2>/dev/null || chown_failed=1
fi
if [ "${chown_failed:-}" = 1 ]; then
	echo "WARNING: could not give webhook_url to the Alertmanager uid ($am_uid); making it world-readable so paging still works" >&2
	chmod 0644 "$mon_dir/webhook_url"
fi

echo "decrypt-secrets: $ENVIRONMENT ready (postgres.env, redis.env, app.env, dbmetrics.env, monitoring-secrets/webhook_url)"
