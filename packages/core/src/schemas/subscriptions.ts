import { z } from "zod";

import { cursorQuery, isoDateTime, money, page, uuid } from "./common.js";

/*
 * Contracts for subscriptions (Module B CRM, feature 8.3, AC-02): an account buys a plan, pays through
 * the Razorpay sandbox (hosted checkout — card data never touches AMPM), and the signed webhook (or a
 * Finance manual bank transfer) activates it. Entitlement gating is NOT in these contracts: it is a
 * computed decision (@ampm/policy), never a permission key or a stored module list (brief §6).
 */

export const subscriptionStatus = z.enum([
  "trial",
  "pending_payment",
  "active",
  "expiring",
  "expired",
  "suspended",
  "cancelled",
]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatus>;

export const activationSource = z.enum(["gateway_webhook", "manual"]);
export type ActivationSource = z.infer<typeof activationSource>;

/**
 * Start a purchase (the Sales team workspace; the client self-purchase screen CP-11 defers). Creates a
 * `pending_payment` subscription, an `initiated` payment and a gateway order for hosted checkout. The
 * optional basic wedding details (§0a) are written to the account (couple names, preferred locations);
 * the wedding workspace itself stays locked (Phase 2).
 */
export const subscriptionCreateRequest = z.object({
  accountId: uuid,
  planId: uuid,
  weddingDetails: z
    .object({
      coupleNames: z.string().trim().max(255).optional(),
      preferredLocations: z.string().trim().max(10_000).optional(),
    })
    .optional(),
});
export type SubscriptionCreateRequest = z.infer<typeof subscriptionCreateRequest>;

/** The gateway order the browser's hosted checkout needs; `keyId` is the gateway's PUBLIC key. */
export const subscriptionOrder = z.object({
  provider: z.string(),
  orderId: z.string(),
  amount: money,
  keyId: z.string(),
});
export type SubscriptionOrder = z.infer<typeof subscriptionOrder>;

export const subscriptionCreateResponse = z.object({
  subscriptionId: uuid,
  status: subscriptionStatus,
  order: subscriptionOrder,
});
export type SubscriptionCreateResponse = z.infer<typeof subscriptionCreateResponse>;

/** A subscription as staff see it (TW-14). CLIENT-class fields; no payment internals. */
export const subscriptionView = z.object({
  id: uuid,
  accountId: uuid,
  planId: uuid,
  status: subscriptionStatus,
  startsAt: isoDateTime.nullable(),
  endsAt: isoDateTime.nullable(),
  trialEndsAt: isoDateTime.nullable(),
  autoRenew: z.boolean(),
  activationSource: activationSource.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type SubscriptionView = z.infer<typeof subscriptionView>;

/**
 * A subscription as the account's own client sees it (CP-11 portal, when it lands). Strict and narrow;
 * no internal field. No route serialises this yet (the portal defers with the screen).
 */
export const subscriptionClientView = z
  .object({
    id: uuid,
    status: subscriptionStatus,
    startsAt: isoDateTime.nullable(),
    endsAt: isoDateTime.nullable(),
  })
  .strict();
export type SubscriptionClientView = z.infer<typeof subscriptionClientView>;

/** List/filter subscriptions (cursor-paginated by id); the cursor is a UUID, validated at the edge so a
 *  malformed cursor is a 400, not a Postgres uuid-cast 500. */
export const subscriptionListQuery = cursorQuery.extend({
  cursor: uuid.optional(),
  accountId: uuid.optional(),
  status: subscriptionStatus.optional(),
});
export type SubscriptionListQuery = z.infer<typeof subscriptionListQuery>;

export const subscriptionPage = page(subscriptionView);
export type SubscriptionPage = z.infer<typeof subscriptionPage>;
