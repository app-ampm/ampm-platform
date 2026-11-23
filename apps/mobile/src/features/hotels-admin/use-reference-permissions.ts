import { useMe } from "@ampm/api-client";
import { can, type StaffRole } from "@ampm/policy";

/** What the signed-in staff member may do with a hotel's previous-wedding references (TW-22). */
export interface ReferencePermissions {
  /** Add a reference (`hotels.wedding_references.create`: SA, HT). */
  readonly canCreate: boolean;
  /** Edit one, attach its consent, show or hide it (`…update`: SA, HT). */
  readonly canUpdate: boolean;
  /** Remove one (`…delete`: SA, HT). */
  readonly canDelete: boolean;
}

const NONE: ReferencePermissions = { canCreate: false, canUpdate: false, canDelete: false };

/**
 * The permissions for a set of staff roles, decided by @ampm/policy as the API's guard decides them. A
 * Sales Manager reaches the catalogue and reads references but changes none.
 *
 * @example
 * referencePermissionsFor(["SM"]); // { canCreate: false, canUpdate: false, canDelete: false }
 */
export function referencePermissionsFor(roles: readonly StaffRole[]): ReferencePermissions {
  const allows = (key: string): boolean => can({ type: "staff", roles }, key);
  return {
    canCreate: allows("hotels.wedding_references.create"),
    canUpdate: allows("hotels.wedding_references.update"),
    canDelete: allows("hotels.wedding_references.delete"),
  };
}

/**
 * The signed-in staff member's reference permissions; none until `/me` answers. The UI hides what a role
 * may not do; the server stays the real gate.
 */
export function useReferencePermissions(): ReferencePermissions {
  const me = useMe();
  if (!me.data || me.data.principal.type !== "staff") return NONE;
  return referencePermissionsFor(me.data.roles);
}
