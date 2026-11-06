# Test deployment — app.ampmverse.com (throwaway test box)

This is the **hand-built Plesk test box** (`31.97.62.74`), **not** the dedicated production VPS of
`vps-setup.md` / D-015, and **not** the `deploy.yml` Compose stack. It exists only so AMPM can click the
app against a real API. Production stays per D-015 (Cognito identity, the VPS-as-code workflow). This note
codifies the test box so it stops being purely hand-built (infra.md: write host setup back into the repo).

## Shape

- **UI**: the Expo **web export of `apps/mobile`** (the client portals' browser build), served as static
  files from the box's `httpdocs`. `apps/web` (the Next.js public site) is a separate concern.
- **API**: the NestJS API on `127.0.0.1` (the box's local port, e.g. `7001`), reached from the UI at
  `/_api` via `httpdocs/.htaccess` (`[P]` proxy). The UI calls `EXPO_PUBLIC_API_URL=https://app.ampmverse.com/_api`.
- **Gate**: HTTP Basic-Auth (user `ampm`) in front of the whole site.

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
  `httpdocs/.htaccess` and fill in the auth block.

## Box API run-config (so sign-in works)

The in-app dev sign-in (`/auth/dev-login`) is **fail-closed**: it only works when the API runs with
`NODE_ENV` ≠ `production`, `IDENTITY_PROVIDER=local`, and `IDENTITY_LOCAL_SECRET` set. The box must run the
API in that **test/local** config (never production), with `CORS_ORIGINS=https://app.ampmverse.com`. Then:

- **Client**: sign in as `client@example.com` (Rhea — a client account with an active Hotel Discovery
  subscription and the seeded consultancy journey). `prospect@example.com` has no subscription or project,
  so hotel assistance is locked for them (they would subscribe first) — they are the portal subscription
  demo, not a Flow-2 client.
- **Staff**: sign in as `admin@example.com` (Super Admin) for the staff workspace (Slice 2).

## Deploy the API at latest main

Get the latest source onto the box (its checkout has no git remote of its own — ship it with
`git archive HEAD | ssh <box> 'cd <repo-on-box> && tar -xf -'` from a clean worktree), then run the box
redeploy, which rebuilds the API/worker image and re-seeds:

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
publishes the API on `127.0.0.1:7001` and sets `CORS_ORIGINS`/`WEB_APP_URL`/`TRUST_PROXY`); that override is
box-specific and not committed —
[`compose.test-override.example.yml`](../../deploy/app-ampmverse/compose.test-override.example.yml)
is the template to copy onto the box.
