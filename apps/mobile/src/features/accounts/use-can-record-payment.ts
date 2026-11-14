import { useMe } from "@ampm/api-client";

import { rolesGrant } from "@/navigation/staff-areas";

/** The key the record-payment route requires (`POST /crm/subscriptions/:id/record-payment`). */
const RECORD_PAYMENT_PERMISSION = "crm.subscriptions.update";

/**
 * Whether the signed-in staff member may record a manual payment: their roles grant the route's key.
 * A reader without it never sees the action, rather than filling the sheet only to be refused; the
 * server stays the real gate. False until `/me` answers.
 *
 *   const canRecordPayment = useCanRecordPayment();
 */
export function useCanRecordPayment(): boolean {
  const me = useMe();
  return me.data ? rolesGrant(me.data.roles, RECORD_PAYMENT_PERMISSION) : false;
}
