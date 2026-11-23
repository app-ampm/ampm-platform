import { useStaffAccess, type StaffAccess } from "@ampm/api-client";

/** What the signed-in staff member may do with the destination catalogue (TW-20). */
export interface DestinationPermissions {
  /** Add a destination (`hotels.destinations.create`: SA, HT). */
  readonly canCreate: boolean;
  /** Edit one, set its status or publish it to the website (`…update`: SA, HT). */
  readonly canUpdate: boolean;
}

/**
 * The permissions for a staff member's access, decided by @ampm/policy as the API's guard decides them,
 * a custom role's grants included (D-164). Every other role reads the destinations and changes none.
 *
 * @example
 * destinationPermissionsFor(staffAccessFor(me)); // SM: { canCreate: false, canUpdate: false }
 */
export function destinationPermissionsFor(access: StaffAccess): DestinationPermissions {
  return {
    canCreate: access.can("hotels.destinations.create"),
    canUpdate: access.can("hotels.destinations.update"),
  };
}

/**
 * The signed-in staff member's destination permissions; none until `/me` answers. The UI hides what a
 * role may not do; the server stays the real gate.
 *
 *   const { canCreate } = useDestinationPermissions();
 */
export function useDestinationPermissions(): DestinationPermissions {
  return destinationPermissionsFor(useStaffAccess());
}
