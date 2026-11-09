#!/usr/bin/env bash
# Build the Expo web export of the client portals and sync it to the app.ampmverse.com test box's
# httpdocs. The box serves httpdocs as static files and proxies /_api to the API (httpdocs/.htaccess [P]);
# see docs/engineering/test-deploy.md for the box run-config. This is a static (production) export, so the
# in-app dev sign-in screen — not a baked token — authenticates against the box's local-identity API.
#
# Usage:
#   WEB_SSH=user@31.97.62.74 WEB_HTTPDOCS=/var/www/vhosts/app.ampmverse.com/httpdocs \
#     bash deploy/deploy-web.sh
#
# Env:
#   WEB_SSH          (required) ssh target for the box
#   WEB_HTTPDOCS     (required) absolute path to the box's httpdocs
#   EXPO_PUBLIC_API_URL  (default https://app.ampmverse.com/_api) the API base the UI calls
#   EXPO_PUBLIC_DEMO     (default true) show the demo-environment banner on this test deploy
set -euo pipefail

: "${WEB_SSH:?set WEB_SSH=user@host}"
: "${WEB_HTTPDOCS:?set WEB_HTTPDOCS=/path/to/httpdocs}"
API_URL="${EXPO_PUBLIC_API_URL:-https://app.ampmverse.com/_api}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/mobile"

echo "Exporting apps/mobile web build (API=$API_URL) ..."
EXPO_PUBLIC_API_URL="$API_URL" EXPO_PUBLIC_DEMO="${EXPO_PUBLIC_DEMO:-true}" \
  pnpm exec expo export --platform web --output-dir dist

echo "Syncing dist/ -> $WEB_SSH:$WEB_HTTPDOCS ..."
# --delete prunes stale assets, but NEVER the box's hand-placed control files, which live outside the
# export and must survive every deploy: .htaccess (the [P] proxy to /_api, the SPA fallback and the
# Basic-Auth stanza), the .htpasswd it points at, and the ACME challenge dir used for cert renewal.
rsync -az --delete \
  --exclude='.htaccess' --exclude='.htpasswd' --exclude='.well-known/' \
  dist/ "$WEB_SSH:$WEB_HTTPDOCS/"

# The /_api proxy + SPA fallback live only in the box's .htaccess (reference:
# deploy/app-ampmverse/htaccess.example). Warn loudly if it is missing — without it deep links 404 and
# every /_api call fails. (The check runs over the same ssh the rsync just used.)
# shellcheck disable=SC2029  # WEB_HTTPDOCS is a local var; expanding it client-side is intended.
if ! ssh "$WEB_SSH" "test -f '$WEB_HTTPDOCS/.htaccess'"; then
  echo "WARNING: $WEB_HTTPDOCS/.htaccess is missing — deep links and /_api will NOT work." >&2
  echo "         Copy deploy/app-ampmverse/htaccess.example to it (and add the Basic-Auth block)." >&2
fi

echo "Done. The box must keep its .htaccess (/_api [P] proxy + SPA fallback) and run the API with"
echo "IDENTITY_PROVIDER=local and NODE_ENV!=production so the dev sign-in screen works."
