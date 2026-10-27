# Offline spike: the team app's local store and sync library

Sprint 2, days 9–10 (build-plan §11.4), closing the choice left open in standards §2.6 and locked only
in principle by Q1 and Brief §10. The library choice is the developer's; this is the thin proof of
concept behind it. Decision recorded as **D-026** (accepted). Chosen: **plain `expo-sqlite` with our
own change queue.**

## What was built

A stand-in "field note" record — a throwaway operational record standing in for incidents, cue updates
and checklist items — taken end to end, behind the real pipeline, on the leading candidate:

- **Contract** (`packages/core`): `fieldNoteUpsert` / `fieldNoteView` Zod schemas; a client-generated
  UUID v7 `id` plus a base `version` form the idempotency key. The pure change-queue logic
  (`packages/core/src/offline`: `orderForReplay`, `idempotencyKey`, `dedupeByIdempotency`, `uuidv7`)
  is framework-free and unit-tested, so the client and the API share one definition of the key.
- **API** (`apps/api/src/modules/spike`): a `POST …/field-notes` upsert and a `GET` list behind the
  global `AuthGuard` and `PermissionGuard` (the `tasks.incidents` key, scoped to the project —
  offline.md's own example of a write that must work with no signal). An in-memory store proves the
  rules without a migration: a replay of the same `(id, baseVersion)` is idempotent; an in-order write
  bumps the version; a stale base loses to the server and comes back as a conflict, surfaced not
  dropped. Unit-tested in `field-note.service.spec.ts`.
- **Mobile** (`apps/mobile/src/features/field-notes`): one `OfflineStore` interface implemented on
  **expo-sqlite** (`sqlite-store.ts`, the engine wired into the app) and on **WatermelonDB**
  (`watermelon-store.ts`, for the comparison only). Reads come from the local store first; a note is
  saved locally and queued; the queue replays in order on reconnection and on app foreground; the
  banner always shows offline state and the pending count, built from the shared `packages/ui`
  components (`Callout` `offline` / `pending-sync`).

### Verified in the simulator (the "done" criterion)

iPhone 17 Pro, Expo Go, SDK 58, against the local API. **The simulator has no airplane mode, so the
documented method to make the API unreachable is to stop the API process** (the app's `fetch` then
fails and is read as offline). Observed:

1. API stopped → record "Gate 3 power is out" → saved to expo-sqlite, shown with an **open · pending**
   chip and the banner "Offline · 1 change waiting to sync."
2. API restarted → **Sync now** → banner "All changes synced", the note now shows **v1**, and the
   server list returns **exactly one** record at v1 — the queued write reached the API once, not twice.

The server-side idempotency was also checked over HTTP directly: create → replay (same `id`,
`baseVersion`) → `duplicate`, one record; in-order edit → `v2`; stale base → `conflict` (server kept);
no token → 401; bad body → 400.

## The candidates, on the criteria that matter here

| Criterion | `expo-sqlite` + our queue (**chosen**) | WatermelonDB | PowerSync |
|---|---|---|---|
| Expo SDK 58, iOS/Android | **Included in Expo Go (~58.0.2)** — no dev build for the base store | Native (JSI); needs a **community config plugin + a development build**; not in Expo Go | Native; needs a **development build**; not in Expo Go |
| Expo **web** export | wasm build; needs a Metro + SharedArrayBuffer setup. Not needed by the team store (web export is the client portals); spike uses an in-memory fallback on web | LokiJS web adapter (separate wiring) | Web SDK (separate wiring) |
| Encryption at rest (offline.md) | **SQLCipher** via `openDatabaseAsync(name, { useSQLCipher: true })` — config plugin + dev build for the toggle only, store code unchanged | None built-in (community workarounds) | SQLCipher in its SDK |
| Operations on the VPS (R13/G2) | **None** — sync is plain HTTPS to our existing NestJS API; no server component | None extra as a plain DB, but its `synchronize()` wants protocol-shaped pull/push endpoints | **A self-hosted PowerSync Service (Docker) + Postgres logical replication + a bucket store (Mongo/Postgres)** → one more container to run, secure, back up and monitor on the single VPS |
| Licence | **MIT** (SQLite public domain) | MIT | **FSL-1.1-ALv2** — source-available, not OSI (converts to Apache-2.0 after 2 years) |
| Bundle / build | Core Expo module; Expo Go now, dev build only for SQLCipher | `native/ios` + `native/android` (~3.8M); dev build + config plugin + Babel decorator plugin | Native SDK + the service |
| offline.md conflict rules | **Direct**: our `change_queue` holds the base version + device timestamp; we own replay order, the `(id, baseVersion)` idempotency key, server-wins-on-status, and the conflict log | **Mismatch**: its value is the opinionated `synchronize()` (last-pulled-at pull/push, its own conflict model); honouring our rules means using it as a plain DB — no gain over expo-sqlite | **Mismatch**: bucket-based replication + its own upload queue; again a model to adapt to our rules |

## Why `expo-sqlite`

1. **It runs in Expo Go.** The only candidate that does — the fastest dev loop, and no development build
   for the base store. Both sync libraries need a development build, so in this spike every sync library
   is a compile-only artifact; the WatermelonDB arm is written and type-checked but never wired into the
   running app.
2. **Our rules are prescriptive, so the sync engines buy nothing.** offline.md fixes the idempotency key
   (client id + base version), the replay order, server-wins-on-status, and a conflict log the project
   lead reviews. WatermelonDB's and PowerSync's worth is precisely their own sync engines; to meet our
   rules we would switch them off and hand-roll the same queue — paying a dev build (and, for PowerSync,
   a container) for nothing.
3. **Zero extra VPS footprint.** Under R13/G2 everything runs on AMPM's single VPS. expo-sqlite syncs
   over plain HTTPS to the API we already run. PowerSync would add a sync-service container plus Postgres
   logical replication and a bucket store.
4. **Licence and encryption.** MIT / public domain, and SQLCipher at-rest encryption via `useSQLCipher`
   with identical store code once the team app moves to a development build.

## Consequences

- Keep the change-queue and idempotency logic validated here (`packages/core/src/offline`); build the
  real team-app store on expo-sqlite with the `OfflineStore` shape from the spike.
- **A development build is still required for encryption at rest (SQLCipher).** Plan it for when the team
  app leaves Expo Go; until then development/Expo Go data is unencrypted (never real guest data — data.md).
- We own the sync engine (more code than adopting a library's), but it is the only way to meet offline.md
  exactly; the pure logic is unit-tested and the API side is idempotent by construction.
- The Expo web export of the client portals does not carry the team store; a web team view, if ever
  needed, adds the sqlite-wasm Metro setup.
- **Spike artifacts to remove before shipping the feature** (all marked `SPIKE STAND-IN`): the
  `@nozbe/watermelondb` dependency and `watermelon-store.ts`; the `apps/api/src/modules/spike` module;
  the `field-note` contract in `packages/core`; the `/field-notes` route and screen. Keep the queue and
  idempotency helpers and their tests.
