import { z } from "zod";

import { money, uuid } from "./common.js";
import { entitlementModule } from "./identity.js";

/*
 * Contracts for subscription plans and their modules (Module B CRM, feature 8.3). A plan is a
 * Super-Admin-editable reference row; it is PUBLIC when active, so the public website (PUB-07) and the
 * portal (CP-11) show its price and inclusions. The price is the plan row's own value — never a code
 * literal (AC-02.9/AC-25.4) — and crosses the wire as integer paise (money.ts). `moduleKey` is an
 * @ampm/core entitlement module, the same vocabulary the policy engine resolves, so the catalogue and
 * the entitlement model cannot drift.
 */

export const planType = z.enum(["hotel_discovery", "trial", "demo", "package"]);
export type PlanType = z.infer<typeof planType>;

export const billingType = z.enum(["one_time", "recurring"]);
export type BillingType = z.infer<typeof billingType>;

export const planModuleAccess = z.enum(["read", "full"]);
export type PlanModuleAccess = z.infer<typeof planModuleAccess>;

/** A module a plan grants (PUBLIC): the entitlement module (identity.ts) and how far it reaches. */
export const planModuleView = z.object({
  moduleKey: entitlementModule,
  accessLevel: planModuleAccess,
});
export type PlanModuleView = z.infer<typeof planModuleView>;

/**
 * A plan as the public catalogue shows it (PUB-07, CP-11): PUBLIC fields only, with the price as client
 * money. Strict, so no internal field (status, isDemo, terms version, audit columns) can leak into a
 * public response (AC-12 / brief rule 8).
 */
export const planPublicView = z
  .object({
    id: uuid,
    planKey: z.string(),
    name: z.string(),
    planType,
    billingType,
    price: money,
    termDays: z.number().int().nullable(),
    trialDays: z.number().int().nullable(),
    modules: z.array(planModuleView),
  })
  .strict();
export type PlanPublicView = z.infer<typeof planPublicView>;

export const plansResponse = z.object({ items: z.array(planPublicView) });
export type PlansResponse = z.infer<typeof plansResponse>;
