# AMPM Platform — The Questions Still Open, Short Version

**For:** AMPM review · **Date:** 26 October 2026 · **Status:** open. One line per question. The full version explains each one, with what your documents say and the choices.

Nineteen questions remain after your answers of 25 October. Nine need a decision from you; for the other ten a tick is enough if you agree with our proposal. Tick a box, write on the line, or reply by number (R1 to R19).

> **CONFLICT.** Two points to look at first. Your compiled answers say the two family representatives share one login, while your brief says separate accounts are preferable: see R5. Your brief says the demo shows "up to two" hotels per location, and its closing note mentions one: see R1.

## Decide: nine questions

- **R1 · The demo.** How long does it last, how many hotels per location, real hotels or invented ones? Our proposal: 7 days, three locations, two hotels each, real hotels with indicative prices.  
  ✔ Answered 26 October 2026: no time limit · three locations · one real hotel per location with indicative prices · managed by the admin
- **R3 · Refunds.** What is the rule if a client wants the ₹50,000 back? Proposal: no refund once the subscription is activated; full refund if AMPM cancels before activation.  
  ✔ Answered 26 October 2026: no refund is offered
- **R4 · Web as well as apps.** Should clients also use hotel discovery and the wedding portal in a browser on a laptop? Proposal: yes, built from the same code as the client app; the team app stays native only. This is the largest open cost item.  
  ✔ Answered 26 October 2026: yes, apps plus web for clients; clients verified by email and mobile; both apps on phones and tablets
- **R5 · Representative logins.** One shared login or one account each? Proposal: one account per representative, same rights on the same wedding, so every approval carries a name.  
  ✔ Working decision 26 October 2026: two accounts, the brief's stated preference · countersign ☐
- **R6 · Approvals.** Does one representative's approval complete a decision, or must both approve? Proposal: one, with a setting to require both for budgets and contracts later.  
  ☐ one approval (proposal) · ☐ both for budgets and contracts · ☐ both for everything
- **R7 · Money the client sees.** Proposal: planned and approved amounts per function, invoices issued to the client and their payment status; actual spend stays internal. Never vendor quotes, costs or margins.  
  ☐ agree · ☐ approved amounts only · ☐ also actual spend and variance
- **R8 · Hotel services with a fee.** Availability checks are included in the subscription. Proposal: negotiation, site visits, contract review and booking assistance need a recorded service agreement first.  
  ☐ agree · ☐ all included in the subscription · ☐ fee only on: ______
- **R11 · RSVP links.** Proposal: a link per side as the standard, a combined link as an option per wedding, both in the first release; private links per household where you have every household's contact.  
  ☐ agree · ☐ per side only · ☐ combined only · ☐ per household only
- **R17 · Launch.** Everything on one go-live, or hotel discovery first? Proposal: hotel discovery goes live at the end of the first build phase; the wedding modules follow together. The schedule and the cost estimate wait for this answer.  
  ✔ Answered 26 October 2026: everything goes live at once

## Tick if you agree: ten proposals

- **R2 · Payment gateway.** Razorpay, unless you already have a merchant account elsewhere.  
  ✔ Answered 26 October 2026: Razorpay
- **R9 · Staff roles and costs.** The nine roles from your specification. Hotel costs visible to Super Admin, Finance, the Hotel Team, and the Project Manager for their own weddings; vendor costs to Super Admin, Finance, the Vendor Coordinator, and the Project Manager for their own weddings; nobody else.  
  ☐ agree · ☐ changes: ______
- **R10 · Staff sign-in.** Password plus a code from an authenticator app, which works without signal inside a venue.  
  ✔ Answered 26 October 2026: password plus authenticator app; identity service Cognito
- **R12 · Retention and privacy wording.** Leads 24 months after closing; guest records 12 months after the wedding closes; identity documents 30 days after checkout; nothing is deleted until a Super Admin approves the list; privacy wording drafted by us for your approval.  
  ☐ agree · ☐ periods: ______ · wording approved by ______
- **R13 · Hosting.** Amazon Web Services in Mumbai with copies in Hyderabad, all data in India; at most 15 minutes of data lost and the platform back within 4 hours; accounts and source code in AMPM's name.  
  ✔ Answered 26 October 2026: everything on AMPM's dedicated VPS, a Hostinger KVM 4 in Mumbai; pgBackRest archives to a Mumbai bucket; media and identity documents in Mumbai buckets
- **R14 · Capacity.** 200 hotels and 20 weddings at a time, as you said. Please add the missing two.  
  staff now ______ · in two years ______ · largest wedding ______ guests
- **R15 · Messaging providers.** The developer selects the WhatsApp and SMS providers; AMPM owns the accounts and starts the WhatsApp and SMS registrations in the first week, since they take two to six weeks.  
  ☐ agree · ☐ use: ______ · WhatsApp account owner at AMPM ______
- **R16 · Service levels and support.** 99.5 percent monthly availability, on-call cover from the developer on wedding days, no deployments while a wedding is live.  
  ☐ agree · ☐ office hours only · ☐ higher target
- **R18 · Material changes.** A change is material at 10 percent on a budget line or 5 percent of the total budget, and on any date or venue change; the Project Manager approves it, and senior management too above 15 percent of the total.  
  ☐ agree · ☐ thresholds: ______ · ☐ approval rule: ______
- **R19 · Archiving.** A reminder before the three months end; the Project Manager proposes archiving and the Super Admin approves; afterwards the client sees only a contact route; reopening on request is read-only for 30 days.  
  ☐ agree · ☐ changes: ______

## Small defaults

- Accounting export for your accountant: ☐ CSV · ☐ Tally · ☐ Zoho Books · ☐ other ______
- Website analytics and a bot check on the forms: ☐ fine · ☐ no analytics
- Who at AMPM signs each phase's acceptance: ______
- Emergency reading of identity documents by the Super Admin, audited: ☐ allowed · ☐ two people · ☐ never
- RSVP reminders, then a call from the RSVP team; no guest edits after the deadline: ☐ fine · ☐ change: ______
- Readiness checklists hidden from the client: ☐ fine · ☐ show a summary
- Programme and calendar files to guests once invitations go out: ☐ fine · ☐ wedding week only
- One subscription per client account, covering that client's weddings: ☐ fine · ☐ one per wedding

Name ______________________ · Date ______________

> **Your decision:** when this sheet comes back, the answers are recorded next to your 25 October answers and the drafts move to version 0.3.
