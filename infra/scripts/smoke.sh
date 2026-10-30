#!/usr/bin/env sh
# Local smoke for the container stack (features 6.1, 6.2): build the image, bring the whole stack up, and
# assert the real edge works -- /health 200 over HTTPS through Caddy (its internal CA on localhost), the
# HTTP->HTTPS redirect, the transport headers, and the stripped server identity. Then tear everything
# down. A repeatable proof the deploy artifact builds and the edge serves it. Needs a running Docker daemon.
set -eu

COMPOSE="docker compose -f infra/compose/local/compose.yml"

cleanup() { $COMPOSE down -v >/dev/null 2>&1 || true; }
trap cleanup EXIT

$COMPOSE up -d --build --wait --wait-timeout 180

# HTTPS /health through Caddy's internal CA (-k accepts the local cert).
code=$(curl -fsSk -o /dev/null -w '%{http_code}' https://localhost:8443/health)
echo "smoke: /health over HTTPS through Caddy -> HTTP $code"
[ "$code" = "200" ] || { echo "smoke FAILED: health $code"; exit 1; }

# Caddy redirects plain HTTP to HTTPS -- an edge-only behaviour the API itself does not do.
redirect=$(curl -sk -o /dev/null -w '%{http_code}' http://localhost:8080/health)
echo "smoke: http://:8080 -> $redirect (expect 308)"
[ "$redirect" = "308" ] || { echo "smoke FAILED: no HTTP->HTTPS redirect ($redirect)"; exit 1; }

headers=$(curl -fsSk -D - -o /dev/null https://localhost:8443/health)
# HSTS is gated to the public domain (never localhost), so it is not asserted here.
for h in "x-content-type-options: *nosniff" "x-frame-options: *DENY" "referrer-policy:" "permissions-policy:"; do
	echo "$headers" | grep -iqE "^$h" || { echo "smoke FAILED: missing edge header matching '$h'"; exit 1; }
done
# The edge strips what names the server software (an edge-only signal).
for h in "server:" "x-powered-by:"; do
	echo "$headers" | grep -iqE "^$h" && { echo "smoke FAILED: '$h' should be stripped at the edge"; exit 1; }
done
echo "smoke OK: HTTPS + /health 200 + HTTP->HTTPS redirect + transport headers + server identity stripped"
