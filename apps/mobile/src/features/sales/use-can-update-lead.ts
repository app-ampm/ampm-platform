import { useMe } from "@ampm/api-client";

import { rolesGrant } from "@/navigation/staff-areas";

const LEAD_UPDATE = "crm.leads.update";

/**
 * Whether the signed-in staff member may edit a lead (`crm.leads.update`: Super Admin and Sales). The
 * Hotel team and project managers read leads without it, so they never see an edit they would only be
 * refused; the server stays the real gate. False until `/me` answers.
 *
 *   const canUpdateLead = useCanUpdateLead();
 */
export function useCanUpdateLead(): boolean {
  const me = useMe();
  if (!me.data || me.data.principal.type !== "staff") return false;
  return rolesGrant(me.data.roles, LEAD_UPDATE);
}
