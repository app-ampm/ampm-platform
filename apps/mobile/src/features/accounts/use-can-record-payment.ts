import { staffPolicyPrincipal, useMe } from "@ampm/api-client";
import { canRecordSubscriptionPayment } from "@ampm/policy";

/**
 * Whether the signed-in staff member may record a manual payment: the same decision the route
 * guard makes (`RECORD_SUBSCRIPTION_PAYMENT` in @ampm/policy: Super Admin, Sales, and Finance on the
 * status it changes, D-125), a custom role's grants included (D-164). A reader without it never sees
 * the action, rather than filling the sheet only to be refused; the server stays the real gate. False
 * until `/me` answers.
 *
 *   const canRecordPayment = useCanRecordPayment();
 */
export function useCanRecordPayment(): boolean {
  const me = useMe();
  const principal = me.data ? staffPolicyPrincipal(me.data) : null;
  return principal ? canRecordSubscriptionPayment(principal) : false;
}
