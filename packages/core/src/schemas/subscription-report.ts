import { z } from "zod";

import { cursorQuery, isoDateTime, money, page, uuid } from "./common.js";
import { paymentMethod, paymentStatus } from "./payments.js";
import { subscriptionStatus } from "./subscriptions.js";

/*
 * The "Subscription status and payment history" report (permission-matrix §5.16, TW-83; run by SA, SM
 * and FA). It is how Finance sees the subscriptions it records payments against: Finance's own grants
 * on subscriptions and accounts are field-conditioned, so the CRM lists refuse it (D-127). Every field
 * here is CLIENT-class: the account's name, the plan, its price, the subscription's status and dates,
 * and the last client-visible inbound payment. No contact, billing detail, internal note or demo flag.
 */

/**
 * Narrow the report by status (`pending_payment` is Finance's queue, oldest first; every other status
 * and the whole report come newest first). Cursor-paginated by subscription id, validated at the edge.
 *
 * @example
 * subscriptionReportQuery.parse({ status: "pending_payment", limit: "20" });
 */
export const subscriptionReportQuery = cursorQuery.extend({
  cursor: uuid.optional(),
  status: subscriptionStatus.optional(),
});
export type SubscriptionReportQuery = z.infer<typeof subscriptionReportQuery>;

/** The latest client-visible inbound payment towards a subscription: a gateway attempt or a transfer. */
export const subscriptionReportPayment = z
  .object({
    method: paymentMethod,
    status: paymentStatus,
    paidAt: isoDateTime.nullable(),
    createdAt: isoDateTime,
  })
  .strict();
export type SubscriptionReportPayment = z.infer<typeof subscriptionReportPayment>;

/**
 * One subscription in the report. Strict, so a stray field (a billing detail, a note) fails the schema
 * rather than reaching Sales, who run the same report. `amount` is the plan's price, the sum a manual
 * payment records.
 */
export const subscriptionReportRow = z
  .object({
    subscriptionId: uuid,
    accountId: uuid,
    accountName: z.string(),
    planId: uuid,
    planName: z.string(),
    amount: money,
    status: subscriptionStatus,
    startsAt: isoDateTime.nullable(),
    endsAt: isoDateTime.nullable(),
    createdAt: isoDateTime,
    lastPayment: subscriptionReportPayment.nullable(),
  })
  .strict();
export type SubscriptionReportRow = z.infer<typeof subscriptionReportRow>;

export const subscriptionReportPage = page(subscriptionReportRow);
export type SubscriptionReportPage = z.infer<typeof subscriptionReportPage>;
