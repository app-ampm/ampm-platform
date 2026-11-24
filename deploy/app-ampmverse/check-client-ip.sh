#!/usr/bin/env bash
# The client-IP check (HF-G8; D-177), repeatable. Behind Plesk's nginx and Apache, with TRUST_PROXY "1",
# does the API's rate limiter count a request against the caller's real address, and ignore an
# X-Forwarded-For the caller sends? It uses POST /_api/auth/activate, which is public and limited per
# address; outside development builds the route answers 404 after the limiter has counted the request
# (D-162). The check:
#   1  reads the limiter's counters for this machine's address and for 203.0.113.7 over SSH;
#   2  sends the route two requests with an empty JSON body and no credentials, the second with
#      X-Forwarded-For: 203.0.113.7 (a documentation address);
#   3  reads the counters again and prints one word:
#        match      both requests counted against the address the box sees for this machine
#        spoofable  the spoofed address was counted: the limiter trusts a header the caller controls
#        differs    neither: the limiter counts requests against some other address, such as a proxy's
# It never prints an address. The box compares against ${SSH_CLIENT%% *} and sends back counts only; the
# Redis password stays inside the redis container. The requests and SSH both go over IPv4 (-4), so the box
# sees one address for both. /_api/auth/activate is outside the password curtain, which leaves /_api open
# except the client-code routes (htaccess.production.example), so nothing here counts toward fail2ban.
#
#   SHIP_SSH=app_ampmverse@31.97.62.74 SHIP_SSH_KEY=~/.ssh/ampm_test_vps bash deploy/app-ampmverse/check-client-ip.sh
#
# Env: SHIP_SSH (required) the box; SHIP_SSH_KEY offers only that key (an agent's other keys count as failed
# logins with fail2ban); CHECK_URL the site's origin (default https://app.ampmverse.com); REDIS_CONTAINER
# (default ampm-redis-1). Exit 0 on match, 1 on spoofable or differs, 2 when the check could not run.
set -euo pipefail

: "${SHIP_SSH:?set SHIP_SSH=user@host, the box}"
url="${CHECK_URL:-https://app.ampmverse.com}"
redis="${REDIS_CONTAINER:-ampm-redis-1}"
SPOOF=203.0.113.7
if [[ ! "$url" =~ ^https?://[A-Za-z0-9.-]+(:[0-9]+)?$ ]]; then
  echo "CHECK_URL must be an origin with no path, such as https://app.ampmverse.com" >&2
  exit 2
fi
if [[ ! "$redis" =~ ^[A-Za-z0-9_.-]+$ ]]; then
  echo "REDIS_CONTAINER must be a container name" >&2
  exit 2
fi

SSH=(ssh -4 -o BatchMode=yes -o ConnectTimeout=15)
if [[ -n "${SHIP_SSH_KEY:-}" ]]; then SSH+=(-o IdentitiesOnly=yes -i "$SHIP_SSH_KEY"); fi

# Run on the box with $1 the redis container and $2 the spoofed address: the limiter's count for the SSH
# client's address, then for the spoofed one, one per line (0 for no bucket).
read -r -d '' REMOTE <<'BOX' || true
set -eu
docker exec "$1" sh -c 'export REDISCLI_AUTH="$REDIS_PASSWORD"
for ip in "$1" "$2"; do
  n=$(redis-cli --no-auth-warning GET "rl:auth.activate:ip:$ip")
  echo "${n:-0}"
done' sh "${SSH_CLIENT%% *}" "$2"
BOX

# counts: "<this machine's count> <the spoofed address's count> " from the box, or exit 2.
counts() {
  local out
  out="$("${SSH[@]}" "$SHIP_SSH" sh -s -- "$redis" "$SPOOF" <<<"$REMOTE" 2>/dev/null | tr '\n' ' ')" ||
    out=""
  if [[ ! "$out" =~ ^[0-9]+\ [0-9]+\ $ ]]; then
    echo "check-client-ip: could not read the limiter's counters over SSH" >&2
    exit 2
  fi
  printf '%s\n' "$out"
}
# send [curl options]: one POST to the route; prints its status, 000 when no answer came. --noproxy: a
# proxy in this machine's environment would reach the box from its own address, not this machine's.
send() {
  curl --noproxy '*' -4 -s -o /dev/null --max-time 30 -X POST -H 'Content-Type: application/json' \
    --data '{}' -w '%{http_code}' "$@" "$url/_api/auth/activate" || true
}
# grown <before> <after>: how much a counter grew; a smaller count means its window rolled over meanwhile.
grown() { if (($2 >= $1)); then echo $(($2 - $1)); else echo "$2"; fi; }

before="$(counts)"
plain="$(send)"
spoofed="$(send -H "X-Forwarded-For: $SPOOF")"
after="$(counts)"
if [[ "$plain" == 000 || "$spoofed" == 000 ]]; then
  echo "check-client-ip: the requests to $url got no answer" >&2
  exit 2
fi
read -r client_before spoof_before <<<"$before"
read -r client_after spoof_after <<<"$after"

if (($(grown "$spoof_before" "$spoof_after") > 0)); then
  echo spoofable
  exit 1
fi
if (($(grown "$client_before" "$client_after") >= 2)); then
  echo match
  exit 0
fi
echo differs
exit 1
