import { describe, expect, it } from "vitest";

import { planPublicView } from "./plans.js";

const base = {
  id: "018f0000-0000-7000-8000-000000000000",
  planKey: "discovery",
  name: "Hotel Discovery",
  planType: "hotel_discovery",
  billingType: "one_time",
  price: { minor: 5_000_000, currency: "INR" },
  termDays: 30,
  trialDays: null,
  modules: [{ moduleKey: "hotel_discovery", accessLevel: "full" }],
};

describe("planPublicView", () => {
  it("accepts a plan carrying only PUBLIC catalogue fields, with the price as integer paise", () => {
    expect(planPublicView.safeParse(base).success).toBe(true);
  });

  it("is strict, so no internal field can leak into the public catalogue", () => {
    expect(planPublicView.safeParse({ ...base, status: "active" }).success).toBe(false);
    expect(planPublicView.safeParse({ ...base, isDemo: false }).success).toBe(false);
    expect(planPublicView.safeParse({ ...base, priceAmount: "50000.00" }).success).toBe(false);
  });

  it("rejects a module key that is not an @ampm/core entitlement module", () => {
    expect(
      planPublicView.safeParse({
        ...base,
        modules: [{ moduleKey: "not_a_module", accessLevel: "full" }],
      }).success,
    ).toBe(false);
  });
});
