import { describe, expect, it } from "vitest";

import {
  bookingMilestoneClientView,
  bookingMilestoneCreateRequest,
  bookingMilestoneStaffView,
  bookingMilestoneTransitionRequest,
  bookingMilestoneUpdateRequest,
} from "./booking-milestones.js";

const money = (minor: number) => ({ minor, currency: "INR" as const });

const validClientBase = {
  id: "00000000-0000-7000-8000-000000000001",
  enquiryId: "00000000-0000-7000-8000-000000000002",
  milestoneType: "advance_paid",
  status: "pending",
  dueAt: "2027-01-31T00:00:00.000Z",
  completedAt: null,
  createdAt: "2026-11-05T00:00:00.000Z",
  updatedAt: "2026-11-05T00:00:00.000Z",
};

describe("bookingMilestoneClientView — amount gated by W-14 (absent, never a hide-flag)", () => {
  it("accepts a client view with the amount absent (W-14 default hidden)", () => {
    expect(bookingMilestoneClientView.safeParse(validClientBase).success).toBe(true);
  });

  it("accepts a client view with the amount present (W-14 on)", () => {
    const withAmount = { ...validClientBase, amount: money(5_000_000) };
    expect(bookingMilestoneClientView.safeParse(withAmount).success).toBe(true);
  });

  it.each(["projectId", "contractId", "documentId", "createdBy"])(
    "rejects the internal field %s (additionalProperties:false)",
    (key) => {
      const bad = { ...validClientBase, [key]: null };
      expect(bookingMilestoneClientView.safeParse(bad).success).toBe(false);
    },
  );
});

describe("bookingMilestoneStaffView", () => {
  const validStaff = {
    ...validClientBase,
    amount: money(5_000_000),
    projectId: null,
    contractId: null,
    documentId: null,
    createdBy: null,
  };

  it("accepts a well-formed staff view, and a milestone with no amount (null)", () => {
    expect(bookingMilestoneStaffView.safeParse(validStaff).success).toBe(true);
    expect(bookingMilestoneStaffView.safeParse({ ...validStaff, amount: null }).success).toBe(true);
  });
});

describe("bookingMilestoneCreateRequest", () => {
  const base = { enquiryId: "00000000-0000-7000-8000-000000000002", milestoneType: "confirmed" };

  it("accepts a minimal request and defaults the optional fields to null", () => {
    const r = bookingMilestoneCreateRequest.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.amount).toBeNull();
      expect(r.data.dueAt).toBeNull();
      expect(r.data.contractId).toBeNull();
      expect(r.data.documentId).toBeNull();
    }
  });

  it("rejects an unknown milestone type", () => {
    expect(
      bookingMilestoneCreateRequest.safeParse({ ...base, milestoneType: "mystery" }).success,
    ).toBe(false);
  });

  it("rejects a status in the body (the server sets pending; status moves via the transition route)", () => {
    expect(bookingMilestoneCreateRequest.safeParse({ ...base, status: "done" }).success).toBe(
      false,
    );
  });

  it("rejects a negative amount and one that would overflow numeric(14,2)", () => {
    expect(bookingMilestoneCreateRequest.safeParse({ ...base, amount: money(-1) }).success).toBe(
      false,
    );
    expect(
      bookingMilestoneCreateRequest.safeParse({ ...base, amount: money(100_000_000_000_000) })
        .success,
    ).toBe(false);
  });
});

describe("bookingMilestoneUpdateRequest", () => {
  it("accepts a partial edit and rejects the milestone type (fixed at creation)", () => {
    expect(bookingMilestoneUpdateRequest.safeParse({ amount: money(1_000) }).success).toBe(true);
    expect(bookingMilestoneUpdateRequest.safeParse({ milestoneType: "balance_due" }).success).toBe(
      false,
    );
  });
});

describe("bookingMilestoneTransitionRequest", () => {
  it.each(["done", "overdue", "cancelled", "pending"])("accepts %s", (status) => {
    expect(bookingMilestoneTransitionRequest.safeParse({ status }).success).toBe(true);
  });

  it("rejects an unknown status", () => {
    expect(bookingMilestoneTransitionRequest.safeParse({ status: "late" }).success).toBe(false);
  });
});
