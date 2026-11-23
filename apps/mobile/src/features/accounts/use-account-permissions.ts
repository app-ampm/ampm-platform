import { useStaffAccess, type StaffAccess } from "@ampm/api-client";

/** What the signed-in staff member may do on the client hub (TW-13). */
export interface AccountPermissions {
  /** Edit the account's details and its contacts (`crm.accounts.update`). */
  readonly canEdit: boolean;
  /** Add a contact or invite one to the portal: both mint a login, like Convert (`crm.accounts.create`). */
  readonly canAddContact: boolean;
  /** Remove a contact who has no portal login (`crm.accounts.delete`). */
  readonly canRemoveContact: boolean;
  readonly canReadEnquiries: boolean;
  /** The hotels the client saved while exploring (`hotels.saved_hotels.read`: SA, SM, HT). */
  readonly canReadSavedHotels: boolean;
  readonly canReadAgreements: boolean;
  readonly canReadLeads: boolean;
}

/**
 * The hub's permissions for a staff member's access, decided by @ampm/policy as the API's guard decides
 * them, a custom role's grants included (D-164): a grant scoped to assigned projects does not reach an
 * account route (no project on it), so a Project Manager sees no edit actions the server would refuse.
 *
 * @example
 * accountPermissionsFor(staffAccessFor(me)).canEdit; // true for Sales
 */
export function accountPermissionsFor(access: StaffAccess): AccountPermissions {
  return {
    canEdit: access.can("crm.accounts.update"),
    canAddContact: access.can("crm.accounts.create"),
    canRemoveContact: access.can("crm.accounts.delete"),
    canReadEnquiries: access.can("consultancy.enquiries.read"),
    canReadSavedHotels: access.can("hotels.saved_hotels.read"),
    canReadAgreements: access.can("crm.service_agreements.read"),
    canReadLeads: access.can("crm.leads.read"),
  };
}

/**
 * The signed-in staff member's hub permissions; none until `/me` answers. The UI hides what a role may
 * not do; the server stays the real gate.
 *
 *   const permissions = useAccountPermissions();
 */
export function useAccountPermissions(): AccountPermissions {
  return accountPermissionsFor(useStaffAccess());
}
