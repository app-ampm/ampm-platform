# AMPM Platform — Decision Register

**Status:** generated 2026-10-26 by `docs/tools/decision_register_build.py` from the assumption registers in the six design drafts and the question list in [requirements-audit.md](requirements-audit.md) §11. Do not edit by hand; change a register and rebuild.

For each audit question, this lists every assumption that was made in its place. Answering the question confirms or replaces those assumptions; the "If AMPM decides otherwise" column says what changes. Tier 1 questions gate design sign-off; Tier 2 must be answered before the Phase 1 build; Tier 3 before Phases 2 to 4.

**AMPM answered on 2026-10-25.** Each question below carries the decision and each assumption its status; the full record is [decision-log.md](decision-log.md).

## Summary

| Register | Document | Assumptions | Tied to a question | Tied only to an audit finding |
|---|---|---|---|---|
| A | [data-model.md](data-model.md) §0 (Data model) | 30 | 25 | 5 |
| P | [permission-matrix.md](permission-matrix.md) §0 (Permission matrix) | 11 | 11 | 0 |
| T | [architecture.md](architecture.md) §0 (Architecture) | 14 | 13 | 1 |
| U | [user-flows.md](user-flows.md) §0 (User flows) | 12 | 12 | 0 |
| W | [wireframes.md](wireframes.md) §0 (Wireframes) | 15 | 12 | 3 |
| V | [test-cases.md](test-cases.md) §0 (Test cases) | 16 | 15 | 1 |
| **Total** | | **98** | **88** | **10** |

## Tier 1 — blocking design sign-off

### Q1 Delivery platform

**AMPM decided (2026-10-25).** Native iOS and Android apps are required. Offline access to essential wedding-day information is required, with automatic synchronisation when the device reconnects, conflict detection and a controlled resolution process. The final technical architecture is to be agreed with the development team. Decided 26 October 2026: the client portals (hotel discovery and the wedding portal) also run in the browser, and both apps support iPad and Android tablets as well as phones.

Dependent assumptions: **6**

| ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |
|---|---|---|---|---|
| A-1 | [Data model](data-model.md) | Responsive web application with one backend for team workspace, client portal and guest portal; no native apps in v1. Phase 4 adds installable (PWA) mode with read-only offline caching of run-of-show and checklists. | Native apps change nothing in the schema except adding a `device_tokens` table for push notifications. | Changed. Native iOS and Android apps with offline use from launch; the client portals also run in the browser; both apps support phones and tablets; the web remains for the public website. |
| T-1 | [Architecture](architecture.md) | One responsive web platform in a single TypeScript codebase: a public and guest-facing web app, an authenticated web app for clients and staff, one API, one worker. Installable (PWA) mode with read-only offline caching arrives in Phase 4. No native apps in v1. | Native apps are added later as React Native clients of the same API. Nothing in the backend changes; front-end effort roughly doubles. | Changed. Native apps for the team and the client from one codebase, with a browser build of the client portals and tablet layouts for both apps; web for the public website. |
| T-11 | [Architecture](architecture.md) | Offline behaviour in Phase 4: run-of-show, readiness checklists and arrival lists are cached for reading; incident reports and cue updates queue locally and sync with a conflict log. | Without offline support the service worker is omitted. | Changed. Offline-first in the native apps from launch, with sync, conflict detection and protected local storage. |
| U-7 | [User flows](user-flows.md) | The execution flow assumes staff phones with intermittent connectivity inside venues: run-of-show, checklists and arrival lists are readable offline, cue updates and incident reports queue and sync. | Without offline support those steps require connectivity. | Confirmed. Offline operation is required, not optional. |
| W-3 | [Wireframes](wireframes.md) | Responsive web: three layouts at 1200 px and above (rail, content, optional side panel), 768 to 1199 px (collapsible rail, single content column), below 768 px (bottom tabs, stacked cards, full-width sheets). Touch targets 44 px minimum. WCAG 2.1 AA for the client and guest portals, AA intent for the team workspace. | Native apps would reuse the mobile layouts as their information architecture. | Changed. Native apps for client and team with phone and tablet layouts; the client portals also in the browser; responsive web for the public site. |
| V-4 | [Test cases](test-cases.md) | Offline tests (AC-33, AC-13.5, AC-14.5) run in Phase 4 using browser offline emulation in the end-to-end runner. | Without offline support those tests are removed. | Changed. Offline tests move to the first release and run on native builds. |

### Q2 Payment mode for Phase 1

**AMPM decided (2026-10-25).** AMPM creates the client's account or sends an invitation link. The client enters basic wedding details (couple's names, contact information, tentative dates, preferred locations) and pays the subscription online by card or UPI. The gateway provider will be selected by AMPM. Payments must create a record, activate the subscription once, and be reviewable by authorised staff. Decided 26 October 2026: Razorpay is the gateway.

Dependent assumptions: **5**

| ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |
|---|---|---|---|---|
| A-2 | [Data model](data-model.md) | Phase 1 supports both an online payment gateway (webhook-driven activation) and offline payment recorded manually by Finance. Both paths create a `payments` row; subscription activation keys off `payments.status = succeeded`. | Offline-only: gateway fields (`provider`, `provider_ref`) stay unused. Online-only: `method = bank_transfer` path is disabled. | Changed. Online payment only, by card or UPI through Razorpay, after AMPM creates or invites the account and the client enters basic wedding details; no refund is offered; manual recording stays as a staff fallback. |
| T-3 | [Architecture](architecture.md) | Razorpay for online payments (UPI, cards, net banking, payment links), hosted checkout, webhook-driven activation. Offline payments are recorded manually and activate the same way. | PayU, Cashfree or Stripe India fit the same adapter. Offline-only leaves the gateway adapter dormant. | Confirmed. Razorpay, card and UPI, hosted checkout, activation once per transaction; no refunds offered. |
| U-2 | [User flows](user-flows.md) | The public subscription page explains plans and collects a request. AMPM creates the account and invites the primary contact; the client chooses a plan and pays inside the portal after activation. Online checkout and offline bank transfer both end in the same activation step. | Anonymous checkout that creates the account automatically would contradict WHY §4 and is not drawn. | Confirmed. Confirmed; the client also completes basic wedding details before paying; payment online only. |
| W-15 | [Wireframes](wireframes.md) | Plan selection and payment happen on CP-11 after activation; PUB-07 explains plans and collects a request only. | Anonymous checkout contradicts WHY §4 and is not specified. | Confirmed. Purchase after activation, with the basic wedding details form first. |
| V-1 | [Test cases](test-cases.md) | Payment tests run against the gateway's sandbox with test keys and simulated webhooks, plus the manual bank-transfer path. No real card or bank data is ever used. | Offline-only payments deactivate the gateway tests; a different gateway swaps the sandbox. | Confirmed. Razorpay sandbox for the contract tests. |

### Q3 Subscription shape

**AMPM decided (2026-10-25).** The subscription is for hotel discovery only: Rs 50,000, one-time, one month from activation, configurable in settings. Renewal is a new purchase. After expiry the client keeps read-only access to saved hotel names and existing enquiries; nothing is deleted; renewal restores access and data. There is no separate trial: the demo, reached by mobile OTP, serves that purpose. Decided 26 October 2026: the demo has no time limit, shows three locations with one real hotel each at indicative prices, and is managed by the admin; no refund is offered on the subscription.

Dependent assumptions: **5**

| ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |
|---|---|---|---|---|
| A-3 | [Data model](data-model.md) | `plans` supports one-time fixed-term and recurring billing. v1 is configured as one-time fixed-term with manual renewal. Trial is a subscription status (`trial`) on a plan with `trial_days`. Demo is a plan flagged `is_demo` on an account flagged `is_demo`. Module entitlements come from `plan_modules`. | Recurring billing needs an additional `subscription_invoices` cycle and dunning states; the tables here already carry `auto_renew` and `ends_at`. | Confirmed. Rs 50,000, one-time, one month, configurable; renewal is a new purchase; no separate trial plan, the demo serves that purpose. |
| P-7 | [Permission matrix](permission-matrix.md) | A Demo Prospect sees a curated subset of real hotels with commercial fields masked, one sample wedding read-only, and can save hotels and submit an enquiry that routes to Sales rather than to the Hotel team. | Invented sample hotels instead of masked real ones changes the data, not the permissions. | Changed. Demo users see a limited set of hotels with indicative prices, not masked prices. |
| U-1 | [User flows](user-flows.md) | Demo access is granted by Sales from the lead record: Sales creates a demo account on the demo plan, the prospect receives an invitation, and the demo expires after the plan's trial days. There is no self-serve demo. | A self-serve time-boxed trial would add an automatic grant step on the public page; the no-self-registration rule (WHY §4) still requires Sales approval of the account. | Confirmed. Sales authorises the demo; OTP login; no expiry; optional 15 to 20 minute Zoom call before purchase. |
| W-15 | [Wireframes](wireframes.md) | Plan selection and payment happen on CP-11 after activation; PUB-07 explains plans and collects a request only. | Anonymous checkout contradicts WHY §4 and is not specified. | Confirmed. Purchase after activation, with the basic wedding details form first. |
| V-10 | [Test cases](test-cases.md) | Demo isolation tests assume demo data in the same database behind flags; the tests prove that no query path reaches non-demo rows. | A separate demo database replaces these with an environment-separation check. | Changed. Demo content: three real hotels with indicative prices and no expiry; isolation tests stand. |

### Q4 Client-visible finance

**AMPM decided (2026-10-25).** Hotel discovery is a separate paid service. The wedding management fee is decided separately by AMPM, outside the app, and never derived from the subscription. Internal costs, margins, vendor rates, quotations, commissions and negotiations are never shown to clients. Vendor profiles and service details are visible only after AMPM is appointed. Online collection of wedding milestone payments is not required in the first release unless AMPM separately approves it. **Still open:** Which client-facing amounts appear in the wedding portal (budget summary, approved amounts, invoices, payment status); Which hotel-assistance services beyond availability checks carry a fee.

Dependent assumptions: **6**

| ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |
|---|---|---|---|---|
| A-4 | [Data model](data-model.md) | AMPM may earn a margin on vendor and hotel pricing. Every commercial record therefore stores client-facing amounts and internal cost in separate columns (`vendor_proposals`, `hotel_proposals`, `budget_lines`, `room_blocks`, `project_final_accounts`). Clients see estimates, approved amounts, invoices issued to them, their own payments and outstanding milestones. Clients never see vendor quotes, internal cost, margin, vendor invoices or vendor contracts. | Transparent fee model: internal cost columns equal client amounts and an explicit AMPM fee budget line is added. No structural change. | Partly decided. Internal cost and margin never shown: confirmed. Wedding management fee set outside the app. Online milestone payment is out of the first release. Which client-facing amounts the wedding portal shows is still to be confirmed. |
| P-3 | [Permission matrix](permission-matrix.md) | Four finance visibility tiers: client-facing amounts; internal cost and margin; vendor and hotel contracts, quotes and received invoices; bank details. Each tier has its own permission key. | A transparent fee model removes the second tier's secrecy but keeps the keys. | Confirmed. Internal commercial data never reaches clients; internal access restricted to authorised personnel. |
| U-3 | [User flows](user-flows.md) | An availability check is included in the hotel-discovery subscription. Negotiation, site visits, contract review and booking assistance are chargeable service types that require an accepted service agreement before work starts. | If all assistance is included, the agreement branch in flow 2 is skipped; if availability checks are chargeable too, the branch moves earlier. | Partly decided. Availability checks on request confirmed as part of the subscription; fees for other hotel services not addressed. |
| W-5 | [Wireframes](wireframes.md) | Finance regions render only when the principal's response model contains the fields. A Viewer without `can_view_finance` sees no budget region and no placeholder for it. | None structural. | Changed. No finance flag; the two representatives have equal rights; what finance the portal shows is to be confirmed. |
| W-14 | [Wireframes](wireframes.md) | Booking-milestone amounts on CP-09 are shown only where the client pays the hotel directly, mirroring the data model's note on `booking_milestones.amount`. | Hide or show all. | Still open. Not addressed. |
| V-8 | [Test cases](test-cases.md) | Finance-leak tests assert the absence of internal fields by comparing every client-facing response against the serialiser schema, not by spot checks. | A transparent fee model keeps the tests; the internal fields still exist. | Confirmed. Finance-leak tests across screens, exports, notifications and APIs. |

### Q5 Client-side users

**AMPM decided (2026-10-25).** Only two nominated family representatives use the client portal, one from the bride's side and one from the groom's side; the families decide who. No other family member may hold an account without AMPM's authorisation. Cost and margin information is never visible to them. AMPM may record a decision made outside the portal when a note or supporting record is attached. Confirmed 26 October 2026: the client-portal access and permission rules of the brief's section 5 stand as written. Working decision on logins: two individually authenticated accounts, the brief's stated preference, to be countersigned. **Still open:** Login implementation: working decision of 26 October 2026 is two individually authenticated accounts; AMPM to countersign; Whether one representative's approval completes a decision or both must approve.

Dependent assumptions: **4**

| ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |
|---|---|---|---|---|
| A-5 | [Data model](data-model.md) | Several client users per wedding through `project_members` with `project_role` in {client_owner, client_approver, client_viewer}. Finance visibility is a separate flag `can_view_finance`. Approvals need one decision by default; `approvals.required_decisions` allows more. | Single client login: only `client_owner` is used. Multiple mandatory approvers: set `required_decisions` per approval type in configuration. | Changed. Two family representatives, one per side, with equal rights; no viewer role and no finance flag; working decision two individually authenticated accounts, each verified by email and mobile, to be countersigned. |
| P-2 | [Permission matrix](permission-matrix.md) | Three client roles per wedding: Owner (full client access, approves, sees finance), Approver (approves, sees finance only if flagged), Viewer (reads shared information, no finance, no guest list). | Fewer roles collapse columns; more roles add columns. | Changed. Two family representatives with equal rights replace the owner, approver and viewer roles. |
| U-4 | [User flows](user-flows.md) | Client decisions are made in the portal by the Client Owner or an Approver. When the family decides by phone, the Project Manager records the decision on their behalf with evidence; the flows show this as an explicit branch. | Forbidding on-behalf decisions removes that branch. | Confirmed. On-behalf decisions with a note or record. |
| V-14 | [Test cases](test-cases.md) | On-behalf decision tests require an evidence document and assert the audit badge. | Forbidding on-behalf decisions turns those tests into denial tests. | Confirmed. On-behalf decision tests stand. |

### Q6 Roles

**AMPM decided (2026-10-25).** AMPM manages the system and controls permissions. Staff access is restricted by assigned responsibilities and department; a department manager on a phone sees only their own sections. Functional departments named: hotel team, vendor team, RSVP team, hospitality team, production team, project manager, senior authorised management. Internal financial information is restricted to specifically authorised personnel. **Still open:** Final staff role list and which users may see hotel costs and vendor costs.

Dependent assumptions: **4**

| ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |
|---|---|---|---|---|
| A-6 | [Data model](data-model.md) | The eleven roles in SPEC §6 are adopted as global staff roles plus external roles (client roles via project membership, guest via token, demo prospect). Internal cost and margin are readable by Super Admin and Finance everywhere, by the Wedding Project Manager on assigned projects, by the Vendor Coordinator for vendor-side cost and by the Hotel team for hotel-side cost. | Role changes alter `roles` and `role_permissions` seed data only. | Partly decided. Department-based access confirmed; the final role list and who may see hotel and vendor costs are to be confirmed by AMPM. |
| P-1 | [Permission matrix](permission-matrix.md) | The nine staff roles from SPEC §6 are global roles. Five of them (Project Manager, Creative, Vendor Coordinator, RSVP, Hospitality) act only on weddings they are members of; four (Super Admin, Sales, Hotel team, Finance) act across all records in their module. | Changing a role's reach changes its scope qualifier in the matrix, nothing else. | Partly decided. Departments confirmed; final roles and cost access to be confirmed. |
| P-9 | [Permission matrix](permission-matrix.md) | Decisions that belong to the client (approvals, vendor selection) can be recorded on the client's behalf by the Project Manager or Super Admin only with an evidence document attached; the audit log shows who recorded it. | AMPM may forbid on-behalf recording entirely. | Confirmed. On-behalf decisions allowed with a note or supporting record. |
| T-14 | [Architecture](architecture.md) | Support model includes on-call cover on wedding days and a deployment freeze while any project is in `live` status. | Office-hours-only support shifts incident handling to AMPM staff on the day. | Not addressed, stands. Not addressed; stands. |

### Q7 Guest identity in the RSVP portal

**AMPM decided (2026-10-25).** Guest invitation links are issued per side (one for the bride's side, one for the groom's side) or as one combined link when AMPM chooses; the final structure is to be decided. The RSVP team imports or creates the guest list and sends the links. Guests cannot see other households or the guest list, and cannot edit a submitted response; corrections go through a change request or the help option to the RSVP caller. The two family representatives see approved RSVP summaries and cannot edit the list. Each guest is counted individually, children included; meal preference, allergies where required, rooming and travel where applicable are collected. **Still open:** Final link structure: per side, or one combined link.

Dependent assumptions: **5**

| ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |
|---|---|---|---|---|
| A-7 | [Data model](data-model.md) | The guest list is loaded first (client upload or AMPM entry). Each family group receives a unique tokenised RSVP link. Guests respond per person per function. A group may add accompanying members up to `family_groups.max_additional_guests` (default 0). There is no open registration. Dietary preference is collected for everyone; allergies and accessibility needs are optional and SENSITIVE. The client sees their own guest list except RESTRICTED and identity fields. | One shared wedding link would require a guest self-identification step and a de-duplication queue; `rsvp_tokens.family_group_id` would become nullable. | Changed. Links per side or one combined link (final structure open); guests identify themselves against the loaded list; no editing after submission; corrections through the RSVP team. Per-person counting, meal preference and allergies confirmed. Family representatives see summaries only and cannot edit the list. |
| P-4 | [Permission matrix](permission-matrix.md) | A guest token grants access to one family group only: read its members, update their attendance and dietary preferences, add members up to the group's allowance, submit travel details and support requests. Nothing outside the group is reachable. | A shared wedding link would require a self-identification step before any of this. | Changed. Links per side or combined; guests identify themselves; no editing after submission; no access to other households. |
| U-5 | [User flows](user-flows.md) | The guest list is uploaded by the Client Owner or entered by the RSVP team before invitations go out. Each family group receives one tokenised link. Groups that have not responded receive reminders at configured intervals, then a call from the RSVP team, whose assisted entry writes the same records. | A single open wedding link would insert a self-identification step at the start of flow 7. | Changed. Per-side or combined links; guests cannot edit after submitting; corrections through the RSVP team; reminders stand. |
| W-6 | [Wireframes](wireframes.md) | The guest portal is a mobile-first single-column wizard with no sign-in, a language switch, and a consent notice on the first step. It never shows other households or counts. | A single open wedding link would add a "find your invitation" step before GR-02. | Partly decided. Per-side links with self-identification; no editing after submission; wizard otherwise stands. |
| V-9 | [Test cases](test-cases.md) | RSVP tests assume one token per household. A dormant test set for a single open wedding link is listed under AC-10 and activated only if AMPM chooses that model. | Activate the dormant set. | Changed. The per-side link tests activate; household-token tests become the alternative. |

### Q8 Identity documents

**AMPM decided (2026-10-25).** Identity documents may be collected only where a hotel requires them for a wedding, under AMPM's control, in restricted storage, visible only to authorised staff, and never Aadhaar documents or numbers. Nothing is deleted automatically; retention and deletion follow AMPM-approved policy, to be confirmed before launch. **Still open:** Retention period and privacy wording for identity documents.

Dependent assumptions: **4**

| ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |
|---|---|---|---|---|
| A-8 | [Data model](data-model.md) | Identity documents are collected only when a project enables it for a defined purpose (hotel check-in). Aadhaar numbers are never stored. Accepted types: passport, voter ID, driving licence. Files live in a separate restricted bucket. `retention_until` defaults to checkout plus 30 days. Every read is audited. | If AMPM needs Aadhaar for a legal reason, add `document_type = aadhaar_masked` storing only the last four digits and the UIDAI-compliant masked image, after legal review. | Partly decided. Per wedding, no Aadhaar, restricted storage: confirmed. Automatic deletion removed; retention follows AMPM-approved policy, to be confirmed. |
| P-5 | [Permission matrix](permission-matrix.md) | Identity documents are readable only by RSVP staff holding an explicit `guests.identity_documents.read` permission on that wedding and by Hospitality staff at check-in. Super Admin has audited break-glass read. Clients, Finance, Sales, Creative and Vendor Coordinators never see them. Exports never include them. | Removing break-glass makes Super Admin equal to the other excluded roles. | Confirmed. Identity documents restricted to authorised staff; break-glass not addressed. |
| W-9 | [Wireframes](wireframes.md) | Identity-document upload appears in GR-05 only when the project enables identity capture; staff see a masked reference and an audited "view document" action only with the explicit grant. | None structural. | Partly decided. No automatic deletion; retention per policy. |
| V-7 | [Test cases](test-cases.md) | Identity-document tests use synthetic images and a syntactically valid but fictitious Aadhaar-format number to prove rejection. No real identity document ever enters a test environment. | None. | Confirmed. Synthetic identity test data. |

### Q9 Hotel data

**AMPM decided (2026-10-25).** Eva maintains the existing hotel data and updates seasonal prices roughly three times a year. Hotel pages show hotel and venue details, rooms, photographs and videos, food and menu information in a grid, approximate room pricing, wedding package price ranges, indicative venue rental, approximate per-plate pricing, capacity and facilities, and street view or map location. Prices are indicative ranges with a last-verified date, never internal cost. Availability is checked by the team when a client requests it or adds a hotel to their selection. Previous clients' photographs appear only with permission, controlled by AMPM. Hotels can be imported from spreadsheets. About 200 hotels at the start.

Dependent assumptions: **1**

| ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |
|---|---|---|---|---|
| A-9 | [Data model](data-model.md) | Hotel commercials are modelled as indicative rate cards with line items (room rate by category, venue rental, per-plate minimums, taxes), client-visible once verified. Negotiated rates for a specific client live in `hotel_proposals` with client and internal amounts. Availability is checked manually per enquiry; there is no availability calendar. Media carry per-asset rights status. Hotels are bulk-imported from spreadsheets through `import_jobs`. | A live availability calendar adds `hotel_availability_days`; different price structures change `hotel_rate_items.item_type` values only. | Confirmed. Confirmed and extended: prices are indicative ranges including wedding package ranges and per-plate pricing, menu grids, street view; Eva updates about three times a year; about 200 hotels at the start. |

### Q10 Phase 1 scope

**AMPM decided (2026-10-25).** The first release includes the demo and the subscription hotel-discovery workflow, wedding management after appointment, vendor selection, the client portal, department-based team access, RSVP, tracked requests, live chat and offline wedding-day operations. It excludes website editing, online milestone payments and GST invoicing. Only Eva's authorised personnel may approve operational exceptions; the authority must be configurable. Decided 26 October 2026: the whole first release goes live at once, in one launch.

Dependent assumptions: **8**

| ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |
|---|---|---|---|---|
| A-10 | [Data model](data-model.md) | Phase 1 includes demo/trial, the full ten-status hotel enquiry flow, online payment and a minimal built-in CMS. Phase tags per table are in §19. | Removing an item from Phase 1 moves its tables to a later phase; nothing else changes. | Changed. First release includes discovery, wedding management, vendors, client portal, department access, RSVP, requests, live chat and offline operations; excludes website editing, online milestone payments and GST invoicing. Single or staged launch to be agreed. Launched at once in one go-live (decided 26 October 2026). |
| P-8 | [Permission matrix](permission-matrix.md) | Readiness exceptions (letting a function go live with a required check unmet) may be authorised by the Project Manager of that wedding or by Super Admin. | AMPM may restrict this to Super Admin. | Changed. Only Eva's authorised personnel may authorise exceptions; the authority is configurable but the policy names Eva. |
| T-10 | [Architecture](architecture.md) | Phase 1 is deployed on the full production topology from the start; there is no throwaway hosting. | A reduced Phase 1 runs single-availability-zone database and one task per service on the same code. | Changed. One box from phase 1: production and staging as separate Compose projects on the KVM 4; staging moves to a small second VPS if the box runs tight. |
| U-1 | [User flows](user-flows.md) | Demo access is granted by Sales from the lead record: Sales creates a demo account on the demo plan, the prospect receives an invitation, and the demo expires after the plan's trial days. There is no self-serve demo. | A self-serve time-boxed trial would add an automatic grant step on the public page; the no-self-registration rule (WHY §4) still requires Sales approval of the account. | Confirmed. Sales authorises the demo; OTP login; no expiry; optional 15 to 20 minute Zoom call before purchase. |
| U-6 | [User flows](user-flows.md) | A wedding project is created when a service agreement for anything beyond hotel assistance (design, vendor coordination, full management) is accepted. Project creation back-fills the account's saved hotels, enquiries and agreements. | AMPM may prefer to create the project earlier, at the first engagement conversation, in `setup` status. | Confirmed. The agreement is recorded by AMPM and the project created by AMPM. |
| W-1 | [Wireframes](wireframes.md) | The client portal has five navigation entries: Home, Hotels, My Wedding, Approvals, More. A subscriber-only account sees My Wedding and Approvals as locked entries with a one-line explanation; an engaged account sees them live. The client-portal flowchart's four tabs omitted Hotels, the Phase 1 product. | Hiding the locked entries entirely is a one-line change; dropping Hotels is not possible while hotel discovery is the subscription product. | Partly decided. Hotels entry confirmed; vendor selection stays locked until appointment; the home page gains help and live chat; the initial structure is acceptable for the first release. |
| V-10 | [Test cases](test-cases.md) | Demo isolation tests assume demo data in the same database behind flags; the tests prove that no query path reaches non-demo rows. | A separate demo database replaces these with an environment-separation check. | Changed. Demo content: three real hotels with indicative prices and no expiry; isolation tests stand. |
| V-11 | [Test cases](test-cases.md) | Phase exit packs assume the Phase 1 scope of A-10 (demo, full consultancy statuses, online payment, built-in CMS). | Items leaving Phase 1 move their tests to the later phase's pack. | Changed. Exit packs follow the first-release scope. |

## Tier 2 — before the Phase 1 build

### Q11 Guest and client communication channels

**AMPM decided (2026-10-25).** Email and WhatsApp are required; SMS is proposed. Live chat is also required on the home page. Providers are to be confirmed. **Still open:** WhatsApp and SMS providers.

Dependent assumptions: **4**

| ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |
|---|---|---|---|---|
| A-11 | [Data model](data-model.md) | Notification channels are in-app, email and WhatsApp (via a business service provider) with SMS fallback. `notifications.channel` enumerates them. | Unused channels are disabled in configuration. | Partly decided. Email and WhatsApp required, SMS proposed, providers to be confirmed; live chat added. |
| T-4 | [Architecture](architecture.md) | WhatsApp Business Platform through a business solution provider, Amazon SES for email, an Indian SMS provider with DLT registration for OTP and fallback. All behind one notification adapter. | Any provider swap is an adapter change. Dropping WhatsApp removes the longest onboarding lead time (§10). | Partly decided. Email and WhatsApp required, SMS proposed; providers to be confirmed. |
| U-10 | [User flows](user-flows.md) | Notifications go to each recipient's preferred channel. WhatsApp requires an opt-in captured on the enquiry form or in the RSVP portal; without it the platform uses email or SMS. | Dropping WhatsApp removes the opt-in step. | Not addressed, stands. Not addressed; stands. |
| V-2 | [Test cases](test-cases.md) | Messaging tests use provider sandboxes. WhatsApp template delivery is stubbed until templates are approved; delivery-status webhooks are simulated. | Dropping a channel removes its tests. | Partly decided. Provider sandboxes depend on the provider choice. |

### Q12 Public website

**AMPM decided (2026-10-25).** No. AMPM staff will not edit public website content through the app in the initial scope; the website editor is not approved.

Dependent assumptions: **3**

| ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |
|---|---|---|---|---|
| A-12 | [Data model](data-model.md) | A minimal built-in CMS (`cms_pages`, `cms_showcase_items`) lets AMPM edit destinations, showcase items and page copy. | A headless CMS replaces these two tables with an integration. | Dropped. No website editing in the app; the website is maintained outside the platform. |
| T-5 | [Architecture](architecture.md) | Built-in content tables (`cms_pages`, `cms_showcase_items`) rendered statically by the public web app. | A headless CMS replaces the two tables with a fetch at build time. | Dropped. No content editor; the website is static and maintained outside the app. |
| W-4 | [Wireframes](wireframes.md) | Public pages are rendered statically from the content tables; editors change copy and showcase items in TW-97, not in code. | A headless CMS changes the editor, not the pages. | Dropped. No website editor. |

### Q13 Sign-in

**AMPM decided (2026-10-25).** Prospects, demo users and clients sign in with their mobile number and an OTP. There is no unrestricted self-registration; AMPM creates the account or sends an invitation. Staff have individual authorised accounts with role- and department-based access; the exact staff authentication method is to be finalised with the development team. Decided 26 October 2026: a client is verified by both email and mobile number; sign-in stays by mobile number and OTP. Decided 26 October 2026: staff sign in with a password and an authenticator-app code; the identity service is Amazon Cognito in Mumbai.

Dependent assumptions: **6**

| ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |
|---|---|---|---|---|
| A-13 | [Data model](data-model.md) | Clients sign in with email and password, with phone OTP as an optional second factor. Staff must use email, password and an authenticator app (TOTP). Guests use token links only and never have accounts. | Phone-OTP-only for clients changes `users.password_hash` to nullable and adds an OTP flow on `auth_tokens`. | Changed. Clients are verified by email and mobile and sign in with mobile OTP; staff sign in with a password and an authenticator-app code; the identity service is Cognito. |
| P-6 | [Permission matrix](permission-matrix.md) | Staff sign in with email, password and an authenticator app. Clients sign in with email and password with optional phone OTP. Guests never sign in; they hold a token. Demo prospects sign in like clients to a demo account. | Phone-OTP-only for clients changes the sign-in step, not the matrix. | Changed. Mobile OTP for prospects and clients; staff method to be finalised. |
| T-6 | [Architecture](architecture.md) | Authentication inside the API: Argon2id passwords, authenticator-app codes mandatory for staff, phone OTP optional for clients, invitation and reset tokens, server-side sessions in secure cookies, guest access by tokenised link. No self-registration anywhere. | A managed identity provider (Cognito, Auth0, Keycloak) can front the same session model; guest tokens and entitlements stay in the API. | Changed. Identity through Amazon Cognito (Mumbai): OTP for prospects and clients with email and mobile verified at activation, password plus authenticator app for staff; principals, guest tokens, entitlements and no self-registration in the API. |
| U-9 | [User flows](user-flows.md) | Staff sign in with email, password and an authenticator code; clients with email and password plus optional phone OTP; guests never sign in and use their token link; demo prospects sign in like clients. | Phone-OTP-only for clients changes the client branch of flow 11. | Changed. Client activation verifies email and mobile; OTP sign-in for clients; staff by password plus authenticator-app code. |
| W-7 | [Wireframes](wireframes.md) | Sign-in screens follow A-13: email and password, authenticator code for staff, optional phone OTP for clients, invitation and reset links. There is no registration screen anywhere. | Phone-OTP-only changes AUTH-01 only. | Changed. OTP sign-in screens for prospects and clients. |
| V-3 | [Test cases](test-cases.md) | Authentication tests cover email and password, authenticator codes for staff, optional phone OTP for clients, and guest token links. There is no registration test because there is no registration. | Phone-OTP-only for clients changes AC-17 only. | Changed. OTP sign-in tests for clients and prospects. |

### Q14 Hosting and data residency

**AMPM decided (2026-10-25).** Hosting arrangements, backup frequency and recovery timelines are yet to be confirmed with the developer. Decided 26 October 2026: everything runs on AMPM's dedicated VPS, a Hostinger KVM 4 in the India (Mumbai) datacentre, with pgBackRest archives to a Mumbai S3 bucket and rehearsed monthly restores (recovery point about one minute, rebuild within four hours), files and identity documents in Mumbai buckets, Cognito for identity; the specification is docs/engineering/vps-setup.md.

Dependent assumptions: **4**

| ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |
|---|---|---|---|---|
| A-14 | [Data model](data-model.md) | Hosted in an Indian region with private object storage. No schema impact; noted so retention and residency rules are consistent. | None for the schema. | Changed. Hosted on AMPM's dedicated VPS, a Hostinger KVM 4 in Mumbai; backups and files in Mumbai S3 buckets; all personal data stays in India. |
| T-2 | [Architecture](architecture.md) | AWS, Mumbai region (ap-south-1), with backup copies in Hyderabad (ap-south-2). All personal data stays in India. | The same topology runs on Google Cloud or Azure India regions. Containers and PostgreSQL keep the platform portable. | Changed. Hostinger KVM 4 in the India (Mumbai) datacentre instead of AWS compute; Mumbai S3 buckets for backups, media and the restricted identity store; Cognito in Mumbai for identity. |
| T-13 | [Architecture](architecture.md) | Backups: database point-in-time recovery for 35 days plus daily snapshots copied to the second region; object storage versioning and cross-region replication; quarterly restore drill. Recovery point 15 minutes, recovery time 4 hours. | Tighter targets need a warm standby in the second region at roughly double the database cost. | Changed. pgBackRest archives to an encrypted Mumbai bucket forced every minute, full weekly and differential daily, retention two full sets and fourteen days; Hostinger weekly backups and snapshots as the second layer; monthly restore rehearsal into staging, quarterly full rebuild; targets fifteen minutes and four hours measured, not assumed. |
| V-13 | [Test cases](test-cases.md) | Backup and restore drills run quarterly in staging; the first drill is a Phase 5 exit gate. Recovery point and time are measured, not assumed. | Tighter targets change the thresholds. | Changed. The restore drill is the monthly pgBackRest rehearsal into staging and the quarterly rebuild; AC-22 measures the recovery point and time. |

### Q15 Volumes

**AMPM decided (2026-10-25).** About 200 hotels at the start and roughly 20 concurrent weddings as a planning assumption; multiple weddings and departmental staff access; staff and guest capacity to be confirmed. **Still open:** Staff count and largest guest count.

Dependent assumptions: **4**

| ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |
|---|---|---|---|---|
| A-15 | [Data model](data-model.md) | Sizing used for index and partition choices: up to 50 staff users, 40 concurrent projects, 1,500 guests per project, 500 hotels, 2 TB of media in year one. | Larger volumes change indexing and partitioning (notably `audit_events`, `notifications`, `guest_function_attendance`), not the model. | Changed. About 200 hotels and 20 concurrent weddings; staff and guest capacity to be confirmed. |
| T-7 | [Architecture](architecture.md) | Sized for 50 staff, 40 concurrent weddings, 1,500 guests per wedding, 500 hotels, 2 TB of media in year one. A modular monolith (one API, one worker) serves this with room for tenfold growth by adding replicas. | Beyond tenfold growth, media processing and notifications move to their own services; the module boundaries in §5 are the seams. | Changed. Sized for about 200 hotels and 20 concurrent weddings; the monolith still fits. |
| W-11 | [Wireframes](wireframes.md) | List screens paginate at 50 rows with server-side filters and sorting; guest and vendor lists have bulk actions (SPEC §10). | Page size is configuration. | Not addressed, stands. Not addressed; stands. |
| V-5 | [Test cases](test-cases.md) | Load tests run at twice the sizing assumptions: 100 concurrent staff users, 1,500 guests responding within one hour, 500 hotels searchable, with the targets of T-12. | Different volumes rescale the profiles; different targets rescale the thresholds. | Changed. Load profiles rescaled to 200 hotels and 20 weddings; staff and guest numbers to be confirmed. |

### Q16 Currency, language and tax

**AMPM decided (2026-10-25).** Indian rupees. English as the primary language. The platform will not issue GST invoices.

Dependent assumptions: **3**

| ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |
|---|---|---|---|---|
| A-16 | [Data model](data-model.md) | Single currency (INR) at launch; a `currency` column is kept wherever money appears. GST fields exist on invoices and invoice lines. English only. Time zone is stored per project, default Asia/Kolkata. | Multi-currency adds exchange-rate snapshots on `payments` and `budget_lines`. | Confirmed. INR and English confirmed; the platform does not issue GST invoices, so GST fields are dormant. |
| T-8 | [Architecture](architecture.md) | INR, English, Asia/Kolkata by default; GST fields present; the guest portal is built with a translation layer from day one so Hindi or other languages are a content task, not a rebuild. | Multi-currency adds exchange-rate snapshots to money fields. | Confirmed. INR and English. |
| V-12 | [Test cases](test-cases.md) | GST invoice tests assume AMPM issues invoices from the platform. | If invoices come from an accounting system, AC-36.3 and AC-36.4 are dormant. | Dropped. No GST invoices from the platform. |

### Q17 Privacy notice, consent wording and retention schedule

**AMPM decided (2026-10-25).** AMPM will decide the final privacy wording and the data retention policy. Retention and deletion require AMPM's approval; guest and wedding information must remain access-controlled; wedding records are not deleted automatically. **Still open:** Privacy wording; Retention periods for leads, guest records and identity documents.

Dependent assumptions: **6**

| ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |
|---|---|---|---|---|
| A-17 | [Data model](data-model.md) | Retention classes: closed leads 24 months; guest personal data 12 months after project close; identity documents checkout plus 30 days; demo data reset on a schedule. `retention_class` and `retention_until` sit on `documents`, `identity_documents` and `wedding_projects.client_access_until`. | Different periods are configuration values. | Changed. No automatic deletion; retention and deletion require AMPM approval; periods to be confirmed. Jobs become proposed deletion lists awaiting approval. |
| P-10 | [Permission matrix](permission-matrix.md) | Exports never include SENSITIVE or identity fields. Exports containing internal cost and margin are limited to Finance and Super Admin. Every export is audited with its filter and row count. | None structural. | Confirmed. Exports and APIs must never expose internal commercial data; stands. |
| T-9 | [Architecture](architecture.md) | Retention jobs, consent capture at the enquiry form and RSVP portal, erasure handled through support tooling, breach runbook. Designed to the Digital Personal Data Protection Act 2023 (GP-40). | Periods and notice wording are configuration and copy. | Changed. No automatic deletion; retention actions require AMPM approval. |
| W-13 | [Wireframes](wireframes.md) | Consent copy on PUB-06 and GR-01 and the privacy notice (PUB-08) are configurable text approved by AMPM. | None. | Confirmed. AMPM decides the wording. |
| V-6 | [Test cases](test-cases.md) | Retention tests use accelerated clocks: retention periods are configuration and are set to minutes in the test environment. | Periods change the configuration, not the tests. | Changed. Retention tests cover the approval workflow, not automatic deletion. |
| V-15 | [Test cases](test-cases.md) | Test data is synthetic: fictitious names, phone numbers in reserved ranges, example-domain emails, generated images. Staging never holds real guest data (architecture §12). | None. | Not addressed, stands. Not addressed; stands. |

## Tier 3 — before Phases 2 to 4

### Q18 Multi-hotel weddings and venues outside the database

**AMPM decided (2026-10-25).** Yes. A wedding can involve multiple hotels and venues.

Dependent assumptions: **1**

| ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |
|---|---|---|---|---|
| A-18 | [Data model](data-model.md) | A wedding may use several hotels (`project_hotels`) and venues outside the database (`external_venues`). `wedding_projects.primary_hotel_id` is a convenience pointer only. | Single-hotel weddings simply have one `project_hotels` row. | Confirmed. Multiple hotels and venues per wedding. |

### Q19 Room blocks and rooming rules

**AMPM decided (2026-10-25).** Room blocks by hotel, room category and dates. Allocation and rooming are handled by the team, not automatically. Counts must support both room-wise and person-wise calculations, children included.

Dependent assumptions: **1**

| ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |
|---|---|---|---|---|
| A-19 | [Data model](data-model.md) | Room blocks are held per project, hotel, room category and date range. Allocations reference a block. Occupants are individual guests, children included. Sharing rules are not enforced by the schema. | Rules such as "two adults per room maximum" become validations, not schema. | Confirmed. Room blocks by hotel, category and dates; team-managed allocation; room-wise and person-wise counts, children included. |

### Q20 In-portal messaging or questions: in scope or handled outside the platform

**AMPM decided (2026-10-25).** Both tracked requests with conversation history and live chat are required; live chat on the home page, distinguished from tracked requests so a formal change request keeps its own approval history. More options may be added later.

Dependent assumptions: **3**

| ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |
|---|---|---|---|---|
| A-20 | [Data model](data-model.md) | No free-form chat in v1. A client "question" is a `client_requests` row of type `question` with a threaded `comments` trail. All exchanges are logged and visible to the assigned team. | Real-time messaging adds `conversations` and `messages`. | Changed. Live chat is required in addition to tracked requests. |
| U-12 | [User flows](user-flows.md) | Questions from clients are requests of type question, answered in a thread; there is no free-form chat. | Real-time messaging would replace the question branch of flow 6. | Changed. Live chat is added alongside tracked requests. |
| W-8 | [Wireframes](wireframes.md) | The client-portal flowchart's "Messages, questions" is delivered as Requests (CP-36, CP-37): typed requests with a threaded conversation, not chat. | Real-time chat would add a conversation screen. | Changed. Live chat screen added; tracked requests stay. |

### Q21 Change-request workflow and statuses

**AMPM decided (2026-10-25).** Change requests are submitted, reviewed, accepted or rejected, then implemented and closed. A change to an approved item creates a new version for approval.

Dependent assumptions: **1**

| ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |
|---|---|---|---|---|
| A-21 | [Data model](data-model.md) | Change requests are `client_requests` of type `change_request` with the statuses listed in §11. A configurable threshold marks a request `is_material`. | Separate change-request table if the workflow diverges from questions. | Confirmed. Confirmed, with a closed status added. |

### Q22 Vendor or hotel logins, now or later

**AMPM decided (2026-10-25).** No vendor or hotel logins in the current version.

Dependent assumptions: **2**

| ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |
|---|---|---|---|---|
| A-22 | [Data model](data-model.md) | Vendors and hotels never log in. `users.user_type` has no vendor value. | A vendor portal later adds a `vendor` user type scoped to `vendor_assignments`; the `vendors` table is unchanged. | Confirmed. No vendor or hotel logins. |
| P-11 | [Permission matrix](permission-matrix.md) | Vendors and hotels have no principal type. | A vendor portal adds a principal with read access to its own assignments and deliverables only. | Confirmed. No vendor principal. |

### Q23 Client portal access after the wedding: how long, and what remains visible

**AMPM decided (2026-10-25).** Read-only client access for three months after the wedding, then the project is archived following AMPM's approval. Records are not deleted; archiving is a change of status and permissions. Later access or reopening is controlled by AMPM. **Still open:** Exact workflow for archiving and for restoring access after archiving.

Dependent assumptions: **2**

| ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |
|---|---|---|---|---|
| A-23 | [Data model](data-model.md) | Clients keep read-only portal access for 12 months after closure (`wedding_projects.client_access_until`), then the project is archived. | The period is configuration. | Changed. Three months of read-only access, then archiving on AMPM approval. |
| U-8 | [User flows](user-flows.md) | Closure ends with a client feedback request, a read-only access window for the client, then archival. | Different window length is configuration. | Confirmed. Confirmed with three months and archiving on approval. |

### Q24 Post-wedding feedback and archive expectations

**AMPM decided (2026-10-25).** A short feedback form after the wedding and an archived state that preserves the records.

Dependent assumptions: **1**

| ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |
|---|---|---|---|---|
| A-24 | [Data model](data-model.md) | Post-wedding feedback is a `client_feedback` row; archive is `wedding_projects.archived_at` plus retention jobs. | None structural. | Confirmed. Feedback form and archived state. |

### Q25 Definition of a "material change" and the resulting flags

**AMPM decided (2026-10-25).** Thresholds must be configurable; AMPM will define the final budget-change percentages, date-change and venue-change thresholds and the approval rules. **Still open:** Material-change thresholds and approval rules.

Dependent assumptions: **2**

| ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |
|---|---|---|---|---|
| A-25 | [Data model](data-model.md) | A change is material when it exceeds configurable thresholds (for example a budget line delta of 10 percent or a date or venue change). Material changes set `is_material` and populate `impact_flags_json`, which drives the §8 automation in the spec. | Thresholds are configuration values. | Partly decided. Configurable thresholds confirmed; values and approval rules to be defined by AMPM. |
| U-11 | [User flows](user-flows.md) | A change request is material when it exceeds configured thresholds; material acceptance raises impact flags and review tasks. | Thresholds are configuration. | Partly decided. Thresholds to be defined. |

## Assumptions tied to an audit finding rather than a question

These resolve an ambiguity, conflict or gap the audit recorded; AMPM confirms them by reviewing the finding.

| Finding | ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |
|---|---|---|---|---|---|
| (no audit reference) | V-16 | [Test cases](test-cases.md) | The authorisation suite is generated from permission-matrix.md §5 and §6, so a change in the matrix changes the tests without hand editing. | None. | Not addressed, stands. Not addressed; stands. |
| AM-3 | A-26 | [Data model](data-model.md) | `functions.status` (planned, confirmed, cancelled) and `functions.readiness_status` are two fields; readiness is derived from the function's checklist. | Merge into one field if AMPM prefers a single status. | Confirmed. Readiness rule confirmed; the two fields stand. |
| AM-5 | A-27 | [Data model](data-model.md) | `hotel_room_categories.room_count` is the inventory in that category; `max_occupancy` is per room. | None. | Not addressed, stands. Not addressed; stands. |
| AM-6 | W-2 | [Wireframes](wireframes.md) | The team workspace uses a left rail with the nine areas of SPEC §2.4 on desktop and tablet, and the team flowchart's five bottom tabs (Home, Clients, Weddings, Tasks, More) on mobile, with Hotels, Guests, Vendors, Finance and Settings under More. The flowchart's "Database" is the Hotels area. A rail entry appears only if the user's roles grant any permission in that area. | A different grouping changes labels and order only. | Confirmed. Department managers on phones see only their own sections. |
| AM-8 | A-28 | [Data model](data-model.md) | Demo data lives in the same database, isolated by `client_accounts.is_demo`, `wedding_projects.is_demo` and `hotels.demo_visible`; demo accounts see a curated subset of real hotels with rate items masked and one sample project. | A separate demo database removes the flags and adds a copy job. | Changed. Demo after OTP with no time limit: three locations, one real hotel each with indicative prices and street view, managed by the admin. |
| AM-9 | A-29 | [Data model](data-model.md) | A subscription belongs to an account and covers every project on that account. | Per-wedding subscriptions add `subscriptions.project_id`. | Not addressed, stands. Not addressed; stands. |
| AM-14 | A-30 | [Data model](data-model.md) | Single tenant (AMPM only). No `organisation_id` column anywhere. | If AMPM intends to license the software, add `organisation_id` to every root table before build; it is expensive to retrofit. | Confirmed. For AMPM's internal use, not for licensing. |
| CF-3 | W-2 | [Wireframes](wireframes.md) | The team workspace uses a left rail with the nine areas of SPEC §2.4 on desktop and tablet, and the team flowchart's five bottom tabs (Home, Clients, Weddings, Tasks, More) on mobile, with Hotels, Guests, Vendors, Finance and Settings under More. The flowchart's "Database" is the Hotels area. A rail entry appears only if the user's roles grant any permission in that area. | A different grouping changes labels and order only. | Confirmed. Department managers on phones see only their own sections. |
| CF-8 | W-12 | [Wireframes](wireframes.md) | Flowchart vocabulary mapped: "Questionnaire" and "Consultation" are lead activity types on TW-11; "Countdown" appears on CP-20 only when the project has dates; "Feedback" is CP-40; "Archive" is the closed state CP-41 and TW-45; "Schedule, calendar" is TW-02. | None. | Not addressed, stands. Not addressed; stands. |
| GP-34 | W-10 | [Wireframes](wireframes.md) | TW-73 (run-of-show live view), TW-74 (readiness) and TW-76 (event-day console) are offline-capable in Phase 4 and show a sync indicator. | Without offline support the indicator is removed. | Changed. Offline screens at launch and extended to tasks, department information and arrival lists. |
| GP-35 | T-12 | [Architecture](architecture.md) | Proposed targets: 99.5 percent monthly availability excluding announced maintenance, API p95 under 400 ms, portal pages interactive under 3 seconds on 4G, WCAG 2.1 AA for client and guest portals, last two versions of Chrome, Safari, Edge and Firefox plus Android WebView. | AMPM may raise or lower; costs scale with availability. | Still open. Targets not addressed; proposal stands. |
| GP-36 | T-12 | [Architecture](architecture.md) | Proposed targets: 99.5 percent monthly availability excluding announced maintenance, API p95 under 400 ms, portal pages interactive under 3 seconds on 4G, WCAG 2.1 AA for client and guest portals, last two versions of Chrome, Safari, Edge and Firefox plus Android WebView. | AMPM may raise or lower; costs scale with availability. | Still open. Targets not addressed; proposal stands. |

## Where each document keeps its own open questions

| Document | Section |
|---|---|
| [requirements-audit.md](requirements-audit.md) | §11 Decisions required from AMPM |
| [data-model.md](data-model.md) | §21 Open modelling questions |
| [permission-matrix.md](permission-matrix.md) | §11 Open questions for review |
| [architecture.md](architecture.md) | §15 Decisions for AMPM |
| [user-flows.md](user-flows.md) | §15 Open questions raised by the flows |
| [wireframes.md](wireframes.md) | §12 Open questions for the screen review |
| [test-cases.md](test-cases.md) | §9 Coverage summary and open questions |
