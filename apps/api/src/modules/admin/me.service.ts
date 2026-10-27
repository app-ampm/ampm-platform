import { Injectable } from "@nestjs/common";
import { meResponse, type MeResponse } from "@ampm/core";

import type { Principal } from "../../policy/principal.types.js";

/** Staff reach modules through roles, not entitlements (permission-matrix §1 layer 4). */
const NO_ENTITLEMENTS = {
  modules: [],
  readOnlyModules: [],
  hotelReach: [],
  financeReach: [],
  requestTypes: [],
};

/**
 * Step 7 for `/me`: the one view of a principal, parsed through its schema so nothing else leaks.
 * A client's entitlements go out whole (read-only modules and reaches included, §3), so the
 * portals show what the policy resolved rather than guessing it from the module list.
 *
 * @example
 * return this.me.view(principal); // MeResponse, parsed through meResponse
 */
@Injectable()
export class MeService {
  view(principal: Principal): MeResponse {
    if (principal.type === "system") {
      throw new Error("the system principal has no /me");
    }
    return meResponse.parse({
      principal: {
        type: principal.type,
        userId: principal.userId,
        name: principal.name,
        email: principal.email,
        phone: principal.phone,
        status: principal.status,
        lastLoginAt: principal.lastLoginAt ? principal.lastLoginAt.toISOString() : null,
      },
      roles: principal.type === "staff" ? principal.roles : [],
      memberships: principal.memberships,
      entitlements: principal.type === "staff" ? NO_ENTITLEMENTS : principal.entitlements,
      isDemo: principal.type === "demo",
    });
  }
}
