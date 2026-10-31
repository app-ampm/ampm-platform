# Deploy runbook (feature 6.6, D-053)

Deploys run only through `.github/workflows/deploy.yml` — never by hand on the box (infra.md). The workflow
builds the app + postgres images to GHCR, pins them by digest, and runs `infra/scripts/deploy.sh` on the
host (over SSH) to migrate, bring the stack up behind a health gate, and roll back on failure.

## Triggers

| Event               | Environment            | Images                                                           |
| ------------------- | ---------------------- | ---------------------------------------------------------------- |
| push to `main`      | staging                | built from the merge commit (`sha-<12>`), digest-pinned          |
| publish a release   | production             | built + tagged with the release tag, digest-pinned               |
| `workflow_dispatch` | the chosen environment | build this ref, or redeploy an existing `image_tag` for rollback |

## Release to production

1. Merge to `main` → staging deploys automatically; verify staging.
2. Publish a GitHub release with a semver tag (e.g. `v1.4.0`) → production deploys.
3. The migration job runs **expand steps only**; the health gate (`up --wait`) must pass or the deploy
   rolls back to the previous image automatically. The release stays reversible.

## Roll back

Run the **Deploy** workflow manually (`workflow_dispatch`) with `environment: production` and `image_tag`
set to the previous release tag. It resolves that tag to its digest and redeploys it without rebuilding,
and skips the migration step. Because migrations are expand-and-contract, the previous image is compatible
with the current (expanded) schema; contract steps ship only in a later release.

## Deploy freeze (no deploys while a wedding is live)

Production **forward** deploys are refused unless `DEPLOY_FREEZE` is empty or an explicit falsey value
(`false`/`0`/`no`/`off`) — the check fails closed, so any other value (including a typo) is treated as
frozen. Set it before a live event and clear it after. A **rollback** (`workflow_dispatch` with
`image_tag`) is exempt, so a bad release can always be recovered even during a freeze. (This mirrors the
app's "wedding is live" configuration; once the production API is reachable the check can instead query its
config endpoint.)

## Wiring the host (when VPS access opens)

Set these on the `staging` / `production` GitHub Environments:

- secrets `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `DEPLOY_SSH_KEY` (the deploy user's private key),
  `DEPLOY_SSH_KNOWN_HOSTS` (the host's public key, to pin it — without it the workflow falls back to
  trust-on-first-use), and `DEPLOY_SSH_PORT` if the host's SSH port is not 22 (match bootstrap's `SSH_PORT`)
- variables `AMPM_DOMAIN`, `ACME_EMAIL`

Provision the repo at `/opt/ampm`, owned by the deploy user: pass `BOOTSTRAP_REPO_URL` to `bootstrap.sh`
(feature 6.5) to clone it, or clone it once by hand (`sudo -u deploy git clone <url> /opt/ampm`). The deploy
SSHes in, checks out the deployed commit there, and the Compose files bind-mount their config from that
tree. Until `DEPLOY_SSH_HOST` is set, the deploy step runs `deploy.sh` in `DRY_RUN` on the runner, so the
pipeline (build, push, digest pin, freeze check, deploy plan) is exercised end to end without a real box.

## What deploy.sh does on the host

Decrypt secrets (sops → per-zone `.env`), pull the pinned images, run `docker compose --profile migrate run
--rm migrate` (expand-only `prisma migrate deploy`), `up -d --wait` (the health gate), and on a failed gate
re-up the previously running app image. See `infra/scripts/deploy.sh`.
