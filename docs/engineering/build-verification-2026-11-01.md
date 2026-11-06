# Build re-verification, 1 November 2026

This re-verifies `main` (origin/main, == the tip of `claude/sprint-8-phase1-setup-3d43d0` at `dc18791`) after the hardening pass **PR #32** (`3d3edea`) and features **8.2** (PR #31) and **8.3** (PR #33), to test the 31 October verdict that the build was "not yet deployable". The 31 October check (`build-verification-2026-10-31.md`) reviewed origin/main at PR #30 and said sprint 8 should pause after 8.1 for a hardening pass before 8.2 and 8.3. That hardening pass has since landed; this document asks whether it closed the blockers.

Method: a background verification workflow of thirteen agents — one live-execution agent that reproduced every CI gate and ran two targeted deployability proofs, nine adversarial blocker verifiers (one per "what does not hold" item, each instructed to prove the blocker is *still* open), and three regression reviewers over the 8.2, 8.3 and hardening diffs — plus the live staging-deploy CI runs read from GitHub. Nothing in the tree was changed by the verification. It ran in-place on the existing worktree (not a fresh clone) against the live Postgres (`ampm_test`, 13 migrations) and Redis (`:6379`), on Node 24.22.1 / pnpm 12.15.0.

## Verdict

**The application is deployable; the deployment to a real VPS is not yet wired.** This flips the 31 October "not deployable" verdict at the application layer: every application-level blocker is closed and proven live, every CI gate is green, and the 8.2 / 8.3 / hardening changes carry zero high-severity and zero deploy-blocking regressions. What remains is a cluster of **deploy/host + website-serving + bot-check-configuration** items that are infrastructure and configuration, not application code. Until they are wired, a real VPS deploy would still fail — and no real VPS deploy has ever run: `DEPLOY_SSH_HOST` is unset, so `deploy.yml` has only ever executed `deploy.sh` in `DRY_RUN`. The staging-deploy pipeline (build → GHCR image → deploy plan) is nonetheless green on every merge (#31, #32, #33), proving the pipeline itself and the image build are sound.

### What holds (closed and proven live)

- **All CI gates pass** on the current tree (table below), including the full policy suite (9,868 cases), the three-platform mobile bundle with no dev token leaked, byte-for-byte authz-matrix reproduction, and both secret/price scanners clean.
- **A1 / B2 / F1 — notifications and invites (CLOSED, high confidence).** The job id is now `notification.send.${id}` (dot, not colon — verified against BullMQ 6.4.2's actual custom-id rule, `job.js:916`); enqueue failures are logged not swallowed (four invite call sites); a failed send retries (3 attempts + backoff) then dead-letters; the worker container is on an `egress` network; `REDIS_URL` is required in production. The previously-missing Redis-backed driver test (D-031) exists (`bullmq.driver.redis.spec.ts`) and **passed live against Redis**.
- **A2 / A3 — sessions (CLOSED, high).** The reaper now deletes only expired rows (`session.repository.ts:89`), so revoked/idle sessions can no longer be resurrected before the token expires; the request-id is capped at 64 chars to match `audit_events.request_id`. New e2e "does not resurrect a revoked token after the reaper runs" passes.
- **B1 — client activation (CLOSED for the client-login path, proven; see caveat).** Activation flips the membership `invited → active` with `accepted_at` in one transaction, the principal loads it, and `/me` returns the wedding. The activate-then-read-as-client e2e passes.
- **C3 / C4 / C7 / L6 — lead workspace (CLOSED, high).** Forward-only status machine (409 on a refused move, no edits to a terminal lead), owner restricted to active staff (400 not 500 on an unknown id), update invariants enforced, cursor validated (400 not 500). The workflow e2e (8/8) covers every case.
- **B4 / B8 / B9 — admin guards (CLOSED).** Email reusable after soft delete (partial unique index verified applied), no `disabled → active` for a never-activated user, demo baseline no longer clobbers a real identity subject.
- **Deploy hardening that did land (CLOSED):** harden-before-clone (F11), refusal of a manual forward production deploy (F6), path-gating of the deploy trigger (F7-paths), redis non-root (F4-redis), pinned age-key path + `/etc/ampm` (F2-path).
- **Process (CLOSED):** the checkpoint now commits inside a worktree and scans before pushing (F8/F9, live-verified); the knowledge graph was refreshed (P2).

### What still blocks a real VPS deploy

1. **The website has no serving path (`website` — partial).** The CSP fix (C2) and the PUB-06 component test are done and the form works in dev, but neither the staging nor the production stack serves the site: no `web` service in any compose, Caddy's only vhost reverse-proxies to `api:3900`, the single image builds only the API, and the force-dynamic site has no static export. In a real deploy the marketing site and its `/contact` enquiry form — the 31 October report's "only viewable feature" — would **404**, and `deploy.sh`'s health gate only probes the API `/health`, so the deploy would pass while the public site is down.
2. **The deploy/host is not wired for a real run (`deploy` — partial).** On the decided single VPS, staging and production still publish **identical host ports** (80/443, 9090, 9093) — a real co-located staging deploy fails at `up` on a port clash, then cannot roll back. There is no host-side GHCR login, no private-repo read-only deploy key, and no committed encrypted secrets (the `.sops.yaml` recipient is a literal placeholder), so `decrypt-secrets.sh` exits 1 before anything deploys. The deploy job gates only on the image `build`, not on CI success. Caddy still runs as root. The 31 October "cannot run end to end as written … same host ports" is therefore still substantially true.
3. **The bot-check is not configured for the documented deploy (`botcheck` — partial).** A real siteverify adapter exists and production refuses to boot with the stub (fail-closed), but `BOT_CHECK_PROVIDER/URL/SECRET` are absent from the secret-zone example and both prod/staging compose, so a by-the-book deploy **crash-loops at boot** until an operator reverse-engineers the three missing settings. Separately, the no-op-stub safety is delegated entirely to `NODE_ENV === "production"`; running the compiled artifact with `NODE_ENV` unset silently activates the accept-anything stub.

### Smaller items surfaced (none deploy-blocking)

| Item | Severity | Where | Note |
|---|---|---|---|
| Last-Super-Admin guard is a check-then-act outside the tx (concurrency TOCTOU) | partial-B3 | `last-super-admin.ts:25` | Two simultaneous removals can both pass the pre-check → zero-SA lockout. Make it atomic (row lock / SERIALIZABLE). |
| Entitlement cache invalidation never reaches the API process in production | medium | `principal.service.ts` | Worker's `invalidate()` touches a different in-memory Map than the API's; relies on the ≤5-min TTL, so self-heals within the matrix's documented tolerance. This is the known "cross-process entitlement-cache invalidation" deferred item — needs Redis pub/sub. |
| Reminder sweep reorder drops the atomic claim guard | medium | `leads.reminder.service.ts:95` | `36705ae` changed claim-then-queue to queue-then-claim and discards the claim result → duplicate in-app reminders possible. Exactly-once → at-least-once regression; in-app only, single-process worker makes it unlikely now. Restore the claim-first guard. |
| Convert's closed/converted guard is pre-transactional (TOCTOU) | low | `accounts.service.ts:69` | A close racing a convert can leave a closed lead converted. Make `markConverted` a conditional `updateMany`. |
| Convert's invite-delivery failure swallowed with no log/resend | low | `accounts.service.ts:160` | Bare `catch { return false }`; log it like the client-logins path. |
| Webhook arriving before the payment row silently loses activation | low | `subscription-activation.service.ts:131` | Unreachable today (order row committed first); becomes reachable once the CP-11 client-purchase screen ships — throw so the job retries. |
| Captured amount/currency not asserted against the plan/order | low | `subscription-activation.service.ts:130` | Defense-in-depth; harden before CP-11 gives the browser influence over the order. |
| Production bot-check fetch has no timeout | low | `bot-check.adapter.ts:50` | A hung provider stalls the public enquiry POST (~300s) — add a short `AbortSignal.timeout`. |
| Convert flow doesn't reuse the extracted `lead-status` module | low | `accounts.service.ts:71` | Incomplete extraction; no functional bug, but the two terminal-state definitions can diverge. |
| `P1` — main checkout split from origin/main | hygiene | `~/Desktop/AMPM` | A one-time manual fast-forward the user runs in the main checkout; no commit can close it. Does not affect application deployability. |

## Gates and builds

| Gate | Result |
|---|---|
| `pnpm install --frozen-lockfile` | pass (10 workspaces; Node 24.22.1 / pnpm 12.15.0) |
| `pnpm db:generate` | pass (Prisma 7.10.1) |
| `prettier --check .` | pass |
| `quality`: turbo lint+typecheck+test `--force --filter='!api'` | pass (23/23; 2 non-fatal `max-lines-per-function` warnings in `enquiry-fields.tsx`) |
| `api`: turbo lint+typecheck+test `--force --filter=api` | pass (5/5; unit 291 + 2 skipped, e2e 93) |
| `build`: turbo build `--filter=web --filter=api` | pass (Next 16.4.3; only the known `middleware`-deprecation warning) |
| `mobile`: `expo export --platform all` | pass (Android + iOS + web; dev token absent from every bundle) |
| `authz:generate` drift | none (matrix reproduces byte-for-byte: 116 staff rows, 680 capabilities, 64 transitions) |
| `pnpm test:tools` | pass (8 self-tests) |
| secrets-scan: `scan_secrets` + `scan_price_literals` | clean (1,130 tracked files, 12 allowlisted; 321 source files) |
| static infra validators | pass (`docker compose config` ×3 stacks, `caddy validate`, `promtool` config+rules, `amtool`, `shellcheck`, `actionlint`) |
| docker image build (`infra/docker/Dockerfile`) + container smokes | **not-verifiable** — registry unreachable offline (same as 31 Oct). Environmental; CI builds the image and runs the smokes green on every merge. This single caveat is why the verdict is "green-with-caveats", not plain green. |

Test counts (turbo `--force`, no cache): `@ampm/policy` 9,868 · `@ampm/ui` 231 (Jest) · `@ampm/core` 62 · `web` 12 · `@ampm/tokens` 6 · `@ampm/api-client` 3 · `api` unit 291 (+2 skipped) · `api` e2e 93. The 2 skipped are the Redis driver tests, `skipIf(!REDIS_URL)` — run standalone with `REDIS_URL` set, both pass.

## Targeted deployability proofs

- **A1 / D-031** — `apps/api/src/jobs/bullmq.driver.redis.spec.ts` run with `REDIS_URL=redis://localhost:6379`: 2/2 passed. Proves a `notification.send.<uuid>` key is accepted by the real BullMQ driver and the worker runs it, plus the retry → dead-letter path. CI runs this file with a Redis service (`ci.yml:236`).
- **B1** — `apps/api/test/auth-activation.e2e-spec.ts`: 3/3 passed, including the activate-then-read-as-client case (membership `invited → active`, `accepted_at` set, `/me` returns the wedding).

## Caveat on "deployable"

The application-layer verdict is strong: all gates green, both live proofs pass, zero deploy-blocking regressions. But "deployable to the real VPS" is a separate, still-open question. The deploy pipeline's green runs on every merge are per-stack `docker compose config`, `actionlint`, `shellcheck` and a `DRY_RUN` plan only — none of these can detect the single-host port collision (each stack is validated in isolation), the missing host GHCR/repo auth, the placeholder age recipient, or that the website is not served at all. The first time the box is wired, a real deploy is likely to fail at decrypt (no encrypted secrets / unreadable key), then at pull (no GHCR login), a co-located staging deploy would fail at `up` on the port clash, and the public website would 404. Those are exactly the items in "What still blocks a real VPS deploy".

## Recommended next: a deploy-readiness pass

The remaining blockers are the same "deploy and host" bucket the 31 October check advised pausing on, plus the website-serving decision. Grouped into one pass that would flip the verdict to "deployable to the VPS":

1. **Website serving** — add a Next.js runtime `web` service behind a dedicated Caddy site block to both stacks, build/ship `apps/web` in the image and the deploy workflow, and add a deploy edge-probe of a website route (not just the API `/health`).
2. **Deploy/host wiring** — give staging its own host ports (or a second Caddy site), run Caddy non-root, provision a host GHCR login and a read-only deploy key in `bootstrap.sh`, align `/etc/ampm` ownership with the non-root deploy user, generate a real age key + commit real `*.enc.yaml`, and gate the deploy on CI success — then rehearse **one real (non-`DRY_RUN`) deploy on a VM** with RPO/RTO captured.
3. **Bot-check config** — add `BOT_CHECK_PROVIDER=siteverify` + URL + secret to the secret-zone example and both compose stacks, and make the stub-selection throw intrinsically under production rather than relying on `NODE_ENV`.
4. **Fold-in hardening** — the B3 atomic last-SA guard, the Redis pub/sub entitlement invalidation (the already-known cross-process item), the reminder claim-first restore, and the bot-check fetch timeout.
5. **Process** — the user fast-forwards the `~/Desktop/AMPM` main checkout onto origin/main (P1); refresh the knowledge graph (drifted again since the hardening pass).

The 8.2/8.3 low-severity items (convert TOCTOU, swallowed invite log, webhook-before-row, amount assertion) are best addressed alongside the CP-11 client-purchase screen, which is what makes several of them reachable.
