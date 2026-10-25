# AMPM Platform — Requirements Audit

**Audit date:** 23 October 2026
**Scope:** the five documents in `reference_docs/`
**Purpose:** establish whether the documentation is complete, consistent and precise enough to begin the pre-development deliverables that the business brief (§8) and the technical specification (§14) ask for: wireframes, data model, permission matrix, technology recommendation and a phased estimate.

Document short names used throughout:

| Short name | Document |
|---|---|
| BIZ | AMPM Website & App — Business Explanation for Developer (PDF, 5 pages) |
| WHY | Why AMPM App (PDF, 2 pages) |
| SPEC | AMPM Developer Technical Specification v1.0 (DOCX, 15 sections) |
| TEAM-FLOW | AMPM App Visual Flowchart – for team (PDF, A3, 1 page) |
| PORTAL-FLOW | AMPM Client Portal Visual Flowchart (PDF, A3, 1 page) |

Finding IDs: **CF** = conflict between documents, **GP** = gap, **AM** = ambiguity, **RK** = risk, **Q** = decision needed from AMPM.

---

## 1. Verdict

The five documents describe one coherent product with a clear business model and a strong security posture. They are **sufficient to start the design phase under stated assumptions, but not sufficient to start building**. The specification is explicitly a "starting specification" (SPEC purpose statement) and both BIZ §9 and SPEC §13 list commercial decisions that remain open.

Three problems stand out:

1. **The two flowcharts and the specification describe different products.** The client-portal flowchart has no hotel discovery at all, even though hotel discovery is the Phase 1 deliverable and the paid subscription product. The team-app flowchart shows a single linear wedding-management path with no subscription, discovery or consultancy branch, which contradicts the "critical rule" in SPEC §1.2. (CF-2, CF-3, CF-4)
2. **The hotel database, the core of the subscription product, has no price field.** BIZ requires "quoted prices and verification dates" and SPEC requires "last-verified commercial information", but the data model (SPEC §4) has no rate, quote or snapshot entity. (GP-8)
3. **The commercial and access decisions that drive architecture are still open**: online vs offline payment and account activation, one-time vs recurring subscription, what finance the client sees, native app vs responsive web, and how guests are identified in the RSVP portal. (CF-5, CF-6, GP-4, GP-33, AM-1)

Counts: 9 conflicts, 44 gaps, 15 ambiguities, 8 risks, 25 decisions for AMPM (10 of them blocking design sign-off).

---

## 2. Document inventory and provenance

| # | Document | Format | Dated | Role | Notes |
|---|---|---|---|---|---|
| 1 | BIZ | PDF exported from Pages | 21 Oct 2026 | Plain-language business brief, 9 sections | States that SPEC carries the detailed requirements (final instruction) |
| 2 | WHY | PDF exported from Pages | 21 Oct 2026 | Access model and customer funnel, 4 sections | Only document that defines the demo/trial stage and the no-self-registration rule |
| 3 | SPEC | DOCX, 10 tables | v1.0, 20 Oct 2026 | Primary specification | Generated with python-docx; no author, comments, tracked changes or revision history; no sign-off marks |
| 4 | TEAM-FLOW | PDF, A3 | undated | Level-1 navigation for the team app | Footer: "Detailed section workflows to be designed next" |
| 5 | PORTAL-FLOW | PDF, A3 | undated | Level-1 navigation for the client portal | Footer: "Client-facing access only" |

Observations on provenance:

- SPEC has no evidence of AMPM review. Its §6 (roles), §7 (statuses) and §11 (phases) read as decisions but BIZ §9 says roles and release scope must not be assumed. Treat those sections as proposals until signed off (CF-7).
- Both flowcharts are explicitly Level 1 and undated. They should be reconciled with SPEC before Level 2 flows are drawn (§9 of this audit).

---

## 3. What the documents get right

These should be preserved through design; they are the strongest parts of the brief.

- **Three distinct service stages** (hotel discovery → optional consultancy → full management) with the rule that one never implies the next. Stated consistently in BIZ Step 5, WHY §1 and SPEC §1.2 and §15.
- **Server-side, field-level protection** of internal cost, margins, private notes and identity documents. SPEC §4 security note and §6.1 explicitly reject hiding data in the interface.
- **Approvals locked to exact versions** of designs, menus and proposals (SPEC §5, §7, §12).
- **Privacy by default** for identity documents: never universally required, conditional, restricted and audited (BIZ rule 7, SPEC §2.5, §5).
- **No hard-coded commercial rules** and an explicit list of undecided policies (SPEC §10, §13; BIZ §9).
- **Concrete acceptance scenarios** (SPEC §12), including tamper tests on URLs, API requests and file links.
- **Phasing with exit criteria** (SPEC §11).
- **Not everything mandatory, parallel workflows allowed** (BIZ rules 2–3, SPEC §5, §15).

---

## 4. Conflicts between documents

### CF-1 — Shape of the platform: three environments vs four experiences

- WHY §2 defines **three distinct environments**: public website, demo/trial environment, private platform. The guest RSVP portal is not mentioned.
- BIZ §2 and SPEC §1.1 define **four parts**: public website, client portal, team workspace, guest RSVP portal. The demo appears only as one public-website screen (SPEC §2.1 "Demo / subscription") and one acceptance test (SPEC §12 "Demo account cannot access records outside demo scope").
- Neither flowchart shows a demo or trial state. SPEC §11 assigns demo/trial to no phase.
- **Impact:** a separate demo deployment vs a demo tenant inside the platform is an architecture and cost decision. Trial expiry needs automation that is not specified.
- **Recommendation:** define demo/trial as a mode of the private platform: AMPM-provisioned demo accounts, an isolated seeded demo dataset, time-boxed access, delivered in Phase 1. Add a trial status (GP-2).

### CF-2 — The client-portal flowchart omits hotel discovery

- SPEC §2.2 defines a full subscriber experience: destinations, search and filters, hotel detail with verified commercial information, compare, favourites, assistance requests and enquiry tracking. This is the Phase 1 product and the thing the subscription pays for (WHY Stage 3).
- PORTAL-FLOW shows four tabs: Home (countdown, updates), My Wedding, Approvals, More (budget, documents, support). There is no hotels area, search, favourites or assistance request. The Home "countdown" presupposes a wedding date, which a discovery-only subscriber does not have.
- **Impact:** wireframes drawn from the flowchart would omit the revenue product. The portal needs two states (subscriber-only and engaged client) and the flowchart acknowledges only one.
- **Recommendation:** redraw with a Hotels area and an explicit subscriber-only home state, keeping the engaged-client tabs.

### CF-3 — The team flowchart hides Hotels and Guests

- SPEC §2.4 lists nine areas, including **Hotels** (destinations, profiles, rooms, venues, media, verification, enquiries, visits, negotiations) and **Guests** (cross-wedding guest database, RSVP calls, family groups, rooming, travel).
- TEAM-FLOW has five tabs. Hotels is absent unless "Database" under More means the hotel database, which is not defined. Guests appears only as "Guest/hospitality" inside Weddings.
- **Impact:** the Hotel/Destination Team and the RSVP/Guest Team (SPEC §6) have no obvious home. Cross-wedding guest operations are not represented.
- **Recommendation:** a five-tab mobile navigation is fine, but decide deliberately where Hotels and Guests live and label them.

### CF-4 — The team flowchart shows one linear path with no subscription or consultancy branch

- TEAM-FLOW main flow: Qualified client → Create wedding record → Planning → Live operations → Closure.
- SPEC §1.2 and WHY §1 describe a funnel in which many clients stop at hotel discovery or consultancy and never get a wedding project. SPEC calls this the "critical rule".
- **Impact:** anyone working from the flowchart will design the team app as a wedding-planning tool and under-build sales, subscription and hotel-consultancy operations.
- **Recommendation:** the Level-1 flow should branch after Clients: subscription → discovery → optional consultancy → optional engagement → project.

### CF-5 — How accounts are created and paid for

- WHY §3 and §4: "AMPM creates their account", "No public self-registration", "AMPM administrators create or approve client accounts".
- SPEC §2.1: a public "Demo / subscription" screen leads to a "controlled demo or payment journey". SPEC §1.2: "access activates after payment confirmation". SPEC §8: "Payment confirmation activates only the purchased entitlement". The no-self-registration rule appears nowhere in SPEC.
- **Impact:** whether Phase 1 includes an online payment gateway with automatic activation, or offline payment with manual activation, changes Phase 1 scope materially. SPEC §13 does not list the payment provider or mode as a decision; BIZ §9 lists "payment rules" as undecided. Phase 1's exit criterion ("lead-to-subscriber journey tested") cannot be tested until this is decided.
- **Recommendation:** write the no-self-registration rule into SPEC. Decide the Phase 1 payment mode (Q2).

### CF-6 — Client-visible finance

- PORTAL-FLOW "More: Budget" commits to "Client-facing budget" and "Invoices & payment status".
- SPEC §2.3 limits the client to "Budget summary showing only approved client-facing fields". SPEC §13 leaves "which amounts clients see: vendor quote, negotiated quote, AMPM fee, tax and payment details" undecided.
- **Recommendation:** decide (Q4) before the Phase 2 data model. The answer determines whether budget_lines and invoices need the client/internal split that vendor_proposals already has.

### CF-7 — Roles: proposal or decision?

- BIZ §9: "Final user roles and data-access rules" must not be assumed by the developer.
- SPEC §6 presents 11 roles as definitive and SPEC §13 does not list roles among the pending decisions (only "who approves for the couple/family").
- **Recommendation:** treat SPEC §6 as the proposal. Sign-off happens through the role/permission matrix deliverable (SPEC §14).

### CF-8 — Vocabulary that exists in only one document

| Term | Appears in | Status in SPEC |
|---|---|---|
| Questionnaire | TEAM-FLOW (Clients tab) | Absent |
| Consultation (as a tracked step) | WHY Stage 1, TEAM-FLOW | Absent; lead statuses have "introduction shared" and "demo offered" |
| Feedback, Archive (closure) | TEAM-FLOW | Absent from closure module (§3) and closure statuses (§7) |
| Schedule, Today, calendar | TEAM-FLOW (Home tab) | No calendar concept |
| Messages, questions, "ask a question" | PORTAL-FLOW | No messaging module, entity or notification |
| Countdown | PORTAL-FLOW | Absent |
| Database (under More) | TEAM-FLOW | Undefined |
| Trial | WHY (4 mentions) | Absent from statuses, automation and phases |

**Recommendation:** one agreed glossary before Level-2 flows are drawn.

### CF-9 — "Three distinct environments" vs "shared backend"

WHY §2 asks for three distinct environments; SPEC §10 asks for a shared backend with separate user experiences. These are compatible only if "environment" means experience. The open point is the isolation level for demo data (AM-8).

---

## 5. Gaps

### 5A. Commercial and access model

- **GP-1 Entitlement resolution.** Access "depends on subscription, service agreement and project permissions" (SPEC §1.1), but no rule says how the three combine. Unspecified: what an expired discovery subscriber with an active wedding project sees; what a client sees after project closure and for how long; whether one subscription covers several weddings on one account. WHY §4 requires that expiry and cancellation never delete wedding records; SPEC does not restate this.
- **GP-2 Trial mechanics.** No trial status (SPEC §7 subscription statuses are pending payment, active, expiring, expired, suspended, cancelled), no duration, no expiry automation in §8, no demo dataset definition, no provisioning flow, no phase.
- **GP-3 Plans and packages.** `subscriptions.plan_id` references a table that does not exist. There is no plan-to-module entitlement mapping, although SPEC §10 requires configurable packages and §2.4 Settings lists "packages".
- **GP-4 One-time vs recurring subscription.** SPEC §13 asks about "term, renewal, expiry" but no document says whether billing recurs. Recurring billing (renewals, failed-payment handling, proration, auto-expiry) is a large scope item on its own.
- **GP-5 Hotel-assistance commercial flow.** "Request hotel assistance" (SPEC §2.2) triggers paid services whose fees are undecided (BIZ §9). The flow request → fee quote → agreement → work → status is not drawn. `service_agreements` exists but has no status list and no link from a hotel enquiry to an agreement.
- **GP-6 Client payments for wedding milestones.** Only the subscription payment is described. PORTAL-FLOW shows "payment status" but nothing says whether clients pay AMPM through the portal.
- **GP-7 Refunds and cancellations.** Undecided in BIZ §9 and SPEC §13. Affects the gateway integration and the subscription state machine.

### 5B. Data model (SPEC §4)

- **GP-8 Hotel prices have nowhere to live.** BIZ Step 4 and §4 require "quoted prices and verification dates"; SPEC §2.2 requires "last-verified commercial information"; SPEC §3 lists an "inventory snapshot" record. SPEC §4 has no price, rate, quote or snapshot entity: `hotels` holds profile, address, contact and status; `hotel_rooms / venues` holds category, capacity and facilities; `hotel_verifications` holds a field group and a date. Indian wedding hotel commercials typically include room rates by category and season, venue rental, per-plate food-and-beverage minimums, taxes and inclusions. These need a rate-card or quote-snapshot entity with its own verification record.
- **GP-9 Availability.** SPEC §12 says "unverified availability is not shown as confirmed", but there is no availability entity or calendar. This is probably intended as a per-enquiry manual check; it should be stated so the product does not promise live availability.
- **GP-10 Saved hotels, favourites, compare** (SPEC §2.2, Phase 1): no entity.
- **GP-11 Room blocks.** Rooms reserved per project, hotel, category and date are not modelled, so `room_allocations` cannot be validated against inventory and the rooming reports in §9 have no source.
- **GP-12 One hotel per wedding.** `wedding_projects.hotel_id` is single-valued. Destination weddings commonly use a main hotel plus overflow hotels, and functions may be at venues outside AMPM's database (a farmhouse, a palace, the client's own venue). `functions.venue` is untyped.
- **GP-13 Guest atomic unit.** `guests` has `family_group_id` but there is no family_groups table; `guest_function_attendance` is per guest yet carries `party_count`; `room_allocations` and `travel_segments` use a polymorphic "guest/group_id". Rooming and identity handling need individuals; headcounts need groups including children. The model must choose: the individual guest is the atomic record and the family group is a grouping.
- **GP-14 Change requests.** Prominent in PORTAL-FLOW and listed in SPEC §3, but there is no entity, no statuses and no notification rule.
- **GP-15 Messaging and questions.** PORTAL-FLOW promises "Messages • questions" and "ask a question"; SPEC has no module, entity or notification for it. Only design comments and guest tickets exist.
- **GP-16 Module records without entities.** About 25 record types named in SPEC §3 have no table in §4 (full list in §7.1 below), including budget categories, vendor categories, family groups, invitations and recipients, checklists, readiness checks, production items, artist bookings, departure records, lost-and-found, final account, notifications and configuration.
- **GP-17 Payments and invoices.** `payments` has no direction (client to AMPM vs AMPM to vendor), no payer or payee and no method. `contracts / invoices` has a single amount with no client/internal split. If AMPM invoices marked-up vendor services, this is a margin-leak path that the §4 security note is meant to prevent.
- **GP-18 Tax.** SPEC mentions tax once (§13). There are no GST fields on invoices, budget lines or payments. If the platform issues invoices in India they must be GST-compliant.
- **GP-19 Statuses.** No status list exists for vendor assignment, vendor proposal, design version, menu version, invitation, RSVP response, payment, invoice, contract, service agreement, travel segment or transfer, or guest ticket. For the ten objects that do have lists (§7), there are no allowed transitions and no rule on who may transition.
- **GP-20 Media rights.** Hotel profiles will show "previous wedding photos and videos" (BIZ Step 4), which are other clients' weddings. `documents / media` has a visibility field but no consent or rights fields. SPEC §13 raises "media publication rights" only as a governance question.
- **GP-21 Vendor availability.** BIZ rule 6 says vendor availability changes and must be verified; SPEC §3 lists vendor "availability" as a record; `vendors` has no availability or verification field.

### 5C. Functional

- **GP-22 Bulk import and migration.** The word "import" appears in no document. SPEC §10 mentions only "bulk operations for large guest/vendor lists". AMPM presumably has existing hotel research in spreadsheets, and clients supply guest lists in Excel. Both need import tooling and a migration plan, and the hotel import decides whether Phase 1 launches with a populated database.
- **GP-23 Public website content management.** "Content managed by AMPM" (SPEC §2.1) implies a content management system; none is specified. The choice (headless CMS, admin pages, or developer-maintained) determines the website stack.
- **GP-24 Dietary and allergy capture.** SPEC §9 references "medical" data and the menus module needs headcounts (vegetarian, Jain, vegan, allergies), but the RSVP flow (§2.5) collects only attendance, travel and accommodation.
- **GP-25 Guest list ownership.** Who enters and edits guests (client in the portal vs AMPM), and which guest fields the client can see (full list vs counts), is undefined. SPEC §2.3 "authorised guest views" has no definition.
- **GP-26 Client-side users.** SPEC §2.3 "authorised family/decision-maker contacts" and §13 "who approves" imply several client users per wedding with different rights (viewer vs approver; who sees money). Only one client role exists (§6) and `project_members` is not stated to cover client users.
- **GP-27 Linking pre-project activity.** WHY §3 requires hotel selections and enquiries made during discovery to connect to the wedding project once it is created. SPEC §8 automation has no such rule.
- **GP-28 Calendar and schedule view.** TEAM-FLOW Home promises "Schedule", "Today" and "calendar". SPEC has no calendar concept and no external calendar sync.
- **GP-29 Closure extras.** Feedback and archive (TEAM-FLOW) are absent from the closure module and statuses.
- **GP-30 Staffing.** "Staffing" and "staff assignment" appear in SPEC §2.4, §3 and §11, but the only mechanism is a task owner. Live execution needs on-site staff assigned to functions and shifts.
- **GP-31 Authentication specifics.** No sign-in method for clients (email and password vs phone OTP, which is common in India), no password reset or account recovery flow (PORTAL-FLOW offers only "Contact AMPM for access help"), no multi-factor authentication for staff who can see every client's finances, no session or timeout policy.
- **GP-32 Notifications.** Channels are undecided (§13). In-app vs email vs push, user preferences, and a notification entity are all absent even though §8 requires logging recipient, channel, timestamp and delivery status.

### 5D. Non-functional and delivery

- **GP-33 Native app vs responsive web vs progressive web app.** SPEC §10 says responsive web. Both flowcharts say "App" with tab bars; BIZ says "website and connected app"; WHY says "the private app". No document mentions iOS, Android, app stores or push notifications. This decision alone can change the cost estimate by a large factor.
- **GP-34 Offline and low-connectivity use.** Run-of-show, readiness checks and incidents will be used on phones inside hotel ballrooms and at outdoor venues. No document mentions offline behaviour.
- **GP-35 Sizing inputs.** No numbers for team size, concurrent weddings, guests per wedding (BIZ's example is 250; several hundred to a thousand is common), hotels in the database, media volume or expected subscribers. SPEC §14 demands a cost estimate, which cannot be produced responsibly without these.
- **GP-36 Targets.** No uptime, performance, browser-support or accessibility level (Phase 5 says "accessibility" with no standard).
- **GP-37 Security specifics beyond principles.** Rate limiting, upload scanning, file-size limits, video hosting and delivery approach ("controlled video delivery"), penetration testing and secrets management are not mentioned.
- **GP-38 Delivery requirements.** Environments (development, staging, production), continuous integration, monitoring, logging, support levels and handover are not specified. SPEC §14 asks for deployment and maintenance documentation but states no requirements for them.
- **GP-39 "External hotel systems"** (SPEC §10) is undefined. If no live integration with hotel systems is intended in the first release, the spec should say so.

### 5E. Legal and compliance (India)

- **GP-40 Digital Personal Data Protection Act 2023.** Guests are data principals who never contracted with AMPM. Consent notice, purpose limitation, erasure, breach handling and a grievance contact need to be designed into the RSVP portal. Not referenced anywhere.
- **GP-41 Aadhaar.** The Aadhaar framework restricts private storage and use of Aadhaar numbers. Recommended position: never store Aadhaar numbers. If hotels need identity for check-in, store the minimum (document type and a masked reference) under restricted access with automatic deletion after checkout.
- **GP-42 GST invoicing.** See GP-18.
- **GP-43 Hosting location and data residency** for an Indian client base, and cross-border transfer if hosted abroad. SPEC §13 covers ownership, not location.
- **GP-44 Retention schedule per data class**: guest personal data after the wedding, identity documents after checkout, demo data, closed leads. SPEC §10 asks AMPM to approve rules but proposes none.

---

## 6. Ambiguities

- **AM-1 RSVP link model.** SPEC §2.5 says "wedding-specific link". A shared per-wedding link forces guests to identify themselves, which creates privacy exposure and duplicate records, contradicting §12 "without duplicates". A per-guest or per-family token requires the guest list to be loaded before invitations go out. Can unknown guests self-register? Who authorises accompanying family members, and how many?
- **AM-2 Function venue.** Is `functions.venue` a foreign key to a hotel venue or free text? Can one function span venues, and can functions of one wedding be at different hotels?
- **AM-3 Function status vs function readiness.** SPEC §7 has a "Function readiness" status list and `functions` has a status field. Same field, or is readiness derived from a checklist?
- **AM-4 "Material changes"** (SPEC §8) has no threshold or definition.
- **AM-5 Room capacity.** Is `hotel_rooms.capacity` the number of rooms in the category or the occupancy per room?
- **AM-6 "Database"** under TEAM-FLOW's More tab is undefined.
- **AM-7 Multiple approvers.** `approvals` holds one decision per record; SPEC §13 raises the possibility of several required approvals.
- **AM-8 Demo data separation.** "Demo data must remain separate from real client data" (WHY §4): a separate database or deployment, or a tenant flag in one database?
- **AM-9 Subscription scope.** Per account, covering any number of weddings, or per wedding?
- **AM-10 Vendors and hotels as users.** No role exists for them. Confirm they never log in; vendor portals are a common later request and are cheaper to plan for than to retrofit.
- **AM-11 Phase 1 consultancy depth.** SPEC §7 lists ten hotel-enquiry statuses from draft to closed. Phase 1 says "hotel enquiry". How much of negotiation, site visits, proposals and booking assistance is Phase 1?
- **AM-12 Invitations and save-the-dates.** Phase 2 (they are design versions) or Phase 3 (they are part of RSVP)?
- **AM-13 Time zones** for weddings abroad. SPEC §13 raises international expansion; no document mentions time zones.
- **AM-14 Tenancy.** Single tenant (AMPM only) or future licensing to other planners? WHY calls the software "a paid business asset". Multi-tenancy is expensive to retrofit.
- **AM-15 "Consultation" and "Questionnaire"** in the lead flow: are these tracked records with statuses, and what does the questionnaire contain?

---

## 7. Technical specification: internal consistency

### 7.1 Module records (SPEC §3) with no entity in the data model (SPEC §4)

SPEC §4 describes itself as a logical model, so this is expected to some degree. The list matters because the ER diagram deliverable (SPEC §14) must cover all of it.

| Module | Records named in §3 | Missing from §4 |
|---|---|---|
| CRM/subscriptions | lead, contact, account, subscription, payment, service agreement | plan/package |
| Hotel intelligence | destination, hotel, room category, inventory snapshot, venue, media, verification | inventory snapshot, rates/prices |
| Hotel consultancy | availability enquiry, response, negotiation, site visit, proposal, booking milestone | response, negotiation, site visit, hotel proposal, booking milestone (only implied as "responses, visits, proposals, negotiation events") |
| Budget/finance | budget category/line, quote, contract, invoice, payment, cost entry | budget category, quote, cost entry |
| Functions | function, schedule, checklist, venue, run-of-show | schedule, checklist |
| Creative/approvals | design brief, version, comment, approval, change request | design brief, comment, change request |
| Vendors | vendor, category, portfolio, proposal, assignment, scope, contract | vendor category, portfolio |
| Invitations/RSVP | invitation, recipient, guest, family group, response, attendance | invitation, recipient, family group |
| Rooms/logistics/hospitality | room allocation, travel segment, transfer, vehicle, request/ticket | vehicle, request/ticket |
| Food/entertainment/production | menu version, artist booking, technical rider, production item, readiness check | artist booking, technical rider, production item, readiness check |
| Tasks/risk | task, dependency, staff assignment, incident, resolution | dependency, staff assignment |
| Closure | departure record, lost-and-found item, vendor completion, final account | all four |
| Administration | user, role, permission, notification, audit event, configuration | notification, configuration |

### 7.2 Status coverage

SPEC §7 defines statuses for ten objects: lead, subscription, hotel enquiry, wedding project, approval, task, room allocation, function readiness, incident, wedding closure. Twelve objects that carry state have none (GP-19). No object has allowed transitions or transition permissions.

### 7.3 Completeness of the decisions list (SPEC §13)

§13 is good but misses decisions that this audit shows are design-blocking: payment mode and provider, native app vs web, final roles (dropped relative to BIZ §9), client sign-in method, website content management, hosting location, offline needs, and the RSVP identity model.

### 7.4 Smaller inconsistencies

- SPEC §1.2 is the only place that names the market ("Indian wedding destinations"); currency appears only on `payments`.
- SPEC §2.1 enquiry form captures "consent" without saying consent to what; this should align with the privacy notice in §10.
- SPEC §5 says the wedding project has a "unique ID generated separately" and TEAM-FLOW says "Unique Wedding ID"; no format is given.
- SPEC §8 "Material changes flag affected budgets, contracts, tasks and run-of-show items" has no definition of material.

---

## 8. Traceability: business brief to specification

| BIZ requirement | SPEC coverage | Status |
|---|---|---|
| §2 Four parts of the platform | §1.1 | Covered |
| §3 Steps 1–10 of the business process | §1.2 | Covered |
| §4 Hotels: quoted prices and verification dates | §2.2, §3, §4 | **Partial** — no price entity (GP-8) |
| §4 Guests: family details, travel, accommodation, hospitality | §2.5, §4 | Covered; dietary data missing (GP-24) |
| §5 rule 1: different access per user | §6, §6.1 | Covered |
| §5 rule 2: not all fields compulsory | §5, §15 | Covered |
| §5 rule 3: parallel workflows | §1.2, §15 | Covered |
| §5 rule 4: clear statuses | §7 | **Partial** (GP-19) |
| §5 rule 5: track important changes | §10, `audit_events` | Covered; scope of "important edits" undefined |
| §5 rule 6: verify changing information (hotel and vendor) | §8, `hotel_verifications` | **Partial** — vendor availability not modelled (GP-21) |
| §5 rule 7: protect guest information | §2.5, §5 | Covered |
| §5 rule 8: do not invent policies | §13 | Covered |
| §5 rule 9: separate client and internal views | §6.1 | Covered |
| §6 Main screens | §2 | Covered |
| §8 What the developer should do first | §14 | Covered |
| §9 Decisions still to be confirmed | §13 | Covered and extended; roles dropped (CF-7) |
| WHY §4: no public self-registration | — | **Not stated in SPEC** (CF-5) |
| WHY §4: expiry must not delete wedding records | §7 | **Not stated** (GP-1) |
| WHY Stage 2: demo or limited trial | §2.1, §12 | **Partial** (GP-2) |
| WHY §3: connect discovery activity to the wedding project | — | **Missing** (GP-27) |

---

## 9. Flowchart reconciliation

| Concept | SPEC | TEAM-FLOW | PORTAL-FLOW |
|---|---|---|---|
| Subscription / entitlement | §2.1, §3, §7 | absent | absent |
| Demo / trial | §2.1, §12 | absent | absent |
| Hotel discovery (client) | §2.2 | n/a | **absent** |
| Hotels area (team) | §2.4 | hidden ("Database"?) | n/a |
| Hotel consultancy statuses | §7 | absent | absent |
| Guests area (team, cross-wedding) | §2.4 | inside Weddings only | n/a |
| Design studio, invitations, menus | §2.3 | "design" only | "design approvals" only |
| Change requests | §3 (name only) | absent | present |
| Messaging / questions | absent | absent | present |
| Invoices and payment status (client) | undecided (§13) | absent | present |
| Calendar / schedule | absent | present | absent |
| Questionnaire, consultation | absent | present | n/a |
| Feedback, archive at closure | absent | present | n/a |
| Guest RSVP portal | §2.5 | n/a (separate) | n/a (separate) |

Both flowcharts are usable as navigation sketches for the full-wedding-management case only. They should not be used as the basis for wireframes until the subscriber-only state, the Hotels and Guests areas, and the branching sales funnel are added.

---

## 10. Risks

- **RK-1 Empty product at Phase 1 launch.** Phase 1's value is a populated, verified hotel database. No document names an existing data source, a data-entry plan, an import tool or a verification cadence (SPEC §13 asks who will do it). Without this, Phase 1 ships an empty search.
- **RK-2 Late financial-visibility decision forces rework.** Whether AMPM runs a margin model (marked-up vendor prices, confidential margin) or a transparent fee model changes budget_lines, invoices, payments and every client-facing finance screen. Deciding after the Phase 2 model is built means rework and leak risk.
- **RK-3 App-vs-web decision not made before estimate.** Native iOS and Android apps for the team and clients roughly double front-end effort versus responsive web. SPEC §14 asks for a cost estimate; without this decision the estimate will be wrong.
- **RK-4 Guest communications lead time.** If AMPM wants WhatsApp for RSVP and guest updates (the dominant channel in India), WhatsApp Business API onboarding and template approval take weeks and must start early. No document names a channel.
- **RK-5 Privacy exposure at scale.** Each wedding adds hundreds of non-contracting data subjects. Collecting identity documents, travel details and dietary (health-adjacent) data without a designed consent, retention and deletion model is a legal and reputational risk.
- **RK-6 Scope breadth.** Fourteen modules, roughly fifty entities, eleven roles and five phases. Phase 1 must be scoped tightly or it will absorb Phase 2 features through the client portal.
- **RK-7 Divergent mental models.** The flowcharts and the specification describe different products (§9). If AMPM's internal picture is the flowcharts and the developer builds the spec, review meetings will surface the gap late.
- **RK-8 Unreviewed specification.** SPEC was machine-generated with no author, comments or revision history. Its roles, statuses and phases should be confirmed by AMPM before they are treated as requirements.

---

## 11. Decisions required from AMPM

This section is written so it can be sent to AMPM as-is. Where a default is suggested, it is a technical default to be confirmed, not a business policy; BIZ rule 8 applies.

### Tier 1 — blocking design sign-off (needed before wireframes, data model and permission matrix)

- **Q1 Delivery platform.** Responsive web for everything, native mobile apps for the team and/or clients, or a progressive web app? Who uses what on the wedding day, and is offline use needed? (GP-33, GP-34)
- **Q2 Payment mode for Phase 1.** Online payment through a gateway with automatic account activation, or offline payment with AMPM activating the account manually? If online, which provider? (CF-5)
- **Q3 Subscription shape.** One-time or recurring? Term and renewal? Which modules does it include? Is there a free trial, how long, and what does a trial account see? (GP-2, GP-3, GP-4)
- **Q4 Client-visible finance.** Does AMPM earn through margins on vendor prices or a transparent fee? Exactly which amounts do clients see: vendor quote, negotiated quote, AMPM fee, tax, invoices, payment status? Can clients pay milestones through the portal? (CF-6, GP-6, GP-17)
- **Q5 Client-side users.** How many client users per wedding (couple, parents, siblings)? Do they have different rights, for example viewer vs approver, and who may see the budget? Who approves for the family, and are multiple approvals ever required? (GP-26, AM-7)
- **Q6 Roles.** Confirm or amend the eleven roles in SPEC §6. Who may see internal cost and margin? (CF-7)
- **Q7 Guest identity in the RSVP portal.** Is the guest list loaded first and each guest or family sent a unique link, or is there one wedding link where guests identify themselves? Can unknown guests register? Who authorises accompanying family members? Should dietary preferences and allergies be collected? What guest data can the client see? (AM-1, GP-24, GP-25)
- **Q8 Identity documents.** What is the use case (for example hotel check-in rooming lists)? Which documents? Who may access them, and when are they deleted? Suggested default: never store Aadhaar numbers. (GP-41, GP-44)
- **Q9 Hotel data.** Is there existing hotel data to migrate, and how much? Who enters and verifies it, and how often? What price structure must be stored (room rates by category and season, venue rental, per-plate minimums, taxes)? Is availability always checked manually per enquiry? Do you have rights to publish previous clients' wedding photos on hotel profiles? (GP-8, GP-9, GP-20, GP-22, RK-1)
- **Q10 Phase 1 scope.** Confirm whether Phase 1 includes the demo/trial, the full hotel-consultancy status flow, online payment, and website content management. (AM-11, CF-1, GP-23)

### Tier 2 — needed before Phase 1 build

- **Q11 Guest and client communication channels.** Email, SMS, WhatsApp? Which providers? (GP-32, RK-4)
- **Q12 Public website.** Will AMPM edit marketing content themselves (needs a content management system)? Are SEO, analytics and an Instagram feed required?
- **Q13 Sign-in.** Email and password or phone OTP for clients? Multi-factor authentication for staff? Any single sign-on? (GP-31)
- **Q14 Hosting and data residency.** Where must data be hosted? Backup and recovery targets? (GP-43, SPEC §13 technology ownership)
- **Q15 Volumes.** Team size, weddings per year and concurrently, typical and maximum guests per wedding, number of hotels, expected media volume, expected subscribers. (GP-35)
- **Q16 Currency, language and tax.** Initial currency and language; will the platform issue GST invoices? (GP-18, SPEC §13)
- **Q17 Privacy notice, consent wording and retention schedule** for leads, clients, guests and demo data. (GP-40, GP-44)

### Tier 3 — before Phases 2 to 4

- **Q18** Multi-hotel weddings and venues outside the database. (GP-12, AM-2)
- **Q19** Room blocks and rooming rules (sharing, children, upgrades). (GP-11)
- **Q20** In-portal messaging or questions: in scope or handled outside the platform? (GP-15)
- **Q21** Change-request workflow and statuses. (GP-14)
- **Q22** Vendor or hotel logins, now or later. (AM-10)
- **Q23** Client portal access after the wedding: how long, and what remains visible. (GP-1)
- **Q24** Post-wedding feedback and archive expectations. (GP-29)
- **Q25** Definition of a "material change" and the resulting flags. (AM-4)

---

## 12. Recommended next steps

1. **Resolve Tier 1 with AMPM** in one working session. The ten questions are answerable by the business in an afternoon and unblock everything else.
2. **Produce a glossary and a reconciled information architecture** that replaces both Level-1 flowcharts, showing the subscriber-only state of the client portal, the Hotels and Guests areas of the team app, and the branching sales funnel.
3. **Amend SPEC v1.0 to v1.1** with: the no-self-registration rule, the no-deletion-on-expiry rule, a trial status, a price or rate-card entity, saved-hotel and room-block entities, the entitlement resolution rule, and the missing status lists. Mark §6, §7 and §11 as proposals pending sign-off.
4. **Then start the SPEC §14 deliverables** in this order: entity-relationship diagram (covering the table in §7.1), role and permission matrix (including field-level finance and guest-data restrictions), field matrix, wireframes, technical architecture, phased estimate.
5. **Begin hotel data collection now**, in parallel with design, so Phase 1 does not launch empty (RK-1).

---

## Appendix: method

Every document was extracted to text and read in full; both flowcharts were also rendered as images to check structure that text extraction loses. The Word specification was inspected for comments and tracked changes (none present). Claims of absence in this audit (for example "no document mentions a price field, bulk import, native apps, offline use, WhatsApp, GST or an authentication method") were verified by keyword search across all five extracted texts.
