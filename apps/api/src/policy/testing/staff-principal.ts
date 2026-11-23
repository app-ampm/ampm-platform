import { resolveCustomGrants, type StaffRole } from "@ampm/policy";

import type { StaffPrincipal } from "../principal.types.js";

/**
 * A staff principal for a unit test, as the principal service builds one: its system roles, the grants
 * of a custom role's capability ids resolved as the server resolves them (D-036, D-164), and the
 * weddings it is an active member of. Test-only: the build leaves `testing/` folders out.
 *
 * @example
 * staffPrincipal(["HT"]); // the Hotel team
 * staffPrincipal([], ["hotels.hotel_contacts.read:all"]); // a custom role that reads hotel contacts
 * staffPrincipal(["HL"], [], [projectId]); // a Hospitality Lead on one wedding
 */
export function staffPrincipal(
  roles: StaffRole[],
  capabilities: string[] = [],
  projectIds: string[] = [],
): StaffPrincipal {
  const { grants } = resolveCustomGrants(capabilities);
  return {
    type: "staff",
    userId: "018f0000-0000-7000-8000-00000000cafe",
    name: "Test Staff",
    email: null,
    phone: null,
    status: "active",
    lastLoginAt: null,
    memberships: projectIds.map((projectId) => ({
      projectId,
      projectRole: "staff",
      clientSide: null,
      canViewFinance: false,
      canApprove: false,
    })),
    roles,
    resolvedGrants: grants.size > 0 ? grants : undefined,
  };
}
