# Frontend Development Roadmap

**Date:** 7 November 2026 · **For:** the developer (AMPM, one-person team with Claude Code) · **Status:** proposed, awaiting the first-workstream pick.

This plan answers one question: now that the server, the live test domain and the **Peacock Night** design system are in place, how do we build the screens and workflows we can show, in what order? It is grounded in a code-verified audit of the whole repository on 7 November 2026 (a six-agent sweep of `apps/api`, `apps/mobile`, `apps/web`, `packages/ui`, `packages/tokens`, and the design package) — not in what the docs claim. It runs in two horizons:

- **Horizon 1 — Close the gap.** A lot of backend is already built and has **no UI**. Building those screens is mostly UI-only (contracts already exist), so it is fast and turns far more of the platform into something demoable.
- **Horizon 2 — Feature-complete cadence.** For the engaged-wedding product (no backend yet), build each feature backend-first, wire it, then its screen, then move on — exactly the method you described.

---

## 1. The picture today (code-verified, 7 Nov 2026)

### 1.1 What exists end-to-end (backend **and** a wired Peacock Night screen)

| Surface | What works | Caveats |
|---|---|---|
| **Public website** (`apps/web`, Next.js) | 8 pages (home, how-it-works, services, destinations, about, contact, privacy, terms). Contact → `/crm/enquiries` (real lead capture); how-it-works reads `/crm/plans` for the price. | Legal copy is placeholder; all photos are `PhotoPlaceholder`; bot-check is a dev stub (Turnstile deferred); no sitemap/robots/OG. Marketing-only — hosts **no** product surface. |
| **Flow 1 — Lead → demo → subscription** | Web enquiry → mobile Sales pipeline (`/leads`, `/leads/[id]`) → convert + invite → client activation + plan purchase (`/portal`, `CP-11`). | Sign-in is **dev-login only**; payment completion is a **dev stub** ("Complete payment (demo)"); demo banner (`DM-01`) minimal; plans page (`PUB-07`) missing. |
| **Flow 2 — Hotel discovery & assistance** | The most complete flow. **Client:** search, detail, saved, request assistance, enquiry tracker, proposal decision, site-visit feedback, booking-milestones (`/hotels*`, `/portal/requests*`). **Staff:** enquiry queue, detail, proposal editor with site-visit + milestone creation (`/enquiries*`). | Hotel photos are placeholders (no media pipeline); `/hotels/compare` endpoint exists but has no screen/hook here (reconcile vs. memory of PR #53/#54). |

**The product portal reaches the browser as the Expo web export of `apps/mobile`** on its own origin — *not* inside `apps/web`. So "the screens we show" for everything built so far = Expo (`apps/mobile`) work, plus `packages/ui`. `apps/web` is essentially done as the public funnel.

### 1.2 Backend is READY, frontend is MISSING — the Horizon-1 targets

These are built on the server, with Zod contracts in `packages/core`, but have **zero screens** (most have no api-client hook either). This is almost pure UI work.

| # | Area | Backend (routes) | Frontend state | Wireframe |
|---|---|---|---|---|
| A | **Admin console** | staff-users, roles+capabilities, permission-sets, audit-log (list/export), config editor, notifications inbox (`useNotifications` hook already exists), client-logins | **0 screens, ~30 endpoints.** The single largest buildable-now gap. | TW-90–96 |
| B | **Staff hotel catalogue** | hotels CRUD + destinations + rooms/venues/contacts; bulk **import**; internal **rate cards** + verifications; previous-wedding **references** (consent-gated) | **0 screens, ~18 endpoints, 0 hooks.** | TW-20–25 |
| C | **Media pipeline** | full staff media CRUD + signed upload (AV scan, metadata strip) + signed download | **0 screens, 0 hooks.** Images only surface read-only inside hotel detail → that is why hotels show placeholders. | — |
| D | **Sales/Finance CRM completion** | accounts list/detail; staff subscriptions (create, **record manual payment**, list, detail); lead create/edit/assign/merge/activity + **lead funnel report**; service-agreement detail/update-terms | Partial: convert, lead reads, client purchase, agreement create/transition are wired; the rest is **0 screens**. | TW-12–14 |
| E | **Real authentication** | `/auth/activate` (invite activation) exists; production path is **Cognito** (ships with hosting) | Dev-login only; **no** OTP sign-in (AUTH-06), invite-acceptance, reset, access-help, or authenticator enrolment; session not persisted (reload logs out). | AUTH-02…06 |
| F | **Real payment** | Razorpay merged (webhook, orders, idempotent activation) | App uses a dev stub; **no** real hosted-checkout. Blocks a believable purchase and first revenue. | CP-11 |
| G | **Small wiring gaps** | `GET /hotels/destinations`, `/hotels/compare`; enquiry `/preview`, staff-field `PATCH`, `/events`; GET-single + PATCH for staff proposals/site-visits/milestones; notifications inbox | Endpoints live, no hook/screen. Fold into the feature each belongs to. | — |

### 1.3 Backend is NOT ready — the Horizon-2 product (engaged wedding)

The locked **My Wedding** / **Approvals** tabs and `TW-30–84`. Needs backend first.

| Flow | Feature | Notes |
|---|---|---|
| 3 | Wedding projects / members / functions | **Keystone.** No `wedding_projects` module. The already-built *client-logins* API is project-scoped and currently **uncallable** because projects don't exist. |
| 4 | Vendors (options, proposals, selection) | No vendors module. |
| 5 | Creative approvals (designs, menus, invitations) | No module. |
| 6 | Client requests + live chat | No `client_requests`/conversations module (note: today's `/portal/requests` is hotel-assistance, a different thing). |
| 7 | Invitations & RSVP + **guest RSVP portal** (GR-01–09) | No guests/invitations/rsvp module; 0 guest screens. |
| 8 | Rooms, travel & transport | No module. |
| 9 | Live execution (run-of-show, readiness, incidents, offline) | Only the `/field-notes` **offline spike** exists — the template for the real thing. |
| 10 | Closure & archive | Needs projects + final accounts. |

### 1.4 Design-system readiness (`packages/ui`)

A mature, cross-platform, four-colour kit: **39 component folders (~44 components), 36 stories, 50 test files**, a working `Gallery` at `/gallery`, and `packages/tokens` as the single source of values. **Complete for the screens built so far.** But the Horizon-1 staff screens (tables, forms, uploads, dialogs) and all Horizon-2 screens need primitives that **do not exist yet**. Building them is the enabling first step (see H1.0). Note: every new shared primitive must ship **both** a React Native version and a web style recipe (`@ampm/ui/styles`) — roughly **2× the cost** of a single-platform component.

---

## 2. How we build (the method)

Your proposed cadence — *build the backend of a feature, wire it, then build its frontend, then the next feature* — **is already the house method** (`docs/CONTRIBUTING.md`, standards §2.8). A feature is one vertical slice that ends in something demoable:

> Zod contract → permission-matrix row → Prisma model → controller/service/repository → **api-client hook (the wiring) → screen → tests**, finished with `pnpm check` green.

Two slice types follow from the two horizons:

- **Frontend-completion slice (Horizon 1):** backend + contract already exist → do **hook → screen → tests** only. Fast.
- **Full-stack slice (Horizon 2):** the full path, backend-first.

**Principle:** build a *thin vertical per feature that ends in a demo*, rather than all backend for everything and then all frontend. One slice merges green, becomes demoable on the live box, then the next begins. One stream of work at a time (one developer).

---

## 3. Horizon 1 — Close the gap (frontend for backend we already have)

Ordered. H1.0 is enabling groundwork; H1.A/H1.B are cross-cutting unblocks gated on AMPM's provider onboarding; H1.1–H1.4 are feature screens.

### H1.0 — UI-kit expansion (enabling; do first) · size **L**
Build the primitives nearly everything below needs, each as RN + web recipe, in the Gallery with tests. **Blocking wave:** `DataTable`/`DataGrid` (sortable, numeric/MoneyText align, sticky header, row-select, pagination), `Select`/`Menu`/`Dropdown` + overflow menu, `Date`/`Calendar`/range picker, `FilePicker` + `Uploader` (signed-URL, AV, progress — per `security.md`), centred `Dialog`/`AlertDialog` + confirm, `Drawer`/side-panel (admin ≥1200 inspector). **Second wave (as features need them):** charts/sparkline + trend, Kanban board, wizard controller, `RadioGroup`, number stepper, slider, accordion, tooltip/popover, map, signature, breadcrumbs, star rating, checklist/cue-sheet.

### H1.A — Real authentication (cross-cutting; gated on Cognito) · size **M**
OTP sign-in (AUTH-06), invite-acceptance screen (wire `/auth/activate`), session persistence, password reset / access help / authenticator enrolment. Required for go-live regardless. *Dependency: AMPM's Cognito/provider onboarding.*

### H1.B — Real payment (cross-cutting; gated on Razorpay) · size **M**
Replace the dev stub with real Razorpay hosted-checkout in the portal; confirm via the existing webhook→activation path. Unlocks a believable purchase and first revenue. *Dependency: AMPM's Razorpay onboarding + keys.*

### H1.1 — Make the hotel flow real: catalogue + media · size **L** · *highest demo leverage*
Staff hotel directory (DataTable), hotel editor (rooms/venues/contacts), destinations, **bulk import**, internal **rate cards** + verifications (`InternalPanel`), consent-gated **references**, and the **media pipeline** (upload real photos). **Why first:** it turns the best-built flow (Flow 2) from placeholder photos into something that looks real to a client, and it is how Eva's team loads the ~200 hotels (a build-plan week-20 dependency). No external dependency — pure build. Also wire gap-G hooks (`destinations`, `compare`).

### H1.2 — Admin console · size **L**
staff-users (list/detail/invite/suspend), roles + capabilities editor, permission-sets, audit-log viewer + export, configuration editor, **notifications inbox + bell** (hook already exists — a quick early win). Lets AMPM actually administer the platform and its team. *(Client-logins management waits for Horizon-2 projects — it is project-scoped.)*

### H1.3 — Complete Sales + Finance · size **M**
Client accounts list/detail; staff subscription management + **Finance record-manual-payment**; lead create/edit/assign/merge/activity + **lead funnel report**; service-agreement detail/update-terms. Rounds out the staff workspace that exists today.

### H1.4 — Demo & funnel polish · size **S–M**
`DM-01` persistent demo banner/landing (expiry, curated hotels, "Available on subscription" masking), `PUB-07` plans page, real legal copy, Turnstile, marketing photos. Completes the prospect-facing story.

---

## 4. Horizon 2 — Feature-complete cadence (backend-first)

Each is a full-stack slice. Order follows dependency and the original build-plan phases 2→4.

1. **Module E — Wedding projects** (Flow 3). *Keystone:* unlocks the My Wedding/Approvals shell, project-scoped client-logins, and every flow below. Project create/dashboard/members/functions.
2. **Vendors** (Flow 4) — options, proposals, selection.
3. **Creative approvals** (Flow 5) — designs, menus, invitations; approvals inbox.
4. **Client requests + live chat** (Flow 6) — plus the real chat service (replaces the website chat-pill stub).
5. **Invitations & RSVP + guest portal** (Flow 7) — the guest RSVP wizard (GR-01–09), tokenised access, no sign-in.
6. **Rooms, travel & transport** (Flow 8).
7. **Live execution** (Flow 9) — run-of-show, readiness, incidents; the `/field-notes` offline spike becomes the real offline operations screens.
8. **Closure & archive** (Flow 10).

---

## 5. Dependencies, risks & open calls

- **Primitive tax:** H1.0 is real work (RN + web each). It front-loads cost but every later screen is faster for it — this is why it goes first.
- **Auth & payment are partly infra:** H1.A/H1.B need AMPM's Cognito and Razorpay onboarding (build-plan weeks 0–2). Start them the moment those are ready; don't let them block H1.1 (which needs nothing external).
- **Client-logins ordering:** its backend exists but is uncallable until Horizon-2 projects land — so client-login management belongs *after* Module E, not in H1.2.
- **Go-live shape:** D-decision (26 Oct) is a single launch of the whole first release. The build plan offers a lever — *discovery live after Phase 1* — for first revenue ~month 11 instead of ~24; Horizon 1 + H1.A/H1.B is exactly that lever's scope.
- **Open design call:** D-077 midnight-on-peacock contrast (4.25:1) is still unresolved — a one-line token change if AMPM wants the 4.53:1 variant.
- **Reconcile:** `/hotels/compare` has a backend endpoint but no screen/hook in this tree, though memory records a compare PR — confirm whether it needs porting.

---

## 6. Recommended first move

Start **H1.0 (core primitives)** immediately — it is unavoidable groundwork — and make **H1.1 (hotel catalogue + media)** the first feature workstream. Rationale: highest demo leverage (makes the strongest existing flow show real hotels and real photos), no external dependency (unlike auth/payment), and it is a build-plan prerequisite anyway (Eva loads the hotel database through it). Run H1.A/H1.B in parallel as soon as Cognito and Razorpay onboarding are done.

Alternatives if your priority differs: lead with **H1.2 (admin console)** if "operate the platform" matters most, or with **H1.A/H1.B (auth + payment)** if the next demo must look production-real.
