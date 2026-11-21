import { useMe } from "@ampm/api-client";
import { can, type StaffRole } from "@ampm/policy";

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

const NONE: ClientInterestPermissions = { canReadSavedHotels: false, canOpenClient: false };

/**
 * The permissions for a set of staff roles, decided by @ampm/policy as the API's guard decides them: a
 * grant scoped to assigned weddings does not reach these project-less routes, so a Project Manager gets
 * neither.
 *
 * @example
 * clientInterestPermissionsFor(["HT"]); // { canReadSavedHotels: true, canOpenClient: true }
 */
export function clientInterestPermissionsFor(
  roles: readonly StaffRole[],
): ClientInterestPermissions {
  const allows = (key: string): boolean => can({ type: "staff", roles }, key);
  return {
    canReadSavedHotels: allows("hotels.saved_hotels.read"),
    canOpenClient: allows("crm.accounts.read"),
  };
}

/**
 * The signed-in staff member's permissions; none until `/me` answers. The UI hides what a role may not
 * read; the server stays the real gate.
 *
 *   const { canReadSavedHotels } = useClientInterestPermissions();
 */
export function useClientInterestPermissions(): ClientInterestPermissions {
  const me = useMe();
  if (!me.data || me.data.principal.type !== "staff") return NONE;
  return clientInterestPermissionsFor(me.data.roles);
}
