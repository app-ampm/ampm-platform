#!/usr/bin/env bash
# Build the Expo web export of the client and staff portals and sync it to a docroot on the shared
# Plesk box, for one of its two stacks (D-138):
#   production  app.ampmverse.com (httpdocs): AMPM's own sign-in (D-142), no demo banner, and calls
#               the production API (127.0.0.1:7101 behind the domain's /_api proxy)
#   test        the test stack (dev sign-in, demo banner) at its test-app address
# The docroot keeps a `.ampm-target` marker, and the script refuses to put one target's bundle into the
# other's docroot: a test bundle in production would show dev sign-in against the production API.
#
# Usage:
#   AMPM_WEB_TARGET=production WEB_SSH=app_ampmverse@31.97.62.74 bash deploy/deploy-web.sh
#   AMPM_WEB_TARGET=test       WEB_SSH=app_ampmverse@31.97.62.74 bash deploy/deploy-web.sh
#
# Env:
#   AMPM_WEB_TARGET      (required) production | test
#   WEB_SSH              (required) ssh target for the box; WEB_SSH_KEY adds `-i <key>` to ssh and rsync
#   WEB_HTTPDOCS         docroot on the box (defaults per target, below)
#   EXPO_PUBLIC_API_URL  the API base the UI calls (defaults per target, below)
#   AMPM_WEB_RETARGET=1  allow switching a docroot from one target to the other (done once, deliberately)
set -euo pipefail

: "${AMPM_WEB_TARGET:?set AMPM_WEB_TARGET=production or test}"
: "${WEB_SSH:?set WEB_SSH=user@host}"
VHOST=/var/www/vhosts/app.ampmverse.com

case "$AMPM_WEB_TARGET" in
  production)
    HTTPDOCS="${WEB_HTTPDOCS:-$VHOST/httpdocs}"
    API_URL="${EXPO_PUBLIC_API_URL:-https://app.ampmverse.com/_api}"
    # AMPM's own sign-in (D-142): password + authenticator code, no third-party identity service.
    BUILD_ENV=(EXPO_PUBLIC_IDENTITY_PROVIDER=ampm)
    ;;
  test)
    HTTPDOCS="${WEB_HTTPDOCS:-$VHOST/test-app.ampmverse.com}"
    API_URL="${EXPO_PUBLIC_API_URL:-https://test-app.ampmverse.com/_api}"
    # The dev sign-in screen against the test stack's local-identity API, with the demo banner.
    BUILD_ENV=(EXPO_PUBLIC_IDENTITY_PROVIDER=local EXPO_PUBLIC_DEMO=true)
    ;;
  *)
    echo "AMPM_WEB_TARGET must be production or test, not '$AMPM_WEB_TARGET'" >&2
    exit 2
    ;;
esac

SSH=(ssh)
[[ -n "${WEB_SSH_KEY:-}" ]] && SSH+=(-i "$WEB_SSH_KEY")
RSYNC_RSH="${SSH[*]}"

# Refuse to cross targets: the marker says which stack this docroot serves.
# shellcheck disable=SC2029  # HTTPDOCS is a local var; expanding it client-side is intended.
marker="$("${SSH[@]}" "$WEB_SSH" "cat '$HTTPDOCS/.ampm-target' 2>/dev/null || true")"
if [[ -n "$marker" && "$marker" != "$AMPM_WEB_TARGET" && "${AMPM_WEB_RETARGET:-}" != "1" ]]; then
  echo "REFUSED: $HTTPDOCS serves the '$marker' stack, not '$AMPM_WEB_TARGET'." >&2
  echo "         Set AMPM_WEB_RETARGET=1 only when deliberately moving this docroot to another stack." >&2
  exit 3
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# The app imports @ampm/core and @ampm/policy through their package exports, which point at the compiled
# dist/, not src/. Export without rebuilding them and the bundle carries whatever dist the checkout last
# built: after moving to a newer main that shipped a stale core and blanked every enquiry page on the box
# (15 Nov 2026). Build every workspace package the app depends on first; turbo skips the unchanged ones.
echo "Building the workspace packages apps/mobile depends on ..."
(cd "$ROOT" && pnpm turbo run build --filter='mobile^...')

cd "$ROOT/apps/mobile"

# EXPO_NO_DOTENV keeps a developer's apps/mobile/.env (often a localhost API) out of the box's bundle;
# --clear drops Metro's transform cache so nothing from an earlier checkout is reused. `env -u` drops a
# stray EXPO_PUBLIC_DEMO / dev token from the caller's shell so only BUILD_ENV decides the build.
echo "Exporting apps/mobile web build for $AMPM_WEB_TARGET (API=$API_URL) ..."
env -u EXPO_PUBLIC_DEMO -u EXPO_PUBLIC_DEV_ACCESS_TOKEN -u EXPO_PUBLIC_IDENTITY_PROVIDER \
  EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL="$API_URL" "${BUILD_ENV[@]}" \
  pnpm exec expo export --platform web --output-dir dist --clear

echo "Syncing dist/ -> $WEB_SSH:$HTTPDOCS ..."
# --delete prunes stale assets, but NEVER the box's hand-placed control files, which live outside the
# export and must survive every deploy: .htaccess (the [P] proxy to /_api, the SPA fallback, the
# headers and the Basic-Auth stanza), the .htpasswd it points at, the ACME challenge dir used for cert
# renewal, and the target marker.
rsync -az --delete -e "$RSYNC_RSH" \
  --exclude='.htaccess' --exclude='.htpasswd' --exclude='.well-known/' --exclude='.ampm-target' \
  dist/ "$WEB_SSH:$HTTPDOCS/"
# shellcheck disable=SC2029
"${SSH[@]}" "$WEB_SSH" "printf '%s\n' '$AMPM_WEB_TARGET' > '$HTTPDOCS/.ampm-target'"

# The /_api proxy + SPA fallback live only in the box's .htaccess (references:
# deploy/app-ampmverse/htaccess.production.example and htaccess.example). Warn loudly if it is missing.
# shellcheck disable=SC2029
if ! "${SSH[@]}" "$WEB_SSH" "test -f '$HTTPDOCS/.htaccess'"; then
  echo "WARNING: $HTTPDOCS/.htaccess is missing — deep links and /_api will NOT work." >&2
fi

echo "Done: $AMPM_WEB_TARGET bundle in $HTTPDOCS. Load a page and read the browser console."
