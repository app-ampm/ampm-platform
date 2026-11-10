import { describe, expect, it } from "vitest";

import { Prisma } from "../../../generated/prisma/client.js";
import type { PaymentRow } from "./payments.repository.js";
import { toPaymentFinanceView } from "./payments.view.js";

function row(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: "0192f3a0-7d3e-7b1a-9c2f-000000000001",
    accountId: "0192f3a0-7d3e-7b1a-9c2f-000000000002",
    direction: "inbound",
    purpose: "subscription",
    amount: new Prisma.Decimal("25000.00"),
    currency: "INR",
    method: "bank_transfer",
    status: "succeeded",
    provider: null,
    providerRef: "UTR-1",
    relatedType: "subscription",
    relatedId: "0192f3a0-7d3e-7b1a-9c2f-000000000003",
    paidAt: new Date("2026-11-08T10:00:00.000Z"),
    recordedBy: "0192f3a0-7d3e-7b1a-9c2f-000000000004",
    createdAt: new Date("2026-11-08T09:00:00.000Z"),
    ...overrides,
  };
}

describe("toPaymentFinanceView", () => {
  it("serialises the finance view with money in integer paise and ISO dates", () => {
    const view = toPaymentFinanceView(row());
    // 25,000.00 rupees → 2,500,000 paise, no floating point (data.md money path).
    expect(view.amount.minor).toBe(2_500_000);
    expect(view.amount.currency).toBe("INR");
    expect(view.paidAt).toBe("2026-11-08T10:00:00.000Z");
    expect(view.createdAt).toBe("2026-11-08T09:00:00.000Z");
    expect(view.direction).toBe("inbound");
    expect(view.providerRef).toBe("UTR-1");
    expect(view.recordedBy).toBe("0192f3a0-7d3e-7b1a-9c2f-000000000004");
  });

  it("passes nullable finance fields through unchanged", () => {
    const view = toPaymentFinanceView(
      row({ paidAt: null, provider: null, providerRef: null, recordedBy: null }),
    );
    expect(view.paidAt).toBeNull();
    expect(view.provider).toBeNull();
    expect(view.providerRef).toBeNull();
    expect(view.recordedBy).toBeNull();
  });
});
