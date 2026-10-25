# AMPM Platform — User-Flow Diagrams

**Status:** DRAFT v0.2, 25 October 2026. AMPM's decisions of 25 October applied where they change a flow (§0a) and stamped on every assumption in §0. Not yet signed off.
**Companions:** [requirements-audit.md](requirements-audit.md) (Q numbers), [data-model.md](data-model.md) (A-1 to A-30), [permission-matrix.md](permission-matrix.md) (P-1 to P-11, status transitions in §7, automation in §8), [architecture.md](architecture.md) (T-1 to T-14), [wireframes.md](wireframes.md) (screen IDs such as CP-05 and TW-27).
**Source of truth being extended:** SPEC §14 ("user-flow diagrams for subscription, hotel assistance, wedding engagement, RSVP and execution"), SPEC §1.2 (business journey), §2 (screen flows), §7 (statuses), §8 (automation), §12 (acceptance scenarios); WHY §1 (five-stage customer journey) and §4 (access rules); the two Level-1 flowcharts, reconciled as the audit's §9 recommends.

Twelve flows: the five the spec names, plus the approval, change-request, logistics, closure and sign-in flows that connect them. Every flow lists the statuses it moves (permission-matrix §7), the notifications it fires (§8), its exceptions, and the screens it uses (wireframes.md).

---

## 0. Assumptions register

Flow-specific assumptions. Data-model (A), permission (P) and technology (T) assumptions are cited where they apply rather than repeated.

| ID | Audit ref | Assumption adopted in this draft | If AMPM decides otherwise |
|---|---|---|---|
| U-1 | Q3, Q10, A-28 | Demo access is granted by Sales from the lead record: Sales creates a demo account on the demo plan, the prospect receives an invitation, and the demo expires after the plan's trial days. There is no self-serve demo. **AMPM (2026-10-25): Confirmed. Confirmed, with OTP login to the demo and an optional 15 to 20 minute Zoom call before purchase.** | A self-serve time-boxed trial would add an automatic grant step on the public page; the no-self-registration rule (WHY §4) still requires Sales approval of the account. |
| U-2 | Q2, CF-5, A-2 | The public subscription page explains plans and collects a request. AMPM creates the account and invites the primary contact; the client chooses a plan and pays inside the portal after activation. Online checkout and offline bank transfer both end in the same activation step. **AMPM (2026-10-25): Confirmed. Confirmed; the client also completes basic wedding details before paying; payment online only.** | Anonymous checkout that creates the account automatically would contradict WHY §4 and is not drawn. |
| U-3 | Q4, GP-5 | An availability check is included in the hotel-discovery subscription. Negotiation, site visits, contract review and booking assistance are chargeable service types that require an accepted service agreement before work starts. **AMPM (2026-10-25): Partly decided. Availability checks on request confirmed as part of the subscription; fees for other hotel services not addressed.** | If all assistance is included, the agreement branch in flow 2 is skipped; if availability checks are chargeable too, the branch moves earlier. |
| U-4 | Q5, P-9 | Client decisions are made in the portal by the Client Owner or an Approver. When the family decides by phone, the Project Manager records the decision on their behalf with evidence; the flows show this as an explicit branch. **AMPM (2026-10-25): Confirmed. On-behalf decisions with a note or record.** | Forbidding on-behalf decisions removes that branch. |
| U-5 | Q7, A-7 | The guest list is uploaded by the Client Owner or entered by the RSVP team before invitations go out. Each family group receives one tokenised link. Groups that have not responded receive reminders at configured intervals, then a call from the RSVP team, whose assisted entry writes the same records. **AMPM (2026-10-25): Changed. Per-side or combined links; guests cannot edit after submitting; corrections through the RSVP team; reminders stand.** | A single open wedding link would insert a self-identification step at the start of flow 7. |
| U-6 | Q10, SPEC §1.2 | A wedding project is created when a service agreement for anything beyond hotel assistance (design, vendor coordination, full management) is accepted. Project creation back-fills the account's saved hotels, enquiries and agreements. **AMPM (2026-10-25): Confirmed. The agreement is recorded by AMPM and the project created by AMPM.** | AMPM may prefer to create the project earlier, at the first engagement conversation, in `setup` status. |
| U-7 | Q1, T-11 | The execution flow assumes staff phones with intermittent connectivity inside venues: run-of-show, checklists and arrival lists are readable offline, cue updates and incident reports queue and sync. **AMPM (2026-10-25): Confirmed. Offline operation is required, not optional.** | Without offline support those steps require connectivity. |
| U-8 | Q23, A-23 | Closure ends with a client feedback request, a read-only access window for the client, then archival. **AMPM (2026-10-25): Confirmed. Confirmed with three months and archiving on approval.** | Different window length is configuration. |
| U-9 | Q13, A-13 | Staff sign in with email, password and an authenticator code; clients with email and password plus optional phone OTP; guests never sign in and use their token link; demo prospects sign in like clients. **AMPM (2026-10-25): Changed. OTP sign-in for clients; staff method open.** | Phone-OTP-only for clients changes the client branch of flow 11. |
| U-10 | Q11, A-11 | Notifications go to each recipient's preferred channel. WhatsApp requires an opt-in captured on the enquiry form or in the RSVP portal; without it the platform uses email or SMS. **AMPM (2026-10-25): Not addressed, stands. Not addressed; stands.** | Dropping WhatsApp removes the opt-in step. |
| U-11 | Q25, A-25 | A change request is material when it exceeds configured thresholds; material acceptance raises impact flags and review tasks. **AMPM (2026-10-25): Partly decided. Thresholds to be defined.** | Thresholds are configuration. |
| U-12 | Q20, A-20 | Questions from clients are requests of type question, answered in a thread; there is no free-form chat. **AMPM (2026-10-25): Changed. Live chat is added alongside tracked requests.** | Real-time messaging would replace the question branch of flow 6. |

---

## 0a. Changes from AMPM's decisions (25 October 2026)

| Decision | Flow changes |
|---|---|
| Q2, Q3, Q13 demo after mobile OTP, optional Zoom call, basic wedding details before an online card or UPI payment, one month, renewal as a new purchase | Flow 1 is revised below; the original diagram is superseded |
| Q7 links per side or one combined link; guests identify themselves; no editing after submission; corrections through the RSVP team; representatives see summaries only | Flow 7 is revised below; the original diagram is superseded |
| Q20 live chat alongside tracked requests | Flow 6 gains a chat branch: a conversation is handled immediately, and a message can be turned into a tracked request that then follows Flow 6 unchanged |
| Q10 only Eva's authorised personnel approve exceptions | Flow 9: the exception step is authorised by the Super Admin role; the Project Manager requests it |
| Q13 mobile OTP for prospects and clients | Flow 11: the client branch becomes mobile number and OTP; no password; staff method to be finalised |
| Q23 three months of read-only access, archive on AMPM approval | Flow 12: the window is three months and archiving waits for a Super Admin's approval |
| Q9 indicative price ranges; availability on request from the selection | Flow 2: the client adds hotels to a selection and requests availability from there; prices show as ranges with a verified date |
| Q4 milestone payments not online in the first release | Flow 3: the first milestone is paid by bank transfer and recorded by Finance |
| Q8, Q17 no automatic deletion | Flow 10: retention jobs propose deletions for approval instead of deleting |

### Flow 1, revised — Enquiry to demo to subscription

```mermaid
flowchart TD
    subgraph pub ["Public website"]
        p1["PUB-06 Enquiry or demo request"]
    end
    subgraph sales ["Sales (TW-11)"]
        t1("leads: new")
        t2["Review the enquiry, authorise the demo, log activities"]
        t3["Create the client account or send the invitation (Q2)"]
        t8("leads: converted")
    end
    subgraph client ["Prospect, then client"]
        c0["AUTH-06 Mobile number and OTP (Q13)"]
        c1["DM-01 Demo: up to three locations, one or two hotels each, indicative prices, street view (Q3)"]
        c2{"Wants to proceed?"}
        c3["Request a 15 to 20 minute Zoom call, optional"]
        c4["CP-11 Basic wedding details: couple, contact, tentative dates, preferred locations"]
        c5["Pay Rs 50,000 online by card or UPI (Q2, Q3)"]
    end
    subgraph sys ["System"]
        s1("subscriptions: pending_payment")
        s2{"Payment succeeded, once per transaction?"}
        s3("subscriptions: active for one month")
        s4["Hotel discovery open; vendor selection stays locked"]
        s5("expired: read-only saved hotel names and enquiries, nothing deleted; renewal is a new purchase")
    end
    p1 --> t1 --> t2 --> c0 --> c1 --> c2
    c2 -->|not yet| c3 --> c2
    c2 -->|yes| t3 --> t8 --> c4 --> c5 --> s1 --> s2
    s2 -->|yes| s3 --> s4
    s2 -->|no| c5
    s3 -.->|after one month| s5
```

### Flow 7, revised — Invitations and RSVP with links per side

```mermaid
flowchart TD
    subgraph list ["RSVP team (TW-50, TW-58, TW-41)"]
        l1["Import or create the guest list: households, members, side"]
        l2["Send the bride-side link and the groom-side link, or one combined link (Q7)"]
        l5["Reminders on a schedule; call list for non-responders"]
        l6["Corrections and change requests handled by the RSVP caller (TW-53, TW-57)"]
    end
    subgraph guest ["Guest (GR-01 to GR-07)"]
        g1["Open the side link; privacy notice"]
        g2["Identify the household: name and phone matched against the list"]
        g3{"Match found?"}
        g4["Attendance per person per function; meals; allergies if required; travel and rooms if asked"]
        g5["Submit once; the response is locked (Q7)"]
        g6["Need a correction? Change request or help option"]
    end
    subgraph sys ["System"]
        y1("guest_function_attendance updated; rsvp_responses snapshot locked")
        y2["Headcounts, menus, rooms and transport recalculated; representatives see summaries only"]
        y3["Unmatched guest held for RSVP review"]
    end
    l1 --> l2 --> g1 --> g2 --> g3
    g3 -->|yes| g4 --> g5 --> y1 --> y2
    g3 -->|no| y3 --> l6
    g5 --> g6 --> l6
    l2 --> l5 --> l6
```

## 1. Conventions

- Rectangles are screens or actions, labelled with the screen ID from wireframes.md where one exists. Diamonds are decisions. Rounded boxes are status changes written as `table: status` and match permission-matrix.md §7. Swimlanes group steps by actor.
- "Notify" steps use the automation rules in permission-matrix.md §8 and the recipient's channel preference (U-10).
- Every flow ends in a state the data model can represent; nothing happens off-system except where a step says so (for example a phone call, which is then recorded).
- Parallelism (BIZ rule 3, SPEC §1.2) is shown in flow 3: once a project exists, flows 4 to 8 run concurrently and independently.

---

## 2. Flow 1 — Lead to demo to subscription (SPEC §14 "subscription") — superseded by the revised Flow 1 in §0a

Actors: public visitor or prospect, Sales (SM), the system. Entry: any public page, an Instagram or referral contact logged by Sales, or a phone call.

```mermaid
flowchart TD
    subgraph pub ["Public website"]
        p1["PUB-01 Home or PUB-07 Demo and subscription page"]
        p2["PUB-06 Enquiry or demo request form with consent"]
        p3["PUB-09 Confirmation"]
    end
    subgraph sales ["Sales (TW-10, TW-11)"]
        t1("leads: new")
        t2["Contact, share introduction, log activities and questionnaire"]
        t3{"Demo requested?"}
        t4["Create demo account on the demo plan and invite (U-1)"]
        t5("leads: demo_accessed")
        t6{"Ready to subscribe?"}
        t7["Create client account, invite primary contact (WHY section 4)"]
        t8("leads: converted")
        t9("leads: closed with reason")
    end
    subgraph client ["Client"]
        c1["AUTH-02 Activate account and set password"]
        c2["CP-11 Choose plan and accept terms"]
        c3{"Pay online?"}
        c4["Hosted checkout (T-3)"]
        c5["Bank transfer, Finance records the payment in TW-80"]
    end
    subgraph sys ["System"]
        s1("subscriptions: pending_payment")
        s2{"Payment succeeded?"}
        s3("subscriptions: active, entitlements granted")
        s4["Notify client and Sales"]
        s5["Demo expires after trial days, demo data reset"]
    end
    p1 --> p2 --> p3 --> t1 --> t2 --> t3
    t3 -->|yes| t4 --> t5 --> t6
    t3 -->|no| t6
    t4 -.-> s5
    t6 -->|yes| t7 --> t8 --> c1 --> c2 --> s1 --> c3
    t6 -->|follow up later| t2
    t6 -->|lost| t9
    c3 -->|yes| c4 --> s2
    c3 -->|no| c5 --> s2
    s2 -->|yes| s3 --> s4
    s2 -->|failed| c2
```

| Statuses moved | Notifications | Exceptions and edge cases | Screens |
|---|---|---|---|
| leads: new → contacted → introduction_shared → demo_offered → demo_accessed → converted or closed; subscriptions: pending_payment → active; client_accounts: prospect → active | Enquiry received (Sales); demo invitation (prospect); account invitation (client); payment confirmation (client, Sales); payment failed (client) | Duplicate lead (same email or phone) is merged by Sales, not auto-merged. A demo that expires without a decision returns the lead to follow_up. A payment that fails leaves the subscription pending_payment with no entitlement (SPEC §8). Trial subscriptions use status trial and skip the payment step until conversion. | PUB-01, PUB-06, PUB-07, PUB-09, TW-10, TW-11, TW-14, AUTH-02, CP-11, TW-80 |

Acceptance mapping: SPEC §12 "public enquiry saves source and owner", "subscription activates hotel discovery without exposing full wedding modules", "demo account cannot access records outside demo scope".

---

## 3. Flow 2 — Hotel discovery and assistance (SPEC §14 "hotel assistance")

Actors: subscriber (CO, CA, CV), Hotel team (HT), Sales (SM) for chargeable services, Finance (FA), the system. Entry: an active or trial subscription.

```mermaid
flowchart TD
    subgraph client ["Subscriber"]
        c1["CP-01 Search destinations and hotels"]
        c2["CP-04 Results with filters and freshness labels"]
        c3["CP-05 Hotel detail with verified rate card"]
        c4["CP-06 Save and compare"]
        c5["CP-07 Request hotel assistance: dates, guests, rooms, services"]
        c6["CP-09 Track enquiry, see non-internal events"]
        c7["CP-09 Accept service agreement and fee"]
        c8["CP-10 Proposal decision"]
    end
    subgraph hotelteam ["Hotel team (TW-26, TW-27, TW-28)"]
        h1("hotel_enquiries: submitted")
        h2["Assign owner, check availability with the hotel"]
        h3("hotel_enquiries: awaiting_hotel then response_received")
        h4{"Chargeable services requested? (U-3)"}
        h5["Sales issues service agreement (TW-15)"]
        h6("service_agreements: active")
        h7["Negotiate, log internal-only events"]
        h8("hotel_enquiries: negotiating")
        h9["Schedule site visit"]
        h10("hotel_enquiries: visit_scheduled")
        h11["Prepare proposal with client and internal amounts, share"]
        h12("hotel_enquiries: proposal_received then client_decision")
        h13{"Decision"}
        h14["Booking milestones: hold, contract, advance"]
        h15("hotel_enquiries: confirmed")
        h16("hotel_enquiries: closed with outcome")
    end
    c1 --> c2 --> c3 --> c4
    c3 --> c5 --> h1 --> h2 --> h3 --> c6
    h3 --> h4
    h4 -->|yes| h5 --> c7 --> h6 --> h7
    h4 -->|no, availability only| h16
    h6 --> h9
    h7 --> h8 --> h11
    h9 --> h10 --> h11
    h11 --> h12 --> c8 --> h13
    h13 -->|accepted| h14 --> h15 --> h16
    h13 -->|revision requested| h11
    h13 -->|declined or no availability| h16
```

| Statuses moved | Notifications | Exceptions and edge cases | Screens |
|---|---|---|---|
| hotel_enquiries: draft → submitted → awaiting_hotel → response_received → negotiating → visit_scheduled → proposal_received → client_decision → confirmed → closed; service_agreements: draft → sent → accepted → active; hotel_proposals: draft → shared → accepted, revision_requested, declined, superseded; booking_milestones: pending → done | Enquiry submitted (HT queue); assignment (HT owner); response received, visit scheduled, proposal shared (client); agreement sent (client); decision (HT) | Stale rate cards show the stale label and the detail page never says "confirmed" (SPEC §12). Internal-only events, negotiation notes and internal amounts never appear in CP-09 or CP-10 (SPEC §12). An enquiry is never a booking: confirmed requires a done milestone of type confirmed and a signed contract (SPEC §7). A subscriber whose subscription expires mid-enquiry keeps read access to that enquiry (permission-matrix §3). Demo users' requests become Sales lead activities, not enquiries (P-7). | CP-01, CP-02, CP-03, CP-04, CP-05, CP-06, CP-07, CP-08, CP-09, CP-10, TW-26, TW-27, TW-28, TW-15 |

Acceptance mapping: SPEC §12 "hotel search shows freshness of pricing", "AMPM records negotiation and site visit without exposing internal notes".

---

## 4. Flow 3 — Wedding engagement and project creation (SPEC §14 "wedding engagement")

Actors: Sales (SM), Super Admin or Project Manager (PM), client, the system. Entry: a client decides to engage AMPM beyond hotel assistance.

```mermaid
flowchart TD
    subgraph sales ["Sales"]
        s1["Record scope, fees and payment stages in a service agreement (TW-15)"]
        s2("service_agreements: sent")
    end
    subgraph client ["Client"]
        c1["Accept agreement in CP-11 or sign offline, Finance uploads"]
        c2("service_agreements: active")
        c3["Pay first milestone (CP-25) or bank transfer"]
    end
    subgraph pm ["Project Manager or Super Admin"]
        p1["TW-31 Create project: name, dates (tentative allowed), lead, currency, time zone (U-6)"]
        p2("wedding_projects: setup, code generated")
        p3["TW-33 Add staff members and client users with roles and flags (A-5)"]
        p4["Add hotels and venues, confirm guest estimate"]
        p5("wedding_projects: planning")
    end
    subgraph sys ["System"]
        y1["Back-fill project_id on saved hotels, enquiries and agreements (GP-27)"]
        y2["Create readiness and closure checklists from templates"]
        y3["Grant wedding workspace entitlement to client members"]
        y4["Notify client members and staff members"]
    end
    subgraph parallel ["Parallel planning streams (BIZ rule 3)"]
        q1["Flow 4 vendors"]
        q2["Flow 5 design, menus, invitations"]
        q3["Flow 7 guests and RSVP"]
        q4["Flow 8 rooms and travel"]
        q5["Budget lines and approvals (TW-36, CP-24)"]
    end
    s1 --> s2 --> c1 --> c2 --> c3
    c2 --> p1 --> p2 --> y1 --> y2 --> p3 --> y3 --> y4 --> p4 --> p5
    p5 --> q1
    p5 --> q2
    p5 --> q3
    p5 --> q4
    p5 --> q5
```

| Statuses moved | Notifications | Exceptions and edge cases | Screens |
|---|---|---|---|
| service_agreements: draft → sent → accepted → active; wedding_projects: setup → planning; payment_milestones: pending → invoiced → paid | Agreement sent and accepted; project created (client members, staff members); milestone invoiced and paid | A project can be created while the first milestone is unpaid; unpaid milestones appear on dashboards (SPEC §8) and the Project Manager decides whether to pause. Only name, account, dates and lead are mandatory (SPEC §5); everything else is captured when relevant (BIZ rule 2). A client with an existing hotel-discovery subscription keeps it; the workspace entitlement is additional (permission-matrix §3). | TW-15, CP-11, CP-25, TW-31, TW-33, TW-32, CP-20 |

Acceptance mapping: SPEC §12 "engaged client receives correct project and permissions".

---

## 5. Flow 4 — Vendor options, proposals and selection

Actors: Vendor Coordinator (VC), Project Manager (PM), client (CO, CA), Finance (FA). Entry: a function or category needs a vendor.

```mermaid
flowchart TD
    subgraph vc ["Vendor Coordinator (TW-38, TW-39, TW-62)"]
        v1["Shortlist vendors by category and availability"]
        v2["Present options: vendor_assignments status option, presented_at set"]
        v3["Collect raw quotes (internal only)"]
        v4["Draft proposal version n: client amount and internal cost (A-4)"]
        v5("vendor_proposals: shared, approval requested")
        v6["New version n+1 supersedes"]
        v7("vendor_assignments: contracted")
        v8["Deliverables tracked (TW-63)"]
    end
    subgraph client ["Client (CP-26, CP-27)"]
        c1["Review options, portfolios and client descriptions"]
        c2{"Client decision per option"}
        c3("vendor_assignments: shortlisted or declined")
        c4("vendor_assignments: selected")
        c5{"Proposal decision"}
    end
    subgraph pm ["Project Manager"]
        p1["Record decision on behalf with evidence (U-4)"]
    end
    subgraph sys ["System"]
        y1("approvals: approved, version locked")
        y2["Budget line approved_amount locked, audit"]
        y3["Notify VC and PM"]
    end
    v1 --> v2 --> c1 --> c2
    c2 -->|interested or shortlisted| c3 --> v3
    c2 -->|declined| c3
    c2 -->|selected| c4 --> v3
    p1 -.-> c2
    v3 --> v4 --> v5 --> c5
    c5 -->|approved| y1 --> y2 --> y3 --> v7 --> v8
    c5 -->|revision requested| v6 --> v4
    c5 -->|rejected| v1
```

| Statuses moved | Notifications | Exceptions and edge cases | Screens |
|---|---|---|---|
| vendor_assignments: option → shortlisted → selected → contracted → delivering → completed, or declined, cancelled; vendor_proposals: draft → shared → accepted, revision_requested, declined, superseded; approvals: submitted → approved, revision_requested, rejected, superseded; budget_lines: proposed → approved → committed | Options presented (client); proposal shared (approvers); decision (VC, PM); contract signed (FA, PM) | Fewer than five options is allowed and more than ten is not blocked (SPEC §12). A revision never overwrites a shared version (SPEC §12). Vendor contacts, raw quotes, internal cost and ratings never reach the client (permission-matrix §4). Multiple approvers: the approval completes at required_decisions (AM-7). | TW-38, TW-39, TW-60, TW-61, TW-62, TW-63, CP-26, CP-27, CP-24 |

Acceptance mapping: SPEC §12 "vendor shortlist permits fewer than five options", "approval refers to exact proposal version".

---

## 6. Flow 5 — Versioned creative approvals: designs, menus, invitations

Actors: Creative (CD) or Project Manager (PM) as author, client approvers, Vendor Coordinator for menus. Entry: a design brief, a menu draft or an invitation draft.

```mermaid
flowchart TD
    subgraph author ["Author (TW-40 designs, TW-35 menus, TW-41 invitations)"]
        a1["Create item with brief"]
        a2["Upload version n, internal review comments"]
        a3("version: shared, approval requested")
        a4["Create version n+1 from feedback"]
        a5("previous version: superseded")
    end
    subgraph client ["Client (CP-29, CP-34, CP-30)"]
        c1["Review version, pin comments on the image"]
        c2{"Decision"}
    end
    subgraph sys ["System"]
        y1("approvals: approved, version locked")
        y2["Item status approved, files frozen"]
        y3["Notify author and PM"]
        y4["Invitations only: approved version becomes distributable (flow 7)"]
    end
    a1 --> a2 --> a3 --> c1 --> c2
    c2 -->|approved| y1 --> y2 --> y3 --> y4
    c2 -->|revision requested| a4 --> a5 --> a2
    c2 -->|rejected| a1
```

| Statuses moved | Notifications | Exceptions and edge cases | Screens |
|---|---|---|---|
| design_items: briefing → in_progress → review → approved; design_versions, menu_versions, invitation_versions: draft → shared → approved, revision_requested, superseded; approvals as in flow 4 | Version shared (approvers); comment added (author or client, per is_internal); decision (author, PM) | Internal comments are never shown to the client (A-20). Menu approval also freezes the guaranteed headcount sent to the caterer (data-model §14). Approving an invitation version does not send it; distribution is a separate, RSVP-team action (flow 7). | TW-40, TW-35, TW-41, CP-28, CP-29, CP-34, CP-30, CP-35 |

Acceptance mapping: SPEC §12 "approval refers to exact design or menu version; revisions do not overwrite it".

---

## 7. Flow 6 — Client requests: questions, change requests, support

Actors: client (CO, CA, CV), assigned staff, Project Manager (PM), the system. Entry: the client wants to ask, change or complain (U-12).

```mermaid
flowchart TD
    subgraph client ["Client (CP-36, CP-37)"]
        c1["New request: type, related record, description"]
        c2("client_requests: submitted")
        c3["Answer clarification in the thread"]
        c4["Sees response or implemented change"]
    end
    subgraph staff ["Assigned staff and Project Manager (TW-42)"]
        s1["Assign and review"]
        s2("client_requests: under_review")
        s3{"Type"}
        s4["Answer in thread"]
        s5("client_requests: answered")
        s6{"Clarification needed?"}
        s7("client_requests: clarification_requested")
        s8{"Accept change?"}
        s9("client_requests: accepted")
        s10("client_requests: rejected with reason")
        s11["Implement: edit records, versions, dates"]
        s12("client_requests: implemented")
    end
    subgraph sys ["System"]
        y1["Notify project lead"]
        y2{"Material? thresholds (U-11)"}
        y3["Set impact flags, create review tasks on budget, contracts, tasks, run-of-show"]
        y4["Notify client"]
    end
    c1 --> c2 --> y1 --> s1 --> s2 --> s3
    s3 -->|question or support| s4 --> s5 --> y4 --> c4
    s3 -->|change request| s6
    s6 -->|yes| s7 --> c3 --> s2
    s6 -->|no| s8
    s8 -->|yes| s9 --> y2
    s8 -->|no| s10 --> y4
    y2 -->|yes| y3 --> s11
    y2 -->|no| s11
    s11 --> s12 --> y4
```

| Statuses moved | Notifications | Exceptions and edge cases | Screens |
|---|---|---|---|
| client_requests: submitted → under_review → clarification_requested → answered, accepted, rejected → implemented, or withdrawn | Request submitted (project lead); assigned (assignee); clarification (client); response (client); material flags (owners of affected records) | A Viewer may submit questions only (permission-matrix §6). Change requests that alter an approved version lead to a new version and a new approval (flow 5). Requests after project closure are support type only. The client can withdraw at any time before implementation. | CP-36, CP-37, TW-42, TW-32 |

---

## 8. Flow 7 — Invitations and RSVP (SPEC §14 "RSVP") — superseded by the revised Flow 7 in §0a

Actors: Client Owner (CO), RSVP team (RG), guests (GU), the system. Entry: an approved invitation version and a guest list.

```mermaid
flowchart TD
    subgraph list ["Guest list"]
        l1["CO imports or enters guests and family groups (CP-31) or RG enters (TW-50, TW-58)"]
        l2["Set functions invited per guest, allowance per group (U-5)"]
    end
    subgraph send ["RSVP team (TW-41, TW-54)"]
        s1["Choose approved invitation version and channels"]
        s2("invitations: scheduled then sending")
        s3["Tokens issued per family group, recipients created"]
        s4("invitations: sent")
        s5["Reminder job for no_response groups"]
        s6["Call list (TW-53): assisted entry writes the same rows"]
    end
    subgraph guest ["Guest (GR-01 to GR-07)"]
        g1["Open link, token exchanged for a guest session"]
        g2["Confirm household, add members within allowance"]
        g3["Attendance per member per function"]
        g4["Dietary, needs, travel if requested"]
        g5["Review and submit"]
        g6["Confirmation and contact route"]
    end
    subgraph sys ["System"]
        y1("guest_function_attendance: attending, not_attending, tentative")
        y2["rsvp_responses snapshot, audit"]
        y3["Recalculate totals and menu headcounts, flag rooms and transfers"]
        y4["Notify RSVP team of changes after the deadline"]
        y5{"Token valid?"}
        y6["GR-08 expired or revoked: contact route, RG reissues"]
    end
    l1 --> l2 --> s1 --> s2 --> s3 --> s4 --> g1 --> y5
    y5 -->|yes| g2 --> g3 --> g4 --> g5 --> y1 --> y2 --> y3 --> g6
    y5 -->|no| y6
    s4 --> s5 --> s6 --> y1
    y3 --> y4
```

| Statuses moved | Notifications | Exceptions and edge cases | Screens |
|---|---|---|---|
| invitations: approved → scheduled → sending → sent → closed; invitation_recipients: pending → sent → delivered, opened, failed, bounced; rsvp_tokens: active → expired, revoked; guest_function_attendance: no_response → attending, not_attending, tentative; guests: draft → invited → confirmed | Invitation and reminders (guests by channel); delivery failures (RG); attendance changes after deadline (RG, HL); headcount changes (PM, VC for the caterer) | Self-service and assisted responses write the same rows, so no duplicates arise (SPEC §12). A guest can edit until the token expires; later changes go through the RSVP team. Identity documents are requested in GR-05 only when the project enables them (A-8). A group cannot see other groups or counts (P-4). Delivery failures create follow-up tasks. | CP-31, CP-32, CP-33, TW-41, TW-50, TW-52, TW-53, TW-54, TW-58, GR-01 to GR-09 |

Acceptance mapping: SPEC §12 "self-service and AMPM-assisted RSVP update the same guest database without duplicates", "attendance changes update totals and flag downstream planning impacts".

---

## 9. Flow 8 — Rooms, travel and transport

Actors: Hotel team (HT), Hospitality (HL), RSVP team (RG), guests. Entry: a hotel contract with a room block, and confirmed attendance.

```mermaid
flowchart TD
    subgraph blocks ["Hotel team and PM (TW-55)"]
        b1["Create room blocks per hotel, category and dates from the contract"]
        b2("room_blocks: held then contracted")
        b3["Release deadline reminder"]
    end
    subgraph rooming ["Hospitality and RSVP (TW-55, TW-56)"]
        r1["Rooming list from attending guests: allocations and occupants"]
        r2("room_allocations: proposed then confirmed")
        r3["Travel segments from guest submissions or calls"]
        r4["Plan vehicles and transfers, assign passengers"]
        r5["Manifests: arrivals, departures, rooming (export without identity data)"]
        r6["Check-in: room numbers, identity check where enabled"]
        r7("room_allocations: checked_in")
        r8["Check-out and departure confirmation"]
        r9("room_allocations: checked_out, guest_departures confirmed")
    end
    subgraph sys ["System"]
        y1{"Within blocked minus released?"}
        y2["Refuse or flag ad hoc room"]
        y3["Attendance change flags affected allocations and transfers"]
        y4["Notify hospitality and RSVP of room or transfer changes"]
    end
    b1 --> b2 --> b3
    b2 --> r1 --> y1
    y1 -->|yes| r2
    y1 -->|no| y2 --> r1
    r2 --> r3 --> r4 --> r5 --> r6 --> r7 --> r8 --> r9
    y3 -.-> r1
    y3 -.-> r4
    r2 --> y4
    r4 --> y4
```

| Statuses moved | Notifications | Exceptions and edge cases | Screens |
|---|---|---|---|
| room_blocks: requested → held → contracted → partially_released → released → closed; room_allocations: requested → proposed → confirmed → checked_in → checked_out, or cancelled; travel_segments: planned → confirmed → arrived, delayed, cancelled; transfers: planned → assigned → en_route → completed | Allocation confirmed (guest, optional); room or transfer changes (HL, RG); release deadline (HT, PM); flight delays (HL) | Allocations without a block are allowed but flagged (data-model §13). Occupants never exceed the category occupancy. The hotel rooming list export carries names, dates and category only and is audited (permission-matrix §5.16). Identity documents are viewed at check-in only by staff with the explicit grant (P-5). | TW-55, TW-56, TW-57, GR-05, CP-32 |

---

## 10. Flow 9 — Live execution (SPEC §14 "execution")

Actors: Project Manager (PM), Hospitality (HL), Vendor Coordinator (VC), on-site staff, the system. Entry: a function in pre-production.

```mermaid
flowchart TD
    subgraph pre ["Pre-production (TW-74, TW-73, TW-72, TW-64)"]
        p1["Readiness checklist items completed by owners"]
        p2{"All required items done?"}
        p3["Authorised exception with reason (P-8)"]
        p4("functions: readiness ready")
        p5["Run-of-show cues, staffing roster, production items tested"]
        p6["Offline caches primed on staff devices (U-7)"]
    end
    subgraph day ["Wedding day (TW-76 console, TW-73 live view)"]
        d1("wedding_projects: live, functions: readiness live")
        d2["Cues started and ended with actual times"]
        d3["Arrivals, transfers and check-ins from flow 8"]
        d4{"Incident?"}
        d5["Report incident with severity (TW-75)"]
        d6("incidents: open then assigned")
        d7{"Critical or unassigned past timer?"}
        d8["Escalate per configured chain"]
        d9("incidents: resolved with notes, then closed")
        d10("functions: readiness completed")
    end
    subgraph sys ["System"]
        y1["Queued cue updates and incident reports sync when online"]
        y2["Wedding-day monitoring mode and deployment freeze (T-14)"]
    end
    p1 --> p2
    p2 -->|yes| p4
    p2 -->|no| p3 --> p4
    p4 --> p5 --> p6 --> d1 --> y2
    d1 --> d2 --> d4
    d1 --> d3
    d4 -->|yes| d5 --> d6 --> d7
    d7 -->|yes| d8 --> d9
    d7 -->|no| d9
    d4 -->|no| d10
    d9 --> d10
    d2 -.-> y1
    d5 -.-> y1
```

| Statuses moved | Notifications | Exceptions and edge cases | Screens |
|---|---|---|---|
| functions: readiness not_started → in_progress → blocked → ready → live → completed; wedding_projects: ready → live; run_of_show_items: pending → in_progress → done, skipped; incidents: open → assigned → in_progress → escalated → resolved → closed; staff_assignments: planned → confirmed → on_duty → off_duty | Readiness blocked (PM); exception authorised (SA); incident assigned and escalated (assignee, escalation chain); critical incident (project lead, SA) | A function cannot go live with a required item open unless an exception is recorded by an authorised user (SPEC §12). A critical incident cannot be resolved without resolution notes (SPEC §7). Offline conflicts: server wins on status transitions, notes merge last-writer-wins with a conflict log (T-11). Deploys are frozen while any project is live (T-14). | TW-72, TW-73, TW-74, TW-75, TW-76, TW-64, TW-35 |

Acceptance mapping: SPEC §12 "production readiness cannot be completed without required checks or an authorised exception", "incidents can be assigned, escalated and closed with resolution notes".

---

## 11. Flow 10 — Closure

Actors: Project Manager (PM), Hospitality (HL), Vendor Coordinator (VC), Finance (FA), client, the system. Entry: the last function is completed.

```mermaid
flowchart TD
    subgraph pm ["Project Manager (TW-45)"]
        p1("wedding_projects: closure")
        p2["Closure checklist from template"]
        p3{"All required items done or excepted?"}
        p4("wedding_projects: closed")
        p5["Request client feedback (CP-40)"]
    end
    subgraph items ["Checklist items and their owners"]
        i1["Departures: every staying guest checked out and confirmed (HL)"]
        i2["Lost and found: no logged or claimed items remain (HL)"]
        i3["Vendor completion: every active assignment confirmed (VC)"]
        i4["Final accounts: reconciled by Finance, approved (FA) (TW-84)"]
        i5["Closure review: documents and records complete (PM)"]
    end
    subgraph sys ["System"]
        y1["Verify each item against data (data-model section 17)"]
        y2["Set client_access_until, keep all records (U-8)"]
        y3["After the window: client memberships removed, project archived"]
        y4["Retention jobs: identity documents, guest data per class (A-17)"]
    end
    p1 --> p2 --> i1 --> y1
    p2 --> i2 --> y1
    p2 --> i3 --> y1
    p2 --> i4 --> y1
    p2 --> i5 --> y1
    y1 --> p3
    p3 -->|yes| p4 --> y2 --> p5 --> y3 --> y4
    p3 -->|no| p2
```

| Statuses moved | Notifications | Exceptions and edge cases | Screens |
|---|---|---|---|
| wedding_projects: live → closure → closed; checklists: in_progress → complete, complete_with_exception; project_final_accounts: draft → reconciled → approved → closed; project_members (client): active → removed after the window | Closure started (owners of items); final accounts approved (PM); project closed (client members, with the access window date); feedback request (client); access ending reminder (client) | Closing with an exception requires an authorised user and a reason (SPEC §7). Reopening a closed project is Super Admin only and audited (permission-matrix §7). Records are never deleted at closure (WHY §4); only retention jobs delete, per class. | TW-45, TW-84, TW-55, TW-63, CP-40, CP-41 |

Acceptance mapping: SPEC §12 "closure checks departure, lost-and-found, vendor completion and financial reconciliation".

---

## 12. Flow 11 — Sign-in, activation, recovery and guest access (cross-cutting)

Actors: staff, clients, demo prospects, guests. Entry: any protected screen (U-9).

```mermaid
flowchart TD
    subgraph entry ["Entry"]
        e1["AUTH-01 Sign in: email and password"]
        e2["AUTH-02 Invitation link: set password, phone, accept notice"]
        e3["AUTH-03 Forgot password: emailed reset link, 1 hour"]
        e4["GR-01 Guest token link"]
    end
    subgraph checks ["Checks"]
        k1{"Credentials valid and account active?"}
        k2{"Principal type"}
        k3["Authenticator code (staff, mandatory)"]
        k4{"OTP enabled?"}
        k5["Phone OTP (clients, optional)"]
        k6{"Token active and unexpired?"}
        k7["Lockout after repeated failures, rate limited"]
    end
    subgraph result ["Result"]
        r1["Staff session 12 hours idle timeout"]
        r2["Client or demo session 30 days"]
        r3["Guest session bound to the family group"]
        r4["AUTH-04 Access help: contact AMPM (flowchart)"]
        r5["GR-08 Invalid or expired token"]
    end
    e2 --> e1
    e3 --> e1
    e1 --> k1
    k1 -->|no| k7 --> r4
    k1 -->|yes| k2
    k2 -->|staff| k3 --> r1
    k2 -->|client or demo| k4
    k4 -->|yes| k5 --> r2
    k4 -->|no| r2
    e4 --> k6
    k6 -->|yes| r3
    k6 -->|no| r5
```

| Statuses moved | Notifications | Exceptions and edge cases | Screens |
|---|---|---|---|
| users: invited → active, locked; auth_tokens: used; rsvp_tokens: active → expired, revoked | Invitation, reset link, OTP code, new-device sign-in notice | No public self-registration anywhere (WHY §4). A disabled or removed membership ends the session at the next request. A demo account past its trial end is refused with an explanation and a Sales contact. Guests never see a password screen. | AUTH-01 to AUTH-05, GR-01, GR-08 |

---

## 13. Flow 12 — Entitlement changes: expiry, suspension, closure window

A table rather than a diagram, because the flow is driven by jobs (permission-matrix §8) and the states are in permission-matrix §3.

| Trigger | What the system does | What the client sees | Notifications |
|---|---|---|---|
| ends_at minus notice period | subscriptions: active → expiring | Banner in CP-01 and CP-11 with renewal action | Client, Sales |
| ends_at reached | subscriptions: expiring → expired; subscription modules removed; saved hotel names kept, profiles hidden | CP-01 shows saved hotel names and a renew prompt; CP-04 and CP-05 unavailable; existing enquiries readable | Client, Sales |
| Finance suspends for non-payment | subscriptions: → suspended | As expired, plus a payment prompt | Client, Sales, FA |
| Cancellation accepted | subscriptions: → cancelled | As expired; records kept | Client, Sales |
| Project closed | client_access_until set | Read-only banner (CP-41) with the date | Client members |
| Window ends | client memberships → removed; project archived | Sign-in succeeds, portal shows no projects and a contact route | Client members (reminder before) |
| Account suspended | client_accounts: → suspended | Sign-in refused with contact route | Primary contact, Sales |

Nothing in this table deletes data (WHY §4, GP-1).

---

## 14. Coverage of the specification's flows and the flowcharts

| Required by | Covered in |
|---|---|
| SPEC §14 subscription | Flow 1, Flow 12 |
| SPEC §14 hotel assistance | Flow 2 |
| SPEC §14 wedding engagement | Flow 3 |
| SPEC §14 RSVP | Flow 7 |
| SPEC §14 execution | Flow 9 |
| SPEC §1.2 journey steps 1 to 10 | Flows 1, 2, 3, 4, 7, 8, 9, 10 in order |
| SPEC §2.5 guest RSVP flow | Flow 7 guest lane |
| WHY §1 stages 1 to 5 | Flow 1 (stages 1 to 3), Flow 3 (stages 4 and 5) |
| TEAM-FLOW main path (qualified client → wedding record → planning → live → closure) | Flows 3, 4 to 8, 9, 10, with the subscription and consultancy branches the flowchart omitted (CF-4) in Flows 1 and 2 |
| PORTAL-FLOW (sign in → home → action → approval required? → AMPM reviews → updated) | Flows 11, 4, 5, 6 |

---

## 15. Open questions raised by the flows

1. **Where the subscription is purchased** (U-2, Q2): inside the portal after invitation, as drawn, or on the public site with account creation on payment, which WHY §4 forbids.
2. **Which hotel services are chargeable** (U-3, Q4): the agreement branch in Flow 2 moves depending on the answer.
3. **When a project is created** (U-6, Q10): on an accepted broader-services agreement, as drawn, or earlier.
4. **Reminder cadence and the RSVP deadline rule** (U-5, Q7): how many reminders, on which channels, and whether guests may edit after the deadline.
5. **Who may authorise readiness exceptions** (P-8, Q10).
6. **Feedback and access window** (U-8, Q23, Q24).
