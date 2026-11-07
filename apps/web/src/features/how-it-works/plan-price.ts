import { clientAmount, formatAmount, plansResponse, type PlanType } from "@ampm/core";
import { z } from "zod";

import { env } from "@/env";

/** The API's envelope around the public plan catalogue (`GET /crm/plans`). */
const plansEnvelope = z.object({ data: plansResponse });

/** How long the site reuses a fetched price before asking the API again, in seconds. */
export const PLAN_PRICE_REVALIDATE_SECONDS = 300;

/** A slow API must not hold the page: past this, the stage renders without its price. */
const PLAN_PRICE_TIMEOUT_MS = 3000;

/** The fetch the reader uses; injectable so tests need no network. */
export type PlanFetch = (input: string, init: RequestInit) => Promise<Response>;

/**
 * The price of the active plan of a type, formatted for the page ("₹50,000" for hotel discovery), or
 * null when the API cannot say. Prices are configuration a Super Admin changes without a deploy
 * (AC-02.9 / AC-25.4), so the site reads the public catalogue instead of carrying the amount. Next keeps
 * the answer for five minutes, so visitors do not each reach the rate-limited endpoint.
 *
 *   const price = await fetchPlanPrice("hotel_discovery");
 */
export async function fetchPlanPrice(
  planType: PlanType,
  request: PlanFetch = fetch,
): Promise<string | null> {
  try {
    const response = await request(`${env.NEXT_PUBLIC_API_URL}/crm/plans`, {
      next: { revalidate: PLAN_PRICE_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(PLAN_PRICE_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const parsed = plansEnvelope.safeParse(await response.json());
    if (!parsed.success) return null;
    const plan = parsed.data.data.items.find((item) => item.planType === planType);
    return plan ? formatAmount(clientAmount(plan.price.minor, plan.price.currency)) : null;
  } catch {
    return null;
  }
}
