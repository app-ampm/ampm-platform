# AMPM Platform — Decision Log

**Status:** AMPM's decisions of 2026-10-25, generated from `docs/decisions.json` by `docs/tools/decision_log_build.py`. Do not edit by hand; change the JSON and rebuild.
**Sources:** AMPM App – Compiled Questions & Answers (PDF, 5 pages, 25 Oct 2026); AMPM Management – Final App Decision Brief & Developer Requirements (PDF, 14 pages, 25 Oct 2026).

This log is the record of what AMPM decided, question by question, and what each answer does to the assumptions the drafts were built on. The assumption registers in every draft carry the same markers; the generated decision register and assumptions sheet show them too.

## Summary

| | Count |
|---|---|
| Questions decided | 13 |
| Questions partly decided (an open point remains) | 9 |
| Questions still open | 3 |
| Assumptions confirmed | 28 |
| Assumptions changed | 35 |
| Assumptions partly decided | 15 |
| Assumptions dropped | 4 |
| Assumptions still open | 7 |
| Assumptions not addressed, standing | 9 |

## Tier 1

### Q1 Delivery platform — Decided

**AMPM decided.** Native iOS and Android apps are required. Offline access to essential wedding-day information is required, with automatic synchronisation when the device reconnects, conflict detection and a controlled resolution process. The final technical architecture is to be agreed with the development team.

**Still open.** 1. Whether the client portal is also needed on the web (desktop) in addition to the apps.

| Assumption | Status | What AMPM's answer means for it |
|---|---|---|
| A-1 ([data-model.md](data-model.md) §0) | Changed | Native iOS and Android apps with offline use from launch; the web remains for the public website. Whether the client portal also needs a web version is open. |
| T-1 ([architecture.md](architecture.md) §0) | Changed | Native iOS and Android apps for the team and the client, with offline-first operations; web for the public website. |
| T-11 ([architecture.md](architecture.md) §0) | Changed | Offline-first in the native apps from launch, with sync, conflict detection and protected local storage. |
| U-7 ([user-flows.md](user-flows.md) §0) | Confirmed | Offline operation is required, not optional. |
| W-3 ([wireframes.md](wireframes.md) §0) | Changed | Native apps for client and team; responsive web for the public site only. |
| W-10 ([wireframes.md](wireframes.md) §0) | Changed | Offline screens at launch and extended to tasks, department information and arrival lists. |
| V-4 ([test-cases.md](test-cases.md) §0) | Changed | Offline tests move to the first release and run on native builds. |

### Q2 Payment mode for Phase 1 — Decided

**AMPM decided.** AMPM creates the client's account or sends an invitation link. The client enters basic wedding details (couple's names, contact information, tentative dates, preferred locations) and pays the subscription online by card or UPI. The gateway provider will be selected by AMPM. Payments must create a record, activate the subscription once, and be reviewable by authorised staff.

**Still open.** 1. Payment gateway provider.

| Assumption | Status | What AMPM's answer means for it |
|---|---|---|
| A-2 ([data-model.md](data-model.md) §0) | Changed | Online payment only, by card or UPI, after AMPM creates or invites the account and the client enters basic wedding details. Gateway to be selected by AMPM. Manual recording stays as a staff fallback for exceptions. |
| T-3 ([architecture.md](architecture.md) §0) | Still open | Gateway to be selected by AMPM; card and UPI required. |
| U-2 ([user-flows.md](user-flows.md) §0) | Confirmed | Confirmed; the client also completes basic wedding details before paying; payment online only. |
| W-15 ([wireframes.md](wireframes.md) §0) | Confirmed | Purchase after activation, with the basic wedding details form first. |
| V-1 ([test-cases.md](test-cases.md) §0) | Partly decided | Gateway sandbox depends on the provider choice. |

### Q3 Subscription shape — Decided

**AMPM decided.** The subscription is for hotel discovery only: Rs 50,000, one-time, one month from activation, configurable in settings. Renewal is a new purchase. After expiry the client keeps read-only access to saved hotel names and existing enquiries; nothing is deleted; renewal restores access and data. There is no separate trial: the demo, reached by mobile OTP, serves that purpose.

**Still open.** 1. Demo duration. 2. Demo limits: up to three locations, one or two sample hotels per location.

| Assumption | Status | What AMPM's answer means for it |
|---|---|---|
| A-3 ([data-model.md](data-model.md) §0) | Confirmed | Rs 50,000, one-time, one month, configurable; renewal is a new purchase; no separate trial plan, the demo serves that purpose. |
| A-28 ([data-model.md](data-model.md) §0) | Changed | Demo shows up to three locations and one or two sample hotels each with indicative prices and street view, after OTP; limits and duration configurable and to be finalised. |
| P-7 ([permission-matrix.md](permission-matrix.md) §0) | Changed | Demo users see a limited set of hotels with indicative prices, not masked prices. |
| U-1 ([user-flows.md](user-flows.md) §0) | Confirmed | Confirmed, with OTP login to the demo and an optional 15 to 20 minute Zoom call before purchase. |
| V-10 ([test-cases.md](test-cases.md) §0) | Partly decided | Demo content changed; isolation tests stand. |

### Q4 Client-visible finance — Partly decided

**AMPM decided.** Hotel discovery is a separate paid service. The wedding management fee is decided separately by AMPM, outside the app, and never derived from the subscription. Internal costs, margins, vendor rates, quotations, commissions and negotiations are never shown to clients. Vendor profiles and service details are visible only after AMPM is appointed. Online collection of wedding milestone payments is not required in the first release unless AMPM separately approves it.

**Still open.** 1. Which client-facing amounts appear in the wedding portal (budget summary, approved amounts, invoices, payment status). 2. Which hotel-assistance services beyond availability checks carry a fee.

| Assumption | Status | What AMPM's answer means for it |
|---|---|---|
| A-4 ([data-model.md](data-model.md) §0) | Partly decided | Internal cost and margin never shown: confirmed. Wedding management fee set outside the app. Online milestone payment is out of the first release. Which client-facing amounts the wedding portal shows is still to be confirmed. |
| P-3 ([permission-matrix.md](permission-matrix.md) §0) | Confirmed | Internal commercial data never reaches clients; internal access restricted to authorised personnel. |
| U-3 ([user-flows.md](user-flows.md) §0) | Partly decided | Availability checks on request confirmed as part of the subscription; fees for other hotel services not addressed. |
| W-14 ([wireframes.md](wireframes.md) §0) | Still open | Not addressed. |

### Q5 Client-side users — Partly decided

**AMPM decided.** Only two nominated family representatives use the client portal, one from the bride's side and one from the groom's side; the families decide who. No other family member may hold an account without AMPM's authorisation. Cost and margin information is never visible to them. AMPM may record a decision made outside the portal when a note or supporting record is attached.

**Still open.** 1. One shared login or two separately authenticated accounts on the same wedding (separate accounts recommended for security and audit history). 2. Whether one representative's approval completes a decision or both must approve.

| Assumption | Status | What AMPM's answer means for it |
|---|---|---|
| A-5 ([data-model.md](data-model.md) §0) | Changed | Two family representatives, one per side, with equal rights; no viewer role and no finance flag. Shared or separate logins to be decided; separate recommended. |
| P-2 ([permission-matrix.md](permission-matrix.md) §0) | Changed | Two family representatives with equal rights replace the owner, approver and viewer roles. |
| P-9 ([permission-matrix.md](permission-matrix.md) §0) | Confirmed | On-behalf decisions allowed with a note or supporting record. |
| U-4 ([user-flows.md](user-flows.md) §0) | Confirmed | On-behalf decisions with a note or record. |
| W-5 ([wireframes.md](wireframes.md) §0) | Changed | No finance flag; the two representatives have equal rights; what finance the portal shows is to be confirmed. |
| V-14 ([test-cases.md](test-cases.md) §0) | Confirmed | On-behalf decision tests stand. |

### Q6 Roles — Partly decided

**AMPM decided.** AMPM manages the system and controls permissions. Staff access is restricted by assigned responsibilities and department; a department manager on a phone sees only their own sections. Functional departments named: hotel team, vendor team, RSVP team, hospitality team, production team, project manager, senior authorised management. Internal financial information is restricted to specifically authorised personnel.

**Still open.** 1. Final staff role list and which users may see hotel costs and vendor costs.

| Assumption | Status | What AMPM's answer means for it |
|---|---|---|
| A-6 ([data-model.md](data-model.md) §0) | Partly decided | Department-based access confirmed; the final role list and who may see hotel and vendor costs are to be confirmed by AMPM. |
| P-1 ([permission-matrix.md](permission-matrix.md) §0) | Partly decided | Departments confirmed; final roles and cost access to be confirmed. |

### Q7 Guest identity in the RSVP portal — Partly decided

**AMPM decided.** Guest invitation links are issued per side (one for the bride's side, one for the groom's side) or as one combined link when AMPM chooses; the final structure is to be decided. The RSVP team imports or creates the guest list and sends the links. Guests cannot see other households or the guest list, and cannot edit a submitted response; corrections go through a change request or the help option to the RSVP caller. The two family representatives see approved RSVP summaries and cannot edit the list. Each guest is counted individually, children included; meal preference, allergies where required, rooming and travel where applicable are collected.

**Still open.** 1. Final link structure: per side, or one combined link.

| Assumption | Status | What AMPM's answer means for it |
|---|---|---|
| A-7 ([data-model.md](data-model.md) §0) | Changed | Links per side or one combined link (final structure open); guests identify themselves against the loaded list; no editing after submission; corrections through the RSVP team. Per-person counting, meal preference and allergies confirmed. Family representatives see summaries only and cannot edit the list. |
| P-4 ([permission-matrix.md](permission-matrix.md) §0) | Changed | Links per side or combined; guests identify themselves; no editing after submission; no access to other households. |
| U-5 ([user-flows.md](user-flows.md) §0) | Changed | Per-side or combined links; guests cannot edit after submitting; corrections through the RSVP team; reminders stand. |
| W-6 ([wireframes.md](wireframes.md) §0) | Partly decided | Per-side links with self-identification; no editing after submission; wizard otherwise stands. |
| V-9 ([test-cases.md](test-cases.md) §0) | Changed | The per-side link tests activate; household-token tests become the alternative. |

### Q8 Identity documents — Partly decided

**AMPM decided.** Identity documents may be collected only where a hotel requires them for a wedding, under AMPM's control, in restricted storage, visible only to authorised staff, and never Aadhaar documents or numbers. Nothing is deleted automatically; retention and deletion follow AMPM-approved policy, to be confirmed before launch.

**Still open.** 1. Retention period and privacy wording for identity documents.

| Assumption | Status | What AMPM's answer means for it |
|---|---|---|
| A-8 ([data-model.md](data-model.md) §0) | Partly decided | Per wedding, no Aadhaar, restricted storage: confirmed. Automatic deletion removed; retention follows AMPM-approved policy, to be confirmed. |
| P-5 ([permission-matrix.md](permission-matrix.md) §0) | Confirmed | Identity documents restricted to authorised staff; break-glass not addressed. |
| W-9 ([wireframes.md](wireframes.md) §0) | Partly decided | No automatic deletion; retention per policy. |
| V-7 ([test-cases.md](test-cases.md) §0) | Confirmed | Synthetic identity test data. |

### Q9 Hotel data — Decided

**AMPM decided.** Eva maintains the existing hotel data and updates seasonal prices roughly three times a year. Hotel pages show hotel and venue details, rooms, photographs and videos, food and menu information in a grid, approximate room pricing, wedding package price ranges, indicative venue rental, approximate per-plate pricing, capacity and facilities, and street view or map location. Prices are indicative ranges with a last-verified date, never internal cost. Availability is checked by the team when a client requests it or adds a hotel to their selection. Previous clients' photographs appear only with permission, controlled by AMPM. Hotels can be imported from spreadsheets. About 200 hotels at the start.

| Assumption | Status | What AMPM's answer means for it |
|---|---|---|
| A-9 ([data-model.md](data-model.md) §0) | Confirmed | Confirmed and extended: prices are indicative ranges including wedding package ranges and per-plate pricing, menu grids, street view; Eva updates about three times a year; about 200 hotels at the start. |
| A-27 ([data-model.md](data-model.md) §0) | Not addressed, stands | Not addressed; stands. |
| A-15 ([data-model.md](data-model.md) §0) | Changed | About 200 hotels and 20 concurrent weddings; staff and guest capacity to be confirmed. |

### Q10 Phase 1 scope — Partly decided

**AMPM decided.** The first release includes the demo and the subscription hotel-discovery workflow, wedding management after appointment, vendor selection, the client portal, department-based team access, RSVP, tracked requests, live chat and offline wedding-day operations. It excludes website editing, online milestone payments and GST invoicing. Only Eva's authorised personnel may approve operational exceptions; the authority must be configurable.

**Still open.** 1. Whether this scope launches as one release or hotel discovery launches first while the wedding modules follow.

| Assumption | Status | What AMPM's answer means for it |
|---|---|---|
| A-10 ([data-model.md](data-model.md) §0) | Changed | First release includes discovery, wedding management, vendors, client portal, department access, RSVP, requests, live chat and offline operations; excludes website editing, online milestone payments and GST invoicing. Single or staged launch to be agreed. |
| P-8 ([permission-matrix.md](permission-matrix.md) §0) | Changed | Only Eva's authorised personnel may authorise exceptions; the authority is configurable but the policy names Eva. |
| V-11 ([test-cases.md](test-cases.md) §0) | Changed | Exit packs follow the first-release scope. |

## Tier 2

### Q11 Guest and client communication channels — Partly decided

**AMPM decided.** Email and WhatsApp are required; SMS is proposed. Live chat is also required on the home page. Providers are to be confirmed.

**Still open.** 1. WhatsApp and SMS providers.

| Assumption | Status | What AMPM's answer means for it |
|---|---|---|
| A-11 ([data-model.md](data-model.md) §0) | Partly decided | Email and WhatsApp required, SMS proposed, providers to be confirmed; live chat added. |
| T-4 ([architecture.md](architecture.md) §0) | Partly decided | Email and WhatsApp required, SMS proposed; providers to be confirmed. |
| V-2 ([test-cases.md](test-cases.md) §0) | Partly decided | Provider sandboxes depend on the provider choice. |

### Q12 Public website — Decided

**AMPM decided.** No. AMPM staff will not edit public website content through the app in the initial scope; the website editor is not approved.

| Assumption | Status | What AMPM's answer means for it |
|---|---|---|
| A-12 ([data-model.md](data-model.md) §0) | Dropped | No website editing in the app; the website is maintained outside the platform. |
| T-5 ([architecture.md](architecture.md) §0) | Dropped | No content editor; the website is static and maintained outside the app. |
| W-4 ([wireframes.md](wireframes.md) §0) | Dropped | No website editor. |

### Q13 Sign-in — Partly decided

**AMPM decided.** Prospects, demo users and clients sign in with their mobile number and an OTP. There is no unrestricted self-registration; AMPM creates the account or sends an invitation. Staff have individual authorised accounts with role- and department-based access; the exact staff authentication method is to be finalised with the development team.

**Still open.** 1. Staff authentication method (authenticator app recommended).

| Assumption | Status | What AMPM's answer means for it |
|---|---|---|
| A-13 ([data-model.md](data-model.md) §0) | Changed | Prospects, demo users and clients sign in with mobile number and OTP; staff method to be finalised (authenticator app recommended). |
| P-6 ([permission-matrix.md](permission-matrix.md) §0) | Changed | Mobile OTP for prospects and clients; staff method to be finalised. |
| T-6 ([architecture.md](architecture.md) §0) | Changed | OTP sign-in for clients and prospects; staff method to be finalised. |
| U-9 ([user-flows.md](user-flows.md) §0) | Changed | OTP sign-in for clients; staff method open. |
| W-7 ([wireframes.md](wireframes.md) §0) | Changed | OTP sign-in screens for prospects and clients. |
| V-3 ([test-cases.md](test-cases.md) §0) | Changed | OTP sign-in tests for clients and prospects. |

### Q14 Hosting and data residency — Still open

**AMPM decided.** Hosting arrangements, backup frequency and recovery timelines are yet to be confirmed with the developer.

**Still open.** 1. Hosting provider and region. 2. Backup location. 3. Recovery targets.

| Assumption | Status | What AMPM's answer means for it |
|---|---|---|
| A-14 ([data-model.md](data-model.md) §0) | Still open | Hosting to be confirmed with the developer; the recommendation stands as a proposal. |
| T-2 ([architecture.md](architecture.md) §0) | Still open | Hosting to be confirmed; the Indian-region recommendation stands as a proposal. |
| T-13 ([architecture.md](architecture.md) §0) | Still open | Backup and recovery targets to be confirmed. |
| V-13 ([test-cases.md](test-cases.md) §0) | Still open | Recovery targets to be confirmed. |

### Q15 Volumes — Partly decided

**AMPM decided.** About 200 hotels at the start and roughly 20 concurrent weddings as a planning assumption; multiple weddings and departmental staff access; staff and guest capacity to be confirmed.

**Still open.** 1. Staff count and largest guest count.

| Assumption | Status | What AMPM's answer means for it |
|---|---|---|
| A-15 ([data-model.md](data-model.md) §0) | Changed | About 200 hotels and 20 concurrent weddings; staff and guest capacity to be confirmed. |
| T-7 ([architecture.md](architecture.md) §0) | Changed | Sized for about 200 hotels and 20 concurrent weddings; the monolith still fits. |
| V-5 ([test-cases.md](test-cases.md) §0) | Changed | Load profiles rescaled to 200 hotels and 20 weddings; staff and guest numbers to be confirmed. |

### Q16 Currency, language and tax — Decided

**AMPM decided.** Indian rupees. English as the primary language. The platform will not issue GST invoices.

| Assumption | Status | What AMPM's answer means for it |
|---|---|---|
| A-16 ([data-model.md](data-model.md) §0) | Confirmed | INR and English confirmed; the platform does not issue GST invoices, so GST fields are dormant. |
| T-8 ([architecture.md](architecture.md) §0) | Confirmed | INR and English. |
| V-12 ([test-cases.md](test-cases.md) §0) | Dropped | No GST invoices from the platform. |

### Q17 Privacy notice, consent wording and retention schedule — Still open

**AMPM decided.** AMPM will decide the final privacy wording and the data retention policy. Retention and deletion require AMPM's approval; guest and wedding information must remain access-controlled; wedding records are not deleted automatically.

**Still open.** 1. Privacy wording. 2. Retention periods for leads, guest records and identity documents.

| Assumption | Status | What AMPM's answer means for it |
|---|---|---|
| A-17 ([data-model.md](data-model.md) §0) | Changed | No automatic deletion; retention and deletion require AMPM approval; periods to be confirmed. Jobs become proposed deletion lists awaiting approval. |
| T-9 ([architecture.md](architecture.md) §0) | Changed | No automatic deletion; retention actions require AMPM approval. |
| W-13 ([wireframes.md](wireframes.md) §0) | Confirmed | AMPM decides the wording. |
| V-6 ([test-cases.md](test-cases.md) §0) | Changed | Retention tests cover the approval workflow, not automatic deletion. |

## Tier 3

### Q18 Multi-hotel weddings and venues outside the database — Decided

**AMPM decided.** Yes. A wedding can involve multiple hotels and venues.

| Assumption | Status | What AMPM's answer means for it |
|---|---|---|
| A-18 ([data-model.md](data-model.md) §0) | Confirmed | Multiple hotels and venues per wedding. |

### Q19 Room blocks and rooming rules — Decided

**AMPM decided.** Room blocks by hotel, room category and dates. Allocation and rooming are handled by the team, not automatically. Counts must support both room-wise and person-wise calculations, children included.

| Assumption | Status | What AMPM's answer means for it |
|---|---|---|
| A-19 ([data-model.md](data-model.md) §0) | Confirmed | Room blocks by hotel, category and dates; team-managed allocation; room-wise and person-wise counts, children included. |

### Q20 In-portal messaging or questions: in scope or handled outside the platform — Decided

**AMPM decided.** Both tracked requests with conversation history and live chat are required; live chat on the home page, distinguished from tracked requests so a formal change request keeps its own approval history. More options may be added later.

| Assumption | Status | What AMPM's answer means for it |
|---|---|---|
| A-20 ([data-model.md](data-model.md) §0) | Changed | Live chat is required in addition to tracked requests. |
| U-12 ([user-flows.md](user-flows.md) §0) | Changed | Live chat is added alongside tracked requests. |
| W-8 ([wireframes.md](wireframes.md) §0) | Changed | Live chat screen added; tracked requests stay. |

### Q21 Change-request workflow and statuses — Decided

**AMPM decided.** Change requests are submitted, reviewed, accepted or rejected, then implemented and closed. A change to an approved item creates a new version for approval.

| Assumption | Status | What AMPM's answer means for it |
|---|---|---|
| A-21 ([data-model.md](data-model.md) §0) | Confirmed | Confirmed, with a closed status added. |

### Q22 Vendor or hotel logins, now or later — Decided

**AMPM decided.** No vendor or hotel logins in the current version.

| Assumption | Status | What AMPM's answer means for it |
|---|---|---|
| A-22 ([data-model.md](data-model.md) §0) | Confirmed | No vendor or hotel logins. |
| P-11 ([permission-matrix.md](permission-matrix.md) §0) | Confirmed | No vendor principal. |

### Q23 Client portal access after the wedding: how long, and what remains visible — Decided

**AMPM decided.** Read-only client access for three months after the wedding, then the project is archived following AMPM's approval. Records are not deleted; archiving is a change of status and permissions. Later access or reopening is controlled by AMPM.

**Still open.** 1. Exact workflow for archiving and for restoring access after archiving.

| Assumption | Status | What AMPM's answer means for it |
|---|---|---|
| A-23 ([data-model.md](data-model.md) §0) | Changed | Three months of read-only access, then archiving on AMPM approval. |
| U-8 ([user-flows.md](user-flows.md) §0) | Confirmed | Confirmed with three months and archiving on approval. |

### Q24 Post-wedding feedback and archive expectations — Decided

**AMPM decided.** A short feedback form after the wedding and an archived state that preserves the records.

| Assumption | Status | What AMPM's answer means for it |
|---|---|---|
| A-24 ([data-model.md](data-model.md) §0) | Confirmed | Feedback form and archived state. |

### Q25 Definition of a "material change" and the resulting flags — Still open

**AMPM decided.** Thresholds must be configurable; AMPM will define the final budget-change percentages, date-change and venue-change thresholds and the approval rules.

**Still open.** 1. Material-change thresholds and approval rules.

| Assumption | Status | What AMPM's answer means for it |
|---|---|---|
| A-25 ([data-model.md](data-model.md) §0) | Partly decided | Configurable thresholds confirmed; values and approval rules to be defined by AMPM. |
| U-11 ([user-flows.md](user-flows.md) §0) | Partly decided | Thresholds to be defined. |

## Requirements AMPM added beyond the questions

- Demo: reached after mobile OTP verification; up to three locations with street view where available; one or two sample hotels per location with indicative prices (to be finalised); limited hotel information; duration to be finalised; the client may request a 15 to 20 minute Zoom call before purchasing.
- Account activation: the client completes basic wedding details (couple's names, contact information, tentative dates, preferred locations) before paying.
- Hotel page content: food and menu information in a grid, vegetarian and non-vegetarian menus, approximate per-plate pricing, wedding package price ranges, indicative venue rental, approximate room pricing, street view or map; the portal must distinguish indicative, requested, verified and awaiting-confirmation information.
- Selection or cart: adding a hotel to the selection can trigger an availability request to the hotel team.
- Vendor categories include photography and videography, decor and production, catering, entertainment and artists, makeup and styling, transport and logistics, and others per AMPM's service structure. Vendor contact details stay internal by default; AMPM may share specific contacts in an approved case.
- Tracked request statuses: submitted, under review, accepted, rejected, implemented, closed.
- Offline scope for staff: assigned tasks, department information, readiness checklists, cue sheets, arrival and operational lists; offline updates where supported; the app shows offline state and pending sync, never silently loses updates, detects conflicts with a controlled resolution, and protects locally stored data; offline data limited to the user's role.
- Readiness exceptions record the unmet check, the exception and reason, the authorised person, the time and the resulting status; only Eva's authorised personnel may approve them.
- Configurable settings: subscription price and duration, demo limits, hotel categories, vendor categories, pricing thresholds, change-request rules, access and approval settings.
- Public website: company information, enquiry submission, demo requests, contact details, login and invitation entry points; no editing by staff.
- The platform is for AMPM's internal business use, not for licensing to other wedding planners.

## Items AMPM listed to confirm before development

1. Exact demo duration and final hotel and location limits
2. Whether the demo shows one or two sample hotels per location with indicative prices
3. Payment gateway provider and transaction-handling requirements
4. Whether the two family representatives share one login or have separate authenticated accounts
5. Final staff roles and which internal users may access hotel costs or vendor costs
6. Hosting provider, backup location and recovery targets
7. Initial capacity for staff, hotels, weddings and guests
8. Communication provider for WhatsApp and SMS
9. Privacy wording and retention periods for leads, guest records and identity documents
10. Final material-change thresholds and approval rules
11. The exact workflow for archiving projects and restoring access after archiving

## Assumptions by status

**Changed (35):** A-1, A-2, A-5, A-7, A-10, A-13, A-15, A-17, A-20, A-23, A-28, P-2, P-4, P-6, P-7, P-8, T-1, T-6, T-7, T-9, T-11, U-5, U-9, U-12, W-3, W-5, W-7, W-8, W-10, V-3, V-4, V-5, V-6, V-9, V-11

**Dropped (4):** A-12, T-5, W-4, V-12

**Partly decided (15):** A-4, A-6, A-8, A-11, A-25, P-1, T-4, U-3, U-11, W-1, W-6, W-9, V-1, V-2, V-10

**Still open (7):** A-14, T-2, T-3, T-12, T-13, W-14, V-13

**Confirmed (28):** A-3, A-9, A-16, A-18, A-19, A-21, A-22, A-24, A-26, A-30, P-3, P-5, P-9, P-10, P-11, T-8, U-1, U-2, U-4, U-6, U-7, U-8, W-2, W-13, W-15, V-7, V-8, V-14

**Not addressed, stands (9):** A-27, A-29, T-10, T-14, U-10, W-11, W-12, V-15, V-16

