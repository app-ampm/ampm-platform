import { useMe, useStaffAccess, type StaffAccess } from "@ampm/api-client";
import type { StaffRoleCode } from "@ampm/core";

/** What the signed-in staff member may do with hotel information requests (D-188 §7). */
export interface InfoRequestPermissions {
  /** See the requests: the hotel record's panel, TW-99 and the count to review (`…read`: SA, SM, HT, PM). */
  readonly canRead: boolean;
  /** Send request and Invite a new hotel, with the duplicate hints (`…create`: SA, HT). */
  readonly canCreate: boolean;
  /** Reissue, revoke, extend, record a share and edit; the full view (`…update`: SA, HT). */
  readonly canUpdate: boolean;
  /**
   * Make a test request and see the tests in TW-99: the Super Admin's alone. The API checks the role
   * itself, not a grant (a custom role can never be the Super Admin), so this mirrors the role.
   */
  readonly canMakeTests: boolean;
}

/**
 * The permissions for a staff member's access, decided by @ampm/policy as the API's guard decides them,
 * a custom role's grants included (D-164), and the Super Admin role for test requests.
 *
 * @example
 * infoRequestPermissionsFor(staffAccessFor(me), me.roles); // SM: read only
 */
export function infoRequestPermissionsFor(
  access: StaffAccess,
  roles: readonly StaffRoleCode[],
): InfoRequestPermissions {
  return {
    canRead: access.can("hotels.info_requests.read"),
    canCreate: access.can("hotels.info_requests.create"),
    canUpdate: access.can("hotels.info_requests.update"),
    canMakeTests: roles.includes("SA"),
  };
}

/**
 * The signed-in staff member's permissions on hotel information requests; none until `/me` answers. The
 * UI hides what a role may not do; the server stays the real gate.
 *
 *   const { canCreate, canUpdate } = useInfoRequestPermissions();
 */
export function useInfoRequestPermissions(): InfoRequestPermissions {
  const me = useMe();
  return infoRequestPermissionsFor(useStaffAccess(), me.data?.roles ?? []);
}
