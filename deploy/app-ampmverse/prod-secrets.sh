#!/usr/bin/env bash
# Production secrets for the stack on the shared Plesk box (D-140). They live in box-only env files
# (mode 600) in a directory outside the source tree and the web roots, read by the Compose override
# (compose.production-box.example.yml). Values are never printed and never passed as command arguments:
# every read and write uses bash builtins, so nothing shows up in `ps` or a log.
#
#   prod-secrets.sh init                    create the directory and generate the machine secrets
#                                           (idempotent: an existing value is never replaced)
#   prod-secrets.sh set <zone> <KEY>        prompt without echo for KEY and store it in <zone>.env
#   prod-secrets.sh copy <zone> <KEY> <file>  copy KEY's value from another env file, unseen
#   prod-secrets.sh check                   list each zone's keys (names only); exit 1 if one is missing
#
# Zones (infra/secrets/examples/ lists the keys): postgres (postgres + pgBackRest), redis, app (api +
# worker). The operator sets SMTP_PASSWORD (a Resend API key), EMAIL_FROM and BOT_CHECK_SECRET with
# `set`, and the Razorpay keys with `set` or `copy`; everything else is generated here.
set -euo pipefail
umask 077

DIR="${AMPM_PROD_SECRETS:-/var/www/vhosts/app.ampmverse.com/ampm-prod-secrets}"

REQUIRED_postgres="POSTGRES_USER POSTGRES_DB POSTGRES_PASSWORD PGPASSWORD DATABASE_URL PGBACKREST_REPO1_CIPHER_PASS"
REQUIRED_redis="REDIS_PASSWORD"
REQUIRED_app="DATABASE_URL REDIS_URL MEDIA_SIGNING_SECRET AUTH_TOKEN_SECRET AUTH_ENCRYPTION_KEY SMTP_PASSWORD EMAIL_FROM BOT_CHECK_SECRET RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET"

die() {
  echo "prod-secrets: $*" >&2
  exit 2
}

zone_file() {
  case "$1" in
    app | postgres | redis) printf '%s/%s.env' "$DIR" "$1" ;;
    *) die "unknown zone '$1' (app, postgres or redis)" ;;
  esac
}

valid_key() {
  [[ "$1" =~ ^[A-Z][A-Z0-9_]*$ ]] || die "invalid key name '$1'"
}

# get <file> <KEY>: the value on stdout ("" if absent). Builtins only.
get() {
  local line
  [[ -f "$1" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" == "$2="* ]]; then
      printf '%s' "${line#"$2="}"
      return 0
    fi
  done <"$1"
}

has() {
  local line
  [[ -f "$1" ]] || return 1
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" == "$2="* ]] && return 0
  done <"$1"
  return 1
}

# put <file> <KEY> <value>: set or replace KEY, rewriting the file through a private temp file.
put() {
  local file="$1" key="$2" value="$3" tmp line
  [[ "$value" != *$'\n'* ]] || die "$key: a value cannot contain a newline"
  tmp="$(mktemp "$DIR/.tmp.XXXXXX")"
  if [[ -f "$file" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ "$line" == "$key="* ]] || printf '%s\n' "$line"
    done <"$file" >"$tmp"
  fi
  printf '%s=%s\n' "$key" "$value" >>"$tmp"
  chmod 600 "$tmp"
  mv -f "$tmp" "$file"
}

# 48 alphanumeric characters: safe inside a postgres:// or redis:// URL without escaping.
random_secret() {
  local s
  s="$(openssl rand -base64 64)"
  s="${s//[^A-Za-z0-9]/}"
  printf '%s' "${s:0:48}"
}

# ensure <file> <KEY> <value>: set only when absent, so `init` never rotates a live secret.
ensure() {
  has "$1" "$2" || put "$1" "$2" "$3"
}

cmd_init() {
  mkdir -p "$DIR"
  chmod 700 "$DIR"
  local pg redis app pw rpw
  pg="$(zone_file postgres)"
  redis="$(zone_file redis)"
  app="$(zone_file app)"
  touch "$pg" "$redis" "$app"
  chmod 600 "$pg" "$redis" "$app"

  ensure "$pg" POSTGRES_USER ampm
  ensure "$pg" POSTGRES_DB ampm
  ensure "$pg" POSTGRES_PASSWORD "$(random_secret)"
  pw="$(get "$pg" POSTGRES_PASSWORD)"
  ensure "$pg" PGPASSWORD "$pw"
  ensure "$pg" DATABASE_URL "postgresql://ampm:${pw}@postgres:5432/ampm"
  # The repository passphrase: losing it makes every backup unreadable. Keep a copy off the box (the
  # operator's password manager) — `prod-secrets.sh` never prints it; read it with `cat` in a terminal.
  ensure "$pg" PGBACKREST_REPO1_CIPHER_PASS "$(random_secret)"

  ensure "$redis" REDIS_PASSWORD "$(random_secret)"
  rpw="$(get "$redis" REDIS_PASSWORD)"

  ensure "$app" DATABASE_URL "postgresql://ampm:${pw}@postgres:5432/ampm"
  ensure "$app" REDIS_URL "redis://:${rpw}@redis:6379"
  ensure "$app" MEDIA_SIGNING_SECRET "$(random_secret)"
  # AMPM's own sign-in (D-142): the token-signing secret (rotating it signs everyone out) and the key
  # that encrypts the staff authenticator secrets (changing it makes every authenticator unreadable).
  ensure "$app" AUTH_TOKEN_SECRET "$(random_secret)"
  ensure "$app" AUTH_ENCRYPTION_KEY "$(openssl rand -base64 32 | tr -d '\n')"
  # No Razorpay webhook is registered yet (checkout callbacks activate); replace this with the
  # dashboard's webhook secret when the webhook is added.
  ensure "$app" RAZORPAY_WEBHOOK_SECRET "$(random_secret)"
  echo "prod-secrets: generated secrets are in $DIR (nothing printed)."
  cmd_check || true
}

cmd_set() {
  [[ $# -eq 2 ]] || die "usage: set <zone> <KEY>"
  valid_key "$2"
  local file value
  file="$(zone_file "$1")"
  [[ -d "$DIR" ]] || die "run 'init' first"
  [[ -t 0 ]] || die "set needs a terminal (run it with ssh -t) so the value is typed, not piped"
  IFS= read -rs -p "$2 (input hidden): " value
  echo
  [[ -n "$value" ]] || die "$2: empty value, nothing stored"
  put "$file" "$2" "$value"
  echo "prod-secrets: stored $2 in $1.env"
}

cmd_copy() {
  [[ $# -eq 3 ]] || die "usage: copy <zone> <KEY> <source-env-file>"
  valid_key "$2"
  local file value
  file="$(zone_file "$1")"
  has "$3" "$2" || die "$2 is not in $3"
  value="$(get "$3" "$2")"
  put "$file" "$2" "$value"
  echo "prod-secrets: copied $2 into $1.env"
}

cmd_check() {
  local zone file key missing=0 required
  for zone in postgres redis app; do
    file="$(zone_file "$zone")"
    if [[ ! -f "$file" ]]; then
      echo "$zone.env: MISSING FILE"
      missing=1
      continue
    fi
    required="REQUIRED_${zone}"
    local present=() absent=()
    for key in ${!required}; do
      if has "$file" "$key"; then present+=("$key"); else absent+=("$key"); fi
    done
    echo "$zone.env (mode $(stat -c %a "$file")): ${#present[@]} set${absent[*]:+; missing: ${absent[*]}}"
    [[ ${#absent[@]} -eq 0 ]] || missing=1
  done
  return "$missing"
}

case "${1:-}" in
  init) cmd_init ;;
  set) shift && cmd_set "$@" ;;
  copy) shift && cmd_copy "$@" ;;
  check) cmd_check ;;
  *) die "usage: prod-secrets.sh init | set <zone> <KEY> | copy <zone> <KEY> <file> | check" ;;
esac
