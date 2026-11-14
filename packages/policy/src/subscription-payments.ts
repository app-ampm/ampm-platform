import type { FieldGroup } from "./conditions";
import { can, type PolicyPrincipal } from "./engine";

/**
 * The decision behind recording a manual (off-gateway) payment for a subscription awaiting one.
 * Recording activates the subscription, so it changes the subscription's status and nothing else on
 * it: `crm.subscriptions.update` with the status as the only field (permission-matrix §5.2). Super
 * Admin and Sales hold that update outright; Finance holds it for the status alone ("RU status"),
 * which is all recording takes, so Finance may record too (decided with AMPM, D-125). The API's route
 * guard and the app's action both read this, so the two never disagree.
 *
 * @example
 * \@RequirePermission(RECORD_SUBSCRIPTION_PAYMENT.key, { fields: RECORD_SUBSCRIPTION_PAYMENT.fields })
 */
export const RECORD_SUBSCRIPTION_PAYMENT = {
  key: "crm.subscriptions.update",
  fields: ["status"],
} as const satisfies { readonly key: string; readonly fields: readonly FieldGroup[] };

/**
 * Whether the principal may record a manual payment for a subscription (RECORD_SUBSCRIPTION_PAYMENT).
 *
 * @example
 * const canRecord = canRecordSubscriptionPayment({ type: "staff", roles: me.roles });
 */
export function canRecordSubscriptionPayment(principal: PolicyPrincipal): boolean {
  const { key, fields } = RECORD_SUBSCRIPTION_PAYMENT;
  return can(principal, key, { fields });
}
