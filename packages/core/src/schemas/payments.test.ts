import { describe, expect, it } from "vitest";

import { manualPaymentRequest, paymentClientView } from "./payments.js";

const ID = "018f0000-0000-7000-8000-000000000000";

describe("paymentClientView (AC-12.3)", () => {
  const base = {
    id: ID,
    amount: { minor: 5_000_000, currency: "INR" },
    purpose: "subscription",
    method: "gateway",
    status: "succeeded",
    paidAt: null,
    createdAt: "2026-11-01T00:00:00.000Z",
  };

  it("accepts a receipt carrying only client-safe fields", () => {
    expect(paymentClientView.safeParse(base).success).toBe(true);
  });

  it("rejects any finance-internal field, so none can be serialised to a client", () => {
    expect(paymentClientView.safeParse({ ...base, direction: "inbound" }).success).toBe(false);
    expect(paymentClientView.safeParse({ ...base, provider: "razorpay" }).success).toBe(false);
    expect(paymentClientView.safeParse({ ...base, providerRef: "pay_x" }).success).toBe(false);
    expect(paymentClientView.safeParse({ ...base, recordedBy: ID }).success).toBe(false);
  });
});

describe("manualPaymentRequest", () => {
  it("defaults the method to a bank transfer and requires a reference", () => {
    const parsed = manualPaymentRequest.safeParse({ reference: "NEFT-12345" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.method).toBe("bank_transfer");
    expect(manualPaymentRequest.safeParse({}).success).toBe(false);
  });
});
