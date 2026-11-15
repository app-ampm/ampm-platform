import { describe, expect, it } from "vitest";

import { subscriptionReportQuery, subscriptionReportRow } from "./subscription-report.js";

const ID = "018f0000-0000-7000-8000-000000000000";

const row = {
  subscriptionId: ID,
  accountId: ID,
  accountName: "The Sharmas",
  planId: ID,
  planName: "Hotel Discovery",
  amount: { minor: 2_500_000, currency: "INR" },
  status: "pending_payment",
  startsAt: null,
  endsAt: null,
  createdAt: "2026-11-15T09:00:00.000Z",
  lastPayment: {
    method: "gateway",
    status: "initiated",
    paidAt: null,
    createdAt: "2026-11-15T09:00:00.000Z",
  },
};

describe("subscriptionReportRow (D-127)", () => {
  it("accepts a subscription awaiting payment with its last gateway attempt", () => {
    expect(subscriptionReportRow.safeParse(row).success).toBe(true);
    expect(subscriptionReportRow.safeParse({ ...row, lastPayment: null }).success).toBe(true);
  });

  it("is strict: a billing detail or an internal note never rides along to Sales", () => {
    expect(subscriptionReportRow.safeParse({ ...row, gstin: "29ABCDE1234F1Z5" }).success).toBe(
      false,
    );
    expect(subscriptionReportRow.safeParse({ ...row, internalNotes: "slow payer" }).success).toBe(
      false,
    );
    const payment = { ...row.lastPayment, providerRef: "pay_123" };
    expect(subscriptionReportRow.safeParse({ ...row, lastPayment: payment }).success).toBe(false);
  });
});

describe("subscriptionReportQuery", () => {
  it("takes a status and coerces the page size", () => {
    const parsed = subscriptionReportQuery.parse({ status: "pending_payment", limit: "20" });
    expect(parsed).toEqual({ status: "pending_payment", limit: 20 });
  });

  it("rejects an unknown status and a cursor that is not a UUID", () => {
    expect(subscriptionReportQuery.safeParse({ status: "unpaid" }).success).toBe(false);
    expect(subscriptionReportQuery.safeParse({ cursor: "abc" }).success).toBe(false);
  });
});
