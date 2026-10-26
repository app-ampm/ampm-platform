# AMPM Platform — The Build Plan, Short Version

**For:** the development team, and AMPM for information · **Date:** 26 October 2026 · **Status:** version 0.2, the execution plan; decisions are locked by the developer. The [full plan](build-plan.md) carries the method, the sprint themes, the rates and the sources; this version carries what to decide.

One developer builds the whole platform with Claude Code, in one critical path, to one launch (R17). Everything below is sized for that; the levers at the end change it.

---

## 1. The phases

| Phase | What it delivers | Exit gate | Weeks at 40 h a week |
|---|---|---|---|
| 0 Bootstrap | Standards enforced; accounts opened; monorepo, tokens, UI kit, API skeleton | Skeleton green | 5 |
| 1 Foundation | Enquiry to demo to ₹50,000 subscription to hotel discovery; team app for leads, hotels, enquiries; chat; infrastructure | Lead to subscriber accepted on staging | 44 |
| 2 Wedding planning | Projects, budget, vendors, designs, menus, approvals, requests, tasks, invitations | A sample wedding planned and approved | 20 |
| 3 Guest operations | Guest lists, RSVP by link, rooms, travel, menus, identity documents | Guest data flows into operations | 13 |
| 4 Live execution | Run-of-show, readiness, incidents, offline on the day, closure, archiving | A real wedding run as the pilot | 14 |
| 5 Stabilisation | Hardening, penetration test, restore drill, accessibility, performance, store releases | Launch checklist signed | 6 |
| | | **Launch** | **about 105 with store review** |

At 30 hours a week multiply by 1.33 (about 32 months); at 20 hours by 2 (about 48 months).

## 2. How we build

Two-week sprints with a demo; a gate at every phase where AMPM's team runs that phase's acceptance scenarios on staging and the developer closes the gate. Every feature follows the same path: brief → Claude searches what exists and plans → go → contract-first build with tests beside the code → lint and typecheck hooks → the developer runs and reviews → pre-merge review against the rules → merge to staging. Rules are files the tooling enforces; a new pattern gets a decision record first; synthetic data everywhere but production; no deployment while a wedding is live. AMPM's testers from phase 1 through internal app builds; the apps reach the stores in phase 5.

## 3. Effort

| Case | Developer-days | What it assumes |
|---|---|---|
| Low | about 400 | Rates a fifth better than likely; 20 % buffer |
| **Likely** | **about 510** | Table 0.6 day; client screen 1 day; team screen 1.1; flow 2 days; offline 20; infrastructure 12; bootstrap 20; acceptance support 10 %; 25 % buffer |
| High | about 700 | Rates a third worse; 35 % buffer |

By phase (likely, with buffer and the cross-cutting share): bootstrap 25 · foundation 220 · wedding planning 102 · guest operations 65 · live execution 66 · stabilisation 29. Half of all effort is the 126 screens on phone, tablet and web; a quarter is the 108 tables and their API.

## 4. Cost

| Line | Amount |
|---|---|
| Development | Developer-days × the agreed day rate (K20). Illustration at ₹10,000 a day: ₹40 lakh low, ₹51 lakh likely, ₹70 lakh high |
| One-off | About ₹2.5 to 5.5 lakh: penetration test ₹2 to 5 lakh, Apple ₹8,300 a year, Google ₹2,100, DLT ₹5,900 plus GST, domain |
| Running, per month, before gateway fees | ₹10,000 to 30,000 on the locked platform: everything on AMPM's Hostinger KVM 4 (₹1,100 to 2,400) plus Mumbai buckets for backups and identity documents, the WhatsApp provider, SMS, email, video, maps, builds and error tracking |
| Gateway | 2 % plus GST on each ₹50,000 subscription: ₹1,180 each |
| Maintenance after launch | Priced with the service levels (R16, K22) |

## 5. What AMPM does, and when (weeks at 40 h)

| By week | Item |
|---|---|
| 0 to 2 | Cloud or Supabase organisation, Razorpay onboarding, Meta business verification, DLT registration, Apple and Google accounts, domain; hosting variant approved (R13) |
| 8 | Hotel import format; ten sample hotels |
| 20 | The full hotel database, verified by Eva |
| 30 | Website copy and selected work with permissions |
| Before each screen sprint | Visual design approvals |
| 49, 69, 82, 95 | One-week acceptance windows with one or two testers per department |
| 69 | The pilot wedding named |
| 75 | Privacy notices and terms approved |
| 98 | Penetration tester engaged; maintenance arrangement signed |

## 6. Decisions by when they are needed

| Before | Decisions |
|---|---|
| Sprint 0 | Developer: hours (K1), pace (K3), stack skills (K4), infrastructure to run (K10), commercial form (K20), account ownership (K21) |
| Sprint 0 | Locked: K1 40 hours a week, K20 time and materials, no levers, code in this repository, R13 (Hostinger KVM 4 in Mumbai), identity service (Cognito), R10. Open: R15 messaging account ownership |
| Sprint 3 | R10 staff sign-in: locked, password plus authenticator app |
| Sprints 8 to 10 | R8 hotel service fees; R9 roles and cost visibility |
| Sprint 25 | R5 countersigned; R6 approvals; R7 amounts the client sees; R18 material changes |
| Sprint 35 | R11 RSVP links; R12 retention and privacy wording |
| Sprint 42 | R19 archiving |
| Sprint 48 | R16 service levels and support |

## 7. Levers that shorten the calendar

| Lever | Effect |
|---|---|
| Discovery live after phase 1 (reopens R17) | First revenue at about month 11 instead of 24 |
| Web-first client portals, native client app at launch | 15 to 20 days off phase 1 |
| Tablet layouts after launch | About 15 days |
| Hosted chat service first | About 5 days |
| A managed database beside the VPS (G1) | Removes database operations for about US$40 to 120 a month |
| A second developer for phases 1 and 2 | Up to 40 % off those phases |
| More hours a week | Linear |

## 8. Risks to watch

Fewer developer hours than planned · offline sync harder than estimated · provider onboarding stalls · hotel data late · store review rejections · the single developer unavailable · scope growth through change requests · acceptance testing not staffed · learning curve on the stack · a late security finding. Each has a mitigation in the full plan.

## 9. Locking the plan

| Item | Decision |
|---|---|
| Capacity (K1) | Locked: 40 hours a week as the planning baseline |
| Commercial form (K20) | Locked: time and materials |
| Data platform (R13) | Locked: G2, everything on the dedicated VPS, a Hostinger KVM 4 (4 vCPU, 16 GB, 200 GB NVMe); India datacentre confirmed at purchase; access by sprint 2 |
| Identity service | Locked: Amazon Cognito in Mumbai |
| Levers chosen | None; the plan runs as drafted |
| Plan | Locked as drafted on 26 October 2026 |

Locked by the developer on 26 October 2026.

> **Your decision:** Sprint 1 starts from part 11 of the full plan on the day you choose; the milestone weeks count from that day.
