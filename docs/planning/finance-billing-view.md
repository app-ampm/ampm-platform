# Finance billing view: plan

Planned 15 November 2026, after D-125 went live (#134, `29ced4d`). The user agreed the plan the same day: route A, Sales sees the area, and export is in the first cut (D-127, D-128).

## Why this is needed

Since D-125, the API accepts a manual subscription payment from Finance. But Finance cannot get to it in the app. A probe of the live box as Farah Finance (FA) returns 404 for `/crm/leads`, `/crm/accounts` and `/crm/subscriptions`. Client accounts sit inside the Sales area, which is gated by `crm.leads.read`, so Finance's menu shows only Hotel enquiries and Settings. The Record payment button is on a page Finance cannot open.

## What the design package already says

- **TW-80 Payments ledger** (wireframes, Phase 1). Finance and the Super Admin edit it. Its regions are the ledger, Record manual payment, Refund and Reconciliation.
- **TW-14 Subscription detail.** Finance records the manual payment ("FA: amount, method, reference, evidence; activates").
- **T11 Finance artboard** (`Peacock Night 4 - Admin Workspace`). It shows one wedding's "Budget and accounts":
  - a panel header with an eyebrow, the title, **Export** and a gold **Record payment**;
  - a `1fr` category table (planned, approved, paid, our cost, margin) beside a `320px` **Client milestones** list of names, amounts and status chips;
  - a bank-transfer footnote;
  - the rail entry **Finance & Reports**.

  Its data (budget lines, milestones, internal cost) arrives in Phase 2. The design guide's screen table lists T11 among the T7–T13 artboards still to compose.
- **W-2.** A rail entry appears when the user's roles grant any permission in that area. On phones, Finance sits under More.
- **Permission matrix §5.16.** "Subscription status and payment history" may be run by SA, SM and FA, and exported by SA and FA. The generated keys are `reports.subscription_status_payment_history.read` and `.export`.

## The read Finance lacks, and the route that fits the matrix

Finance's grants on `crm.subscriptions` ("RU status") and on `crm.accounts` ("RU billing") are field-conditioned. Every CRM read route asks for the plain key, so Finance is refused. There are two ways in:

- **A. The §5.16 report (recommended).** Finance may run it outright, so the matrix needs no new reading. One report row carries what Finance needs to recognise a payment: the account's name, the plan, the amount and the status.
- **B. A field-aware read of `/crm/subscriptions`.** It would need a Finance response model, and a ruling on what "RU status" lets Finance *read*. That is a matrix interpretation for AMPM, and one that would also be applied to "RU billing".

The ledger (`GET /crm/payments`, FA and SA) already exists, and the account page's payments panel uses it. Its rows carry only `accountId`, and Finance cannot read accounts, so the Finance ledger view gains the account's name. This is an additive contract change.

## Slices

One stream of work. Each slice ends with `pnpm check` green.

### Slice 1. API: the subscription report and named ledger rows (S–M)

- **Contract (`packages/core`):**
  - `subscriptionReportQuery`: `status?` and `cursor?`.
  - `subscriptionReportRow`, a strict model: subscription id, account id and name, plan name, the plan's amount and currency, status, starts, ends, created, and the last payment (method, status, paid at) or null.
  - The row never carries contacts, billing details (RESTRICTED-BANK), internal notes or the demo flag.
  - `paymentFinanceView` gains `accountName`.
- **API:**
  - `GET /crm/reports/subscriptions` with `@RequirePermission("reports.subscription_status_payment_history.read")`, following the lead-funnel report's pattern.
  - A run is not audited: every field is client-class, so it is no restricted read, and the audit log has no plain-read action. The export (slice 3) is audited.
  - The repository leaves out demo accounts and deleted rows, and pages by cursor.
  - With `status=pending_payment`, the oldest subscription comes first.
- **Client:** `useSubscriptionReport(query)` in `packages/api-client`.
- **Tests:**
  - Unit tests.
  - An e2e test:
    - SA, SM and FA get 200 with exactly the row's fields;
    - HT and PM are refused (403 or 404 per `refusalFor`);
    - a demo account's subscription is absent;
    - ledger rows carry the name.

### Slice 2. App: the Finance & Reports area (M), built 15 November 2026

As built; where it departs from the first draft of this plan, the reason is given.

- **Nav:** a `finance` staff area, "Finance & Reports" (phone tab "Finance") at `/finance`, gated on the report key and placed after the Hotel catalogue, before the Admin console (the W-2 order). A staff member's home is now the first of their areas in a home order that puts Finance & Reports before the hotel enquiries Finance may also read, so Finance lands on `/finance`; every other role keeps its home.
- **Screen, composed in T11's frame:**
  - **Header:** T11's header is plain, not a panel: the eyebrow "Finance & Reports", the title "Subscriptions and payments", and at the right a gold **Record payment** acting on the subscription picked in the queue. It shows on the Awaiting payment tab to whoever `canRecordSubscriptionPayment` allows, which is Super Admin, Sales and Finance (D-125). The first draft said Sales would get no Record button; that was wrong, since Sales records payments on the account page already, and the button follows the same rule as the server. Export is slice 3.
  - **Left (`1fr`):** the report as a `DataTable` in a glass card under underline tabs, Awaiting payment · Active · All. Each tab has its own columns: the queue shows Account (with the plan under it), Last payment, Waiting since and Amount; Active shows Started and Ends; All shows the status. On the queue the oldest row is picked by default and a row press picks another (`selectedKey`); the other tabs have nothing to record against, so their rows do not press.
  - **Right (`320px`, from 1024):** "Recent payments" from the ledger: each line names the account beside a pill (the day it was paid, or "Initiated"), with the amount and method beneath, then the bank-transfer footnote. Gateway attempts that never completed are listed too, so it is "Recent" rather than "Received". The amounts are finance figures, so they sit in an `InternalPanel` as on the account page (T11's milestones panel holds client amounts and has none). Shown only to roles with `crm.payments.read` (Finance, Super Admin), left out for Sales (W-5).
  - **The record sheet** now names whose payment it records ("Nisha & Arjun · Hotel Discovery · ₹50,000"), since the area lists many accounts' subscriptions.
  - **768:** the rail collapses, the table fits the card without scrolling sideways, and the payments panel stacks below it. **Phones:** the rows stack, led by the account; Record payment wraps under the title and acts on the picked row (one action, the same at every width).
  - **States:** loading, empty per tab ("Nothing awaiting payment"), error and the refused role, from the shared components.
- **Reuse:** `RecordPaymentSheet`, `useCanRecordPayment` and the payment formatters stay in `features/accounts` and are imported from there, as the portal imports consultancy's `RequestRow`; no shared billing module was needed.
- **Tests:** area visibility and home per role; Finance's queue with the oldest picked and its payments; recording against a picked row, named in the sheet, after which the queue and the panel refresh (this fails without the new cache refreshes in `useRecordPayment`); Sales sees the report without the ledger and can record; the Active tab; the empty queue; the hotel team refused without a request; the phone's stacked rows, and the pick kept across 1024; the formatters.

### Slice 3. Export (S–M)

- `GET /crm/reports/subscriptions/export` under `.export` (SA, FA).
- It goes through the same guard and serialiser.
- It is audited with its filters and row count (`.claude/rules/security.md`).
- The Export action appears in the header for those roles only; Sales does not see it.

### Slice 4. Ship (S)

- A PR with the trailer `Monday: crm progress Finance & Reports area (TW-80, T11 frame)`.
- A full API-first redeploy, then the web export from merged main.
- Verify live in the browser, signed in as Farah Finance: the area shows, a subscription awaiting payment can be recorded, the ledger shows the payment, and the export downloads.

## Decisions (settled 15 November 2026)

1. **Sales sees the area.** It follows the matrix (Sales may run this report) and W-2. Sales gets the subscriptions table without the ledger or Export; Record payment shows for Sales as it does on the account page (D-125; the first draft wrongly said it would not). Recorded in D-127.
2. **Export is in the first cut**, as slice 3, before shipping. Recorded in D-128.

D-127 also records route A: Finance reads subscriptions through the §5.16 report. D-128 records that Phase 1 composes T11's frame with subscriptions and the ledger.

## Not in this plan

- TW-81 Invoices and TW-82 Milestones (Phase 2).
- T11's budget table and margins (Phase 2 and later, in an `InternalPanel`).
- Outbound payments, refunds and gateway reconciliation (TW-80's other regions).
