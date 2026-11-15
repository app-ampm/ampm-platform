import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../db/prisma.service.js";
import {
  Prisma,
  type PaymentMethod,
  type PaymentStatus,
  type SubscriptionStatus,
} from "../../../generated/prisma/client.js";

/** The latest client-visible inbound payment towards a subscription. */
export interface SubscriptionReportPaymentRow {
  readonly method: PaymentMethod;
  readonly status: PaymentStatus;
  readonly paidAt: Date | null;
  readonly createdAt: Date;
}

/** One subscription in the report: CLIENT-class fields of the subscription, its account and plan. */
export interface SubscriptionReportDbRow {
  readonly id: string;
  readonly accountId: string;
  readonly accountName: string;
  readonly planId: string;
  readonly planName: string;
  readonly priceAmount: Prisma.Decimal;
  readonly status: SubscriptionStatus;
  readonly startsAt: Date | null;
  readonly endsAt: Date | null;
  readonly createdAt: Date;
  readonly lastPayment: SubscriptionReportPaymentRow | null;
}

const REPORT_FIELDS = {
  id: true,
  accountId: true,
  planId: true,
  status: true,
  startsAt: true,
  endsAt: true,
  createdAt: true,
  account: { select: { name: true } },
  plan: { select: { name: true, priceAmount: true } },
} as const;

type SelectedSubscription = Prisma.SubscriptionGetPayload<{ select: typeof REPORT_FIELDS }>;

/**
 * The reads behind the subscription status report (§5.16, D-127). Scoping lives here: deleted
 * subscriptions and accounts are left out, and so are demo accounts, whose subscriptions are not money
 * anyone collects. Only client-visible inbound payments count as a subscription's payment history.
 */
@Injectable()
export class SubscriptionReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    status: SubscriptionStatus | undefined,
    limit: number,
    cursor?: string,
  ): Promise<{ rows: SubscriptionReportDbRow[]; nextCursor: string | null }> {
    // Finance works the awaiting-payment queue oldest first; every other view reads newest first.
    const direction = status === "pending_payment" ? "asc" : "desc";
    const subs = await this.prisma.subscription.findMany({
      where: {
        deletedAt: null,
        ...(status ? { status } : {}),
        account: { isDemo: false, deletedAt: null },
      },
      orderBy: [{ createdAt: direction }, { id: direction }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: REPORT_FIELDS,
    });
    const hasMore = subs.length > limit;
    const page = hasMore ? subs.slice(0, limit) : subs;
    const payments = await this.lastPayments(page.map((sub) => sub.id));
    const rows = page.map((sub) => toRow(sub, payments.get(sub.id) ?? null));
    return { rows, nextCursor: hasMore ? rows[rows.length - 1]!.id : null };
  }

  /** The newest client-visible inbound payment per subscription, in one query for the whole page. */
  private async lastPayments(
    subscriptionIds: readonly string[],
  ): Promise<Map<string, SubscriptionReportPaymentRow>> {
    const latest = new Map<string, SubscriptionReportPaymentRow>();
    if (subscriptionIds.length === 0) return latest;
    const payments = await this.prisma.payment.findMany({
      where: {
        relatedType: "subscription",
        relatedId: { in: [...subscriptionIds] },
        direction: "inbound",
        clientVisible: true,
        deletedAt: null,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { relatedId: true, method: true, status: true, paidAt: true, createdAt: true },
    });
    for (const { relatedId, ...payment } of payments) {
      if (relatedId && !latest.has(relatedId)) latest.set(relatedId, payment);
    }
    return latest;
  }
}

function toRow(
  sub: SelectedSubscription,
  lastPayment: SubscriptionReportPaymentRow | null,
): SubscriptionReportDbRow {
  return {
    id: sub.id,
    accountId: sub.accountId,
    accountName: sub.account.name,
    planId: sub.planId,
    planName: sub.plan.name,
    priceAmount: sub.plan.priceAmount,
    status: sub.status,
    startsAt: sub.startsAt,
    endsAt: sub.endsAt,
    createdAt: sub.createdAt,
    lastPayment,
  };
}
