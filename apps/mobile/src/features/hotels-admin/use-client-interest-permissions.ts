import { useStaffAccess, type StaffAccess } from "@ampm/api-client";

/** What the signed-in staff member may see, from the hotel catalogue, of clients' interest in hotels. */
export interface ClientInterestPermissions {
  /**
   * Clients' saved hotels (`hotels.saved_hotels.read`: SA, SM, HT): the catalogue's link to every
   * client's saves and a hotel's "Saved by" panel.
   */
  readonly canReadSavedHotels: boolean;
  /** A client's hub (`crm.accounts.read`), which a row of a hotel's "Saved by" panel opens. */
  readonly canOpenClient: boolean;
}

/**
 * The permissions for a staff member's access, decided by @ampm/policy as the API's guard decides them,
 * a custom role's grants included (D-164): a grant scoped to assigned weddings does not reach these
 * project-less routes, so a Project Manager gets neither.
 *
 * @example
 * clientInterestPermissionsFor(staffAccessFor(me)); // { canReadSavedHotels: true, canOpenClient: true }
 */
export function clientInterestPermissionsFor(access: StaffAccess): ClientInterestPermissions {
  return {
    canReadSavedHotels: access.can("hotels.saved_hotels.read"),
    canOpenClient: access.can("crm.accounts.read"),
  };
}

/**
 * The signed-in staff member's permissions; none until `/me` answers. The UI hides what a role may not
 * read; the server stays the real gate.
 *
 *   const { canReadSavedHotels } = useClientInterestPermissions();
 */
export function useClientInterestPermissions(): ClientInterestPermissions {
  return clientInterestPermissionsFor(useStaffAccess());
}
