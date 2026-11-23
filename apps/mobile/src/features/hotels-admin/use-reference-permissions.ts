import { useStaffAccess, type StaffAccess } from "@ampm/api-client";

/** What the signed-in staff member may do with a hotel's previous-wedding references (TW-22). */
export interface ReferencePermissions {
  /** Add a reference (`hotels.wedding_references.create`: SA, HT). */
  readonly canCreate: boolean;
  /** Edit one, attach its consent, show or hide it (`…update`: SA, HT). */
  readonly canUpdate: boolean;
  /** Remove one (`…delete`: SA, HT). */
  readonly canDelete: boolean;
}

/**
 * The permissions for a staff member's access, decided by @ampm/policy as the API's guard decides them,
 * a custom role's grants included (D-164). A Sales Manager reaches the catalogue and reads references
 * but changes none.
 *
 * @example
 * referencePermissionsFor(staffAccessFor(me)); // SM: { canCreate: false, canUpdate: false, canDelete: false }
 */
export function referencePermissionsFor(access: StaffAccess): ReferencePermissions {
  return {
    canCreate: access.can("hotels.wedding_references.create"),
    canUpdate: access.can("hotels.wedding_references.update"),
    canDelete: access.can("hotels.wedding_references.delete"),
  };
}

/**
 * The signed-in staff member's reference permissions; none until `/me` answers. The UI hides what a role
 * may not do; the server stays the real gate.
 */
export function useReferencePermissions(): ReferencePermissions {
  return referencePermissionsFor(useStaffAccess());
}
