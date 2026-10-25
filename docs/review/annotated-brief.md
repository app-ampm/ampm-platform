# AMPM Platform — Your Brief, Annotated

**For:** AMPM review · **Date:** 24 October 2026 · **Status:** your five documents reproduced in full, with every finding placed at the passage it concerns.

This is the document you gave us, handed back with our reading of it. Your text is reproduced as written. Between the passages are callouts of six kinds:

> **GAP.** Something the platform needs that no document specifies. Each names its audit identifier (GP) and says how the design fills it meanwhile.

> **CONFLICT.** Two of your documents say different things (CF). You choose which stands.

> **AMBIGUITY.** A sentence that can be read two ways (AM). We say which reading we took.

> **DECISION.** A question only AMPM can answer (Q). The full list with choices is in [the open decisions document](open-decisions.md).

> **ASSUMED.** What we did in the meantime, with its identifier, listed in [the assumptions sheet](assumptions-taken.md).

> **COVERED.** A requirement the design meets as written, so you can see what needs no discussion.

The five documents, in the order you gave them: the business explanation, the "Why AMPM App" note, the Developer Technical Specification v1.0, the team-app flowchart and the client-portal flowchart.

---

## Part 1 · AMPM Website & App — Simple Business Explanation for Developer

### 1. What is AMPM?

AMPM is a wedding planning and management business. We want to build a website and connected app that help clients discover wedding hotels, explore options, plan their wedding, manage vendors, control budgets, coordinate guests, and manage the complete wedding process.

The platform should support clients who only want hotel-discovery access as well as clients who hire AMPM to manage their entire wedding.

> **COVERED.** The two kinds of client are the backbone of the design: a subscriber-only account and an engaged account see different home pages, and the system never lets one imply the other.

> **DECISION Q1.** "Website and connected app": your specification asks for a responsive website, your flowcharts say "app". We designed a responsive website that can be installed like an app; native apps are a separate choice with a cost.

### 2. The Four Parts of the Platform

**A. Public Website.** This is the website everyone can visit. It should explain AMPM, showcase selected work and services, and allow people to contact us or request a demo. The complete private hotel database must not be publicly accessible.

> **GAP GP-23.** "Showcase selected work" means someone edits the website. No document says whether your team edits it or the developer does. We designed a simple editor for pages, destinations and showcase items (W-4). **Decision Q12.**

> **COVERED.** The private hotel database is never read by public pages; the website shows only hotels you have flagged for showcase, and only their name, destination and a photo.

**B. Client Portal.** This is the private area where clients can log in and see information related to their wedding, including:

- Hotel options shared with them
- Wedding functions and plans
- Budget information intended for clients
- Vendor options and proposals
- Designs, documents and approvals
- Guest and RSVP information where appropriate

Clients should only see information intended for them.

> **CONFLICT CF-2.** Your client-portal flowchart has no hotel area at all, yet "hotel options" is the first item here and hotel discovery is the product a subscription pays for. The redrawn portal adds a Hotels tab and a subscriber home page.

> **GAP GP-26.** "Clients" is one word for several people: the couple, the parents who may be paying, a sibling who helps. No document says how many client logins a wedding has or whether they differ. We designed three client roles with a separate switch for who may see money (A-5). **Decision Q5.**

> **GAP GP-25.** "Guest and RSVP information where appropriate" does not say what the couple may see about their guests, or whether they maintain the list themselves. We assumed the couple sees and edits the full list except restricted notes and identity documents, and viewers see counts only (A-7). **Decision Q7.**

**C. AMPM Team Workspace.** This is the internal system used by AMPM employees to manage:

- Enquiries and clients
- Hotel research and hotel information
- Wedding projects and functions
- Vendors and proposals
- Budgets, payments and approvals
- Guest lists, RSVP and accommodation
- Tasks, documents and event schedules
- Wedding planning and execution

Internal notes, vendor negotiations, profit margins and private operational information must not be visible to clients.

> **CONFLICT CF-3.** Your team-app flowchart has no Hotels area and no Guests area, though both are listed here and in your specification. The redrawn team app gives each a home.

> **COVERED.** The separation of internal and client information is enforced on the server, not hidden in the screen: every money record has a client-facing amount and a separate internal cost, and internal notes, negotiations and margins never leave the server for a client session.

**D. Guest RSVP Portal.** Guests should receive a link where they can confirm attendance and provide the travel, accommodation and other details requested by the wedding team.

The AMPM team should also be able to contact guests and enter their information manually.

> **AMBIGUITY AM-1.** "A link" could be one link for the whole wedding or a private link per household. One shared link would force guests to find themselves in a list and would let them see other families. We designed a private link per household, which means the guest list must exist before invitations go out (A-7). **Decision Q7.**

> **GAP GP-24.** Meal preferences and allergies are not mentioned, but menus and caterers need them. We collect a meal preference for everyone attending and treat allergies as optional and restricted.

> **COVERED.** Manual entry by your team writes the same records as the guest's own response, so a phone call never creates a duplicate.

### 3. How the AMPM Business Process Works

**Step 1: A client contacts AMPM.** The enquiry may come from Instagram, advertisements, referrals, the website or another source. The team records the client's contact details, requirements and enquiry source.

> **DECISION Q17.** The enquiry form must ask for consent in wording you approve, because the people who enquire have not signed anything with you yet (GP-40).

**Step 2: AMPM introduces its services.** The team shares the relevant introduction, information or demo and explains the available services.

> **GAP GP-2.** "Demo" appears here and in your "Why" note, but nothing defines how a demo is granted, what it shows or when it ends. We designed a demo granted by Sales from the lead record, time-boxed, on sample data (U-1). **Decision Q3.**

**Step 3: The client may purchase hotel-discovery access.** The client may purchase a subscription to access AMPM's hotel information. The subscription price and exact terms are still to be decided. After successful payment, AMPM activates the agreed access.

> **CONFLICT CF-5.** Your "Why" note says AMPM creates every account and nobody registers themselves. Your specification describes a payment journey from the website. We reconciled them: the client requests access on the website, AMPM creates the account and invites them, and the client pays inside the portal, online or by bank transfer (U-2). **Decisions Q2 and Q3.**

> **GAP GP-4.** Whether the subscription recurs or is a one-time fee is not stated; recurring billing is a sizeable feature. We assumed one-time for a fixed term (A-3). **Decision Q3.**

**Step 4: The client explores hotels.** The client can explore available hotel information, such as:

- Hotel location and details
- Wedding venues and their capacities
- Room inventory and accommodation information
- Photos and videos
- Previous wedding photos and videos, where available
- Relevant pricing and availability information

The system should indicate whether prices and availability have been verified and when they were last checked.

> **GAP GP-8.** This step requires prices, but the data model in your specification has no place to store one. We designed rate cards per season with line items for room rates, venue rental, per-plate minimums and taxes, each with a verification date (A-9). **Decision Q9.**

> **GAP GP-9.** "Availability" has no home either. We assumed availability for specific dates is answered by your team inside each enquiry, not kept as a live calendar. **Decision Q9.**

> **GAP GP-20.** "Previous wedding photos" are other clients' weddings. Every photo and video now carries a rights status and a consent record, and cannot be shown to clients or the public without one. **Decision Q9.**

> **COVERED.** Every price shows "Verified on" with the date and your team member, turns to "Stale" after a period you set, and is never described as confirmed.

**Step 5: The client may request additional hotel services.** The client may ask AMPM to help with:

- Checking hotel availability
- Negotiating prices
- Arranging site visits
- Reviewing contracts
- Assisting with hotel booking

These services should be treated according to the scope agreed with the client. Buying hotel-discovery access does not automatically mean the client has hired AMPM for complete wedding management.

> **GAP GP-5.** How a request for help turns into agreed, possibly paid, work is not described. We designed it so that an availability check is included in the subscription and the other four services wait for an agreement your team sends and the client accepts in the portal (U-3). **Decision Q4.**

> **COVERED.** The rule that discovery never implies full management is built in: a subscription grants only hotel modules; wedding modules come only from a service agreement and a project.

**Step 6: Create a wedding project if the client hires AMPM.** If the client hires AMPM for additional services or full wedding management, the team creates a wedding project. The project records the agreed services, fees, dates, responsibilities and requirements.

> **ASSUMED U-6.** The project is created when an agreement for anything beyond hotel help is accepted, and it links the client's saved hotels and enquiries automatically. Only a name, the account, tentative dates and a lead are required at creation. **Decision Q10.**

**Step 7: Different activities can happen together.** Wedding planning does not always follow one fixed sequence. For example, hotel discussions, wedding design, invitations, save-the-dates, vendor selection and RSVP planning may happen at the same time. The platform should allow these activities to progress in parallel.

> **COVERED.** Once a project exists, vendors, design, invitations, guests, rooms and budget are independent streams; none waits for another.

**Step 8: Present vendor options.** AMPM can present suitable vendors for services such as wedding decorators and designers; photographers and videographers; sound, lighting and production; artists and entertainment; food and menus; tents, props and special effects; other wedding-related services. Where suitable options are available, AMPM may present around 5–10 options based on the client's budget and expectations. The client should be able to review the options and proposals shared with them.

> **COVERED.** Five to ten is a guideline, not a rule: two options present cleanly and twelve are not blocked. Clients see the vendor's name, description and portfolio; vendor contacts, raw quotes and your internal ratings never reach them.

**Step 9: Manage and execute the wedding.** For clients who hire AMPM for full wedding management, the platform should support the agreed scope of work, including the overall wedding budget; wedding design and function planning; invitations and pre-wedding shoots; vendor coordination; photography, decoration, sound and lighting; artists, entertainment and special effects; menus and food arrangements; activity stalls and guest experiences; guest travel, accommodation and transport; hospitality and event schedules; wedding-day management and execution.

> **GAP GP-34.** Wedding-day execution happens on phones inside venues with poor signal, and no document mentions working offline. We designed the cue sheet, readiness checks and arrival lists to be readable offline, with updates queued until signal returns (T-11). **Decision Q1.**

> **GAP GP-30.** "Execution" needs to know who is on site and when. We added staff rosters per function.

**Step 10: Complete the project.** After the wedding, the team should be able to complete outstanding tasks, record final costs and documents, and close the project.

> **COVERED.** Closure is a checklist verified against the data: every guest departed, nothing left in lost and found, every vendor confirmed complete, final accounts approved by Finance.

> **ASSUMED A-23.** After closure the couple keeps read-only access for twelve months, then the wedding is archived. Nothing is deleted. **Decisions Q23 and Q24.**

### 4. Information the Platform Needs to Manage

The platform should keep connected records for the following:

**Clients and enquiries:** contact details, enquiry source, requirements and follow-up history.

**Hotels:** location, venue spaces, capacity, rooms, images, videos, contact information, quoted prices and verification dates.

> **GAP GP-8.** "Quoted prices and verification dates" is the sentence the specification's data model did not honour; see Step 4.

**Wedding projects:** client details, wedding dates, destination, estimated guests, agreed services, budget and project status.

**Wedding functions:** each event, such as mehendi, sangeet, ceremony or reception, with its own timing, venue, design and requirements.

> **AMBIGUITY AM-2.** A function's venue may be a hotel venue from your database or somewhere else entirely, and a wedding may use more than one hotel. The specification allowed one hotel per wedding; we allow several and venues outside the database (A-18). **Decision Q18.**

**Vendors:** service type, contact details, portfolio, quotations, availability, contracts and proposals shared with the client.

> **GAP GP-21.** Vendor availability is listed here but had no record; we added one with a verification date.

> **DECISION Q22.** Nothing says whether vendors or hotels ever log in. We assumed they do not in this project; a vendor portal can be added later without changing the vendor records (A-22).

**Budgets:** planned budget, quotations, approved amounts, payments and final costs, with appropriate access restrictions.

> **DECISION Q4.** "Appropriate access restrictions" depends on how AMPM earns. If you earn a margin on vendor prices, the client must never see your cost; if you charge a visible fee, they may. We designed for the margin case, which also works for the fee case (A-4).

**Guests and RSVP:** invitations, attendance, guest counts, family details, travel, accommodation and other information required for hospitality.

> **GAP GP-13.** Counting by family or by person was left open. We count by person, grouped into households, so that children, rooms and meals are counted correctly.

**Tasks and approvals:** task owner, deadline, status, related project and decisions awaiting approval.

**Documents:** proposals, designs, contracts, menus, schedules and records of important approvals.

The same information should not need to be entered repeatedly when it can be reused safely.

> **COVERED.** Saved hotels, enquiries and agreements made before a wedding project exists are attached to the project when it is created, so nothing is re-entered.

### 5. Important Rules for Development

1. **Different users need different access.** Clients must not see AMPM's internal notes, private negotiations, internal ratings, profit margins or confidential operational information.

> **COVERED.** Enforced server-side through visibility classes; a client request simply never receives those fields.

2. **Do not make every field compulsory from the beginning.** A client who only wants hotel information should not have to fill out all the details required for full wedding management.

> **COVERED.** The field matrix states, for every one of 1,068 fields, the stage at which it becomes required. A wedding project needs four fields to exist.

3. **Allow parallel workflows.** Hotel selection, design, invitations, vendors and RSVP should be able to progress together where appropriate.

> **COVERED.** See Step 7.

4. **Show clear statuses.** The team should be able to see what is pending, in progress, awaiting approval, confirmed or completed.

> **GAP GP-19.** Your specification lists statuses for ten kinds of record and none for twelve others (vendor proposals, invoices, payments, invitations, guest responses and more), and no document says who may move a record from one status to the next. Both are now defined.

5. **Track important changes.** Important budget changes, approvals, payment updates and contract changes should record who made the change and when.

> **COVERED.** A fixed list of audited actions, append-only, with before and after values.

6. **Verify changing information.** Hotel prices, availability and vendor availability can change. The system should make the verification status clear.

> **COVERED.** Verification dates per field group for hotels, a stale label after a period you set, and verified availability windows for vendors.

7. **Protect guest information.** Collect only information needed for the event. Identity documents should not be compulsory by default; if genuinely required, access should be restricted.

> **GAP GP-41.** Indian rules restrict storing Aadhaar numbers. We designed identity capture to be switched on per wedding only, to refuse Aadhaar, to keep files in a separate locked store seen only by named staff, and to delete them thirty days after checkout (A-8). **Decision Q8.**

8. **Do not invent business policies.** AMPM must confirm subscription prices, service fees, refund terms and payment rules before these are implemented.

> **COVERED.** No price, fee or term is in code. Every open policy is an assumption tagged with its question, listed for you in [the assumptions sheet](assumptions-taken.md).

9. **Keep the client view separate from the internal view.** The team should manage information internally and share only the appropriate client-facing information.

> **COVERED.** Every record that can be shared has a share action your team controls, and a "preview as client" that shows exactly what the client will see.

### 6. Main Screens Required

**Public website:** Home, About, Services, How It Works, selected work, Contact and Request a Demo.

**Client portal:** Dashboard, wedding overview, hotel options, functions, client-facing budget, vendor proposals, designs, approvals, documents and relevant guest information.

**AMPM team workspace:** Dashboard, enquiries, clients, weddings, hotels, vendors, functions, budgets, guests, RSVP, tasks, documents, approvals and reports.

**Guest RSVP portal:** Invitation details, attendance confirmation, guest details where needed, travel and accommodation information where requested, and a confirmation message.

The exact screen structure should be reviewed and approved by AMPM before development begins.

> **COVERED.** All of these appear in the wireframe specification, 124 screens in total, with a table mapping every item here to its screen. The redrawn flowcharts are the structure to approve.

### 7. Example of How the Platform Will Work

Suppose a client is planning a wedding for 250 guests in Jaipur. The client contacts AMPM, and the team records the enquiry. After the client purchases the appropriate access, they can explore hotel options. If the client requests hotel assistance, AMPM can help check availability and rates according to the agreed service. If the client hires AMPM to manage the wedding, the team creates a wedding project, records the functions and budget, presents vendor options, shares proposals for approval and manages the agreed work. The team sends RSVP links to guests and tracks attendance, travel, accommodation and transport requirements. During the wedding, staff use the platform to coordinate tasks, vendors and schedules. The client sees the information intended for them, while internal AMPM information remains private.

> **COVERED.** This example is the sample wedding used throughout the drafts and the test data: a Jaipur wedding with four functions and a 412-guest list, so every screen and test is checked against the case you described.

### 8. What the Developer Should Do First

Before writing code, please:

1. Read this document and the detailed AMPM Technical Specification.
2. Confirm your understanding of the complete business process.
3. Prepare simple wireframes showing the proposed screens.
4. Prepare a database structure showing how clients, weddings, functions, hotels, vendors, guests, budgets and tasks connect.
5. Prepare a permissions table showing what each user can view, add, edit or approve.
6. Recommend the technology, hosting, security, backups and maintenance approach.
7. Break the project into development phases and provide a cost estimate for each phase.
8. Present the proposed structure to AMPM for review and approval before development starts.

> **COVERED.** Items 1 to 6 and 8 are delivered: the audit, this annotated brief and the redrawn flows (item 2), the wireframes (3), the data model (4), the permission matrix (5), the architecture plan (6), and this review package (8). The phases are drafted; the cost estimate (7) is held until you answer Q1 and Q15, because the platform choice and the volumes change it more than anything else.

### 9. Decisions Still to Be Confirmed by AMPM

The following must not be assumed by the developer:

- Subscription price and duration
- What the subscription includes
- Cancellation and refund terms
- Fees for hotel research, negotiation, site visits and booking assistance
- Fees and payment stages for wedding management
- Features included in the first release versus later releases
- Final user roles and data-access rules

If any requirement is unclear, please ask AMPM before deciding how it should work.

Final instruction: This document explains the business in simple language. The detailed technical specification provides the more detailed development requirements.

> **DECISION.** Each line maps to a question: price and duration and inclusions to Q3, cancellation and refunds to Q3, hotel service fees to Q4, management fees and payment stages to Q4, first release to Q10, roles and access to Q5 and Q6. None has been assumed as policy; each has a placeholder assumption so that design could continue.

> **GAP GP-6 · GAP GP-7.** Payment stages for wedding management and refund handling had no records or rules. Payment milestones with due dates and a refund path through the gateway are designed, with the amounts and terms left to you. **Decisions Q3 and Q4.**

> **CONFLICT CF-7.** Your specification goes on to list eleven roles as if final, while this document says roles must not be assumed. We treat the eleven as your proposal and ask you to confirm them (Q6).

---

## Part 2 · Why AMPM App

AMPM is not a public wedding-planning app where anyone can sign up and access the hotel database. It is a paid, client-based wedding management platform. Your public website is for attracting potential clients, explaining the platform, demonstrating its value, and converting interested clients into paying customers. The most important distinction is that seeing AMPM, trying a limited demo, purchasing a subscription, and receiving full wedding-project access are four different stages.

> **COVERED.** The design has exactly these stages and a client account state for each.

### 1. The correct AMPM customer journey

**Stage 1 — Public AMPM website (open to everyone).** Visitors can learn about AMPM, explore its services, understand the benefits, view selected previews, and request a consultation or demo. They do not receive the private app or full hotel database access.

**Stage 2 — Demo or limited free trial (prospective client).** AMPM presents a demo video, guided demonstration, or a time-limited and restricted trial. The prospect can understand how the system works without receiving unrestricted access to real client projects or confidential data.

> **CONFLICT CF-1.** This note makes the demo a distinct environment; your specification mentions it only as one website screen and one test, and assigns it to no phase. We placed it in Phase 1 as a mode of the platform: Sales grants it, it expires, and it shows a curated set of hotels with prices hidden plus one sample wedding (U-1, A-28). **Decisions Q3 and Q10.**

**Stage 3 — Paid subscription (access is purchased).** Once the client is convinced, AMPM creates their account and grants access to the specific module or subscription package they have purchased. Access depends on their plan and permissions.

> **CONFLICT CF-5.** See Step 3 of Part 1: AMPM creates the account first, then the client pays in the portal (U-2). **Decision Q2.**

> **GAP GP-3.** "Module or subscription package" implies plans that list what they include. The specification had a plan reference with no plan record; we added plans with their included modules, editable by you without code.

**Stage 4 — Wedding project creation.** When the client decides to proceed with the wedding management service, AMPM creates the client's wedding project in the system, configures the relevant modules, and adds the wedding-specific information, team members, budget, venues, guests, vendors and other details.

> **ASSUMED U-6.** Created from an accepted service agreement; see Step 6 of Part 1.

**Stage 5 — Full authorised access.** The client and their authorised AMPM team members use the full set of modules included in the agreed service or plan. The platform retains access controls, confidential information, approvals and project-specific permissions. One important distinction for the developer: paying for an app subscription does not automatically mean that a client has purchased AMPM's complete wedding planning and execution service. Those can be separate commercial offerings, even if they work together.

> **COVERED.** A subscription and a service agreement are two separate records; access to wedding modules comes only from membership of a project.

### 2. How the developer should build AMPM

The system should have three distinct environments, not one public app with open registration.

| Environment | Who can access it? | What they can do |
|---|---|---|
| Public website | Anyone | Learn about AMPM, view marketing content, request a demo |
| Demo / trial environment | Approved prospects | Explore selected features with sample data or limited permissions |
| Private AMPM platform | Accounts authorised by AMPM | Access purchased modules, private hotel data and authorised wedding projects |

> **CONFLICT CF-9 · AMBIGUITY AM-8.** "Three distinct environments" could mean three separately hosted systems or three experiences of one system. Your specification asks for one shared backend. We built one platform where demo accounts and demo weddings are flagged and every query for a demo user is limited to flagged records (A-28). A separately hosted demo is possible at extra cost.

### 3. How the hotel discovery feature fits into this model

The hotel database is a private AMPM resource, not a public directory.

- Public visitors can see selected examples, screenshots or a preview of the hotel discovery feature.
- During a demo or trial, prospects can explore the feature using sample data or specifically limited access.
- After purchasing the relevant subscription, an authorised client can access the hotel discovery module according to their plan.
- AMPM can help the client shortlist hotels, compare costs and assess suitability for their wedding.
- Once the wedding project is formally created, hotel selections and relevant information can be connected to that specific wedding.

> **COVERED.** Saved hotels and compare are designed (GP-10 filled), and the last bullet is automated: creating the project attaches the account's saved hotels and enquiries (GP-27 filled).

### 4. The access-control rules

The developer should implement these rules from the beginning:

- No public self-registration for the private platform.
- AMPM administrators create or approve client accounts.
- Each account receives only the modules included in its subscription.
- A paid module subscription and a full wedding-management engagement are tracked separately.
- Full wedding-project access is activated only after the required commercial approval and onboarding.
- Each wedding is a separate project with its own budget, guests, vendors, documents, approvals and permissions.
- Demo data must remain separate from real client data.
- Subscription expiry, cancellation and upgrades must control access appropriately without accidentally deleting wedding records.

> **CONFLICT CF-5.** The first two rules appear nowhere in your specification. They are now written into the design as hard rules, with a test that no registration route exists.

> **GAP GP-1.** The last rule needed a definition of what each account state may see. We wrote one: an expired subscriber keeps the names of saved hotels and read access to existing enquiries, an engaged client keeps the wedding workspace whatever the subscription does, and nothing is ever deleted by an expiry.

AMPM as a private, subscription-based wedding management platform with a public marketing website and a controlled demo-to-client onboarding funnel. This protects your proprietary database and makes your software a paid business asset rather than a free public tool.

> **AMBIGUITY AM-14.** "A paid business asset" could hint at licensing the software to other planners one day. We built it for AMPM alone; if licensing is a real intention, one structural change is cheaper now than later (A-30).

---

## Part 3 · AMPM Developer Technical Specification, version 1.0, 20 October 2026

Functional scope, screen flows, data model, permissions, acceptance criteria. Private and confidential.

**Purpose:** provide one coherent starting specification for AMPM's connected wedding platform. Subscription prices, service fees, legal terms, integrations and final visual design remain decisions for AMPM.

> **COVERED.** We treated this as the authoritative requirements document, as your business brief instructs, and extended it rather than replacing it: every table name in its data model is kept.

> **DECISION.** The document carries no sign-off, and your business brief says roles and release scope must not be assumed. We therefore treat its roles (section 6), statuses (section 7) and phases (section 11) as proposals for you to confirm.

### 1. Product definition

AMPM is a connected wedding-planning and management platform covering the journey from enquiry and paid hotel discovery through optional hotel consultancy, complete wedding planning, guest management, on-site execution and final closure. It is not merely a public hotel or vendor directory.

#### 1.1 Four connected experiences

| Experience | Purpose | Access rule |
|---|---|---|
| Public website | Explain AMPM, showcase approved work, capture enquiries, explain demo/subscription. | Public pages only; no unrestricted private database access. |
| Client portal | Hotel discovery for subscribers; wedding workspace for engaged clients. | Access depends on subscription, service agreement and project permissions. |
| AMPM team workspace | Manage leads, hotels, projects, vendors, budgets, guests, approvals and execution. | Role-based and project-scoped access. |
| Guest RSVP portal | Collect invited guests' RSVP and relevant travel/accommodation information. | Wedding-specific access; no viewing other guests' private records. |

> **CONFLICT CF-1.** Four experiences here, three environments in your "Why" note, and the demo belongs to neither list. See Part 2, Stage 2.

> **GAP GP-1.** "Access depends on subscription, service agreement and project permissions" names three sources of access without saying how they combine. The permission matrix now has a table for every account state.

#### 1.2 Business journey

1. Lead arrives through website, Instagram, advertisement, referral, call or another source.
2. AMPM shares an introduction and demo. Demo access is controlled and limited.
3. Client purchases hotel-discovery subscription; access activates after payment confirmation.
4. Client explores Indian wedding destinations and curated hotels, saves favourites and requests information.
5. Client may separately request availability checks, price negotiation, site visits and booking assistance.
6. If the client engages AMPM for broader services, record scope, fees, agreement and payment status, then create a wedding project.
7. Hotel contracting, creative design, save-the-dates and RSVP can proceed in parallel where appropriate.
8. AMPM presents relevant vendor options, aiming for 5–10 per category where suitable options exist, and coordinates decisions.
9. The project connects budgets, functions, design, invitations, RSVP, menus, vendors, rooms, transport, production and hospitality.
10. AMPM tracks execution, departures, checkout, vendor closure and final accounts before closing the project.

Critical rule: hotel-discovery subscription does not automatically activate full wedding management. Clients may select only the services they want.

> **CONFLICT CF-4.** Your team-app flowchart shows none of steps 2 to 5; it starts at a qualified client. The redrawn team app adds the demo, subscription and hotel-assistance branch so that the critical rule is visible in the structure.

> **DECISION Q16.** "Indian wedding destinations" is the only place the market is named. We assumed rupees, English, and Indian time with the guest portal ready for a second language (A-16).

### 2. Screen map and user flows

#### 2.1 Public website

| Screen | Main content/actions | Outcome |
|---|---|---|
| Home | AMPM positioning, services, selected visuals and enquiry/demo CTA. | Enquiry/demo request. |
| How it works | Explain hotel discovery, optional consultancy and complete management separately. | Clear understanding of service stages. |
| Destinations / selected work | Approved public examples only; content managed by AMPM. | Build confidence without exposing private data. |
| Services | Hotel assistance, design, vendor coordination and full management. | Service enquiry. |
| Enquiry form | Name, contact, contact preference, tentative dates/destination, guest estimate, source/consent. | Lead record in CRM. |
| Demo / subscription | Demo access, plan inclusions, fee, term and AMPM-approved terms. | Controlled demo or payment journey. |

> **GAP GP-23.** "Content managed by AMPM" needs an editor; see Part 1, section 2A. **Decision Q12.**

> **CONFLICT CF-5.** "Payment journey" from the website against the no-self-registration rule; see Part 1, Step 3. The demo and subscription page explains plans and collects a request; payment happens after AMPM has created the account (W-15).

#### 2.2 Client portal: hotel discovery

1. Sign in/account activation.
2. Subscriber home: search destinations, recent searches, saved hotels and enquiry status.
3. Destination list and detail.
4. Hotel search/filter results.
5. Hotel detail: profile, images/videos, rooms, venues/capacity, facilities, wedding references and last-verified commercial information.
6. Compare hotels and save favourites.
7. Request hotel assistance with dates, guest estimate, room requirements and preferred contact method.
8. Track availability enquiry, negotiation, site visit, proposal and booking-assistance status.

> **GAP GP-8.** "Last-verified commercial information" had nowhere to be stored; see Part 1, Step 4.

> **GAP GP-10.** "Save favourites" had no record; one was added.

> **GAP GP-5.** Step 7 leads to paid services with no defined path to an agreement; see Part 1, Step 5.

#### 2.3 Client portal: engaged wedding client

1. Wedding dashboard: dates, destination/hotel, milestones, pending decisions, permitted budget summary and upcoming tasks.
2. Wedding overview and authorised family/decision-maker contacts.
3. Functions list and function workspaces.
4. Budget summary showing only approved client-facing fields.
5. Vendor options by category, portfolio, proposal and decision actions.
6. Design studio with concepts, moodboards, renders, comments, revisions and approvals.
7. Invitations/save-the-dates with version and distribution status.
8. RSVP progress and authorised guest views.
9. Menus and food-service approvals.
10. Shared documents, schedules, AMPM contacts and notifications.

> **DECISION Q4.** "Permitted budget summary" and "approved client-facing fields" are undefined until you decide which amounts clients see.

> **GAP GP-26.** "Authorised family/decision-maker contacts" implies several client users with different rights; see Part 1, section 2B. **Decision Q5.**

> **AMBIGUITY AM-12.** Invitations are design work (Phase 2) and distribution work (Phase 3). We put the design in Phase 2 and the sending in Phase 3.

> **GAP GP-32.** "Notifications" has no channels or preferences defined anywhere. We designed in-app, email, WhatsApp and SMS with per-person preferences and a WhatsApp opt-in (A-11). **Decision Q11.**

#### 2.4 AMPM team workspace

| Area | Core screens |
|---|---|
| Home | Team dashboard, upcoming weddings, overdue tasks, pending approvals and alerts. |
| Leads / Clients | Lead pipeline, follow-up history, account/subscription and service engagement. |
| Hotels | Destinations, hotel profiles, rooms, venues, media, verification, enquiries, visits and negotiations. |
| Weddings | Project dashboard, functions, budgets, vendors, designs, guest operations, documents and closure. |
| Guests | Guest database, RSVP calls, family groups, attendance, rooming, travel and support requests. |
| Vendors | Vendor master, category, portfolio, quotes, availability, contracts and project assignments. |
| Tasks / Operations | Tasks, staffing, run-of-show, production readiness, incidents and event-day status. |
| Finance / Reports | Permitted payment records, budget variance, invoices, reconciliation and exports. |
| Settings | Users, roles, permissions, packages, statuses, categories, notifications and audit logs. |

> **CONFLICT CF-3.** Nine areas here, five tabs in your flowchart with Hotels and Guests absent. The redrawn team app shows nine areas on desktop and your five tabs on phones (W-2).

> **COVERED.** Every area here maps to screens in the wireframe specification, 67 for the team workspace alone.

#### 2.5 Guest RSVP flow

1. Guest opens a wedding-specific link and sees the relevant invitation/context.
2. Guest confirms contact details and family group as needed.
3. Guest responds for themselves and authorised accompanying family members.
4. Guest confirms attendance for each invited function.
5. Guest provides relevant travel and accommodation information if requested.
6. Guest submits; system confirms submission and provides a contact route.
7. AMPM RSVP team reviews/follows up and records call-assisted responses in the same database.

Privacy: do not require Aadhaar/passport uploads for every guest by default. Collect identity documents only for a defined necessary use case, make collection conditional and restrict access.

> **AMBIGUITY AM-1.** "Wedding-specific link"; see Part 1, section 2D. **Decision Q7.**

> **COVERED.** The privacy rule is implemented exactly, and extended: Aadhaar is refused outright and files are deleted after checkout (A-8). **Decision Q8** confirms the use case.

### 3. Module inventory

| Module | Core records | Outcome |
|---|---|---|
| CRM/subscriptions | Lead, contact, account, subscription, payment, service agreement | Lead conversion and access control. |
| Hotel intelligence | Destination, hotel, room category, inventory snapshot, venue, media, verification | Curated discovery with freshness labels. |
| Hotel consultancy | Availability enquiry, response, negotiation, site visit, proposal, booking milestone | Traceable hotel assistance. |
| Wedding project | Project, client contacts, scope, team assignment | Single source of truth per wedding. |
| Budget/finance | Budget category/line, quote, contract, invoice, payment, cost entry | Estimate, approval, actuals and variance. |
| Functions | Function, schedule, checklist, venue, run-of-show | Function-level plans connected to wedding. |
| Creative/approvals | Design brief, version, comment, approval, change request | Versioned creative decisions. |
| Vendors | Vendor, category, portfolio, proposal, assignment, scope, contract | Curated vendor options and delivery tracking. |
| Invitations/RSVP | Invitation, recipient, guest, family group, response, attendance | Invitation-to-attendance workflow. |
| Rooms/logistics/hospitality | Room allocation, travel segment, transfer, vehicle, request/ticket | Guest movement and support. |
| Food/entertainment/production | Menu version, artist booking, technical rider, production item, readiness check | Function readiness. |
| Tasks/risk | Task, dependency, staff assignment, incident, resolution | Operational accountability. |
| Closure | Departure record, lost-and-found item, vendor completion, final account | Formal closeout. |
| Administration | User, role, permission, notification, audit event, configuration | Secure configurable operation. |

> **GAP GP-14.** "Change request" is named here and in your client-portal flowchart but has no record, statuses or rules anywhere. It is designed as a tracked request with a defined path from submitted to implemented, and an accepted change to an approved item produces a new version for a new approval (A-21). **Decision Q21.**

> **GAP GP-16.** Twenty-five of the records named in this table have no table in section 4's data model: plan, inventory snapshot, response, negotiation, site visit, booking milestone, budget category, quote, cost entry, schedule, checklist, design brief, comment, change request, vendor category, portfolio, invitation, recipient, family group, vehicle, request, artist booking, production item, readiness check, departure record, lost-and-found item, final account, notification and configuration. All are modelled now; the data model has 106 tables against this section's 35.

### 4. Suggested relational data model

Use a relational database for structured records and secure file/object storage for media. This is a logical model; the developer should finalise SQL types, indexes, constraints and migrations during technical design.

| Entity/table | Key fields | Relationships |
|---|---|---|
| users | id, name, email, phone, status | Roles and project assignments. |
| roles / permissions | role_id, permission_key, scope | Many-to-many user-role assignments. |
| leads | id, source, status, contact, requirements, owner_user_id | Can convert to client account. |
| client_accounts | id, primary_contact_id, status | Subscriptions, service agreements, projects. |
| subscriptions | id, account_id, plan_id, status, starts_at, ends_at | Controls hotel-discovery entitlement. |
| payments | id, account/project_id, purpose, amount, currency, status, provider_ref | Subscription/service/vendor payment record. |
| service_agreements | id, account_id, service_type, scope, fee, terms_version, status | Determines service access. |
| destinations | id, name, region, country, status | Has many hotels. |
| hotels | id, destination_id, profile, address, contact, status | Rooms, venues, media, verification history. |
| hotel_rooms / venues | id, hotel_id, category/type, capacity, facilities | May be proposed for a wedding. |
| hotel_verifications | id, hotel_id, field_group, verified_at, source, status | Freshness of price/facility information. |
| hotel_enquiries | id, account/project_id, hotel_id, dates, guest_count, status | Responses, visits, proposals, negotiation events. |
| wedding_projects | id, account_id, dates, destination_id, hotel_id, status | Parent for wedding records. |
| project_members | project_id, user_id, project_role, access_scope | Project-specific access. |
| functions | id, project_id, name, date/time, venue, guest_estimate, status | Budget, vendors, design, menu, schedule. |
| budget_lines | id, project_id, function_id, category_id, estimate, approved_amount, actual_amount | Links to quote/contract/invoice/payment. |
| vendors | id, name, category_id, contact, service_area, status | Portfolio, proposals and assignments. |
| vendor_assignments | id, project_id, function_id, vendor_id, scope, status | Links vendor to project/function. |
| vendor_proposals | id, assignment_id, version, client_visible_amount, internal_cost, status | Client and internal fields protected separately. |
| contracts / invoices | id, project_id, assignment_id, amount, due_date, status, document_ref | May link to payments. |
| design_items / versions | id, project_id, function_id, category, version, file_refs, status | Revision and approval history. |
| approvals | id, record_type/id, version_id, decision, user_id, timestamp | Decision tied to exact version. |
| guests | id, project_id, family_group_id, name, contact, restricted fields | One master guest record per wedding. |
| guest_function_attendance | guest_id, function_id, status, party_count | Attendance per function. |
| rsvp_responses | id, guest_id, channel, response, submitted_at, captured_by | Self-service or AMPM-assisted. |
| travel_segments / transfers | id, guest/group_id, mode, pickup, destination, time, status | Feeds transport planning. |
| room_allocations | id, project_id, guest/group_id, hotel_id, room_type, dates, status | Rooming/check-in/checkout. |
| menus / versions | id, function_id, version, status, submitted_by | Versioned menu and approval. |
| run_of_show_items | id, function_id, start/end, cue, owner, status, actual_times | Live execution timeline. |
| tasks / incidents | id, project_id, owner, due_at/severity, status, outcome | Accountability and response. |
| documents / media | id, owner_type/id, file_ref, visibility, version, uploader | Access follows owning record. |
| audit_events | id, actor_id, action, entity_type/id, timestamp, metadata | Important change history. |

Security note: internal cost, margin, private notes and identity-document references must be separately protected or guarded by strict server-side field permissions. Never send restricted data to a client and merely hide it in the interface.

> **GAP GP-8.** `hotels` and `hotel_rooms / venues` have no price field, though the brief requires quoted prices. Rate cards and rate items were added.

> **GAP GP-3.** `subscriptions.plan_id` points at a plan table that does not exist. Plans and their included modules were added.

> **GAP GP-12.** `wedding_projects.hotel_id` allows one hotel per wedding. Destination weddings often use a main hotel and overflow hotels, and functions may be at venues outside your database. Both are now possible (A-18). **Decision Q18.**

> **GAP GP-13.** `guest_function_attendance` is per guest but carries a `party_count`, and rooming and travel point at "guest/group". We made the person the unit and the household the grouping; see Part 1, section 4.

> **GAP GP-11.** Rooms are allocated with nothing to allocate them from. Room blocks (rooms held per hotel, category and dates) were added so allocations can be checked against what is actually held. **Decision Q19.**

> **GAP GP-17.** `payments` has no direction, so a client's payment and a payment to a vendor look alike, and `contracts / invoices` has one amount, which would show a vendor's invoice to a client. Payments now carry a direction and invoices a direction; vendor-side records are never client-visible.

> **GAP GP-18.** No tax fields. GST fields were added to invoices. **Decision Q16.**

> **AMBIGUITY AM-5.** `capacity` on a room category: number of rooms or people per room? Both are now separate fields.

> **GAP GP-20.** `documents / media` has a visibility flag but no record of rights. Every photo and video now has a rights status and consent reference.

> **COVERED.** The security note is the rule the whole permission design is built on: separate client and internal fields, enforced on the server, with tests that no restricted field ever appears in a client response.

### 5. Field specification pattern

For every field, maintain: field name, type, options/validation, who can edit, client/internal visibility, requiredness by stage, automation and report impact. Avoid making all fields mandatory at project creation.

| Field | Type/validation | Who edits | Visibility | Requiredness/automation |
|---|---|---|---|---|
| Wedding project name | Text; non-empty; unique ID generated separately | AMPM admin/project lead | Client + assigned team | Required on project creation. |
| Wedding date range | Dates; end not before start | AMPM; client may request changes | Client + assigned team | Tentative allowed early; updates milestone views. |
| Guest estimate | Non-negative integer; estimated/confirmed flag | AMPM/client per permission | Client + assigned team | Optional at lead stage; feeds planning. |
| Hotel verification date | Timestamp, verifier and source | Hotel team/admin | Freshness label may be client-facing | Required for verified price claims; flags stale records. |
| Vendor decision | Interested/shortlisted/selected/declined | Client and AMPM per workflow | Client + assigned team | Selection links vendor to project. |
| Approval decision | Approved/revision requested/rejected | Authorised approver | Client + relevant team | Approval locks exact version. |
| Identity document | Secure file reference; conditional accepted types | Guest/authorised staff | Restricted | Never universally required; audit access and retention. |

> **COVERED.** This pattern is applied to all 1,068 fields in the field matrix, generated from the data model so the two cannot drift. These seven rows appear in it with the same values.

### 6. User roles and permissions

| Role | Permitted scope |
|---|---|
| AMPM Super Admin | System configuration, users, master data and permissions. |
| Sales / Relationship Manager | Leads, demos, accounts, subscriptions and service engagement. |
| Hotel / Destination Team | Hotel database, availability, site visits, proposals and booking assistance. |
| Wedding Project Manager | Assigned wedding, functions, budgets, tasks and coordination. |
| Creative / Design Team | Assigned design work, references, revisions and approvals. |
| Vendor Coordinator | Vendor profiles, proposals, contracts, assignments and deliverables. |
| RSVP / Guest Team | Authorised guest details, RSVP calls, attendance, travel and rooming. |
| Hospitality / Logistics Team | Assigned guest support, transport, rooming and schedules. |
| Finance / Accounts | Authorised budgets, invoices, payments and reconciliation. |
| Client / Family Decision-Maker | Own project's approved information, proposals and decisions. |
| Guest | Own RSVP response and authorised submission fields only. |

> **CONFLICT CF-7.** Presented as final here; "must not be assumed" in your brief. Treated as your proposal (P-1). **Decision Q6.**

> **GAP GP-26.** One client role cannot express a couple, a paying parent and a viewing relative. Three client roles were designed (A-5). **Decision Q5.**

#### 6.1 Client vs internal visibility

Client-facing: hotel profiles, approved proposals, relevant vendor details, designs, menus, invitations, approved budget views, shared documents and authorised project progress.

Internal-only by default: confidential negotiations, internal cost/margins, candid vendor ratings, staff notes, internal risk assessments, draft proposals and other clients' data.

Backend APIs and file storage must enforce access; hiding frontend controls is not sufficient.

> **COVERED.** Implemented as ten visibility classes, each with named readers and writers, and a rule that a client-facing response is built from a separate model that simply does not contain internal fields.

### 7. Statuses and workflow rules

| Object | Suggested statuses | Rule |
|---|---|---|
| Lead | New, contacted, introduction shared, demo offered/accessed, follow-up, converted, closed | Record owner and timestamp. |
| Subscription | Pending payment, active, expiring, expired, suspended, cancelled | Entitlements follow confirmed payment/status. |
| Hotel enquiry | Draft, submitted, awaiting hotel, response received, negotiating, visit scheduled, proposal received, client decision, confirmed, closed | Enquiry is not a confirmed booking. |
| Wedding project | Setup, planning, approvals, pre-production, ready, live execution, closure, closed, on hold | Project status does not replace task/function statuses. |
| Approval | Draft, submitted, revision requested, approved, rejected, superseded | Tie to exact version. |
| Task | Not started, in progress, blocked, completed, cancelled | Overdue tasks can trigger reminders. |
| Room allocation | Requested, proposed, confirmed, checked in, checked out, cancelled | Keep change history. |
| Function readiness | Not started, in progress, blocked, ready, live, completed | Required checklist or documented authorised exception. |
| Incident | Open, assigned, in progress, escalated, resolved, closed | Critical incident needs resolution record. |
| Wedding closure | Open items, departure, vendor reconciliation, final accounts, closure review, closed | Use configured closure checklist. |

> **GAP GP-2.** Subscription has no "trial" status though your "Why" note requires a trial. Added.

> **GAP GP-19.** Twelve other kinds of record change state with no statuses listed: vendor assignment, vendor proposal, design version, menu version, invitation, guest response, payment, invoice, contract, service agreement, travel, guest request. All are defined now, and for every status change the permission matrix says who may make it.

> **AMBIGUITY AM-3.** "Function readiness" and a function's own status (planned, confirmed, cancelled) are two different things; both are kept, and readiness is calculated from the checklist (A-26).

### 8. Notifications and automation

- Payment confirmation activates only the purchased entitlement.
- Stale hotel pricing/availability is flagged after configurable verification age.
- Approval requests notify authorised decision-makers and assigned staff.
- Material changes flag affected budgets, contracts, tasks and run-of-show items.
- RSVP changes recalculate attendance and flag relevant menu/room/transport impacts.
- Room or transfer changes notify authorised logistics/hospitality staff.
- Overdue tasks, unpaid milestones, unconfirmed vendors and incomplete readiness checks appear on dashboards.
- Critical incident alerts follow configurable escalation rules.
- Log notifications with recipient, channel, timestamp and delivery status where available.

> **AMBIGUITY AM-4.** "Material changes" has no definition. We assumed a budget line moving by ten percent or more, or a date or venue change, with the thresholds as settings (A-25). **Decision Q25.**

> **COVERED.** Each rule here is a job or an event handler in the architecture, and each has a test.

> **DECISION Q11.** Which channels carry these notifications is not stated; see Part 1, section 2.3.

### 9. Reports and exports

- Lead source and conversion funnel; subscription status and payment history.
- Hotel shortlist, enquiries, site visits and booking milestones.
- Wedding progress, upcoming deadlines and approval tracker.
- Budget estimate, approved commitments, payments, actual cost and variance.
- Vendor selection, contracts, deliverables and payment status.
- RSVP progress, function attendance, rooming and arrival/departure manifests.
- Function schedules, run-of-show and production readiness.
- Overdue tasks, incidents, final reconciliation and closure report.

Exports must respect permissions. Sensitive guest, identity, medical, commercial and finance data must not be included by default.

> **COVERED.** Every report is listed with who may run and export it; exports strip sensitive, identity and bank data always and internal cost unless the exporter is Finance.

> **GAP GP-24.** "Medical" data is mentioned here and nowhere else; the guest flow had no place to collect meal needs. See Part 1, section 2D.

### 10. Technical and non-functional requirements

- Responsive desktop, tablet and mobile interface.
- Shared backend with separate user experiences and permission boundaries.
- Secure authentication; role-based and project-scoped access.
- Server-side validation and authorisation for every protected request.
- Encryption in transit and appropriate encryption at rest.
- Private file storage with authorised/expiring links where appropriate.
- Audit trail for approvals, financial changes, permissions and important edits.
- Backups and tested restoration process.
- Search, filters, pagination and bulk operations for large guest/vendor lists.
- Media optimisation and controlled video delivery.
- Configurable packages, categories, statuses and pricing; avoid hard-coded commercial rules.
- Clear errors, duplicate-submission prevention and safe form recovery.
- Data retention/deletion rules and privacy notice approved by AMPM.
- Documented integration boundaries for payment, email, messaging and external hotel systems.

> **GAP GP-33 · DECISION Q1.** "Responsive interface" against "app" in your flowcharts and briefs; see Part 1, section 1.

> **GAP GP-34.** No mention of working without signal on the wedding day; see Part 1, Step 9.

> **GAP GP-31 · DECISION Q13.** "Secure authentication" is not specified: how clients sign in, whether staff need a second factor, how passwords are reset. We defined all three (A-13).

> **GAP GP-22.** "Bulk operations" but no import. Your existing hotel data and each family's guest list arrive as spreadsheets; import tools were added for both.

> **DECISION Q14.** Backups and restoration need targets: how much data may be lost and how long recovery may take. We assumed fifteen minutes and four hours, with copies in a second Indian region (T-13).

> **GAP GP-39.** "External hotel systems" is not defined anywhere. We assumed none in the first release and documented the boundary as manual.

> **GAP GP-44 · DECISION Q17.** Retention and deletion rules are left to AMPM; we proposed periods so that the design could include the deletion jobs (A-17).

> **GAP GP-40.** The Digital Personal Data Protection Act applies to every guest, who has no contract with you. Consent capture, retention and a breach procedure are designed in.

### 11. Recommended implementation phases

| Phase | Scope | Exit criteria |
|---|---|---|
| 1. Foundation | Website/CRM, accounts/subscriptions, hotel database, search, shortlist and hotel enquiry. | Lead-to-subscriber journey tested; private data protected. |
| 2. Wedding planning | Project, functions, budgets, vendors, design versions, approvals, contracts and client dashboard. | A sample wedding can be planned and approved end to end. |
| 3. Guest operations | RSVP, guest database, attendance, rooming, transport, menus and hospitality. | Guest data flows into operational reports. |
| 4. Live execution | Run-of-show, readiness, artist management, staffing, incidents, departure and final accounts. | Simulated event can be managed through closure. |
| 5. Stabilisation | Security, performance, backups, accessibility, reports and user acceptance tests. | Critical defects resolved; launch checklist signed. |

> **CONFLICT CF-1.** The demo and trial belong to no phase. Placed in Phase 1 (A-10).

> **DECISION Q10.** Whether Phase 1 includes the full hotel-assistance workflow, online payment and website editing. We assumed all three.

> **COVERED.** Each phase now has a named pack of tests that must pass before it can close.

### 12. Acceptance test scenarios

1. Public enquiry saves source and owner; team tracks follow-up.
2. Subscription activates hotel discovery without exposing full wedding modules.
3. Demo account cannot access records outside demo scope.
4. Hotel search shows freshness of pricing; unverified availability is not shown as confirmed.
5. AMPM records negotiation and site visit without exposing internal notes.
6. Engaged client receives correct project and permissions.
7. Multiple functions have independent vendors, schedules, budgets and approvals.
8. Vendor shortlist permits fewer than five options when fewer are suitable; it does not require exactly ten.
9. Approval refers to exact design/menu/proposal version; revisions do not overwrite it.
10. Self-service and AMPM-assisted RSVP update the same guest database without duplicates.
11. Attendance changes update totals and flag downstream planning impacts.
12. Unauthorised users cannot access restricted data by changing URLs, API requests or file links.
13. Production readiness cannot be completed without required checks or an authorised exception.
14. Incidents can be assigned, escalated and closed with resolution notes.
15. Closure checks departure, lost-and-found, vendor completion and financial reconciliation.

> **COVERED.** All fifteen are acceptance criteria with between five and ten tests each, 208 tests in total, and twenty-one further criteria were derived from section 10.

### 13. Decisions AMPM must confirm before implementation

| Decision | Confirmation required |
|---|---|
| Commercial plans | Subscription fee, term, renewal, expiry and final cancellation/refund wording. |
| Service catalogue | Standalone services, package inclusions, fees and access rules. |
| Approvals | Who approves for the couple/family; whether multiple approvals are required. |
| Financial visibility | Which amounts clients see: vendor quote, negotiated quote, AMPM fee, tax and payment details. |
| Hotel data governance | Who enters/verifies data, verification cadence and media publication rights. |
| Guest communications | Selected email, SMS and messaging integrations. |
| Identity documents | Use cases, authorised access, retention and deletion. |
| Languages/currency | Initial language/currency and international expansion timing. |
| Technology ownership | Hosting, source-code ownership, maintenance and support responsibility. |
| Launch scope | Which phases are in the initial budget versus later releases. |

> **DECISION.** These ten map to Q3, Q4, Q5, Q4, Q9, Q11, Q8, Q16, Q14 and Q10. The audit found eight more that this list misses and that block design just as much: the delivery platform (Q1), the payment path (Q2), the final roles (Q6), guest identification in the RSVP portal (Q7), sign-in method (Q13), website editing (Q12), hosting location (Q14) and offline use on the wedding day (Q1).

### 14. Deliverables expected from the development team

- Screen-by-screen wireframes for website, client portal, AMPM workspace and guest RSVP portal.
- User-flow diagrams for subscription, hotel assistance, wedding engagement, RSVP and execution.
- Approved database ER diagram and schema/migration documentation.
- Module-wise field matrix: type, options, requiredness, editor, visibility, validation and automation.
- Role/permission matrix, including financial and guest-data restrictions.
- Technical architecture and integration plan.
- Milestone schedule, cost estimate and exclusions.
- Test cases mapped to acceptance criteria.
- Deployment, backup, maintenance and handover documentation.

> **COVERED.** Delivered as drafts: wireframes, user flows, data model, field matrix, permission matrix, architecture and integration plan, test cases. Held: the milestone schedule and cost estimate (until Q1 and Q15 are answered). Part of the build: deployment, backup and handover documentation.

### 15. Final product instruction

Build AMPM as one connected wedding-management platform. Keep hotel discovery, optional hotel consultancy and complete wedding management as distinct but connected service stages. Once a full wedding project is active, connect creative planning, budgets, vendors, RSVP, accommodation, transport, hospitality and on-ground execution to the same project record. Do not create one giant mandatory form: capture information when relevant, reuse records, allow parallel work and keep client views simple while giving AMPM staff detailed operational controls.

Before full implementation begins, review and sign off the user flows, role/permission matrix, field matrix, wireframes and database schema.

> **COVERED.** This instruction is the shape of the design. The sign-off it asks for is what this review package is for.

---

## Part 4 · AMPM Team App — Level 1 visual flowchart

Your flowchart, read box by box. The diagram itself and the redrawn version are in [the redesigned flowcharts](redesigned-flowcharts.md).

**Five main navigation tabs:** HOME (dashboard, schedule, alerts) · CLIENTS (leads, profiles, follow-ups) · WEDDINGS (master workspace, planning) · TASKS (assignments, deadlines) · MORE (finance, vendors, documents, reports, admin).

**Flow:** Start → Open AMPM Team App, sign in / permissions → Home dashboard (overview, alerts, upcoming work) → Choose a main tab → HOME (dashboard; today, calendar; alerts, activity) · CLIENTS (enquiry / lead; consultation; questionnaire) · WEDDINGS (wedding master; functions and plans; guest / hospitality) · TASKS (assign owner; deadline and checklist; track completion) · MORE (finance, vendors; documents, reports; database, settings) → Qualified client → create wedding record (unique wedding ID + approved service scope) → Wedding planning and coordination (functions, venue, design, vendors, guests, budget) → Live wedding operations (production, show flow, readiness, incidents) → Post-wedding closure (final invoices, reconciliation, feedback, archive) → End.

**Side notes:** Connected throughout (tasks and alerts; approvals and documents; budget and reporting) · Access control (role-based permissions; internal vs client data; activity history).

> **CONFLICT CF-4.** The path starts at a qualified client. Everything before it, the demo, the subscription and the hotel work that most clients will buy, is missing. The redrawn version branches after Clients.

> **CONFLICT CF-3.** Hotels and Guests, two of the nine areas in your specification, have no tab. "Database" under More may be the hotel database; we read it that way (AM-6).

> **CONFLICT CF-8.** "Consultation" and "Questionnaire" appear only here. We made them activity types that your team logs on a lead, with the questionnaire a structured form you can edit (W-12).

> **GAP GP-29.** "Feedback" and "archive" at closure appear only here and had no records. A feedback form and an archived state were added (A-24).

> **GAP GP-28.** "Schedule" and "calendar" on the Home tab appear only here. A calendar of functions, visits, deadlines and shifts is designed, with a feed your staff can add to their own calendars.

> **COVERED.** The side notes are met: tasks, approvals, documents and budget are connected to every wedding, and access control is role-based with internal and client data separated and a full activity history.

> **DECISION Q1.** "App" with a tab bar is a phone-app pattern. The redrawn version keeps your five tabs on phones and uses the nine areas on desktop (W-2); whether it is a native app or a website is yours to decide.

---

## Part 5 · AMPM Client Portal — Level 1 visual flowchart

**Navigation:** HOME (countdown, updates) · MY WEDDING (profile, functions) · APPROVALS (decisions, changes) · MORE (budget, documents, support).

**Flow:** Start → Open client portal, sign in securely → Access verified? No: contact AMPM for access help; Yes: HOME (countdown, upcoming functions, updates) → MY WEDDING (couple / family profile; functions and schedule; venue, design, guest info) · APPROVALS (proposals and selections; budget / design approvals; change requests) · MORE: BUDGET (client-facing budget; invoices and payment status) · MORE: DOCUMENTS AND SUPPORT (contracts, shared files; messages, questions; AMPM support) → Client action (view, submit details, review, approve, ask a question) → Approval required? Yes: submit decision / change request; No → AMPM team reviews request (approve, respond, request clarification) → Updated wedding information (approved changes reflected in client portal).

**Side notes:** Client access rules (only own wedding; visible, approved information) · Connected to AMPM (approvals, documents, updates, support).

> **CONFLICT CF-2.** No hotel area, though hotel discovery is the Phase 1 product and the subscription. The redrawn portal adds a Hotels tab and a different home page for a subscriber who has no wedding yet.

> **AMBIGUITY.** "Countdown" assumes a wedding date; a hotel-discovery subscriber has none. The countdown now appears only when dates exist (W-12).

> **GAP GP-15.** "Messages, questions" describes a chat feature no other document mentions. We designed typed, tracked requests with a conversation under each, which your team answers, rather than live chat (A-20). **Decision Q20.**

> **CONFLICT CF-6.** "Invoices and payment status" commits to showing money that your specification leaves undecided. Shown only to client users with the finance flag, and only invoices issued to the client (W-5). **Decision Q4.**

> **COVERED.** "Contact AMPM for access help" is a screen; the approve-or-request loop at the bottom is the portal's behaviour; "only own wedding" and "visible, approved information" are enforced server-side.

---

## Where the findings are counted

| Kind | In the audit | Placed in this document |
|---|---|---|
| Conflicts (CF) | 9 | CF-1, CF-2, CF-3, CF-4, CF-5, CF-6, CF-7, CF-8, CF-9 |
| Gaps (GP) | 44 | 38 placed; the 6 that are purely technical (sizing, performance targets, security hardening, delivery pipeline, GST compliance detail, hosting location) are in the architecture plan |
| Ambiguities (AM) | 15 | AM-1, AM-2, AM-3, AM-4, AM-5, AM-6, AM-8, AM-12, AM-14; the other six are modelling detail answered in the data model |
| Decisions (Q) | 25 | all 25 placed here and listed with choices in [the open decisions document](open-decisions.md) |

The developer package behind this review (audit, data model, permission matrix, field matrix, architecture, user flows, wireframes and test cases) is in the same shared page, after the review documents.
