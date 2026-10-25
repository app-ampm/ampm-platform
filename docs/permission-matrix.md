# AMPM Platform — Role and Permission Matrix

**Status:** DRAFT v0.2, 25 October 2026. AMPM's decisions of 25 October applied where they change the matrix (§0a) and stamped on every assumption in §0. Not yet signed off.
**Companions:** [requirements-audit.md](requirements-audit.md) (findings and Q numbers), [data-model.md](data-model.md) (tables referenced here, assumptions A-1 to A-30).
**Source of truth being extended:** AMPM Developer Technical Specification v1.0 §6 (roles), §6.1 (client versus internal visibility), §7 (statuses), §9 (exports) and the security note in §4.

The governing rule, from SPEC §6.1: *backend APIs and file storage must enforce access; hiding frontend controls is not sufficient.* Every cell in this matrix is a server-side check, applied to API requests, file links, exports and notifications alike.

---

## 0. Assumptions used

Assumptions A-n are defined in data-model.md §0. The permission-specific ones below extend them.

| ID | Audit ref | Assumption adopted in this draft | If AMPM decides otherwise |
|---|---|---|---|
| P-1 | Q6, A-6 | The nine staff roles from SPEC §6 are global roles. Five of them (Project Manager, Creative, Vendor Coordinator, RSVP, Hospitality) act only on weddings they are members of; four (Super Admin, Sales, Hotel team, Finance) act across all records in their module. **AMPM (2026-10-25): Partly decided. Departments confirmed; final roles and cost access to be confirmed.** | Changing a role's reach changes its scope qualifier in the matrix, nothing else. |
| P-2 | Q5, A-5 | Three client roles per wedding: Owner (full client access, approves, sees finance), Approver (approves, sees finance only if flagged), Viewer (reads shared information, no finance, no guest list). **AMPM (2026-10-25): Changed. Two family representatives with equal rights replace the owner, approver and viewer roles.** | Fewer roles collapse columns; more roles add columns. |
| P-3 | Q4, A-4 | Four finance visibility tiers: client-facing amounts; internal cost and margin; vendor and hotel contracts, quotes and received invoices; bank details. Each tier has its own permission key. **AMPM (2026-10-25): Confirmed. Internal commercial data never reaches clients; internal access restricted to authorised personnel.** | A transparent fee model removes the second tier's secrecy but keeps the keys. |
| P-4 | Q7, A-7 | A guest token grants access to one family group only: read its members, update their attendance and dietary preferences, add members up to the group's allowance, submit travel details and support requests. Nothing outside the group is reachable. **AMPM (2026-10-25): Changed. Links per side or combined; guests identify themselves; no editing after submission; no access to other households.** | A shared wedding link would require a self-identification step before any of this. |
| P-5 | Q8, A-8 | Identity documents are readable only by RSVP staff holding an explicit `guests.identity_documents.read` permission on that wedding and by Hospitality staff at check-in. Super Admin has audited break-glass read. Clients, Finance, Sales, Creative and Vendor Coordinators never see them. Exports never include them. **AMPM (2026-10-25): Confirmed. Identity documents restricted to authorised staff; break-glass not addressed.** | Removing break-glass makes Super Admin equal to the other excluded roles. |
| P-6 | Q13, A-13 | Staff sign in with email, password and an authenticator app. Clients sign in with email and password with optional phone OTP. Guests never sign in; they hold a token. Demo prospects sign in like clients to a demo account. **AMPM (2026-10-25): Changed. Mobile OTP for prospects and clients; staff method to be finalised.** | Phone-OTP-only for clients changes the sign-in step, not the matrix. |
| P-7 | Q3, A-28 | A Demo Prospect sees a curated subset of real hotels with commercial fields masked, one sample wedding read-only, and can save hotels and submit an enquiry that routes to Sales rather than to the Hotel team. **AMPM (2026-10-25): Changed. Demo users see a limited set of hotels with indicative prices, not masked prices.** | Invented sample hotels instead of masked real ones changes the data, not the permissions. |
| P-8 | Q10 | Readiness exceptions (letting a function go live with a required check unmet) may be authorised by the Project Manager of that wedding or by Super Admin. **AMPM (2026-10-25): Changed. Only Eva's authorised personnel may authorise exceptions; the authority is configurable but the policy names Eva.** | AMPM may restrict this to Super Admin. |
| P-9 | Q6 | Decisions that belong to the client (approvals, vendor selection) can be recorded on the client's behalf by the Project Manager or Super Admin only with an evidence document attached; the audit log shows who recorded it. **AMPM (2026-10-25): Confirmed. On-behalf decisions allowed with a note or supporting record.** | AMPM may forbid on-behalf recording entirely. |
| P-10 | Q17 | Exports never include SENSITIVE or identity fields. Exports containing internal cost and margin are limited to Finance and Super Admin. Every export is audited with its filter and row count. **AMPM (2026-10-25): Confirmed. Exports and APIs must never expose internal commercial data; stands.** | None structural. |
| P-11 | Q22, A-22 | Vendors and hotels have no principal type. **AMPM (2026-10-25): Confirmed. No vendor principal.** | A vendor portal adds a principal with read access to its own assignments and deliverables only. |

---

## 0a. Changes from AMPM's decisions (25 October 2026)

| Decision | Change in this matrix |
|---|---|
| Q5 only two family representatives, one per side, with equal rights | The client roles Owner, Approver and Viewer are replaced by one role, **CR** (client representative). §6 is rewritten with a single CR column. Whether the two share a login or hold separate accounts on the same wedding is open; separate accounts are recommended and assumed here, so that approvals carry the representative's name. |
| Q7 guests cannot edit after submission; representatives see summaries and cannot edit the list | §6 guest rows become read-only for CR; corrections route to the RSVP team (TW-53, TW-57). Guest links are per side or combined (P-4 changed), so GU access is bound to the side link and the household the guest identified. |
| Q10 only Eva's authorised personnel may approve exceptions | Readiness and closure exceptions are authorised by SA only (P-8 changed); the Project Manager may request, not authorise. The authority stays configurable. |
| Q4 internal commercial data never reaches clients; the wedding fee is set outside the app; milestone payments not online in the first release | Finance tiers unchanged (P-3 confirmed). The CR finance rows are marked "to confirm" because AMPM has not said which client-facing amounts the wedding portal shows; online milestone payment is removed from the first release. |
| Q6 department-based access | Unchanged in principle: the assigned-project scoping (a) is the department boundary. Final roles and cost access are still to be confirmed; the Finance, Sales and Creative roles stay until AMPM's staff structure says otherwise. |
| Q3 and Q13 demo after mobile OTP, with indicative prices | DP sees a configured demo set with indicative prices (P-7 changed); CR and DP sign in with mobile OTP (P-6 changed). |
| Q20 live chat | New rows for conversations and messages in §5.9 and §6. |
| Q8 and Q17 no automatic deletion | Retention jobs propose deletions; SA approves (§8). |
| Q23 three months of read-only access, archive on approval | §3 and §7 updated: the window is three months; archiving is an SA action. |
| Q12 no website editing | The CMS rows in §5.15 are dormant. |

## 1. Authorisation model

Access is decided in seven layers, in this order. A request must pass every applicable layer.

1. **Principal type.** Who is calling: a staff user, a client user, a demo user, a guest token or the system (scheduled jobs and webhooks). Principal type is fixed per login; a staff user is never also a client user.
2. **Global role** (staff only). Roles map to permission keys (`roles`, `permissions`, `role_permissions`). A user may hold several roles; permissions are the union.
3. **Project scope.** Roles marked *assigned* reach a wedding only through an active `project_members` row. Client users reach a wedding only through their membership and never see another wedding, even on the same account, unless they are members of it too.
4. **Entitlement** (client principals only). The modules a client may use come from their subscription, service agreements and project memberships combined (§3). Entitlement is computed per request and cached for at most five minutes.
5. **Record visibility.** A record is reachable when its owning record is reachable and, where it has one, its `visibility` or `client_visible` value admits the principal. A file attached to a proposal is visible exactly when the proposal is.
6. **Field visibility class** (§4). Each field belongs to a class; the API serialises a separate response model per class set, so restricted fields are never sent and then hidden.
7. **Action.** Create, read, update, delete, approve, share, export, as the matrix states.

Three consequences the implementation must honour:

- **Separate response models.** One endpoint, several serialisers chosen by principal and permission. Never one model with fields blanked out in the client.
- **Denial is silent about existence.** A client asking for a record they cannot see receives the same response as for a record that does not exist (SPEC §12 URL and API tampering test).
- **Files follow records.** Download links are short-lived signed URLs minted only after the record check passes (`document_access_links`).

---

## 2. Roles and principals

| Code | Role or principal | Source | Reach |
|---|---|---|---|
| SA | Super Admin | SPEC §6 | Everything; the only role that configures roles, packages and statuses. Restricted reads are audited. |
| SM | Sales / Relationship Manager | SPEC §6 | Leads, demos, accounts, subscriptions, service agreements, website content. All records. |
| HT | Hotel / Destination Team | SPEC §6 | Hotel database, verification, enquiries, site visits, hotel proposals, booking milestones, room blocks. All records. |
| PM | Wedding Project Manager | SPEC §6 | Assigned weddings: everything inside the project, including client-facing finance and internal cost of that project. |
| CD | Creative / Design Team | SPEC §6 | Assigned weddings: design items, versions, invitations, programme theme fields. |
| VC | Vendor Coordinator | SPEC §6 | Vendor master across all records; assignments, proposals, quotes, deliverables, production on any project. |
| RG | RSVP / Guest Team | SPEC §6 | Assigned weddings: guests, family groups, invitations distribution, attendance, tokens, travel, guest requests, identity documents with explicit permission. |
| HL | Hospitality / Logistics Team | SPEC §6 | Assigned weddings: rooming, transport, departures, lost and found, run-of-show, readiness items, incidents. |
| FA | Finance / Accounts | SPEC §6 | Budgets, cost, quotes, contracts, invoices, payments, milestones, final accounts, bank details. All records. |
| CR | Client representative | Q5 (replaces the A-5 roles) | Own wedding: one representative for the bride's side and one for the groom's side, with equal rights: all client-visible information, decisions, requests and chat; approved guest summaries, not the guest list; finance per Q4 once confirmed. Separate authenticated accounts assumed. |
| GU | Guest (token) | SPEC §6 | One family group's RSVP, travel and support, through a tokenised link. |
| DP | Demo Prospect | WHY stage 2 | Demo account: masked hotel discovery and one sample wedding. |
| SYS | System | — | Scheduled jobs, webhooks and automation listed in §8. |

A staff user with no project membership and only the Creative role, for example, can sign in and see nothing but their own tasks and notifications until a Project Manager adds them to a wedding. This is also AMPM's department rule: a department manager on a phone sees only the sections of the weddings they are assigned to.

---

## 3. Client entitlement resolution (audit GP-1)

How a client principal's module set is derived from `subscriptions`, `service_agreements` and `project_members`. Rows are account states; cells say what the client can reach. "Role rules" means the CO/CA/CV columns of §6 then apply.

| Account state | Hotel discovery (search, profiles, verified rate cards) | Saved hotels and compare | Hotel assistance (requests, enquiry tracking, proposals) | Wedding workspace (dashboard, functions, designs, vendors, approvals, documents, requests) | Client finance (budget, invoices, payments, milestones) | Guests and RSVP progress | Menus | Support questions |
|---|---|---|---|---|---|---|---|---|
| Demo account (`is_demo`), reached after mobile OTP | Read the configured demo set only: up to three locations, one or two hotels each, with indicative prices and street view (Q3) | Create and read, demo data | Create, but the request becomes a Sales lead activity; may request a Zoom call | Read one sample wedding | Read sample | Read sample | Read sample | Chat and requests routed to Sales |
| Trial subscription | Not used: AMPM decided the demo serves this purpose (Q3); the status stays available in configuration | | | | | | | |
| Active discovery subscription, no project | Read | Create and read | Create and read status | — | — | — | — | Create |
| Expired, cancelled or suspended subscription, no project | Saved hotel names only; profiles and rates hidden | Read | Read status of existing enquiries only | — | Read own invoices and payments | — | — | Create |
| Active hotel-assistance agreement, no subscription | Read the hotels named in that agreement's enquiries only | Read | Create and read | — | Read invoices for that service | — | — | Create |
| Active wedding project (member), any subscription state | Read hotels linked to the project; full search only with an active subscription | Create and read | Create and read | Read and act (both representatives) | Contents to confirm with AMPM (Q4); internal data never | Approved summaries only (Q7) | Read and approve | Create; live chat |
| Project on hold | As active, read-only; approvals paused | Read | Read | Read-only | Read-only | Read-only | Read-only | Create |
| Project closed, within the three-month window (Q23) | As above, read-only | Read | Read | Read-only | Read-only | Read-only | Read-only | Create, support type only |
| After the window, archived on AMPM's approval (Q23) | — | — | — | — (membership set to removed) | — | — | — | Request documents from AMPM outside the portal |
| Account suspended | Sign-in refused | | | | | | | |

Rules that apply to every row:

- Entitlement changes never delete or hide records from AMPM staff; they only change what the client can reach (WHY §4, SPEC §7).
- A downgrade is always read-only access first, removal later; the client is told what changed and when.
- Payment confirmation activates only the purchased entitlement (SPEC §8): a subscription payment never grants wedding workspace access, and a service agreement never grants hotel search.

---

## 4. Field visibility classes

Every column in data-model.md belongs to exactly one class. The class decides which serialiser includes it and which permission key unlocks it.

| Class | What it contains (examples) | Readable by | Writable by |
|---|---|---|---|
| PUBLIC | `cms_pages`, published `cms_showcase_items`, `destinations` with `public_visible`, `hotels` with `public_showcase`: name, destination, hero media only | Anyone, including unauthenticated website visitors | SA, SM (content); HT (hotel showcase flag) |
| CLIENT | Fields marked CLIENT in the data model and records flagged `client_visible` or shared: hotel profiles, rooms, venues, verified rate items; enquiry status and client notes; proposals' client amounts; budget estimate, approved and actual amounts; client invoices and inbound payments; shared designs, menus, programme, invitations; vendor names and client descriptions; own guest list standard fields; attendance; own rooming and travel; shared documents; tasks flagged client-visible; request responses | Client principals of that wedding per §6; all staff with module access | Staff per §5; clients only through the actions in §6 |
| INTERNAL | Everything not otherwise classed: unshared drafts, enquiry events not flagged internal-only, run-of-show, readiness items, staff assignments, tasks, vendor assignments' internal status, verification records, import jobs | Staff with module access per §5 | Staff per §5 |
| RESTRICTED-NOTES | `internal_notes` on hotels, vendors, projects, functions, enquiries, family groups, guests; `internal_rating`; `hotel_enquiry_events` with `internal_only`; `comments` with `is_internal`; `site_visits.outcome_internal`; incidents by default | Staff with module access per §5; never client, guest or demo principals | Same |
| RESTRICTED-FINANCE | `budget_lines.internal_cost_estimate` and `internal_cost_actual`; `vendor_proposals.internal_cost`; `hotel_proposals.internal_total_amount`; `room_blocks.internal_rate_amount`; `artist_bookings.fee_internal`; `vendor_quotes` (whole table); `cost_entries` (whole table); `project_final_accounts` cost and margin totals; `invoices` with direction received; `contracts` with party vendor or hotel; outbound `payments` | SA, FA on all records; PM on assigned projects; VC for vendor-side values; HT for hotel-side values | FA, SA; PM (estimates on assigned projects); VC (vendor quotes and vendor cost); HT (hotel internal amounts) |
| RESTRICTED-CONTACT | `hotel_contacts` (whole table); `vendors` contact name, phone, email; `external_venues` contacts; `vehicles.driver_phone` | SA; HT (hotels); VC (vendors); PM on assigned projects; HL on assigned projects for venues, drivers and hotel contacts; SM for hotels | HT, VC, PM, HL per resource |
| RESTRICTED-BANK | `vendors.bank_details_document_id` and the document behind it; `client_accounts` billing fields beyond name | SA, FA | FA, SA |
| SENSITIVE-GUEST | `guests.allergies_text`, `guests.accessibility_needs`, `guest_support_requests` of type dietary, accessibility or complaint | RG, HL and PM on assigned projects; SA; Client Owner for their own wedding; the guest for their own row | RG on assigned projects; the guest for their own row; CO |
| RESTRICTED-IDENTITY | `identity_documents` (whole table) and the files behind it | RG with `guests.identity_documents.read` on assigned projects; HL at check-in on assigned projects; SA break-glass (audited and alerted); the guest for their own document's existence and status only | RG; the guest uploading their own |
| SECRET | `password_hash`, `mfa_secret_ref`, `token_hash` columns, `storage_key` columns | SYS only; never serialised | SYS only |

Exports (SPEC §9) include PUBLIC, CLIENT and INTERNAL fields subject to the matrix, include RESTRICTED-FINANCE only for FA and SA, and never include SENSITIVE-GUEST, RESTRICTED-IDENTITY, RESTRICTED-BANK or SECRET (P-10).

---

## 5. Permission matrix: staff roles

Legend: **C** create, **R** read, **U** update, **D** delete (soft), **A** approve, decide or authorise, **S** share with the client (set client visibility), **X** export. A trailing **(a)** limits the actions to weddings the user is a member of; **(o)** limits them to records the user created or owns. **—** means no access. Where a resource name says "client fields" or "internal fields", the row covers only that visibility class.

### 5.1 Administration

| Resource | SA | SM | HT | PM | CD | VC | RG | HL | FA |
|---|---|---|---|---|---|---|---|---|---|
| Staff users and global roles | CRUD | R | R | R | R | R | R | R | R |
| Client user logins (invite, reset, disable) | CRUD | CRU | — | CRU (a) | — | — | — | — | — |
| Roles and permissions | CRUD | R | R | R | R | R | R | R | R |
| Configurations (thresholds, labels, templates, escalation rules) | CRU | — | — | — | — | — | — | — | R |
| Audit log | RX | — | — | R (a) | — | — | — | — | R finance entities |
| Import jobs | CR | — | CR hotels | CR (a) guests | — | CR vendors | CR (a) guests | — | — |
| Notifications log | R | R (o) | R (o) | R (o) | R (o) | R (o) | R (o) | R (o) | R (o) |

### 5.2 CRM and commercial

| Resource | SA | SM | HT | PM | CD | VC | RG | HL | FA |
|---|---|---|---|---|---|---|---|---|---|
| Leads and lead activities | CRUD | CRUD | R | R | — | — | — | — | — |
| Client accounts and contacts | CRUD | CRUD | R | RU (a) | — | — | R (a) | R (a) | RU billing |
| Plans and plan modules | CRUD | R | — | — | — | — | — | — | R |
| Subscriptions | CRUD | CRU | R | — | — | — | — | — | RU status |
| Service agreements | CRUD | CRU | CRU hotel services | RU (a) | — | — | — | — | R |
| Payment milestones | CRUD | R | — | R (a) | — | — | — | — | CRUD |
| Payments inbound from clients | CRUD | R | — | R (a) | — | — | — | — | CRUD |
| Payments outbound to vendors and hotels | CRUD | — | R | R (a) | — | R (a) | — | — | CRUD |

### 5.3 Hotels

| Resource | SA | SM | HT | PM | CD | VC | RG | HL | FA |
|---|---|---|---|---|---|---|---|---|---|
| Destinations | CRUD | R | CRUD | R | R | R | R | R | R |
| Hotel profiles, client fields | CRUD | R | CRUD | R | R | R | R | R | R |
| Hotel internal rating and notes | RU | R | RU | R | — | — | — | — | — |
| Hotel contacts | CRUD | R | CRUD | R | — | — | — | R (a) | — |
| Room categories and venues | CRUD | R | CRUD | R | R | R | R | R | R |
| Rate cards and rate items | CRUD | R | CRUD | R | — | — | — | — | R |
| Verifications | CRU | R | CRU | R | R | R | R | R | R |
| Hotel media and rights status | CRUDS | RU rights | CRUDS | R | R | R | — | — | — |
| Wedding references | CRUD | R | CRUD | R | — | — | — | — | — |
| Saved hotels (created by clients) | R | R | R | R (a) | — | — | — | — | — |

### 5.4 Hotel consultancy

| Resource | SA | SM | HT | PM | CD | VC | RG | HL | FA |
|---|---|---|---|---|---|---|---|---|---|
| Hotel enquiries, client fields | CRUD | CR | CRU | CRU (a) | — | — | — | — | R |
| Enquiry internal notes and internal-only events | CRU | R | CRU | CR (a) | — | — | — | — | — |
| Site visits | CRU | R | CRU | CRU (a) | — | — | — | — | — |
| Hotel proposals, client amounts | CRUS | R | CRUS | RUS (a) | — | — | — | — | R |
| Hotel proposals, internal amounts | RU | — | RU | R (a) | — | — | — | — | R |
| Booking milestones | CRU | R | CRU | CRU (a) | — | — | — | — | RU |

### 5.5 Wedding projects

| Resource | SA | SM | HT | PM | CD | VC | RG | HL | FA |
|---|---|---|---|---|---|---|---|---|---|
| Wedding projects (create, edit, status) | CRUD | CR | R | CRU (a) | R (a) | R (a) | R (a) | R (a) | R |
| Project internal notes | RU | — | — | RU (a) | — | — | — | — | R |
| Project hotels and external venues | CRU | — | CRU | CRU (a) | R (a) | R (a) | R (a) | RU (a) | — |
| Project members, staff | CRUD | — | — | CRUD (a) | R (a) | R (a) | R (a) | R (a) | — |
| Project members, client users and their flags | CRUD | CRU | — | CRUD (a) | — | — | — | — | — |

### 5.6 Functions, programme and run-of-show

| Resource | SA | SM | HT | PM | CD | VC | RG | HL | FA |
|---|---|---|---|---|---|---|---|---|---|
| Functions | CRUD | R | R (a) | CRUD (a) | RU (a) theme, dress code | R (a) | R (a) | RU (a) logistics notes | R |
| Programme items (shared schedule) | CRUDS | — | — | CRUDS (a) | R (a) | R (a) | R (a) | CRU (a) | — |
| Run-of-show items | CRUD | — | — | CRUD (a) | R (a) | RU (a) vendor cues | R (a) | CRU (a) | — |
| Readiness checklist items | CRU | — | — | CRU (a) | RU (a) | RU (a) | R (a) | CRU (a) | — |
| Readiness exceptions (Q10: Eva's authorised personnel only) | A | — | — | request only | — | — | — | — | — |
| Function status (planned, confirmed, cancelled) | U | — | — | U (a) | — | — | — | — | — |

### 5.7 Budget and finance

| Resource | SA | SM | HT | PM | CD | VC | RG | HL | FA |
|---|---|---|---|---|---|---|---|---|---|
| Budget categories | CRUD | R | R | R | R | R | R | R | CRUD |
| Budget lines, client-facing amounts | CRUDS | — | RU hotel lines | CRUS (a) | R (a) | RU (a) vendor lines | — | R (a) | CRUS |
| Budget lines, internal cost | RU | — | RU hotel lines | RU (a) | — | RU (a) vendor lines | — | — | RU |
| Cost entries | CRUD | — | CR hotel | CR (a) | — | CR (a) | — | — | CRUD |
| Vendor quotes | CRUD | — | — | R (a) | — | CRUD | — | — | R |
| Contracts with the client | CRUS | R | — | RUS (a) | — | — | — | — | CRUS |
| Contracts with vendors and hotels | CRU | — | CRU hotel | R (a) | — | CRU vendor | — | — | RU |
| Invoices issued to the client | CRUS | R | — | R (a) | — | — | — | — | CRUS |
| Invoices received from vendors and hotels | CRU | — | CR hotel | R (a) | — | CR (a) vendor | — | — | CRU |
| Final accounts | CRUA | — | — | RU (a) | — | — | — | — | CRUA |

### 5.8 Vendors, artists and production

| Resource | SA | SM | HT | PM | CD | VC | RG | HL | FA |
|---|---|---|---|---|---|---|---|---|---|
| Vendor categories | CRUD | R | R | R | R | CRU | R | R | R |
| Vendor profiles, client fields | CRUD | R | — | R | R | CRUD | — | R | R |
| Vendor contacts | RU | — | — | R (a) | — | RU | — | R (a) | — |
| Vendor internal rating and notes | RU | — | — | R (a) | — | RU | — | — | — |
| Vendor bank details | R | — | — | — | — | RU | — | — | RU |
| Vendor availability | CRU | — | — | R | — | CRU | — | — | — |
| Vendor assignments and client decisions | CRUD | — | — | CRU (a) | R (a) | CRU | — | R (a) | R |
| Vendor proposals, client amounts | CRUS | — | — | RUS (a) | R (a) | CRUS | — | — | R |
| Vendor proposals, internal cost | RU | — | — | R (a) | — | RU | — | — | R |
| Vendor deliverables | CRUD | — | — | CRUA (a) | R (a) | CRU | — | U (a) mark delivered | — |
| Artist bookings | CRUD | — | — | CRU (a) | R (a) | CRU | — | R (a) | — |
| Artist fee, internal | RU | — | — | R (a) | — | RU | — | — | R |
| Production items | CRUD | — | — | CRU (a) | R (a) | CRU | — | CRU (a) | — |

### 5.9 Creative, approvals and client requests

| Resource | SA | SM | HT | PM | CD | VC | RG | HL | FA |
|---|---|---|---|---|---|---|---|---|---|
| Design items and versions | CRUDS | — | — | CRUS (a) | CRUDS (a) | R (a) | R (a) | R (a) | — |
| Comments, internal | CRUD | CR (o) UD | CR (o) UD | CR (a) UD (o) | CR (a) UD (o) | CR (a) UD (o) | CR (a) UD (o) | CR (a) UD (o) | CR (o) UD |
| Comments, client-visible replies | CRUD | — | CRU hotel threads | CRU (a) | CRU (a) design threads | CRU (a) proposal threads | CRU (a) guest threads | — | CRU invoice threads |
| Client requests (questions, change requests, support) | CRUDA | R | RU hotel-related | RUA (a) | RU (a) | RU (a) | RU (a) | RU (a) | R |
| Approvals, submit for decision | CRU | — | C hotel proposals | CRU (a) | C (a) designs, invitations | C proposals | — | — | C budget lines, contracts, invoices |
| Approval decisions, on the client's behalf with evidence | A | — | — | A (a) | — | — | — | — | — |
| Live chat conversations and messages (Q20) | CRUD | CRU | CRU hotel conversations | CRU (a) | R (a) | R (a) | CRU (a) guest conversations | CRU (a) | R |

### 5.10 Guests and RSVP

| Resource | SA | SM | HT | PM | CD | VC | RG | HL | FA |
|---|---|---|---|---|---|---|---|---|---|
| Invitations and versions | CRUDS | — | — | CRUS (a) | CRU (a) | — | RU (a) | — | — |
| Invitation distribution (recipients, send) | CRU | — | — | R (a) | — | — | CRU (a) | — | — |
| Family groups and guests, standard fields | CRUD | — | — | CRU (a) | — | — | CRUD (a) | RU (a) | — |
| Guest sensitive fields (allergies, accessibility) | R | — | — | R (a) | — | — | RU (a) | R (a) | — |
| Guest internal notes | RU | — | — | R (a) | — | — | CRU (a) | R (a) | — |
| Identity documents | R break-glass | — | — | — | — | — | CRU (a) with explicit grant | R (a) check-in only | — |
| Attendance | CRU | — | — | RU (a) | — | — | CRU (a) | R (a) | — |
| RSVP tokens (issue, revoke) | CRU | — | — | CRU (a) | — | — | CRU (a) | — | — |
| RSVP responses (submission log) | R | — | — | R (a) | — | — | CR (a) | — | — |
| Guest support requests | CRU | — | — | RU (a) | — | — | CRU (a) | CRU (a) | — |

### 5.11 Rooms, travel and transport

| Resource | SA | SM | HT | PM | CD | VC | RG | HL | FA |
|---|---|---|---|---|---|---|---|---|---|
| Room blocks, client fields | CRU | — | CRU | CRU (a) | — | — | R (a) | R (a) | R |
| Room blocks, internal rate | RU | — | RU | R (a) | — | — | — | — | R |
| Room allocations and occupants | CRUD | — | R | RU (a) | — | — | CRU (a) | CRUD (a) | — |
| Travel segments | CRU | — | — | R (a) | — | — | CRU (a) | CRU (a) | — |
| Vehicles, transfers, passengers | CRUD | — | — | RU (a) | — | R (a) transport vendor | R (a) | CRUD (a) | — |
| Guest departures | CRU | — | — | R (a) | — | — | RU (a) | CRU (a) | — |
| Lost and found | CRU | — | — | RU (a) | — | — | R (a) | CRU (a) | — |

### 5.12 Menus

| Resource | SA | SM | HT | PM | CD | VC | RG | HL | FA |
|---|---|---|---|---|---|---|---|---|---|
| Menus, versions, items | CRUDS | — | — | CRUS (a) | R (a) | CRU (a) | R (a) | R (a) | — |
| Headcounts | R | — | — | R (a) | — | R (a) | R (a) | R (a) | — |

### 5.13 Tasks, staffing and incidents

| Resource | SA | SM | HT | PM | CD | VC | RG | HL | FA |
|---|---|---|---|---|---|---|---|---|---|
| Tasks | CRUD | CRU (o) | CRU (o) | CRUD (a) | CRU (a) | CRU (a) | CRU (a) | CRU (a) | CRU (o) |
| Task dependencies | CRUD | — | — | CRUD (a) | CR (a) | CR (a) | CR (a) | CR (a) | — |
| Staff assignments | CRUD | — | — | CRUD (a) | R (o) | R (o) | R (o) | CRU (a) | — |
| Incidents (report, assign, escalate, resolve, close) | CRUD | — | — | CRUA (a) | CR (a) | CR (a) | CR (a) | CRU (a) | — |

### 5.14 Documents and media

| Resource | SA | SM | HT | PM | CD | VC | RG | HL | FA |
|---|---|---|---|---|---|---|---|---|---|
| Documents on records the role can reach | CRUD | CRU | CRU | CRUD (a) | CRU (a) | CRU | CRU (a) | CRU (a) | CRU |
| Set client visibility on a document | S | — | S hotel proposals | S (a) | S (a) designs | S proposals | — | — | S invoices, client contracts |
| Media assets | CRUD | RU rights, showcase | CRUD hotels | R | CRUD (a) designs | CRUD vendors | — | — | — |
| Expiring access links | CRUD | C (o) | C (o) | C (a) | C (a) | C (o) | C (a) | C (a) | C (o) |

### 5.15 Closure, feedback and public website

| Resource | SA | SM | HT | PM | CD | VC | RG | HL | FA |
|---|---|---|---|---|---|---|---|---|---|
| Closure checklist items | CRU | — | — | CRU (a) | — | U vendor completion | — | U (a) departures, lost and found | U final accounts |
| Close the project | A | — | — | A (a) when the checklist is complete and final accounts are approved | — | — | — | — | — |
| Archive the project after the window (Q23) | A | — | — | request only | — | — | — | — | — |
| Approve a retention deletion proposed by the retention job (Q17) | A | — | — | — | — | — | — | — | — |
| Client feedback | R | R | — | R (a) | — | — | — | — | — |
| CMS pages and showcase items | CRUD | CRU | R | R | R | R | R | R | R |

### 5.16 Reports and exports

| Report (SPEC §9) | May run | May export | Excluded from the export |
|---|---|---|---|
| Lead source and conversion funnel | SA, SM | SA, SM | — |
| Subscription status and payment history | SA, SM, FA | SA, FA | — |
| Hotel shortlist, enquiries, site visits, booking milestones | SA, HT, SM, PM (a) | SA, HT | Internal amounts unless FA or SA |
| Wedding progress, deadlines, approval tracker | SA, PM (a), SM | SA, PM (a) | — |
| Budget estimate, approved, payments, actual, variance (client view) | SA, FA, PM (a) | SA, FA, PM (a) | — |
| Internal cost and margin variance | SA, FA, PM (a) | SA, FA | — |
| Vendor selection, contracts, deliverables, payment status | SA, VC, PM (a), FA | SA, VC, FA | Bank details |
| RSVP progress and function attendance | SA, RG (a), PM (a), HL (a) | SA, RG (a), PM (a) | Sensitive guest fields |
| Rooming list and arrival or departure manifests | SA, HL (a), RG (a), PM (a) | SA, HL (a) | Identity documents; the hotel rooming list export carries names, dates and room category only and is audited |
| Function schedules, run-of-show, production readiness | SA, PM (a), HL (a), VC (a) | SA, PM (a) | — |
| Overdue tasks, incidents, final reconciliation, closure report | SA, PM (a), FA | SA, PM (a) | Margin unless FA or SA |

---

## 6. Permission matrix: client, guest and demo principals

Same legend as §5. "Own" means the wedding or account the principal belongs to; no client principal ever reaches another wedding. CR is the single client role after AMPM's decision (Q5): the two representatives have the same rights. Rows marked "to confirm" wait for AMPM's answer on client-facing finance (Q4).

| Resource | CR (both representatives) | GU | DP |
|---|---|---|---|
| Hotel discovery (per entitlement §3) | R | — | R masked |
| Saved hotels and compare | CRUD own account | — | CRUD demo |
| Hotel assistance requests | CRU own | — | C, routed to Sales |
| Enquiry status, non-internal events, site visit dates, client feedback | R, U feedback | — | R sample |
| Hotel proposals, client amounts | R, A | — | R sample |
| Wedding dashboard, overview, milestones | R | — | R sample |
| Family and decision-maker contacts (`account_contacts`) | R; changes through a request | — | — |
| Functions and shared programme | R | R invited functions only | R sample |
| Client budget: estimate, approved, actual amounts of client-visible lines | To confirm (Q4); internal data never | — | R sample masked |
| Invoices issued to the client, inbound payments, milestones | To confirm (Q4) | — | — |
| Pay a milestone online (A-2) | — (not in the first release, Q4) | — | — |
| Vendor options, client descriptions, portfolios | R | — | R sample |
| Vendor decision (interested, shortlisted, selected, declined) | U (either representative) | — | — |
| Vendor proposals, client amounts | R, A | — | R sample |
| Shared design versions | R, comment, A | — | R sample |
| Invitations and save-the-dates, shared versions | R, A | — | — |
| Family groups and guests, standard fields | R approved summaries only (Q7) | own group: R members, U attendance and dietary, C members up to allowance | — |
| Guest sensitive fields (allergies, accessibility) | — | own row: RU | — |
| Guest internal notes | — | — | — |
| Identity documents | — | own: C upload when the project requires it, R status only | — |
| Attendance and RSVP progress | R summaries | own group: RU | R sample |
| Rooming (own guests) | R summaries | own allocation once confirmed: R | — |
| Travel and transport (own guests) | R summaries | own group: CRU travel details when requested | — |
| Menus, shared versions | R, A | — | R sample |
| Client requests: questions, change requests, support | CRU own | C support request | C, routed to Sales |
| Approval decisions | A (either representative; P-9 on-behalf with a note) | — | — |
| Shared documents | R, download | R documents shared to guests | R sample |
| Upload documents (signed contract, guest list file) | C | — | — |
| Tasks flagged client-visible (pending decisions) | R | — | — |
| Notification preferences | own | — | own |
| Feedback after the wedding | C | — | — |
| Exports | To confirm (Q4); never guest data | — | — |
| Live chat (Q20) | CRU own conversations | — | C, routed to Sales |

Guest link rules (P-4 changed by Q7): a link identifies a side (bride or groom) or the whole wedding, and a guest identifies their household against the loaded list before responding; a household link remains possible. The RSVP portal never shows counts, other households, budgets or staff names. A submitted response is locked; corrections go to the RSVP team. Revoking a link invalidates it immediately; a new link is issued. Every submission writes an `rsvp_responses` snapshot.

Demo prospect rules (P-7 changed by Q3): the demo is authorised by AMPM after an enquiry, opened with mobile OTP, limited to the configured locations and hotels with indicative prices and street view, and expires after the configured duration; it is reset to the seed state on a schedule. Nothing a demo user creates is visible to any other principal except Sales.

---

## 7. Status transitions and who may make them

Status lists are the enumerations on each table in data-model.md. This section adds the allowed transitions and the principal that may trigger each one (audit GP-19). "System" means the automation in §8.

### Subscription
| From | To | Who |
|---|---|---|
| pending_payment or trial | active | System on payment succeeded; FA or SA manually, with a payment record attached |
| active | expiring | System, at `ends_at` minus the configured notice period |
| expiring | expired | System, at `ends_at` |
| active or expiring | suspended | SA, FA (non-payment, dispute) with reason |
| suspended | active | SA, FA |
| any | cancelled | SA, SM with reason; a client asks for cancellation through a client request |
| expired or cancelled | active | New subscription row; the old one is never reactivated |

### Hotel enquiry
| From | To | Who |
|---|---|---|
| draft | submitted | Either CR; SM or HT on the client's behalf |
| submitted | awaiting_hotel | HT |
| awaiting_hotel | response_received | HT |
| response_received | negotiating | HT |
| negotiating or response_received | visit_scheduled | HT, PM (a) |
| any active | proposal_received | HT |
| proposal_received | client_decision | HT, PM (a), when a proposal is shared |
| client_decision | confirmed | HT, SA, only when a booking milestone of type confirmed is done and a contract is signed |
| any | closed | HT, SA, PM (a), with an outcome |

### Wedding project
| From | To | Who |
|---|---|---|
| setup | planning | PM (a), SA |
| planning | approvals | PM (a) |
| approvals | pre_production | PM (a), when the configured key approvals are approved |
| pre_production | ready | PM (a), when every confirmed function is ready |
| ready | live | PM (a), SA |
| live | closure | PM (a) |
| closure | closed | PM (a), SA, only when the closure checklist is complete and final accounts are approved by FA |
| any | on_hold | PM (a), SA, with reason; approvals are paused |
| on_hold | previous status | PM (a), SA |
| closed | closure | SA only, audited |

### Approval
| From | To | Who |
|---|---|---|
| draft | submitted | The requester per §5.9 |
| submitted | approved, revision_requested or rejected | Either CR; PM (a) or SA on the client's behalf with a note or record (P-9 confirmed). Approved needs `required_decisions` approvals, one by default; one rejection or revision request moves it immediately |
| any | superseded | System, when a new version of the record is created |

### Vendor assignment
| From | To | Who |
|---|---|---|
| option | shortlisted or declined | Either CR as a client decision; VC or PM (a) recording the client's decision |
| shortlisted | selected | Either CR; PM (a) on the client's behalf with evidence |
| selected | contracted | VC, when the contract is signed |
| contracted | delivering | VC, PM (a) |
| delivering | completed | PM (a), when every deliverable is accepted |
| any | cancelled | PM (a), VC, SA, with reason |

### Function status and readiness
| From | To | Who |
|---|---|---|
| planned | confirmed | PM (a) |
| planned or confirmed | cancelled | PM (a), SA |
| readiness: not_started, in_progress, blocked, ready | derived | System, from the readiness checklist; an exception needs SA, Eva's authorised personnel (P-8 changed by Q10) |
| ready | live | PM (a), HL (a) on the day |
| live | completed | PM (a) |

### Incident
| From | To | Who |
|---|---|---|
| open | assigned | PM (a), HL (a), SA |
| assigned | in_progress | The assignee |
| any open state | escalated | The assignee, PM (a), or System per the escalation rules |
| in_progress or escalated | resolved | The assignee, PM (a); a critical incident requires resolution notes |
| resolved | closed | PM (a), SA |

### Task
| From | To | Who |
|---|---|---|
| not_started | in_progress, blocked, completed | The owner, PM (a) |
| blocked | in_progress | The owner, PM (a) |
| any | cancelled | The creator, PM (a), SA |

### Room allocation
| From | To | Who |
|---|---|---|
| requested | proposed | HL (a), RG (a) |
| proposed | confirmed | HL (a) |
| confirmed | checked_in | HL (a) |
| checked_in | checked_out | HL (a) |
| any | cancelled | HL (a), PM (a) |

### Client request
| From | To | Who |
|---|---|---|
| submitted | under_review | The assigned staff member |
| under_review | clarification_requested | The assigned staff member |
| under_review | answered (question) | The assigned staff member |
| under_review | accepted or rejected (change request) | PM (a), SA |
| accepted | implemented | PM (a) |
| any | withdrawn | The requester |

### Project closure checklist (SPEC §7 closure statuses)
The spec's closure sequence (open items, departure, vendor reconciliation, final accounts, closure review, closed) maps to the required items of the `project_closure` checklist template. Each item is completed by the role in §5.15; the project closes per the wedding project table above.

---

## 8. Automation performed by the system principal

Mapped from SPEC §8. The system acts without a user but every change is still written to `audit_events` with `actor_type = system`.

| Trigger | Action |
|---|---|
| Payment webhook succeeded for a subscription | Set the subscription active and grant exactly its plan's modules |
| Daily, for hotel verifications older than `hotel_verification_max_age_days` | Mark the verification and dependent rate cards stale; show the stale label; never present stale rates as confirmed |
| Approval submitted | Notify the client approvers of that wedding and the requesting staff member |
| Material client request accepted, or a budget line, date or venue changes beyond the configured threshold | Set `impact_flags_json`; create review tasks on affected budget lines, contracts, tasks and run-of-show items |
| Attendance changes | Recalculate function totals and `menu_headcounts`; flag room allocations and transfers for the affected guests |
| Room allocation or transfer changes | Notify the Hospitality and RSVP members of that wedding |
| Daily | Surface overdue tasks, unpaid milestones, unconfirmed vendors and incomplete readiness checks on dashboards |
| Critical incident unassigned beyond the configured minutes | Escalate per the configured chain and notify |
| Any notification sent | Log recipient, channel, timestamp and delivery status |
| Subscription reaches `ends_at` minus notice period, then `ends_at` | Move to expiring, then expired; notify Sales and the client; remove subscription modules only |
| Project closed plus three months (Q23) | Propose archiving to SA; on approval set client memberships to removed; keep every record |
| Retention job (daily) | Propose deletions (identity documents, guest data, leads) per the configured policy; nothing is deleted until SA approves (Q8, Q17) |
| Demo accounts, on schedule | Reset demo data to seed |

---

## 9. Actions that must be audited

Every row below writes an `audit_events` row with before and after values. This is the concrete list behind SPEC §10 "audit trail for approvals, financial changes, permissions and important edits".

- Any change to `user_roles`, `role_permissions`, `project_members` or a user's status.
- Any change to `configurations`.
- Every approval submission and decision, including on-behalf decisions and their evidence.
- Every change to `budget_lines` amounts, `vendor_proposals`, `hotel_proposals`, `contracts`, `invoices`, `payments`, `payment_milestones`, `cost_entries`, `project_final_accounts`.
- Every change to a subscription or service agreement status.
- Every change of `client_visible`, `visibility`, `internal_only` or `is_internal` on any record (sharing and unsharing).
- Every status transition in §7.
- Every read of RESTRICTED-IDENTITY data, every read of RESTRICTED-FINANCE data by a Super Admin outside Finance, and every break-glass read.
- Every export, with the report name, filters and row count.
- Every change to `room_allocations` and `room_allocation_occupants` (SPEC §7 "keep change history").
- Every RSVP token issue, revocation and use.
- Every deletion by a retention job.

---

## 10. Permission keys

Keys follow `module.resource.action` with an optional `:assigned` or `:own` scope suffix, and are seeded from this matrix. Actions are `create`, `read`, `update`, `delete`, `approve`, `share`, `export`, plus class-specific reads such as `read_internal_cost`, `read_internal_notes`, `read_contacts`, `read_sensitive`, `read_identity`. Examples:

| Key | Meaning |
|---|---|
| `hotels.profiles.update` | Edit hotel client-facing fields (HT, SA) |
| `hotels.rate_cards.read` | Read rate cards and items (HT, SA, SM, PM, FA) |
| `hotels.contacts.read` | Read hotel sales contacts (HT, SA, SM, PM, HL:assigned) |
| `consultancy.proposals.share` | Set a hotel proposal to shared (HT, SA, PM:assigned) |
| `consultancy.proposals.read_internal_amount` | Read the internal total (HT, SA, FA, PM:assigned) |
| `projects.members.update:assigned` | Add or remove members on own projects (PM) |
| `budget.lines.read_internal_cost:assigned` | Read internal cost on own projects (PM) |
| `budget.lines.read_internal_cost` | Read internal cost everywhere (FA, SA) |
| `vendors.quotes.read` | Read raw vendor quotes (VC, FA, SA) |
| `approvals.decisions.create_on_behalf:assigned` | Record a client decision with evidence (PM) |
| `guests.identity_documents.read:assigned` | Read identity documents on own projects (RG with explicit grant, HL at check-in) |
| `guests.identity_documents.read` | Break-glass read everywhere (SA, audited and alerted) |
| `guests.sensitive.read:assigned` | Read allergies and accessibility needs (RG, HL, PM) |
| `functions.readiness.authorise_exception:assigned` | Authorise a readiness exception (PM; SA holds the unscoped key) |
| `projects.close:assigned` | Close a project (PM; SA holds the unscoped key) |
| `reports.budget_internal.export` | Export internal cost and margin reports (FA, SA) |

Client and guest principals do not use permission keys; their access is computed from membership, entitlement (§3) and the fixed rules in §6.

---

## 11. Open questions for review

Each has a default in this draft; the audit Q number shows where AMPM's answer is needed.

1. **Readiness exception authority** (P-8). Project Manager plus Super Admin, or Super Admin only? (Q10)
2. **Break-glass reads** (P-5). Should Super Admin be able to read identity documents at all, or should that require two people? (Q8)
3. **On-behalf decisions** (P-9). Allowed with evidence, or never? (Q5)
4. **Vendor contacts after selection.** Restricted throughout in this draft; AMPM may want a per-assignment share flag so the couple can speak to their photographer. (Q4, Q22)
5. **Client Owner edits to the guest list after invitations go out.** Allowed in this draft, with the RSVP team notified; AMPM may prefer changes to route through requests. (Q7)
6. **Client Viewer and the guest list.** No access in this draft, counts only. (Q7)
7. **Sales visibility of project budgets.** None in this draft; Sales sees service agreement fees only. (Q6)
8. **Hospitality access to hotel contacts** on assigned projects. Granted in this draft for on-site coordination. (Q6)
9. **Multiple required approvals.** `required_decisions` defaults to 1 for every record type; AMPM may set 2 for budget and contract approvals. (Q5)
10. **Engaged clients and hotel search.** This draft lets an engaged client without a live subscription see only the hotels linked to their project. AMPM may prefer the package to include discovery. (Q3, Q10)
