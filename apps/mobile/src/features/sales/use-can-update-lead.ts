import { useStaffAccess } from "@ampm/api-client";

const LEAD_UPDATE = "crm.leads.update";

/**
 * Whether the signed-in staff member may edit a lead (`crm.leads.update`: Super Admin and Sales, or a
 * custom role granted it, D-164). The Hotel team and project managers read leads without it, so they
 * never see an edit they would only be refused; the server stays the real gate. False until `/me`
 * answers.
 *
 *   const canUpdateLead = useCanUpdateLead();
 */
export function useCanUpdateLead(): boolean {
  return useStaffAccess().holds(LEAD_UPDATE);
}
