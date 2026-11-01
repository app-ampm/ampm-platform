import { entitlementModule, type PlanModuleView, type PlanPublicView } from "@ampm/core";

import { toClientMoney } from "./money.js";
import type { PlanModuleRow, PlanRow } from "./plans.repository.js";

function toPlanModuleView(row: PlanModuleRow): PlanModuleView {
  // The stored module key must be an entitlement module; a stray value is a 500 (a bad plan row),
  // never a silent cast (code.md), matching how the serialiser treats any stored row it cannot model.
  return { moduleKey: entitlementModule.parse(row.moduleKey), accessLevel: row.accessLevel };
}

/** The public catalogue view: PUBLIC fields only, the price as client money (integer paise). */
export function toPlanPublicView(row: PlanRow): PlanPublicView {
  return {
    id: row.id,
    planKey: row.planKey,
    name: row.name,
    planType: row.planType,
    billingType: row.billingType,
    price: toClientMoney(row.priceAmount),
    termDays: row.termDays,
    trialDays: row.trialDays,
    modules: row.modules.map(toPlanModuleView),
  };
}
