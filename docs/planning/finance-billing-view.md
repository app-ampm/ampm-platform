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

### Slice 2. App: the Finance & Reports area (M)

- **Nav:** a `finance` staff area, "Finance & Reports" at `/finance`, gated on the report key. It goes after Tasks and before Settings (the W-2 order), and Finance's home moves there from `/enquiries`.
- **Screen, composed in T11's frame:**
  - **Header:** `ScreenHeader variant="panel"` with the eyebrow "Finance & Reports" and the title "Subscriptions and payments". Its gold **Record payment** acts on the selected subscription awaiting payment, and appears only when `canRecordSubscriptionPayment` is true. Export is slice 4.
  - **Left (`1fr`):**
    - A subscriptions `DataTable` with columns Account, Plan, Status chip, Starts, Ends and Amount.
    - Above it, an underline `SegmentedControl`: Awaiting payment · Active · All.
    - On desktop the first awaiting row is pre-selected (`selectedKey`).
  - **Right (`320px`):** "Recent payments" from the ledger, showing account, amount, method, date and status chip, with the bank-transfer footnote. It is shown only to roles with `crm.payments.read` (FA and SA). Following W-5, it is left out, not greyed out.
  - **Phones:** the table stacks (`stackBelow`), the payments panel follows below it, and tapping an awaiting row opens the sheet.
  - **States:** loading, empty ("Nothing awaiting payment"), error and offline, all from the shared components.
- **Reuse:** `RecordPaymentSheet` (it already takes a `subscriptionId`) and the ledger row from `account-payments.tsx`. Both features will use them, so they move to a shared billing module in the app, not stay inside `features/accounts`.
- **Tests:**
  - Area visibility per role.
  - Finance records from the area.
  - Sales sees no Record button and no ledger.
  - Phone and desktop renders.
  - The selection survives a resize.

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

1. **Sales sees the area.** It follows the matrix (Sales may run this report) and W-2. Sales gets the subscriptions table only, with no ledger, no Record button and no Export. Recorded in D-127.
2. **Export is in the first cut**, as slice 3, before shipping. Recorded in D-128.

D-127 also records route A: Finance reads subscriptions through the §5.16 report. D-128 records that Phase 1 composes T11's frame with subscriptions and the ledger.

## Not in this plan

- TW-81 Invoices and TW-82 Milestones (Phase 2).
- T11's budget table and margins (Phase 2 and later, in an `InternalPanel`).
- Outbound payments, refunds and gateway reconciliation (TW-80's other regions).
