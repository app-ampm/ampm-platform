# AMPM Platform — Your Flowcharts, Redrawn With the Gaps Filled

**For:** AMPM review · **Date:** 24 October 2026 · **Status:** proposal, nothing approved.

This document takes the two Level-1 flowcharts you supplied (the team app and the client portal) and the customer journey described in your "Why AMPM App" note, reproduces each faithfully, and then shows the upgraded version. Every box in an upgraded diagram is colour-coded so you can see at a glance what was yours, what was added to fill a gap, and what was changed. The tag inside a box names the finding it answers; the findings are explained in plain language in [the annotated brief](annotated-brief.md) and the decisions you are asked for are in [the open decisions document](open-decisions.md).

## Legend

| Colour | Meaning | Tag |
|---|---|---|
| Grey | As in your flowchart, unchanged | none |
| Green | Added to fill a gap your documents left open | `+ ID` |
| Amber | Kept, but changed in scope or meaning | `~ ID` |

Tags refer to findings in the audit: **CF** a conflict between two of your documents, **GP** a gap, **AM** an ambiguity, **Q** a decision only AMPM can make, **A / U / W** an assumption we made meanwhile (listed in [the assumptions sheet](assumptions-taken.md)).

---

## 1. Team app

### 1.1 Your flowchart, as supplied

Five navigation tabs and one linear path from a qualified client to closure.

```mermaid
flowchart TD
    s([START]) --> open["Open AMPM Team App<br>Sign in / permissions"]
    open --> home["HOME DASHBOARD<br>Overview • alerts • upcoming work"]
    home --> choose{"Choose a main tab"}
    choose --> tHome["HOME<br>Dashboard<br>Today • calendar<br>Alerts • activity"]
    choose --> tClients["CLIENTS<br>Enquiry / lead<br>Consultation<br>Questionnaire"]
    choose --> tWeddings["WEDDINGS<br>Wedding master<br>Functions and plans<br>Guest / hospitality"]
    choose --> tTasks["TASKS<br>Assign owner<br>Deadline and checklist<br>Track completion"]
    choose --> tMore["MORE<br>Finance • vendors<br>Documents • reports<br>Database • settings"]
    tHome --> create
    tClients --> create
    tWeddings --> create["QUALIFIED CLIENT → CREATE WEDDING RECORD<br>Unique Wedding ID + approved service scope"]
    tTasks --> create
    tMore --> create
    create --> plan["WEDDING PLANNING AND COORDINATION<br>Functions • venue • design • vendors • guests • budget"]
    plan --> live["LIVE WEDDING OPERATIONS<br>Production • show flow • readiness • incidents"]
    live --> closure["POST-WEDDING CLOSURE<br>Final invoices • reconciliation • feedback • archive"]
    closure --> fin([END])
    side1["CONNECTED THROUGHOUT<br>Tasks and alerts • approvals and documents • budget and reporting"]
    side2["ACCESS CONTROL<br>Role-based permissions • internal vs client data • activity history"]
```

What this flowchart does well: the four stages after the wedding record is created (planning, live operations, closure) match the specification and are kept as they are.

What it leaves out: the business before a wedding record exists. Your specification's "critical rule" says a hotel-discovery subscription never implies full wedding management, and most clients will stop at discovery or hotel assistance. The flowchart has no subscription, no demo, no hotel work, and no place for the Hotel team or the RSVP team to work (findings CF-3 and CF-4).

### 1.2 Upgraded team app

```mermaid
flowchart TD
    classDef orig fill:#ebe7ef,stroke:#8d8497,color:#221c2a
    classDef added fill:#d6efd8,stroke:#2e7d32,color:#0f2b12
    classDef changed fill:#ffe7b3,stroke:#b8862b,color:#3a2a05
    s([START]) --> signin["Sign in: email, password and an authenticator code for staff<br>+ GP-31 / Q13"]
    signin --> home["HOME dashboard<br>today • alerts • pending approvals • overdue tasks • live weddings"]
    home --> nav{"Nine areas on desktop, your five tabs on phones<br>~ CF-3 / W-2"}
    nav --> leads["LEADS AND CLIENTS<br>pipeline • consultation and questionnaire as activities • accounts • subscriptions • agreements<br>~ CF-8 / W-12"]
    nav --> hotels["HOTELS<br>destinations • profiles • rate cards with verification dates • enquiries • site visits • proposals<br>+ CF-3 / GP-8"]
    nav --> weddings["WEDDINGS<br>project dashboard • functions • budget • vendors • designs • approvals • requests • closure"]
    nav --> guests["GUESTS<br>guest database • RSVP calls • rooming • travel • support requests<br>+ CF-3"]
    nav --> vendors["VENDORS<br>master list • availability • quotes • contracts • deliverables"]
    nav --> tasks["TASKS AND OPERATIONS<br>tasks • staffing • run-of-show • readiness • incidents • event-day console"]
    nav --> finance["FINANCE AND REPORTS<br>payments • invoices • milestones • reports • final accounts"]
    nav --> settings["SETTINGS<br>users • roles • plans and packages • reference data • templates • configuration • audit log • website content<br>+ GP-3 / GP-23"]
    leads --> demo["Demo or trial granted by Sales, time-boxed, sample data<br>+ GP-2 / CF-1"]
    demo --> sub["Subscription: AMPM invites, client pays in the portal, modules activate<br>+ CF-5 / Q2"]
    sub --> discovery["Hotel discovery and assistance for the subscriber<br>+ CF-4"]
    discovery --> agree{"Engages AMPM beyond hotels?"}
    agree -->|no| stay["Stays a subscriber: renew or expire, nothing deleted<br>+ GP-1"]
    agree -->|yes| create["Service agreement → create wedding record<br>unique ID • scope • staff and client members<br>~ U-6 / Q10"]
    create --> plan["PLANNING AND COORDINATION<br>functions • venues • design • vendors • guests • budget, in parallel"]
    plan --> live["LIVE OPERATIONS<br>readiness gate • run-of-show, readable offline • incidents • arrivals<br>~ GP-34"]
    live --> closure["CLOSURE<br>checklist: departures, lost and found, vendor completion, final accounts<br>feedback • client access window • archive<br>~ GP-29 / A-23"]
    closure --> fin([END])
    class s,home,weddings,vendors,tasks,finance,plan,fin orig
    class signin,hotels,guests,demo,sub,discovery,stay added
    class nav,leads,settings,agree,create,live,closure changed
```

What changed and why:

| Box | Change | Finding | Where it is specified |
|---|---|---|---|
| Sign in | Authenticator code for staff; no self-registration anywhere | GP-31, Q13 | wireframes AUTH-01 to AUTH-05; permission matrix P-6 |
| Nine areas / five tabs | Your five tabs stay on phones; desktop shows the nine areas your specification lists, so Hotels and Guests have a home | CF-3, W-2 | wireframes §2 |
| Leads and clients | "Consultation" and "Questionnaire" become logged activities on the lead, and subscriptions and agreements live here | CF-8, W-12 | wireframes TW-10 to TW-15 |
| Hotels | New area: the private database, rate cards with verification dates, enquiries, visits and proposals | CF-3, GP-8 | wireframes TW-20 to TW-28; data model modules C and D |
| Guests | New area: cross-wedding guest operations for the RSVP team | CF-3 | wireframes TW-50 to TW-58 |
| Settings | Plans and packages, website content and configuration added, so prices and rules are never in code | GP-3, GP-23 | wireframes TW-90 to TW-97 |
| Demo or trial | A stage your "Why" note requires but no other document specified | GP-2, CF-1 | user flows Flow 1 (U-1) |
| Subscription | Purchase path defined: AMPM invites, client pays, modules activate | CF-5, Q2 | user flows Flow 1 (U-2) |
| Hotel discovery and assistance | The branch most clients take and the flowchart omitted | CF-4 | user flows Flow 2 |
| Stays a subscriber | Expiry and renewal without deleting records | GP-1 | user flows Flow 12 |
| Create wedding record | Triggered by an accepted service agreement for anything beyond hotel help | U-6, Q10 | user flows Flow 3 |
| Live operations | Readiness gate and offline-readable cue sheet added | GP-34 | user flows Flow 9 |
| Closure | Your "feedback" and "archive" kept and given records; a client access window added | GP-29, A-23 | user flows Flow 10 |

---

## 2. Client portal

### 2.1 Your flowchart, as supplied

```mermaid
flowchart TD
    s([START]) --> open["Open client portal<br>Sign in securely"]
    open --> verified{"Access verified?"}
    verified -->|No| help["Contact AMPM<br>for access help"]
    help --> open
    verified -->|Yes| home["HOME<br>Countdown • upcoming functions • updates"]
    home --> wed["MY WEDDING<br>Couple / family profile<br>Functions and schedule<br>Venue • design • guest info"]
    home --> appr["APPROVALS<br>Proposals and selections<br>Budget / design approvals<br>Change requests"]
    home --> budget["MORE: BUDGET<br>Client-facing budget<br>Invoices and payment status"]
    home --> docs["MORE: DOCUMENTS AND SUPPORT<br>Contracts • shared files<br>Messages • questions<br>AMPM support"]
    wed --> action["CLIENT ACTION<br>View • submit details • review • approve • ask a question"]
    appr --> action
    budget --> action
    docs --> action
    action --> need{"Approval required?"}
    need -->|Yes| submit["Submit decision /<br>change request"]
    submit --> review["AMPM TEAM REVIEWS REQUEST<br>Approve • respond • request clarification"]
    need -->|No| review
    review --> updated["UPDATED WEDDING INFORMATION<br>Approved changes reflected in client portal"]
    side1["CLIENT ACCESS RULES<br>Only own wedding • visible, approved information"]
    side2["CONNECTED TO AMPM<br>Approvals • documents • updates • support"]
```

What this flowchart does well: the approve-or-request loop at the bottom is exactly how the portal should behave and is kept.

What it leaves out: hotel discovery, which is the Phase 1 product and the thing a subscription pays for. The Home tab's countdown also assumes every client has a wedding date, which a hotel-discovery subscriber does not (finding CF-2). "Messages, questions" implies a chat feature no other document describes (GP-15), and "Invoices and payment status" commits to showing money the specification leaves undecided (CF-6).

### 2.2 Upgraded client portal

```mermaid
flowchart TD
    classDef orig fill:#ebe7ef,stroke:#8d8497,color:#221c2a
    classDef added fill:#d6efd8,stroke:#2e7d32,color:#0f2b12
    classDef changed fill:#ffe7b3,stroke:#b8862b,color:#3a2a05
    s([START]) --> open["Sign in: email and password, optional phone code<br>~ Q13"]
    open --> verified{"Access verified?"}
    verified -->|no| help["Contact AMPM for access help"]
    help --> open
    verified -->|yes| state{"Account state<br>+ GP-1"}
    state -->|subscriber only| homeS["HOME: hotel discovery<br>search • saved hotels • enquiries • subscription<br>+ CF-2"]
    state -->|engaged client| homeE["HOME: wedding dashboard<br>countdown when dates exist • pending decisions • milestones • budget if permitted<br>~ W-12 / W-5"]
    state -->|closed wedding| homeC["HOME: read-only until the access window ends<br>+ A-23"]
    homeS --> hotels["HOTELS<br>destinations • search • hotel detail with verified rates • compare • request assistance • enquiry tracker<br>+ CF-2 / GP-8"]
    homeE --> hotels
    homeE --> wed["MY WEDDING<br>overview and contacts • functions • vendors • designs • invitations • guest list • RSVP progress • menus"]
    homeE --> appr["APPROVALS<br>one inbox of decisions waiting • history"]
    homeE --> more["MORE<br>budget, invoices and milestones for permitted users • requests • documents • subscription • notifications<br>~ CF-6 / W-5"]
    hotels --> action
    wed --> action["CLIENT ACTION<br>view • decide • comment • request • upload"]
    appr --> action
    more --> action
    action --> kind{"What kind of action?"}
    kind -->|a decision| decide["Approve • request revision • decline, locked to the exact version"]
    kind -->|a question, change or support need| req["REQUEST with a tracked thread, in place of messages<br>~ GP-15 / A-20"]
    kind -->|help with a hotel| enq["Hotel assistance request becomes an enquiry<br>+ GP-5"]
    decide --> review["AMPM reviews and responds"]
    req --> review
    enq --> review
    review --> updated["Updated information in the portal, notifications sent"]
    class s,verified,help,wed,appr,action,review,updated orig
    class state,homeS,homeC,hotels,enq added
    class open,homeE,more,kind,decide,req changed
```

What changed and why:

| Box | Change | Finding | Where it is specified |
|---|---|---|---|
| Sign in | Method defined; no self-registration | Q13 | wireframes AUTH-01 |
| Account state | The portal has three states: subscriber only, engaged client, closed wedding | GP-1 | permission matrix §3; wireframes §2 |
| Home for subscribers | Hotel discovery is the home page until a wedding project exists | CF-2 | wireframes CP-01 |
| Home for engaged clients | Countdown only when dates exist; budget card only for users allowed to see money | W-12, W-5 | wireframes CP-20 |
| Hotels | New tab: the Phase 1 product | CF-2, GP-8 | wireframes CP-02 to CP-11 |
| More | Finance shown only to permitted users; subscription management added | CF-6, W-5 | wireframes CP-11, CP-24, CP-25 |
| Requests | Your "messages, questions" delivered as typed, tracked requests rather than chat | GP-15, A-20 | wireframes CP-36, CP-37; user flows Flow 6 |
| Hotel assistance | A client's request for hotel help becomes an enquiry the Hotel team works | GP-5 | user flows Flow 2 |

---

## 3. The customer journey

### 3.1 As described in your "Why AMPM App" note

```mermaid
flowchart LR
    a["Stage 1<br>Public website<br>open to everyone"] --> b["Stage 2<br>Demo or limited free trial<br>prospective client"]
    b --> c["Stage 3<br>Paid subscription<br>access is purchased"]
    c --> d["Stage 4<br>Wedding project creation"]
    d --> e["Stage 5<br>Full authorised access"]
```

### 3.2 Upgraded journey

```mermaid
flowchart LR
    classDef orig fill:#ebe7ef,stroke:#8d8497,color:#221c2a
    classDef added fill:#d6efd8,stroke:#2e7d32,color:#0f2b12
    classDef changed fill:#ffe7b3,stroke:#b8862b,color:#3a2a05
    a["1 Public website<br>learn • examples • request a demo or access"] --> b["2 Demo or trial<br>Sales grants it, time-boxed, sample data, expires<br>+ GP-2 / CF-1"]
    b --> c["3 Subscription<br>AMPM invites the client, the client pays in the portal, modules activate<br>~ CF-5 / U-2"]
    c --> c2["Hotel discovery and assistance<br>availability checks included, other services by agreement<br>+ GP-5 / U-3"]
    c2 --> d{"Engage AMPM for the wedding?"}
    d -->|no| c3["Remains a subscriber<br>renew, or expire to read-only, nothing deleted<br>+ GP-1"]
    d -->|yes| e["4 Wedding project<br>created from the accepted agreement<br>~ U-6"]
    e --> f["5 Full authorised access<br>client users with roles, a finance flag and approval rights<br>~ Q5"]
    f --> g["Closure<br>feedback • access window • archive<br>+ A-23"]
    class a orig
    class b,c2,c3,g added
    class c,d,e,f changed
```

---

## 4. The guest RSVP flow

### 4.1 As described in your specification (section 2.5)

```mermaid
flowchart TD
    a["Guest opens a wedding-specific link<br>and sees the invitation context"] --> b["Confirms contact details<br>and family group"]
    b --> c["Responds for self and<br>authorised accompanying family"]
    c --> d["Confirms attendance<br>for each invited function"]
    d --> e["Provides travel and accommodation<br>information if requested"]
    e --> f["Submits; system confirms<br>and provides a contact route"]
    f --> g["AMPM RSVP team reviews, follows up,<br>records call-assisted responses"]
```

### 4.2 Upgraded guest flow

```mermaid
flowchart TD
    classDef orig fill:#ebe7ef,stroke:#8d8497,color:#221c2a
    classDef added fill:#d6efd8,stroke:#2e7d32,color:#0f2b12
    classDef changed fill:#ffe7b3,stroke:#b8862b,color:#3a2a05
    p["Guest list loaded first by the family or the RSVP team<br>+ GP-25 / U-5"] --> t["One private link per household, sent by WhatsApp, email or SMS<br>~ AM-1 / A-7"]
    t --> a["Guest opens the link and sees the wedding, the household and the invited functions<br>with a short privacy notice<br>~ GP-40 / Q17"]
    a --> b["Confirms who is responding and the household members<br>may add members within an allowance set by the family<br>~ A-7"]
    b --> d["Attendance per person per function<br>yes, no or maybe"]
    d --> m["Meal preference for everyone attending; allergies and access needs optional<br>+ GP-24"]
    m --> e["Travel and accommodation if the wedding asks for it<br>identity document only when the wedding requires it, never Aadhaar<br>~ GP-41 / Q8"]
    e --> f["Review and submit; confirmation with a contact route; can update until the deadline"]
    f --> g["RSVP team sees the same records; reminders go out on a schedule; calls record assisted responses<br>~ U-5"]
    g --> h["Attendance changes update headcounts, menus, rooms and transport automatically<br>+ GP-13"]
    class d,f orig
    class p,m,h added
    class t,a,b,e,g changed
```

What changed and why:

| Step | Change | Finding | Where it is specified |
|---|---|---|---|
| Guest list first | Households and members are loaded before invitations go out, so the link knows who is responding | GP-25, U-5 | user flows Flow 7; wireframes CP-31, TW-58 |
| One link per household | Your "wedding-specific link" becomes a private link per household, so no guest can see another household | AM-1, A-7 | data model module J; permission matrix P-4 |
| Privacy notice | Consent and retention stated where the data is collected | GP-40, Q17 | wireframes GR-01 |
| Household allowance | Accompanying members are allowed up to a number the family sets per household | A-7 | wireframes GR-02 |
| Meal preference | Collected for the menus and caterer counts; allergies optional and restricted | GP-24 | wireframes GR-04 |
| Identity documents | Only when the wedding needs them for hotel check-in, never Aadhaar, deleted after checkout | GP-41, Q8 | data model module N; wireframes GR-05 |
| Reminders and calls | Scheduled reminders, then calls; assisted entries write the same records | U-5 | wireframes TW-53 |
| Automatic updates | Headcounts, menus, rooms and transport react to every change | GP-13 | user flows Flows 7 and 8 |

---

## 5. Every addition in one list

| Tag | What was added or changed | Diagram |
|---|---|---|
| + GP-31 / Q13 | Staff sign-in with an authenticator code; client sign-in with optional phone code; no self-registration | 1.2, 2.2 |
| ~ CF-3 / W-2 | Nine areas on desktop, five tabs on phones; Hotels and Guests get a home | 1.2 |
| ~ CF-8 / W-12 | Consultation and questionnaire become lead activities; "Database" means the Hotels area | 1.2 |
| + CF-3 / GP-8 | Hotels area with rate cards and verification dates | 1.2 |
| + GP-3 / GP-23 | Plans, packages and website content in Settings, not in code | 1.2 |
| + GP-2 / CF-1 | Demo or trial stage with expiry | 1.2, 3.2 |
| + CF-5 / Q2 | Subscription purchase path: invite, pay in portal, activate | 1.2, 3.2 |
| + CF-4 | The hotel discovery and assistance branch | 1.2, 3.2 |
| + GP-1 | Expiry and renewal without deletion; account states in the portal | 1.2, 2.2, 3.2 |
| ~ U-6 / Q10 | Wedding record created from an accepted agreement | 1.2, 3.2 |
| ~ GP-34 | Readiness gate and offline-readable cue sheet on the day | 1.2 |
| ~ GP-29 / A-23 | Closure checklist, feedback, client access window, archive | 1.2, 3.2 |
| + CF-2 / GP-8 | Hotels tab and subscriber home in the client portal | 2.2 |
| ~ W-12 / W-5 | Countdown only with dates; finance only for permitted users | 2.2 |
| ~ CF-6 / W-5 | Invoices and payments shown only to users with the finance flag | 2.2 |
| ~ GP-15 / A-20 | Requests with a tracked thread instead of messages | 2.2 |
| + GP-5 | Hotel assistance requests become enquiries | 2.2, 3.2 |
| ~ Q5 | Several client users per wedding with different rights | 3.2 |
| + GP-25 / U-5, ~ AM-1 / A-7, ~ GP-40 / Q17, + GP-24, ~ GP-41 / Q8, + GP-13 | The guest flow additions listed in section 4 | 4.2 |
