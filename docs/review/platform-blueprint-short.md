# AMPM Platform — The Blueprint, Short Version

**For:** AMPM review, and the development team · **Date:** 26 October 2026 · **Status:** version 0.1, the sign-off sheet. The [full blueprint](platform-blueprint.md) carries the detail and the sources; this version carries what to lock.

Three marks: **locked** means decided by AMPM on 25 October 2026 or set by its brief; **proposed** means chosen in the drafts and standing unless AMPM says otherwise, a tick locks it; **open** means it needs an answer, numbered R1 to R19 in [the questions still open](remaining-questions.md). Tick each lock box, write changes on the line, and answer the R questions in their own document.

---

## 1. One platform, six experiences, one backend

| # | Experience | Who | Where | What it is for | Locked by |
|---|---|---|---|---|---|
| 1 | Public website | Anyone | Browser | Explain AMPM, take enquiries and demo requests, hold the login entry points; no editing by staff in the app | Brief §13, rules 1 and 15 |
| 2 | Demo | Prospects AMPM authorises | Client app, mobile OTP | Three locations, a few hotels, indicative prices, street view; a Zoom call before buying | Brief §2; R1 answered 26 October |
| 3 | Hotel discovery portal | Clients, ₹50,000 for one month | Client app and browser | Explore, save, compare, enquire, request availability; read-only after expiry, nothing deleted | Brief §3 and §4, rules 3 to 7 |
| 4 | Client wedding portal | Two family representatives | Client app and browser | Follow the wedding, approve versions, request changes, chat; three months read-only after the wedding | Brief §5, §7, §11, §12 |
| 5 | AMPM team app | Staff by role and department | iOS and Android, offline on the day | Everything AMPM does, department by department; the wedding day without signal | Brief §9, §10, §14 |
| 6 | Guest RSVP portal | Invited guests | Browser, from a link | Confirm attendance per person per function and give the details asked | Brief §8, rule 10 |

Everything runs on one backend: one API that holds every rule and permission, one worker for jobs and messages, one database, files in three stores by sensitivity, and a live chat channel. Two rules bind all six: internal costs, margins, vendor rates and negotiations never reach a client by any route, and every permission is enforced on the server (rules 8 and 18).

> **Your decision:** The six experiences and the one backend ☐ locked · changes: ______

---

## 2. The platforms

**Public website.** Pages: Home, About, Services, How It Works, selected work, Contact, Request a Demo, demo and subscription explainer. Enquiry and demo-request forms with consent and source. Login and invitation entry points. Static, maintained by the developer. Nothing private on it.
Locked: pages and forms; no self-registration; no website editing in the app. Proposed: analytics on public pages and a bot check on the forms.
> **Your decision:** ☐ locked · changes: ______

**Demo.** Sales authorises it from the lead; the prospect signs in by OTP; sees up to three locations with one or two hotels each, limited information, indicative prices, street view where available, and a sample wedding; may request the 15 to 20 minute Zoom call; the demo expires; demo data is separate from real data.
Locked: OTP; AMPM controls access; three locations; limited information; separation; and, from 26 October, no time limit, one real hotel per location with indicative prices, managed by the admin (R1 answered). Proposed: one sample wedding.
> **Your decision:** ☐ locked (R1 answered) · changes: ______

**Hotel discovery portal.** Account created or invited by AMPM; basic wedding details; ₹50,000 by card or UPI; activation once per transaction; one month, dates shown; renewal is a new purchase. Hotel pages with venues, rooms, photographs and videos, approximate room pricing, package ranges, indicative venue rental, menu grids (veg and non-veg), approximate per-plate pricing, capacity, facilities, street view, a last-verified date on every price, and the labels indicative, requested, verified, awaiting confirmation. Search, filters, freshness labels, saved hotels, compare. Enquiries and availability requests to the hotel team, who check with the property. Proposals with client amounts only. After expiry: saved hotel names and enquiries readable, nothing deleted. Vendor selection and wedding modules visible as locked entries only.
Locked: all of the above (Brief §2 to §4); Razorpay, no refunds, a browser version of the portals and email-and-mobile verification of the client (26 October). Proposed: the enquiry statuses; a recorded agreement before chargeable work. Open: R8 services with a fee.
> **Your decision:** ☐ locked subject to R8 · changes: ______

**Client wedding portal.** Two representatives, one per side, chosen by the families, no others without AMPM's authorisation. Home with countdown, updates, pending decisions, help and chat; my wedding (profile, functions, venues); hotels and bookings; vendors (five to ten options per category as a guideline, approved profiles, shortlist, select, submit, AMPM's response); proposals, designs, menus and invitations as versions to approve, request a revision or reject, pinned comments, internal comments hidden; one approvals list; the client-facing budget (what it shows: R7); documents by signed link; approved RSVP summaries, no editing; tracked requests with statuses submitted, under review, accepted, rejected, implemented, closed; live chat; feedback form; three months read-only, then archive on approval.
Locked: all of the above (Brief §5, §6, §7, §11, §12; Q20 to Q24), reconfirmed 26 October; the browser version (R4). Working decision: two accounts (R5, to be countersigned). Proposed: five navigation entries; readiness hidden from the client; a contact route after archiving. Open: R6 one approval or both, R7 amounts, R19 archiving mechanics.
> **Your decision:** ☐ locked subject to R6, R7, R19; countersign R5 ☐ · changes: ______

**AMPM team app.** Individual accounts; role and department scoping; a department manager on a phone sees only their sections. Sales: leads, demos, accounts, subscriptions, agreements. Hotel team: the hotel database (add, edit, import from spreadsheets, prices and packages, photographs and menus, who verified what and when, outdated marks, media permissions), enquiries, availability, negotiation with internal notes, site visits, proposals with client and internal amounts apart, booking milestones, room blocks. Project managers: projects, members, functions, tasks, approvals, requests, readiness, run-of-show, incidents, closure. Vendor team: vendor master by category, portfolios, raw quotes (internal), options, proposals, contracts, deliverables. Creative: design versions. RSVP team: guest lists, households and sides, links, reminders, call list, corrections, identity documents with an explicit grant. Hospitality: room blocks and allocations, rooming lists, travel, transfers, manifests, check-in, lost and found, departures. Production: readiness checklists, cue sheets, staffing, production items. Finance: budgets, cost entries, quotes, contracts, internal invoices, payments, milestones, final accounts, exports. Super Admin: roles, settings (subscription price and duration, demo limits, categories, thresholds, change-request rules, access and approval settings), retention approvals, archiving, reopening, exceptions (Eva's authorised personnel). Offline on the day: assigned tasks, department information, readiness checklists, cue sheets, arrival and operational lists; offline updates queue and sync; offline and pending state shown; no silent loss; conflicts detected and resolved; encrypted, role-limited local data.
Locked: all of the above (Brief §9, §10, §14; rules 11 to 13, 17, 18); both apps on phones and tablets (26 October). Proposed: one native app shared with the client app; the conflict rules; a deployment freeze while a wedding is live. Open: R9 roles and cost visibility, R16 service levels and on-call, R18 material-change approval. Answered 26 October: R10 staff sign-in.
> **Your decision:** ☐ locked subject to R9, R16, R18 · changes: ______

**Guest RSVP portal.** Open the link, read the notice; identify the household by name and phone; attendance per person per function, children counted; meal preference; allergies where required; rooming and travel where applicable; identity documents only when enabled for the wedding, never Aadhaar; submit once, then locked; corrections through the RSVP team; confirmation with a contact route; programme and calendar files; never another household's information or the list.
Locked: all of the above (Brief §8, rule 10, Q7, Q8). Proposed: self-identification by name and phone; reminders then a call; programme files from the day invitations go out. Open: R11 link structure.
> **Your decision:** ☐ locked subject to R11 · changes: ______

---

## 3. The data model

108 tables in seventeen modules; 43 built in phase 1, 32 in phase 2, 19 in phase 3, 12 in phase 4, 2 dormant. A lead becomes an account; the account holds the subscription, agreements, enquiries and saved hotels; a wedding project hangs off the account and everything about the wedding hangs off the project.

| Rule every table obeys | Status |
|---|---|
| Client-facing amounts and internal amounts are always separate fields | Locked, rule 8 |
| Every field is marked client-visible, restricted or sensitive, or is internal by default; whole tables such as hotel contacts, vendor quotes, cost entries and identity documents are restricted | Locked in principle, rule 18; the marks on budget actuals are R7 |
| Nothing is deleted; retention jobs only propose and a Super Admin approves | Locked, Q17 |
| A shared version never changes; an approval points at the exact version | Locked, SPEC §12 and Q21 |
| Prices, plans, categories, thresholds, labels and templates are editable rows, not code | Locked, rule 17 |
| Demo data is flagged and filtered on every query | Locked, WHY §4 |
| Everything records who did it and when; an append-only audit log | Locked, Brief §9 and §14 |

| Module | Tables | Holds | Open |
|---|---|---|---|
| A Identity and administration | 12 | Users, roles and permissions, wedding memberships (with a side for representatives), sign-in tokens, notifications, audit log, configurations, imports | R5, R9 |
| B CRM, subscriptions, agreements | 12 | Leads and activities, accounts and contacts, plans and their modules, subscriptions, service types and agreements, milestones, payments | R3, R8 |
| C Hotel intelligence | 10 | Destinations, hotels, hotel contacts (restricted), rooms and venues, dated indicative rate cards, verifications, past wedding references with consent, saved hotels | R1 |
| D Hotel consultancy | 6 | Enquiries with ten statuses, events, site visits, proposals with client and internal totals, booking milestones | — |
| E Wedding project | 3 | The project with code, access-until and archive fields; project hotels; external venues | R19 |
| F Functions and run-of-show | 4 | Function types, functions with readiness, the shared programme, the internal cue sheet | — |
| G Budget and finance | 7 | Categories, budget lines with three client amounts and two internal, cost entries, contracts, invoices, final accounts | R7 |
| H Vendors and production | 10 | Categories, vendors (contacts and rates restricted), availability, assignments with a share-contact flag, quotes (restricted), versioned proposals, deliverables, artists, production items | — |
| I Creative, approvals, requests | 6 | Design items and versions, one comments table, client requests with a material flag, approvals with required decisions and on-behalf records | R6, R18 |
| J Invitations, guests, RSVP | 9 | Invitations and versions, households, guests (allergies sensitive), attendance per function, tokens by scope, locked responses, guest support requests | R11, R12 |
| K Rooms, travel, transport | 9 | Room blocks with client and internal rates, allocations and occupants, travel, vehicles, transfers, departures, lost and found | — |
| L Menus | 4 | Menus, versions, items, dietary headcounts frozen for the caterer | — |
| M Tasks, staffing, incidents | 4 | Tasks and dependencies, roster, incidents with escalation | — |
| N Documents and identity | 4 | Documents and media with visibility and rights, identity documents in a restricted store, expiring links | R12 |
| O Checklists and closure | 4 | Readiness and closure templates, checklists, items, client feedback | — |
| P Website content | 2 | Dormant after Q12 | — |
| Q Live chat | 2 | Conversations and messages | — |

> **Your decision:** Data model ☐ locked subject to R1, R3, R5 to R9, R11, R12, R18, R19 · changes: ______

---

## 4. Roles and access

| Role | Reach | Hotel costs | Vendor costs |
|---|---|---|---|
| Super Admin | Everything; configures roles, plans, statuses | yes | yes |
| Finance / Accounts | Budgets, costs, contracts, invoices, payments, final accounts; all records | yes | yes |
| Hotel / Destination Team | Hotel database, enquiries, visits, proposals, milestones, room blocks; all records | yes | no |
| Vendor Coordinator | Vendor master; assignments, proposals, quotes, deliverables, production on any wedding | no | yes |
| Wedding Project Manager | Assigned weddings, everything inside, including that wedding's costs | own weddings | own weddings |
| Sales / Relationship Manager | Leads, demos, accounts, subscriptions, agreements | no | no |
| Creative / Design Team | Assigned weddings: designs, versions, invitations | no | no |
| RSVP / Guest Team | Assigned weddings: guests, households, links, attendance, travel; identity documents with an explicit grant | no | no |
| Hospitality / Logistics Team | Assigned weddings: rooming, transport, departures, lost and found, readiness, incidents | no | no |
| Client representative | Own wedding, client-visible information, decisions, requests, chat; two per wedding | never | never |
| Guest | One household's RSVP through a link | never | never |
| Demo prospect | Demo content only | never | never |

Access is decided on the server by a permission key with a scope (all records, assigned weddings, own), the client's entitlements (subscription modules, agreements, memberships), and a visibility set per field; exports strip sensitive, identity, bank and secret fields whatever the role; every significant update, approval, export and restricted read is audited.

> **Your decision:** Roles and access ☐ locked subject to R6, R9 · changes: ______

---

## 5. The flows

| # | Flow | In one line | Open |
|---|---|---|---|
| 1 | Lead to demo to subscription | Enquiry → Sales authorises the demo → OTP demo → Zoom call if asked → account or invitation → basic details and ₹50,000 → one month of discovery → read-only after | R1, R2, R3 |
| 2 | Hotel discovery and assistance | Search, save, compare → availability request → hotel team checks → agreement for chargeable work → negotiation, visits, proposals → decision → milestones | R8 |
| 3 | Wedding engagement | Agreement recorded by AMPM → first milestone by bank transfer → project created → members added → saved hotels carried in → workspace opens | R5, R6 |
| 4 | Vendors | Options presented → client shortlists and selects → internal quotes → versioned proposal → approval locks the version and the approved amount → contract → deliverables | R6, R7 |
| 5 | Creative approvals | Version shared → pinned comments → approved, revision or rejected → new version supersedes; invitations approved before sending | — |
| 6 | Requests and chat | Request with type → review → answered, accepted or rejected → implemented; material changes flag budgets, contracts, tasks, run-of-show; chat can become a request | R18 |
| 7 | Invitations and RSVP | List with households and sides → links → household identifies itself → answers per person per function → locked → headcounts recalculated → reminders and calls | R11 |
| 8 | Rooms, travel, transport | Room blocks → rooming list → travel → transfers → manifests → check-in → departures | — |
| 9 | Live execution | Readiness or authorised exception → cues with actual times → incidents assigned, escalated, closed → offline updates sync | R16 |
| 10 | Closure | Departures, lost and found, vendor completion, final accounts, documents → closed → feedback → three months read-only → archive on approval | R12, R19 |
| 11 | Sign-in | OTP for prospects and clients; staff by their method; guests by link; no self-registration | R10 |
| 12 | Entitlement changes | Expiry, suspension, cancellation, the closure window; nothing deletes data | R3 |

> **Your decision:** Flows ☐ locked subject to the open points named · changes: ______

---

## 6. The architecture

| Decision | Status | Open |
|---|---|---|
| Native iOS and Android apps for the team and the client from one codebase, with tablet layouts and a browser version of the client portals; the website in the browser | Locked by Q1 and 26 October | — |
| One API, one worker, one database (a modular monolith), sized for 200 hotels and 20 weddings with room to grow tenfold | Proposed; sizing partly locked | R14 staff and guest numbers |
| Hosting: everything on AMPM's dedicated VPS, a Hostinger KVM 4 in Mumbai; backups, media and identity documents in Mumbai buckets; accounts and source code in AMPM's name | Locked 26 October | — |
| Backups: pgBackRest archives to a Mumbai bucket every minute, full weekly and differential daily, monthly rehearsed restores; about a minute lost, back within four hours | Locked 26 October | — |
| Razorpay behind an adapter, hosted checkout, activation once, no refunds | Locked (Brief §3; 26 October) | — |
| Email, WhatsApp, SMS and push behind one adapter | Channels locked | R15 providers |
| Cognito: OTP for prospects and clients; staff by password plus authenticator app; guests by link | Locked 26 October | — |
| Offline-first team app with change queue, server-wins on status changes, conflict log, encrypted local data | Locked by Q1 and Brief §10 | — |
| Retention proposals approved by a Super Admin; consent captured where data enters | Principle locked | R12 periods and wording |
| Service levels 99.5 percent monthly availability; on-call cover on wedding days; no deployments while a wedding is live | Proposed | R16 |
| Five build phases: foundation; wedding planning; guest operations; live execution; stabilisation; one go-live for the whole first release | Phases proposed; the single launch locked 26 October | — |
| Rupees, English, no GST invoices; no vendor or hotel logins; no website editor | Locked | — |

Before the first phase starts, AMPM opens the accounts whose lead times exceed a sprint: the payment gateway, the WhatsApp business manager, the SMS registration, the cloud account in AMPM's name.

> **Your decision:** Architecture ☐ locked subject to R14 to R16 · changes: ______

---

## 7. The nineteen open points

| R | Question | Default if you tick "as proposed" |
|---|---|---|
| R1 | Demo duration, hotels per location, real or invented | Answered 26 October 2026: no time limit, three locations, one real hotel each, indicative prices, managed by the admin |
| R2 | Payment gateway | Answered 26 October 2026: Razorpay |
| R3 | Cancellation and refunds | Answered 26 October 2026: no refund is offered |
| R4 | Browser version of the client portals | Answered 26 October 2026: yes, with tablet layouts for both apps and email-and-mobile verification of clients |
| R5 | One shared login or two accounts | Working decision 26 October 2026: two accounts, to be countersigned |
| R6 | One approval or both representatives | One approval; a setting for two on budgets and contracts |
| R7 | Amounts the client sees | Planned and approved amounts, invoices, payment status; no actual spend |
| R8 | Hotel services with a fee | Availability included; negotiation, visits, contract review, booking assistance by agreement |
| R9 | Staff roles and cost visibility | Nine roles as drafted; costs as in part 4 |
| R10 | Staff sign-in | Answered 26 October 2026: password plus authenticator app; Cognito |
| R11 | RSVP links | Per side as standard, combined as an option |
| R12 | Retention and privacy wording | Leads 24 months, guest records 12 months, identity documents 30 days; wording drafted for approval |
| R13 | Hosting, backups, ownership | Answered 26 October 2026: everything on AMPM's Hostinger KVM 4 in Mumbai; pgBackRest to a Mumbai bucket; Cognito |
| R14 | Capacity | 50 staff, 1,500 guests in the largest wedding |
| R15 | Messaging providers | Developer selects; AMPM owns the accounts |
| R16 | Service levels and support | As drafted |
| R17 | One go-live or discovery first | Answered 26 October 2026: one go-live for the whole first release |
| R18 | Material changes | 10 percent on a line, 5 percent of the total, any date or venue change; PM approves, senior management above 15 percent |
| R19 | Archiving and reopening | Super Admin approves; reopening read-only for 30 days |

---

## 8. Lock sheet

| Section | Locked | With these changes |
|---|---|---|
| 1 Six experiences, one backend | ☐ | |
| 2 Public website | ☐ | |
| 2 Demo | ☐ | |
| 2 Hotel discovery portal | ☐ | |
| 2 Client wedding portal | ☐ | |
| 2 AMPM team app | ☐ | |
| 2 Guest RSVP portal | ☐ | |
| 3 Data model | ☐ | |
| 4 Roles and access | ☐ | |
| 5 Flows | ☐ | |
| 6 Architecture | ☐ | |
| 7 Open points answered in the questions document | ☐ | |

Locked by the developer: ______________________ · Date: ______________

> **Your decision:** When this sheet and the questions come back, the drafts move to version 0.3 as the build specification, and the schedule and cost estimate are drafted against them.
