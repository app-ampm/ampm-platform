import { subscriptionReportRow } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { Prisma } from "../../../generated/prisma/client.js";
import type { SubscriptionReportDbRow } from "./subscription-report.repository.js";
import { toSubscriptionReportRow } from "./subscription-report.view.js";

function row(overrides: Partial<SubscriptionReportDbRow> = {}): SubscriptionReportDbRow {
  return {
    id: "0192f3a0-7d3e-7b1a-9c2f-000000000001",
    accountId: "0192f3a0-7d3e-7b1a-9c2f-000000000002",
    accountName: "The Sharmas",
    planId: "0192f3a0-7d3e-7b1a-9c2f-000000000003",
    planName: "Hotel Discovery",
    priceAmount: new Prisma.Decimal("25000.00"),
    status: "pending_payment",
    startsAt: null,
    endsAt: null,
    createdAt: new Date("2026-11-15T09:00:00.000Z"),
    lastPayment: {
      method: "gateway",
      status: "initiated",
      paidAt: null,
      createdAt: new Date("2026-11-15T09:01:00.000Z"),
    },
    ...overrides,
  };
}

describe("toSubscriptionReportRow (D-127)", () => {
  it("serialises the plan's price in paise, the dates as ISO, and passes the strict contract", () => {
    const view = toSubscriptionReportRow(row());
    expect(view.subscriptionId).toBe("0192f3a0-7d3e-7b1a-9c2f-000000000001");
    // 25,000.00 rupees → 2,500,000 paise (the client-amount brand rides along, so compare the parts).
    expect(view.amount.minor).toBe(2_500_000);
    expect(view.amount.currency).toBe("INR");
    expect(view.createdAt).toBe("2026-11-15T09:00:00.000Z");
    expect(view.lastPayment).toEqual({
      method: "gateway",
      status: "initiated",
      paidAt: null,
      createdAt: "2026-11-15T09:01:00.000Z",
    });
    expect(subscriptionReportRow.safeParse(view).success).toBe(true);
  });

  it("keeps an active subscription's term and paid transfer, and a never-paid one's null", () => {
    const active = toSubscriptionReportRow(
      row({
        status: "active",
        startsAt: new Date("2026-11-15T10:00:00.000Z"),
        endsAt: new Date("2027-11-15T10:00:00.000Z"),
        lastPayment: {
          method: "bank_transfer",
          status: "succeeded",
          paidAt: new Date("2026-11-15T10:00:00.000Z"),
          createdAt: new Date("2026-11-15T10:00:00.000Z"),
        },
      }),
    );
    expect(active.startsAt).toBe("2026-11-15T10:00:00.000Z");
    expect(active.endsAt).toBe("2027-11-15T10:00:00.000Z");
    expect(active.lastPayment?.paidAt).toBe("2026-11-15T10:00:00.000Z");
    expect(toSubscriptionReportRow(row({ lastPayment: null })).lastPayment).toBeNull();
  });
});
