import { useAccountSubscriptions } from "@ampm/api-client";
import type { SubscriptionView } from "@ampm/core";

/** A subscription Finance can record a manual payment against: the client chose a plan, unpaid. */
export function isAwaitingPayment(subscription: SubscriptionView): boolean {
  return subscription.status === "pending_payment";
}

/**
 * The account's one subscription awaiting payment, whose Record payment the record header carries
 * (T3: a record's actions sit in its header). Null when none waits, and when several do: the header
 * cannot say which, so each of those rows keeps its own action instead. It reads the same query as the
 * Subscriptions section, so the two always agree and no second request is made.
 *
 *   const pendingId = useSolePendingSubscription(accountId);
 */
export function useSolePendingSubscription(accountId: string): string | null {
  const subscriptions = useAccountSubscriptions(accountId);
  const [only, ...others] = (subscriptions.data?.items ?? []).filter(isAwaitingPayment);
  return only && others.length === 0 ? only.id : null;
}
