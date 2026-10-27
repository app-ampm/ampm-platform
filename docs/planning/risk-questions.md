# AMPM Platform — Risk Questions for the Developer, Before Planning

**For:** the developer (the user), not AMPM · **Date:** 26 October 2026 · **Status:** the plan was drafted on 26 October with these locked the same day: K1 40 hours a week as the planning baseline; K20 time and materials; K10 everything on the dedicated VPS (Hostinger KVM 4 in Mumbai, see `docs/engineering/vps-setup.md`); the identity service Cognito; code in this repository. The rest remain open and are answered as their sprints approach.

The nineteen open questions (R1 to R19) are the founder's and can be answered phase by phase. These twenty-two are yours. Each answer changes the shape, length or risk of the plan, and the plan is only honest if it is built on them. The delivery model they test is the one recorded on 26 October: one developer building the whole platform with Claude Code, no other developers, designers or testers on the developer side (decision D-012).

Answer on the lines, or reply by number (K1 to K22). "Why it matters" says what the drafts assume today; "What it changes" says what moves in the plan.

---

## A · Your time

**K1 · Hours and months.** How many hours a week can you give AMPM, for how many months, and which other projects compete for the same hours?
Why it matters: the drafts' five phases were written for a small team working full time; one person's pace is the single biggest driver of the schedule.
What it changes: the calendar length of every phase, and whether discovery-first (R17) is the only realistic first go-live.
> Hours a week ______ · for ______ months · other commitments ______

**K2 · A date the founder expects.** Is there a date by which AMPM expects something live: the wedding season, a client already waiting for hotel discovery, a launch promised to anyone? Is it hard or soft?
Why it matters: nothing in AMPM's documents names a date; the schedule must either meet one or say what can be live by it.
What it changes: which scope goes into the first go-live and whether anything is cut or deferred.
> Date ______ · hard ☐ soft ☐ · what must be live by then ______

**K3 · Your pace with Claude.** Have you shipped a production system this way before, and how much of your time goes to reviewing and testing generated code rather than writing it?
Why it matters: the estimate has to assume a throughput; with Claude writing most code, review and testing dominate the developer's hours.
What it changes: the developer-days per screen, table and flow used in the estimate.
> Shipped before ☐ yes ☐ no · review share ______ percent

## B · Your skills on the chosen stack

**K4 · What you have shipped to production.** Tick each: TypeScript on Node ☐ · NestJS ☐ · Next.js ☐ · React Native with Expo, including iOS and Android builds and store review ☐ · PostgreSQL with Prisma ☐ · Redis and BullMQ ☐ · WebSockets ☐ · AWS with ECS Fargate, RDS, S3 and Terraform ☐
Why it matters: the architecture chose this stack for a small team; every unticked box is learning time or an argument for a simpler choice.
What it changes: learning weeks in phase 1, and which choices in K7 to K10 to simplify.
> Unticked boxes you would rather replace: ______

**K5 · Offline sync.** The team app must work without signal on the wedding day, queue updates, synchronise on reconnection, detect conflicts and resolve them (locked by AMPM, T-11). Have you built offline sync before? Would you use a library for it or write the queue yourself?
Why it matters: this is the hardest technical piece in the project and it sits in phase 4, late, where a problem has no slack.
What it changes: whether a sync library is chosen in phase 1 and a thin offline proof-of-concept is built early.
> Built before ☐ yes ☐ no · library ☐ hand-written ☐ · early proof-of-concept ☐ yes

**K6 · Apple and Google.** Do you have a Mac with Xcode for iOS builds, and will AMPM open Apple Developer and Google Play accounts in its own name now? Have you been through app review?
Why it matters: two native apps are locked (Q1); each store release waits on review, and the accounts take days to open and need AMPM's company documents.
What it changes: when the first internal test builds can go out, and a one-to-two-week review allowance before each release.
> Mac and Xcode ☐ · accounts opened by ______ · reviewed before ☐ yes ☐ no

## C · The scope you will argue for

**K7 · Web-first for the client, or two native apps first.** Given one developer, would you propose to the founder that the client portals are built first as a browser version from the shared React Native code, with the native client app following, while the team app stays native from the start?
Why it matters: this is the developer's side of R4; it halves the app-store work in phases 1 and 2 and lets the demo run without an install.
What it changes: phase 1 and 2 effort, the first go-live, and the wording of the R4 proposal to the founder.
> Propose web-first for clients ☐ yes ☐ no · reason ______

**K8 · Live chat.** Build it on WebSockets as drafted, or use a hosted chat service for the first release and build later?
Why it matters: chat is locked (Q20) but the build is not; a hosted widget is days of work and a monthly fee, the drafted build is weeks.
What it changes: phase 1 effort and a running cost line.
> Build ☐ hosted service ☐

**K9 · Video.** Hotel walkthroughs and wedding films through a streaming provider with signed playback as drafted, or plain uploads with no streaming in the first release?
Why it matters: the provider is a few days of integration and a cost per minute; plain uploads are cheaper and limit what hotel pages can show.
What it changes: phase 1 effort and the running cost; what Eva can upload.
> Streaming provider ☐ plain uploads first ☐

**K10 · Infrastructure you will run.** ECS Fargate with Terraform as drafted, or a managed application platform for one developer at this scale, moving to the drafted design later?
Why it matters: the drafted infrastructure is right for a team with an operator; for one person it is days of setup and a standing operations load. The proposal to the founder (R13) can still be "an Indian region, AMPM's own account".
What it changes: phase 1 setup time, the operations load in K18, and the running-cost line.
> As drafted ☐ managed platform first ☐ which ______

**K11 · The minimum first release.** If your pace demands it, which locked items would you ask the founder to phase later, and what is the smallest first release you would stand behind?
Why it matters: AMPM's first release lists everything from the demo to offline wedding-day operations; one developer may need to propose an order of go-lives rather than one.
What it changes: the scenario the schedule plans first, and a conversation with the founder before the plan, not after.
> Items to phase later ______ · minimum first release ______

## D · Who does the rest

**K12 · Visual design.** Who produces the visual design of the 126 screens: you with a design system generated with Claude, a designer AMPM pays, or AMPM itself? Your specification says the final visual design remains AMPM's decision.
Why it matters: the wireframes are structure, not design; someone has to make the screens look like AMPM.
What it changes: a design track before each phase's screens, its cost, and who approves it.
> ______

**K13 · Hotel data.** Who loads the hotel database (about 200 hotels with photographs, menus, rate cards and verification dates, maintained by Eva), in what format, and when can a sample of ten hotels be ready?
Why it matters: phase 1 cannot be tested or demonstrated without real hotel content, and the import format decides the import tool.
What it changes: a data task on AMPM's side in the plan, with a date, and the shape of the spreadsheet import.
> Who ______ · format ______ · ten-hotel sample by ______

**K14 · Acceptance testing.** Who at AMPM tests each phase on staging, how much time can they give, and how much of your time will supporting them take?
Why it matters: AMPM's twenty acceptance scenarios must pass before approval, and each phase exit assumes AMPM accepts on staging; with one developer, support time competes with build time.
What it changes: an acceptance window per phase in the schedule and a support allowance in the estimate.
> Testers ______ · hours a week ______ · support allowance ______

**K15 · Security testing.** A penetration test before launch is proposed. Is there a budget for an external tester, or will security review be done with Claude and automated scanning only?
Why it matters: the platform holds guest identity documents and payment flows; an outside test is the usual expectation and costs money.
What it changes: a cost line and a phase 5 dependency.
> External test ☐ budget ______ · internal review only ☐

**K16 · Legal wording.** Who drafts and approves the privacy notices, terms, consent texts and refund wording (R3, R12): AMPM's lawyer, AMPM itself, or you with Claude for AMPM's approval?
Why it matters: the drafts assume the developer drafts and AMPM approves; the Digital Personal Data Protection Act 2023 is cited in the design.
What it changes: a review step before phase 3 and before launch, and who owns the risk.
> ______

## E · Operations after launch

**K17 · On-call on wedding days.** The architecture proposes on-call cover from the developer while a wedding is live and no deployments during it. Can one person commit to that, and what is the fallback when you are unavailable?
Why it matters: this is the operational promise behind R16; for one person it has to be true or replaced by something else (manual procedures for AMPM staff, a second contact, a hosted platform's support).
What it changes: the service levels proposed to the founder and the maintenance contract.
> Can commit ☐ yes ☐ with limits ______ · fallback ______

**K18 · Running the system.** Monitoring alerts, backups and restore drills, key rotation, patching: will you run operations, or should AMPM contract a managed service for them?
Why it matters: the drafted operations assume someone on the team watches dashboards and rehearses restores quarterly.
What it changes: your weekly hours after launch and a cost line, and the K10 choice.
> You ☐ managed service ☐ mix ______

**K19 · If you are unavailable.** If you are ill or away for two weeks during a live wedding month, what happens? What handover material and ownership arrangements will exist (AMPM owns the source, R13; runbooks; a second developer on standby)?
Why it matters: one developer is one point of failure; AMPM's specification lists "maintenance and support responsibility" among the decisions to confirm.
What it changes: handover deliverables in every phase, and a standby arrangement in the contract.
> ______

## F · Money and the contract

**K20 · The commercial arrangement.** Fixed price per phase, time and materials, or a retainer? Milestone payments to you? What does AMPM expect to spend on development and on running costs? The infrastructure alone is in the region of USD 450 to 900 a month before WhatsApp, SMS, gateway and video fees.
Why it matters: the estimate's form follows the arrangement; a fixed price needs the scope locked first, which is what the blueprint is for.
What it changes: the format of the cost estimate and how change requests are priced.
> Arrangement ______ · AMPM's budget expectation ______

**K21 · Provider accounts.** Who pays for and owns the cloud, payment gateway, WhatsApp business, SMS registration, Apple, Google, video and monitoring accounts? Your specification says AMPM owns the technology; registrations need AMPM's company documents and take weeks.
Why it matters: the plan's first week is account opening; if the owner is unclear, phase 1 waits.
What it changes: a checklist for AMPM with dates before phase 1, and who holds the credentials.
> Owner ______ · payer ______ · who holds credentials ______

**K22 · Maintenance after launch.** A paid maintenance contract with defined hours and response times, or ad hoc support?
Why it matters: R16's service levels and K17's on-call are only real if someone is paid to provide them.
What it changes: the service levels proposed to the founder and a line in the estimate.
> Contract ☐ hours ______ response ______ · ad hoc ☐

---

## What happens with the answers

The answers are recorded next to the delivery model (D-012), and the milestone schedule and cost estimate are drafted on them and on the founder's defaults, with a decision calendar that says by which phase each R question must be answered. Where an answer changes a proposal already made to the founder (R4, R13, R16), the questions document is updated before it is sent.
