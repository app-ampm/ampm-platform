import { describe, expect, it } from "vitest";

import {
  subscriptionClientView,
  subscriptionCreateRequest,
  subscriptionListQuery,
} from "./subscriptions.js";

const ID = "018f0000-0000-7000-8000-000000000000";

describe("subscriptionCreateRequest", () => {
  it("requires an account and a plan", () => {
    expect(subscriptionCreateRequest.safeParse({ accountId: ID, planId: ID }).success).toBe(true);
    expect(subscriptionCreateRequest.safeParse({ accountId: ID }).success).toBe(false);
  });

  it("accepts the optional basic wedding details (§0a)", () => {
    expect(
      subscriptionCreateRequest.safeParse({
        accountId: ID,
        planId: ID,
        weddingDetails: { coupleNames: "Riya & Arjun" },
      }).success,
    ).toBe(true);
  });
});

describe("subscriptionListQuery", () => {
  it("validates the cursor as a UUID, so a malformed cursor is a 400 at the edge, not a 500", () => {
    expect(subscriptionListQuery.safeParse({ cursor: "not-a-uuid" }).success).toBe(false);
    expect(subscriptionListQuery.safeParse({ cursor: ID }).success).toBe(true);
    expect(subscriptionListQuery.safeParse({}).success).toBe(true);
  });
});

describe("subscriptionClientView", () => {
  it("is strict, so no internal subscription field reaches a client", () => {
    const base = { id: ID, status: "active", startsAt: null, endsAt: null };
    expect(subscriptionClientView.safeParse(base).success).toBe(true);
    expect(subscriptionClientView.safeParse({ ...base, accountId: ID }).success).toBe(false);
    expect(subscriptionClientView.safeParse({ ...base, activationSource: "manual" }).success).toBe(
      false,
    );
  });
});
