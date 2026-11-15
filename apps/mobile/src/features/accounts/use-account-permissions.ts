import { useMe } from "@ampm/api-client";
import { can, type StaffRole } from "@ampm/policy";

/** What the signed-in staff member may do on the client hub (TW-13). */
export interface AccountPermissions {
  /** Edit the account's details and its contacts (`crm.accounts.update`). */
  readonly canEdit: boolean;
  /** Add a contact or invite one to the portal: both mint a login, like Convert (`crm.accounts.create`). */
  readonly canAddContact: boolean;
  /** Remove a contact who has no portal login (`crm.accounts.delete`). */
  readonly canRemoveContact: boolean;
  readonly canReadEnquiries: boolean;
  readonly canReadAgreements: boolean;
  readonly canReadLeads: boolean;
}

const NONE: AccountPermissions = {
  canEdit: false,
  canAddContact: false,
  canRemoveContact: false,
  canReadEnquiries: false,
  canReadAgreements: false,
  canReadLeads: false,
};

/**
 * The hub's permissions for a set of staff roles, decided by @ampm/policy as the API's guard decides
 * them: a grant scoped to assigned projects does not reach an account route (no project on it), so a
 * Project Manager sees no edit actions the server would refuse.
 *
 * @example
 * accountPermissionsFor(["SM"]).canEdit; // true
 */
export function accountPermissionsFor(roles: readonly StaffRole[]): AccountPermissions {
  const allows = (key: string): boolean => can({ type: "staff", roles }, key);
  return {
    canEdit: allows("crm.accounts.update"),
    canAddContact: allows("crm.accounts.create"),
    canRemoveContact: allows("crm.accounts.delete"),
    canReadEnquiries: allows("consultancy.enquiries.read"),
    canReadAgreements: allows("crm.service_agreements.read"),
    canReadLeads: allows("crm.leads.read"),
  };
}

/**
 * The signed-in staff member's hub permissions; none until `/me` answers. The UI hides what a role may
 * not do; the server stays the real gate.
 *
 *   const permissions = useAccountPermissions();
 */
export function useAccountPermissions(): AccountPermissions {
  const me = useMe();
  if (!me.data || me.data.principal.type !== "staff") return NONE;
  return accountPermissionsFor(me.data.roles);
}
