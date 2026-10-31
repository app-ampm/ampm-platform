#!/usr/bin/env bash
# Deploy one environment on the VPS (feature 6.6, D-053). Run on the host by .github/workflows/deploy.yml
# over SSH, or with DRY_RUN=1 anywhere to print the plan without changing anything. It pins the released
# images, decrypts the secrets, runs the expand-only migration job BEFORE the new API starts (skipped on a
# rollback), brings the stack up, gates on container health AND an edge probe, and rolls back to the
# previously running images if the gate fails. Expand-and-contract keeps a release reversible (contract
# steps ship later); redeploy a previous tag (workflow_dispatch) to roll a bad release back.
#
# Usage:
#   AMPM_IMAGE=... AMPM_POSTGRES_IMAGE=... AMPM_DOMAIN=... ACME_EMAIL=... [SKIP_MIGRATE=1] deploy.sh <production|staging>
set -euo pipefail

ENVIRONMENT="${1:?usage: deploy.sh <production|staging>}"
case "$ENVIRONMENT" in
production | staging) ;;
*)
	echo "unknown environment: $ENVIRONMENT (expected production or staging)" >&2
	exit 2
	;;
esac

# The released, digest-pinned images and the edge interpolation vars (compose reads them from the env).
: "${AMPM_IMAGE:?AMPM_IMAGE (the app image, tag@sha256) is required}"
: "${AMPM_POSTGRES_IMAGE:?AMPM_POSTGRES_IMAGE (the postgres image, tag@sha256) is required}"
: "${AMPM_DOMAIN:?AMPM_DOMAIN is required}"
: "${ACME_EMAIL:?ACME_EMAIL is required}"
export AMPM_IMAGE AMPM_POSTGRES_IMAGE AMPM_DOMAIN ACME_EMAIL
DRY_RUN="${DRY_RUN:-}"
SKIP_MIGRATE="${SKIP_MIGRATE:-}" # set on a rollback: a wedged/failed migration must never block recovery

repo_root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
COMPOSE=(docker compose -f "$repo_root/infra/compose/$ENVIRONMENT/compose.yml")

log() { printf '\033[1;34m[deploy]\033[0m %s\n' "$*"; }
die() {
	printf '\033[1;31m[deploy] ERROR:\033[0m %s\n' "$*" >&2
	exit 1
}
run() {
	if [[ -n "$DRY_RUN" ]]; then
		printf '[dry-run] %s\n' "$*"
	else
		"$@"
	fi
}

log "deploy $ENVIRONMENT: app=$AMPM_IMAGE postgres=$AMPM_POSTGRES_IMAGE${DRY_RUN:+ (DRY-RUN)}${SKIP_MIGRATE:+ (skip-migrate)}"

# Remember the currently-running images so a failed health gate can roll BOTH back.
previous_app=""
previous_postgres=""
if [[ -z "$DRY_RUN" ]]; then
	previous_app=$("${COMPOSE[@]}" ps --format '{{.Image}}' api 2>/dev/null | head -1 || true)
	previous_postgres=$("${COMPOSE[@]}" ps --format '{{.Image}}' postgres 2>/dev/null | head -1 || true)
fi

# Roll BOTH images back to what was running, and report truthfully whether that became healthy.
rollback() {
	if [[ -z "$previous_app" || -z "$previous_postgres" ]]; then
		die "health gate FAILED and there is no previous deployment to roll back to — the new stack is unhealthy and still up; investigate now"
	fi
	log "rolling back to app=$previous_app postgres=$previous_postgres"
	if AMPM_IMAGE="$previous_app" AMPM_POSTGRES_IMAGE="$previous_postgres" \
		"${COMPOSE[@]}" up -d --wait --wait-timeout 180; then
		die "deploy of $ENVIRONMENT failed its health gate — rolled back to the previous images"
	fi
	die "deploy of $ENVIRONMENT failed its health gate AND the rollback did not become healthy — investigate now"
}

# 1. Secrets: sops -> the per-zone .env files in the compose directory (feature 6.4).
run "$repo_root/infra/scripts/decrypt-secrets.sh" "$ENVIRONMENT"

# 2. Pull the pinned images so the migration + the new containers use exactly the released digests.
run "${COMPOSE[@]}" pull

# 3. Migration job: expand steps only, run to completion BEFORE the new API. Skipped on a rollback so a
#    wedged migration can never block recovery. A failure here leaves the running stack untouched (up has
#    not run yet) and stops the deploy loudly.
if [[ -n "$SKIP_MIGRATE" ]]; then
	log "skipping migrations (rollback path)"
elif [[ -n "$DRY_RUN" ]]; then
	printf '[dry-run] %s --profile migrate run --rm migrate\n' "${COMPOSE[*]}"
elif ! "${COMPOSE[@]}" --profile migrate run --rm migrate; then
	die "migration failed — the running stack was left untouched; resolve with 'prisma migrate status' / 'prisma migrate resolve' before retrying"
fi

# 4. Bring the stack up and gate on health. `up --wait` covers the container healthchecks (api /health,
#    postgres, redis, worker); Caddy has no in-container healthcheck (its admin API is off), so the
#    host-side edge probe below is what confirms Caddy terminates TLS and routes to the api for the domain.
if [[ -n "$DRY_RUN" ]]; then
	printf '[dry-run] %s up -d --wait --wait-timeout 180\n' "${COMPOSE[*]}"
	printf '[dry-run] edge probe https://%s/health (rollback on failure)\n' "$AMPM_DOMAIN"
	log "deploy $ENVIRONMENT complete (dry-run — nothing changed)"
	exit 0
fi

if ! "${COMPOSE[@]}" up -d --wait --wait-timeout 180; then
	log "containers did not become healthy"
	rollback
fi

# --resolve points the domain at the local edge so the real vhost + cert are exercised; -k tolerates a
# cert still being issued — the gate checks routing and a 200, not cert validity.
code=000
for _ in $(seq 1 30); do
	code=$(curl -sSk --resolve "$AMPM_DOMAIN:443:127.0.0.1" -o /dev/null -w '%{http_code}' "https://$AMPM_DOMAIN/health" 2>/dev/null || echo 000)
	[[ "$code" == "200" ]] && break
	sleep 2
done
if [[ "$code" != "200" ]]; then
	log "edge health probe failed (last HTTP $code)"
	rollback
fi

log "deploy $ENVIRONMENT complete — health gate passed (containers + edge)"
