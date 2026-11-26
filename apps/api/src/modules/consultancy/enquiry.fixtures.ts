import type { EnquiryRow } from "./enquiries.repository.js";

/**
 * A submitted hotel enquiry row for the consultancy service specs (shared so the row shape — budget and
 * all — lives in one place, not copied per spec). Override any field through `over`; the budget is null by
 * default (the client left it blank), so set `budgetAmountMin`/`budgetAmountMax` to exercise it.
 */
export function makeEnquiryRow(over: Partial<EnquiryRow> = {}): EnquiryRow {
  return {
    id: "enq-1",
    accountId: "acc-1",
    projectId: null,
    hotelId: "hot-1",
    requestedByUserId: "usr-1",
    assignedUserId: null,
    serviceAgreementId: null,
    status: "submitted",
    dateFrom: new Date("2027-02-14"),
    dateTo: new Date("2027-02-16"),
    datesFlexible: false,
    guestEstimate: 120,
    roomsRequired: 40,
    budgetAmountMin: null,
    budgetAmountMax: null,
    budgetCurrency: "INR",
    functionsSummary: null,
    contactPreference: null,
    notesClient: null,
    notesInternal: null,
    submittedAt: new Date(),
    closedAt: null,
    outcome: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}
