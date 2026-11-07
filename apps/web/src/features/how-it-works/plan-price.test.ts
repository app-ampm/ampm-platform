import { describe, expect, it, vi } from "vitest";

import { env } from "@/env";

import { PLAN_PRICE_REVALIDATE_SECONDS, fetchPlanPrice, type PlanFetch } from "./plan-price";

/** The catalogue as GET /crm/plans answers it (the seed's discovery plan: 50,000 rupees in paise). */
const CATALOGUE = {
  data: {
    items: [
      {
        id: "01a1b268-cb1c-71e3-8582-38b042d8fc3f",
        planKey: "discovery",
        name: "Hotel Discovery",
        planType: "hotel_discovery",
        billingType: "one_time",
        price: { minor: 5_000_000, currency: "INR" },
        termDays: 30,
        trialDays: null,
        modules: [{ moduleKey: "hotel_discovery", accessLevel: "full" }],
      },
    ],
  },
};

function answering(body: unknown, status = 200): PlanFetch {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe("fetchPlanPrice", () => {
  it("formats the active plan's catalogue price", async () => {
    await expect(fetchPlanPrice("hotel_discovery", answering(CATALOGUE))).resolves.toBe("₹50,000");
  });

  it("asks the public catalogue and lets Next reuse the answer", async () => {
    const request = answering(CATALOGUE);
    await fetchPlanPrice("hotel_discovery", request);
    expect(request).toHaveBeenCalledWith(
      `${env.NEXT_PUBLIC_API_URL}/crm/plans`,
      expect.objectContaining({ next: { revalidate: PLAN_PRICE_REVALIDATE_SECONDS } }),
    );
  });

  it("says nothing when the plan is not in the catalogue", async () => {
    await expect(fetchPlanPrice("package", answering(CATALOGUE))).resolves.toBeNull();
  });

  it("says nothing when the API refuses, answers garbage or cannot be reached", async () => {
    await expect(fetchPlanPrice("hotel_discovery", answering({}, 503))).resolves.toBeNull();
    await expect(
      fetchPlanPrice("hotel_discovery", answering({ data: { items: "no" } })),
    ).resolves.toBeNull();
    const unreachable: PlanFetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(fetchPlanPrice("hotel_discovery", unreachable)).resolves.toBeNull();
  });
});
