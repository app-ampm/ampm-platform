#!/usr/bin/env bash
# Redeploys the PRODUCTION stack on the shared Plesk box (D-138) from the source tree it sits in: ship a
# commit from a checkout with `AMPM_SHIP_TARGET=production SHIP_SSH=<box> bash deploy/ship-source.sh`
# (D-156), then run ON the box:  bash deploy/redeploy-prod.sh
# The test stack (ampm-local, deploy/redeploy-box.sh) is a different Compose project and is not touched.
#
# Order (infra rule: migrate before the new API, health gate, roll back to the previous image):
#   1  preflight: the tree as shipped, the box override, the secrets (prod-secrets.sh check), disk headroom
#   2  build the app image (tagged with the commit, kept for rollback) and the postgres and website images
#   3  start postgres, redis, the pgBackRest scheduler and the virus scanner (clamav + freshclam);
#      services that did not change keep running
#   4  safety dump of the live database into ampm-backups/pgdump (14 days kept)
#   5  migrate with a one-off container of the NEW image (prisma migrate deploy)
#   6  recreate api, worker and web on the new image and wait for them
#   7  health gate on 127.0.0.1:7101/health; on failure api and worker go back to the previous image
# After the gate it drops app images older than the rollback target and trims the build cache to 8 GiB.
# It never seeds demo data: production holds real data only (D-141).
set -euo pipefail
cd "$(dirname "$0")/.."

BASE=infra/compose/production/compose.yml
OVR=infra/compose/production/compose.box.yml
VHOST=/var/www/vhosts/app.ampmverse.com
SECRETS="${AMPM_PROD_SECRETS:-$VHOST/ampm-prod-secrets}"
DUMPS="$VHOST/ampm-backups/pgdump"
STATE="$VHOST/ampm-prod-state" # remembers the app image that last passed the gate, for rollback
PORT=7101

log() { printf '>> %s\n' "$*"; }
die() {
  printf 'redeploy-prod: %s\n' "$*" >&2
  exit 1
}

# 1. Preflight.
[[ -f "$OVR" ]] || die "missing $OVR (copy deploy/app-ampmverse/compose.production-box.example.yml there)"
[[ -f .deployed-commit ]] || die "missing .deployed-commit (write the shipped commit there)"
commit="$(tr -d '[:space:]' <.deployed-commit)"
[[ "$commit" =~ ^[0-9a-f]{7,40}$ ]] || die ".deployed-commit does not hold a commit id"
# The tree must be that commit as deploy/ship-source.sh shipped it: a `git archive | tar` by hand leaves
# the files a commit deleted in place, and the build still compiles them (D-156).
bash deploy/verify-shipped-source.sh ||
  die "the source tree is not ${commit:0:12} as shipped: ship it with deploy/ship-source.sh"
# Production refuses the stub virus scanner, so an override without these lines would fail the health
# gate only after the build and the migration; stop here instead.
grep -Eq '^[[:space:]]+AV_PROVIDER:[[:space:]]*"?clamav"?[[:space:]]*$' "$OVR" ||
  die "$OVR lacks 'AV_PROVIDER: clamav' (and CLAMAV_HOST): copy them from deploy/app-ampmverse/compose.production-box.example.yml"
# Production refuses a missing, plain-http or local PUBLIC_SITE_URL, the website the hotel form's links
# point to (D-188 §6), so the same applies to every line that sets it (the api's and the worker's, when
# the override does not share them): an https origin, quoted or not, with or without a comment, and never
# a local host in any case or with a trailing dot, 0.0.0.0, a user name, a query or a path.
site_ok() {
  local value="${1#*PUBLIC_SITE_URL:}" host
  value="$(printf '%s' "$value" | sed -E 's/[[:space:]]+#.*$//; s/^[[:space:]]+//; s/[[:space:]]+$//')"
  if [[ "$value" =~ ^\"(.*)\"$ || "$value" =~ ^\'(.*)\'$ ]]; then value="${BASH_REMATCH[1]}"; fi
  value="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"
  [[ "$value" =~ ^https://[a-z0-9.-]+(:[0-9]+)?/?$ ]] || return 1
  host="${value#https://}"
  host="${host%/}"
  host="$(printf '%s' "${host%%:*}" | sed -E 's/[.]+$//')"
  case "$host" in
  localhost | *.localhost | 0.0.0.0 | 127.*) return 1 ;;
  esac
}
site_lines="$(grep -E '^[[:space:]]+PUBLIC_SITE_URL:' "$OVR" || true)"
site_valid=false
if [[ -n "$site_lines" ]]; then
  site_valid=true
  while IFS= read -r site_line; do site_ok "$site_line" || site_valid=false; done <<<"$site_lines"
fi
[[ "$site_valid" == true ]] ||
  die "$OVR lacks 'PUBLIC_SITE_URL: https://<the website>' (not localhost) in every block that sets it: copy it from deploy/app-ampmverse/compose.production-box.example.yml"
AMPM_PROD_SECRETS="$SECRETS" bash deploy/app-ampmverse/prod-secrets.sh check ||
  die "secrets incomplete: set the missing keys with deploy/app-ampmverse/prod-secrets.sh set"
free_gb="$(df -BG --output=avail / | tail -1 | tr -dc 0-9)"
if ((free_gb < 15)); then
  log "only ${free_gb}G free: pruning dangling Docker build cache (never volumes or images in use)"
  docker builder prune -f >/dev/null
  free_gb="$(df -BG --output=avail / | tail -1 | tr -dc 0-9)"
fi
((free_gb >= 8)) || die "only ${free_gb}G free on / even after pruning the build cache"

mkdir -p "$STATE"
previous_app="$(cat "$STATE/app-image" 2>/dev/null || true)"
export AMPM_IMAGE="ampm-prod-app:${commit:0:12}"
export AMPM_POSTGRES_IMAGE="ampm-prod-postgres:current"
# Compose interpolates every service, including the Caddy service this box never starts, so its two
# required values must be set; Plesk, not Caddy, serves the domain and issues the certificates.
export AMPM_DOMAIN="app.ampmverse.com"
export ACME_EMAIL="not-used-plesk-issues-the-certificates"
COMPOSE=(docker compose -f "$BASE" -f "$OVR")
log "[1/7] commit ${commit:0:12}; previous app image: ${previous_app:-none}"

# The same values for an operator's manual `docker compose -f … -f … ps|logs|exec` in this directory
# (Compose reads .env beside the first file). Written on success and on rollback, so it names the
# image that is actually running.
write_compose_env() {
  printf '%s\n' "# Written by deploy/redeploy-prod.sh; interpolation only, no secrets." \
    "AMPM_IMAGE=$1" "AMPM_POSTGRES_IMAGE=$AMPM_POSTGRES_IMAGE" \
    "AMPM_DOMAIN=$AMPM_DOMAIN" "ACME_EMAIL=$ACME_EMAIL" >infra/compose/production/.env
}

rollback() {
  log "$1"
  [[ -n "$previous_app" ]] ||
    die "health gate FAILED and there is no previous image to roll back to — investigate now"
  log "rolling api and worker back to $previous_app"
  # --no-build: the api service has a build section, so a tag the box no longer holds would otherwise
  # be built from this tree, which is the release that just failed, under the previous image's name.
  if AMPM_IMAGE="$previous_app" "${COMPOSE[@]}" up -d --no-deps --no-build --wait --wait-timeout 180 api worker; then
    write_compose_env "$previous_app"
    die "deploy of ${commit:0:12} failed its health gate — rolled back to $previous_app"
  fi
  die "deploy failed AND the rollback did not become healthy — investigate now"
}

# 2. Build. Unchanged layers come from the cache, so an unchanged postgres image keeps its id and its
#    container is not recreated in step 3.
log "[2/7] build images"
"${COMPOSE[@]}" build api postgres web

# 3. The data tier first: a fresh server gets its database here; on a redeploy these keep running.
log "[3/7] start postgres, redis, the pgBackRest scheduler and the virus scanner"
"${COMPOSE[@]}" up -d --wait --wait-timeout 180 postgres redis
"${COMPOSE[@]}" up -d pgbackrest
# Not waited for: on a first start freshclam downloads the signatures before clamd can load them, and
# meanwhile the API refuses uploads (503) rather than storing them unscanned. Not fatal either (an image
# pull can fail): the API runs without it and only uploads wait. Its health is reported at the end.
"${COMPOSE[@]}" up -d freshclam clamav ||
  log "WARNING: the virus scanner did not start; uploads are refused (503) until it runs"

# 4. A logical dump before any migration: the quickest way back from a bad migration (pgBackRest's
#    point-in-time restore is the other). PGPASSWORD comes from postgres.env inside the container.
log "[4/7] safety dump"
(
  umask 077
  mkdir -p "$DUMPS"
)
dump="$DUMPS/ampm-prod-$(date -u +%Y%m%dT%H%M%SZ)-${commit:0:12}.dump"
(
  umask 077
  # shellcheck disable=SC2016  # the container's sh expands them, from postgres.env
  "${COMPOSE[@]}" exec -T postgres sh -c \
    'pg_dump -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -Z 6' >"$dump"
) || die "safety dump failed — nothing was migrated or replaced"
find "$DUMPS" -name 'ampm-prod-*.dump' -mtime +14 -delete
log "     $(du -h "$dump" | cut -f1) -> $dump"

# 5. Expand-only migrations, before the new API starts. A failure leaves api and worker untouched.
log "[5/7] migrate"
"${COMPOSE[@]}" --profile migrate run --rm migrate ||
  die "migration failed — api and worker were left on the previous image; see 'prisma migrate status'"

# 6. The application tier on the new image.
log "[6/7] recreate api, worker and web"
"${COMPOSE[@]}" up -d --no-deps --wait --wait-timeout 240 api worker web ||
  rollback "containers did not become healthy"

# 7. Health gate through the same loopback port Apache proxies to.
log "[7/7] health gate"
code=000
for _ in $(seq 1 30); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/health" || echo 000)"
  [[ "$code" == "200" ]] && break
  sleep 2
done
[[ "$code" == "200" ]] || rollback "health gate failed (last HTTP $code)"

printf '%s\n' "$AMPM_IMAGE" >"$STATE/app-image"
write_compose_env "$AMPM_IMAGE"
# Keep the image that just passed and the one before it (the rollback target); drop older app images.
# A rerun of the same commit (an environment change, say) or a first deploy names no new rollback
# target, so it drops nothing: keeping this image alone would delete the one a rollback by hand needs.
if [[ -n "$previous_app" && "$previous_app" != "$AMPM_IMAGE" ]]; then
  keep="$AMPM_IMAGE ${previous_app}"
  docker image ls ampm-prod-app --format '{{.Repository}}:{{.Tag}}' | while read -r img; do
    [[ " $keep " == *" $img "* ]] || docker image rm "$img" >/dev/null 2>&1 || true
  done
else
  log "no new rollback target (${previous_app:-first deploy}): keeping every app image"
fi
# Every build grows Docker's build cache, on the one disk that also holds the media, the WAL archive and
# the backups. The install layer comes after `COPY . .`, so each deploy adds a fresh one (about 5 GB) and
# no later build uses the old ones again, while Docker's own collection keeps up to a tenth of the disk
# (18.63 GiB on the box). After every deploy that passed its gate, trim the cache to 8 GiB, least
# recently used first, which keeps the last build's layers for a rerun (D-186). A failed prune is
# reported with the daemon's own error, not fatal: the release is in.
if pruned="$(docker builder prune -f --max-used-space 8GB 2>&1)"; then
  log "build cache trimmed to 8 GiB, least recently used first (${pruned##*$'\n'})"
else
  log "WARNING: the build-cache prune failed (${pruned//$'\n'/ }); the release itself passed its gate"
fi
curl -s "http://127.0.0.1:${PORT}/health" && echo
# The scanner is outside the gate (uploads fail closed while it is down), but say how it stands.
scanner="$("${COMPOSE[@]}" ps --format '{{.Health}}' clamav 2>/dev/null || true)"
if [[ "$scanner" == "healthy" ]]; then
  log "virus scanner healthy"
else
  log "virus scanner ${scanner:-not running}: uploads are refused (503) until clamav is healthy" \
    "(a first start downloads the signatures first; production-setup.md, 'Antivirus')"
fi
log "REDEPLOY_PROD_OK ${commit:0:12}"
