#!/usr/bin/env bash
# A read-only probe of the limits in front of the production API (D-177; plesk-nginx-directives.conf and
# plesk-apache-directives.conf), run from any machine. It prints each expectation with PASS or FAIL.
#   - 40 MiB to an upload route: the edge refuses it with its own 413, rather than passing it on to be cut
#     off by the API, which Apache answers with a 502 (the state measured on 24 Nov 2026);
#   - 20 MiB to an upload route: it reaches the API, which answers itself (401 or 415), not the edge's 413;
#   - with --hardened (the optional tier): 2 MiB of JSON to any other API route gets the edge's 413.
# It sends no credentials and nothing a server stores: with no token, the API refuses every request before
# it writes anything. It only calls /_api outside /_api/auth/, so never a path behind the password curtain
# (htaccess.production.example), where a 401 counts toward Plesk's fail2ban.
#
#   bash deploy/app-ampmverse/check-edge-limits.sh              # the required tier
#   bash deploy/app-ampmverse/check-edge-limits.sh --hardened   # and the optional tier
#
# Env: EDGE_URL, the site's origin (default https://app.ampmverse.com). Exit 0 when every check passes.
set -euo pipefail

base="${EDGE_URL:-https://app.ampmverse.com}"
hardened=0
case "${1:-}" in
  "") ;;
  --hardened) hardened=1 ;;
  *)
    echo "usage: check-edge-limits.sh [--hardened]" >&2
    exit 2
    ;;
esac
if [[ ! "$base" =~ ^https?://[A-Za-z0-9.-]+(:[0-9]+)?$ ]]; then
  echo "EDGE_URL must be an origin with no path, such as https://app.ampmverse.com" >&2
  exit 2
fi

# The media upload route (UPLOAD_PATHS in apps/api/src/common/app-error.filter.ts), for a media id that no
# media asset has, and a JSON staff route.
UPLOAD="/_api/media/00000000-0000-0000-0000-000000000000/upload"
JSON_ROUTE="/_api/hotels-admin/hotels"
MIB=$((1024 * 1024))

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
failures=0

pass() { printf 'PASS  %s\n' "$1"; }
fail() {
  printf 'FAIL  %s\n' "$1"
  failures=$((failures + 1))
}
# post <body file> <content type> <path>: prints the answer's status and content type ("000" for none).
# --noproxy: a proxy in this machine's environment would answer instead of the edge being measured.
post() {
  curl --noproxy '*' -s -o /dev/null --max-time 180 -X POST -H "Content-Type: $2" --data-binary "@$1" \
    -w '%{http_code} %{content_type}' "$base$3" || true
}
# The API answers in its JSON envelope; nginx's and Apache's own pages are HTML.
from_api() { [[ "$1" == *application/json* ]]; }

echo "Edge limits of $base (no credentials; nothing is stored)"

head -c $((40 * MIB)) /dev/zero >"$work/body"
read -r code ctype <<<"$(post "$work/body" application/octet-stream "$UPLOAD")"
what="40 MiB to an upload route"
if [[ "$code" == 413 ]] && ! from_api "${ctype:-}"; then
  pass "$what: refused at the edge (413)"
elif [[ "$code" == 502 ]]; then
  fail "$what: 502, so the edge passed it on and the API cut it off (no edge limit)"
elif [[ "$code" == 413 ]]; then
  fail "$what: the API's own 413, so the edge passed it on"
else
  fail "$what: expected the edge's 413, got ${code:-000} (${ctype:-no content type})"
fi

head -c $((20 * MIB)) /dev/zero >"$work/body"
read -r code ctype <<<"$(post "$work/body" application/octet-stream "$UPLOAD")"
what="20 MiB to an upload route"
if [[ "$code" == 401 || "$code" == 415 ]] && from_api "${ctype:-}"; then
  pass "$what: reached the API, which answered $code"
elif [[ "$code" == 413 ]]; then
  fail "$what: refused with 413, below the 25 MiB the uploads need"
else
  fail "$what: expected the API's 401 or 415, got ${code:-000} (${ctype:-no content type})"
fi

what="2 MiB of JSON to another API route"
if ((hardened)); then
  {
    printf '{"pad":"'
    head -c $((2 * MIB)) /dev/zero | tr '\0' 'a'
    printf '"}'
  } >"$work/body"
  read -r code ctype <<<"$(post "$work/body" application/json "$JSON_ROUTE")"
  if [[ "$code" == 413 ]] && ! from_api "${ctype:-}"; then
    pass "$what: refused at the edge (413)"
  elif [[ "$code" == 413 ]]; then
    fail "$what: the API's own 413, so the optional tier's 1m is not in force"
  else
    fail "$what: expected the edge's 413, got ${code:-000} (${ctype:-no content type})"
  fi
else
  printf 'SKIP  %s: the optional tier; run with --hardened once it is applied\n' "$what"
fi

if ((failures > 0)); then
  echo "$failures edge check(s) failed"
  exit 1
fi
echo "every edge check passed"
