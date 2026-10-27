import { Injectable } from "@nestjs/common";
import { meResponse, type MeResponse } from "@ampm/core";

import type { Principal } from "../../policy/principal.types.js";

/** Step 7 for `/me`: the one view of a principal, parsed through its schema so nothing else leaks. */
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
      entitlements: { modules: principal.type === "staff" ? [] : principal.entitlements.modules },
      isDemo: principal.type === "demo",
    });
  }
}
