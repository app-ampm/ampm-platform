import { serviceCategory, type ServiceTypeView } from "@ampm/core";

import type { ServiceTypeRow } from "./service-types.repository.js";

/**
 * The reference view: the stable key (reported as an open string — the catalogue is Super-Admin-extendable,
 * so a row outside the fixed v1 `serviceKey` enum must not 500 the list), the display name and the category.
 * The category IS a DB enum, so a value the contract cannot model there is a 500 (a bad reference row),
 * never a silent cast (code.md) — mirroring how the plan view treats its entitlement module.
 */
export function toServiceTypeView(row: ServiceTypeRow): ServiceTypeView {
  return {
    id: row.id,
    serviceKey: row.serviceKey,
    name: row.name,
    category: serviceCategory.parse(row.category),
  };
}
