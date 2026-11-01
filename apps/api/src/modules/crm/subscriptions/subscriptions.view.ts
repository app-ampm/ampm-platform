import type { SubscriptionView } from "@ampm/core";

import type { SubscriptionRow } from "./subscriptions.repository.js";

/** The staff subscription view (TW-14): CLIENT-class fields, timestamps as ISO. */
export function toSubscriptionView(row: SubscriptionRow): SubscriptionView {
  return {
    id: row.id,
    accountId: row.accountId,
    planId: row.planId,
    status: row.status,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
    autoRenew: row.autoRenew,
    activationSource: row.activationSource,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
