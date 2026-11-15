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
    const subs = await this.prisma.subscription.findMany({
      ...reportQuery(status),
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = subs.length > limit;
    const rows = await this.withLastPayments(hasMore ? subs.slice(0, limit) : subs);
    return { rows, nextCursor: hasMore ? rows[rows.length - 1]!.id : null };
  }

  /** The whole filtered report for an export, up to `max` rows; `truncated` when more were left out. */
  async export(
    status: SubscriptionStatus | undefined,
    max: number,
  ): Promise<{ rows: SubscriptionReportDbRow[]; truncated: boolean }> {
    const subs = await this.prisma.subscription.findMany({ ...reportQuery(status), take: max + 1 });
    const truncated = subs.length > max;
    return { rows: await this.withLastPayments(subs.slice(0, max)), truncated };
  }

  private async withLastPayments(
    subs: readonly SelectedSubscription[],
  ): Promise<SubscriptionReportDbRow[]> {
    const payments = await this.lastPayments(subs.map((sub) => sub.id));
    return subs.map((sub) => toRow(sub, payments.get(sub.id) ?? null));
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

/**
 * The report's scoping and order, shared by the page and the export: deleted subscriptions and
 * accounts and demo accounts left out; Finance's awaiting queue oldest first, everything else newest
 * first.
 */
function reportQuery(status: SubscriptionStatus | undefined) {
  const direction: Prisma.SortOrder = status === "pending_payment" ? "asc" : "desc";
  return {
    where: {
      deletedAt: null,
      ...(status ? { status } : {}),
      account: { isDemo: false, deletedAt: null },
    },
    orderBy: [{ createdAt: direction }, { id: direction }],
    select: REPORT_FIELDS,
  } satisfies Prisma.SubscriptionFindManyArgs;
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
