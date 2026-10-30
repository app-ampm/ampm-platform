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

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
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

echo "decrypt-secrets: $ENVIRONMENT ready (postgres.env, redis.env, app.env)"
