# Test deployment — app.ampmverse.com and site.ampmverse.com (throwaway test box)

This is the **hand-built Plesk test box** (`31.97.62.74`), **not** the dedicated production VPS of
`vps-setup.md` / D-015, and **not** the `deploy.yml` Compose stack. It exists only so AMPM can click the
app against a real API. Production stays per D-015 (Cognito identity, the VPS-as-code workflow). This note
codifies the test box so it stops being purely hand-built (infra.md: write host setup back into the repo).

## Shape

- **UI**: the Expo **web export of `apps/mobile`** (the client portals' browser build), served as static
  files from the box's `httpdocs`.
- **API**: the NestJS API on `127.0.0.1` (the box's local port, e.g. `7001`), reached from the UI at
  `/_api` via `httpdocs/.htaccess` (`[P]` proxy). The UI calls `EXPO_PUBLIC_API_URL=https://app.ampmverse.com/_api`.
- **Website**: the public site (`apps/web`, Next.js) runs as its own container on `127.0.0.1:7002` and is
  served at `https://site.ampmverse.com` through that domain's `.htaccess` (`[P]` proxy); see
  [The public website](#the-public-website--siteampmversecom) below.
- **Gate**: HTTP Basic-Auth (user `ampm`) in front of both sites; the site's `.htaccess` uses app.'s user
  file, so the same login works on both (the browser asks once per site). `/_api` stays outside the gate
  for the app's Bearer calls and the website's enquiry form, except `/_api/auth/dev-login`, which stays
  behind it (see the run-config below).

## Deploy the UI

```bash
WEB_SSH=user@31.97.62.74 WEB_HTTPDOCS=/var/www/vhosts/app.ampmverse.com/httpdocs \
  bash deploy/deploy-web.sh
```

This runs `expo export --platform web` (the `web:export` script — a static export with
`EXPO_PUBLIC_API_URL` baked in) and rsyncs `apps/mobile/dist/` to `httpdocs`. The rsync uses `--delete` to
prune stale assets but `--exclude`s the box's hand-placed control files (`.htaccess`, `.htpasswd`,
`.well-known/`), so the proxy, the auth gate and cert renewal survive every deploy; it then warns if
`httpdocs/.htaccess` is missing.

- **SPA routing + API proxy**: `app.json` `web.output` is `"single"` — the export is a single-page app
  (`dist/index.html` + `dist/_expo/…`). The box's `httpdocs/.htaccess` does two jobs: it proxies `/_api` to
  the local API (`[P]`) and rewrites unknown paths to `index.html`, so a deep link (`/portal/requests/<id>`)
  loads the app and the router resolves it client-side. The canonical file is version-controlled at
  [`deploy/app-ampmverse/htaccess.example`](../../deploy/app-ampmverse/htaccess.example); it is kept on the box
  (deploys do not overwrite it, because it also carries the Basic-Auth stanza). On a fresh box, copy it to
  `httpdocs/.htaccess` and create the user file it names with `htpasswd`.

## Box API run-config (so sign-in works)

The in-app dev sign-in (`/auth/dev-login`) is **fail-closed**: it only works when the API runs with
`NODE_ENV` ≠ `production`, `IDENTITY_PROVIDER=local`, and `IDENTITY_LOCAL_SECRET` set. The box must run the
API in that **test/local** config (never production), with `CORS_ORIGINS` listing app. and site. Because
`/_api` is reachable from the internet, two guards apply (D-080):

- **Dev sign-in behind the password.** `/auth/dev-login` mints a token for any seeded account from an email
  alone, so `httpdocs/.htaccess` keeps `/_api/auth/dev-login` (case-insensitively) inside the Basic-Auth gate
  while the rest of `/_api` stays open. The app calls it signed out, without a Bearer header, so the browser
  sends the saved Basic credentials. Check: `curl -s -o /dev/null -w '%{http_code}' -X POST https://app.ampmverse.com/_api/auth/dev-login`
  answers `401`.
- **The box's own signing key.** The API and worker sign tokens with `AMPM_BOX_IDENTITY_SECRET` from
  `infra/compose/local/.env` on the box (gitignored, mode 600, generated there; the override template shows
  the command), never the development value committed in `compose.yml`. Replacing it signs every tester
  out.

Then:

- **Client**: sign in as `client@example.com` (Rhea — a client account with an active Hotel Discovery
  subscription and the seeded consultancy journey). `prospect@example.com` has no subscription or project,
  so hotel assistance is locked for them (they would subscribe first) — they are the portal subscription
  demo, not a Flow-2 client.
- **Staff**: sign in as `admin@example.com` (Super Admin) for the staff workspace (Slice 2).

## Media object store (local files)

Media uploads — the hotel photo manager, `POST /media/:id/upload` — go to an object store. On the box that
is the **local filesystem adapter** (`STORAGE_PROVIDER=local`, the dev/staging store); production uses S3 in
Mumbai and `env.ts` refuses `local` there (infra.md). The API container runs with a **read-only root
filesystem**, so the store is a **writable host bind-mount**, not a path inside the image. Without it every
upload fails with `EROFS` / `ENOENT mkdir '.storage'` and the client hotel cards show no cover.

One-time host setup — the dir must be owned by the container's `node` uid (1000); the SSH user cannot `chown`
to another uid, so do it through a throwaway root container:

```bash
STORE=/var/www/vhosts/app.ampmverse.com/ampm-storage
mkdir -p "$STORE"
docker run --rm --user 0 -v "$STORE:/s" node:24.22.1-bookworm-slim chown -R 1000:1000 /s
```

The box override then mounts it into **api and worker** and sets `STORAGE_LOCAL_DIR=/data/storage` (see
[`compose.test-override.example.yml`](../../deploy/app-ampmverse/compose.test-override.example.yml)); recreate
the two services so they pick it up:

```bash
docker compose -f infra/compose/local/compose.yml -f infra/compose/local/compose.test-override.yml \
  up -d --no-deps --wait api worker
```

The uploaded media is the only persistent state outside Postgres — it lives in this host dir and survives
container rebuilds, but a box reinstall keeps the photos only if the dir is preserved. The seed plants no
hotel media, so a fresh box shows placeholder covers until photos are uploaded through the photo manager (an
HT/SA signs in, opens a hotel, adds a photo, and sets visibility `client` + a cleared rights status, GP-20).

## Deploy the API at latest main

Get the latest source onto the box (its checkout has no git remote of its own — ship it with
`git archive HEAD -- . ':(exclude)graphify-out' | ssh <box> 'cd <repo-on-box> && tar -xf -'` from a clean
worktree; the knowledge graph is not needed on the box), write the commit to the box's `.deployed-commit`,
then run the box redeploy, which rebuilds the API/worker image and re-seeds:

```bash
bash deploy/redeploy-box.sh
```

It is **non-destructive**: it recreates only api+worker (leaving Postgres/Redis up, to dodge the startup
"recovery mode" race), applies any pending migrations with `prisma migrate deploy`, then runs the
idempotent seed (`tsx prisma/seed.ts`) — so demo data a tester has already driven forward is preserved. For
a clean wipe use `prisma migrate reset --force` (Prisma 7 takes no `--skip-*` flags and does not auto-seed)
followed by the seed; the script's header documents both. `db:seed` plants the demo accounts (including the
Hotel-team account), the hotels, and the client's consultancy chain plus a fresh `submitted` enquiry.

The script composes `infra/compose/local/compose.yml` with the box-only `compose.test-override.yml` (which
publishes the API on `127.0.0.1:7001`, sets `CORS_ORIGINS`/`WEB_APP_URL`/`TRUST_PROXY`, takes the signing key
from the box's `.env`, limits the API and worker to 1 CPU / 1 GB, and defines the website's `web` service);
Compose reads that `.env` itself, so the scripts need nothing more. The override is box-specific and not
committed —
[`compose.test-override.example.yml`](../../deploy/app-ampmverse/compose.test-override.example.yml)
is the template to copy onto the box.

## The public website — site.ampmverse.com

The Next.js site needs a Node server, not a folder of files: every page renders per request (D-046) and
the middleware sets a fresh CSP nonce on each response. `next.config.ts` builds Next's **standalone**
output, and [`infra/docker/web.Dockerfile`](../../infra/docker/web.Dockerfile) packages it: the traced
server, its `node_modules` and the static assets (about 42 MB), run as the `node` user. The build stage
repeats the API image's install steps, so the two images share that layer when they are built from the
same source.

- **Build arguments** (Next inlines them, the CSP's `connect-src` included): `NEXT_PUBLIC_API_URL=https://app.ampmverse.com/_api`
  and `NEXT_PUBLIC_PORTAL_URL=https://app.ampmverse.com`. The enquiry form posts to the API through app.'s
  `/_api` proxy, a different origin from the site, as it will be under Caddy in production, so the API's
  `CORS_ORIGINS` lists `https://site.ampmverse.com`. The server-side reads (the discovery price on How it
  works, from `GET /crm/plans`) use the same public URL; `/_api` is outside the gate, so they need no login.
- **Container**: the `web` service of the box override, published on `127.0.0.1:7002` only, on a network
  of its own, read-only with a tmpfs for `.next/cache`, a 1 CPU / 1 GB limit and a healthcheck.

### One-time host setup

1. **DNS** (the `ampmverse.com` zone is at GoDaddy, nameservers `ns05`/`ns06.domaincontrol.com`): an `A`
   record `site` → `31.97.62.74`, next to `app`.
2. **Plesk**, signed in as the subscription user (`app_ampm`): Add Domain → Blank website,
   `site.ampmverse.com` in the app.ampmverse.com webspace (so the document root,
   `/var/www/vhosts/app.ampmverse.com/site.ampmverse.com`, belongs to `app_ampmverse`), DNS and mail
   services off (the zone is GoDaddy's; the site sends no mail), preferred domain None. Then SSL/TLS
   Certificates → the free Let's Encrypt certificate for `site.ampmverse.com` only (no www, no wildcard:
   neither has a DNS record), HTTP validation, and "Redirect from http to https" on. Done on 7 Nov 2026;
   the certificate renews itself.
3. Copy [`deploy/site-ampmverse/htaccess.example`](../../deploy/site-ampmverse/htaccess.example) to the
   new document root as `.htaccess` and move Plesk's placeholder `index.html` out of it (it is kept in
   `~/plesk-default-pages/`), so the document root holds nothing but the `.htaccess`. On this server static
   files go through Apache's gate (app.'s `index.html` answers `401`), but Plesk's "Serve static files
   directly by nginx" option, if it were turned on, would hand out any file left there without the
   password. The `.htaccess` proxies every request, `/` included (`DirectoryIndex disabled`), to
   `127.0.0.1:7002` behind app.'s Basic-Auth user file and leaves `/.well-known/acme-challenge/` open so the
   certificate renews.
4. With the override from the template and the box's `.env` key in place, recreate the API and worker once
   so they pick up `CORS_ORIGINS`, the key and the limits:
   `docker compose -f infra/compose/local/compose.yml -f infra/compose/local/compose.test-override.yml up -d --no-deps --wait api worker`.

### Deploy the website

Ship the source as for the API (the `git archive` step above), then on the box:

```bash
bash deploy/redeploy-site.sh
```

It builds the image, recreates only the `web` container (the API, worker, Postgres and Redis keep
running) and checks the home page on `127.0.0.1:7002`. The build installs the workspace and downloads
the fonts (`next/font`), so it needs the network. Every rebuild from changed source adds an install layer
to Docker's build cache; that cache is shared with the server's other projects, so pruning it is the
server owner's call.

### Checks

- On the box: `curl -sI http://127.0.0.1:7002/` answers `200`, and its `content-security-policy` lists
  `https://app.ampmverse.com` in `connect-src`.
- Public: `curl -sI https://site.ampmverse.com/` answers `401` (the gate); signed in, every page loads,
  `/` is the home page (not Next's 404, which means the `DirectoryIndex` line is missing) and How it works
  shows the discovery price.
- CORS: `curl -si -X OPTIONS https://app.ampmverse.com/_api/crm/enquiries -H 'Origin: https://site.ampmverse.com' -H 'Access-Control-Request-Method: POST'`
  answers with `access-control-allow-origin: https://site.ampmverse.com`.
