import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../db/prisma.service.js";
import {
  Prisma,
  type ActivationSource,
  type SubscriptionStatus,
} from "../../../generated/prisma/client.js";

export interface SubscriptionRow {
  readonly id: string;
  readonly accountId: string;
  readonly planId: string;
  readonly status: SubscriptionStatus;
  readonly startsAt: Date | null;
  readonly endsAt: Date | null;
  readonly trialEndsAt: Date | null;
  readonly autoRenew: boolean;
  readonly activationSource: ActivationSource | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SubscriptionWriteData {
  readonly accountId: string;
  readonly planId: string;
  readonly status: SubscriptionStatus;
  readonly createdBy: string;
}

export interface SubscriptionActivation {
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly activationSource: ActivationSource;
  readonly activatedByUserId: string | null;
}

export interface SubscriptionListFilters {
  readonly accountId?: string | undefined;
  readonly status?: SubscriptionStatus | undefined;
}

/** A subscription's identity for a sweep: which account it belongs to (for cache invalidation/notices). */
export interface SubscriptionRef {
  readonly id: string;
  readonly accountId: string;
}

const SUBSCRIPTION_FIELDS = {
  id: true,
  accountId: true,
  planId: true,
  status: true,
  startsAt: true,
  endsAt: true,
  trialEndsAt: true,
  autoRenew: true,
  activationSource: true,
  createdAt: true,
  updatedAt: true,
} as const;

type SelectedSubscription = Prisma.SubscriptionGetPayload<{ select: typeof SUBSCRIPTION_FIELDS }>;

function toRow(sub: SelectedSubscription): SubscriptionRow {
  return { ...sub };
}

@Injectable()
export class SubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: SubscriptionWriteData, client: Prisma.TransactionClient): Promise<string> {
    const sub = await client.subscription.create({ data, select: { id: true } });
    return sub.id;
  }

  async findById(id: string): Promise<SubscriptionRow | null> {
    const sub = await this.prisma.subscription.findFirst({
      where: { id, deletedAt: null },
      select: SUBSCRIPTION_FIELDS,
    });
    return sub ? toRow(sub) : null;
  }

  /** The account's current pending-payment subscription for a plan, if any — so a retried purchase
   *  reuses it (idempotent) and an abandoned one is picked back up rather than duplicated. */
  async findPendingForAccountPlan(accountId: string, planId: string): Promise<string | null> {
    const sub = await this.prisma.subscription.findFirst({
      where: { accountId, planId, status: "pending_payment", deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    return sub?.id ?? null;
  }

  /** The subscription's current state inside the activation transaction (status drives the one-shot guard). */
  async loadForActivation(
    id: string,
    client: Prisma.TransactionClient,
  ): Promise<{ status: SubscriptionStatus; accountId: string; planId: string } | null> {
    return client.subscription.findFirst({
      where: { id, deletedAt: null },
      select: { status: true, accountId: true, planId: true },
    });
  }

  /**
   * Flip `pending_payment` → `active` with the term dates, only while still pending. The
   * `status: "pending_payment"` guard is the concurrency-safe idempotency: a second (duplicate) webhook
   * updates zero rows, so exactly one activation, audit and notification happen (AC-02.5).
   */
  async activate(
    id: string,
    activation: SubscriptionActivation,
    client: Prisma.TransactionClient,
  ): Promise<number> {
    const result = await client.subscription.updateMany({
      where: { id, status: "pending_payment", deletedAt: null },
      data: { ...activation, status: "active" },
    });
    return result.count;
  }

  /** Active subscriptions whose term ends within the notice window (for the expiring notice). */
  async findDueForExpiringNotice(now: Date, noticeBefore: Date): Promise<SubscriptionRef[]> {
    return this.prisma.subscription.findMany({
      where: { status: "active", deletedAt: null, endsAt: { gt: now, lte: noticeBefore } },
      select: { id: true, accountId: true },
    });
  }

  /** Subscriptions whose term has ended (for expiry). */
  async findDueForExpiry(now: Date): Promise<SubscriptionRef[]> {
    return this.prisma.subscription.findMany({
      where: { status: { in: ["active", "expiring"] }, deletedAt: null, endsAt: { lte: now } },
      select: { id: true, accountId: true },
    });
  }

  /** Move a subscription to a new status only from the given statuses (idempotent re-runs). */
  async transition(
    id: string,
    from: SubscriptionStatus[],
    to: SubscriptionStatus,
    client: Prisma.TransactionClient,
  ): Promise<number> {
    const result = await client.subscription.updateMany({
      where: { id, status: { in: from }, deletedAt: null },
      data: { status: to },
    });
    return result.count;
  }

  async list(
    filters: SubscriptionListFilters,
    limit: number,
    cursor?: string,
  ): Promise<{ rows: SubscriptionRow[]; nextCursor: string | null }> {
    const where: Prisma.SubscriptionWhereInput = { deletedAt: null };
    if (filters.accountId) where.accountId = filters.accountId;
    if (filters.status) where.status = filters.status;
    const subs = await this.prisma.subscription.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: SUBSCRIPTION_FIELDS,
    });
    const hasMore = subs.length > limit;
    const rows = (hasMore ? subs.slice(0, limit) : subs).map(toRow);
    return { rows, nextCursor: hasMore ? rows[rows.length - 1]!.id : null };
  }

  /** The client user ids attached to an account, so the activation can invalidate their entitlements. */
  async accountClientUserIds(accountId: string): Promise<string[]> {
    const contacts = await this.prisma.accountContact.findMany({
      where: { accountId, deletedAt: null, userId: { not: null } },
      select: { userId: true },
    });
    return contacts.map((contact) => contact.userId).filter((id): id is string => id !== null);
  }

  /** Does a live client account exist? Guards a purchase against a bad or deleted account id. */
  async accountExists(accountId: string): Promise<boolean> {
    const account = await this.prisma.clientAccount.findFirst({
      where: { id: accountId, deletedAt: null },
      select: { id: true },
    });
    return account !== null;
  }

  /** Write the basic wedding details a purchase captured (§0a) onto the account (same CRM module). */
  async applyWeddingDetails(
    accountId: string,
    details: { coupleNames?: string; preferredLocations?: string },
    client: Prisma.TransactionClient,
  ): Promise<void> {
    const data: Prisma.ClientAccountUpdateInput = {};
    if (details.coupleNames !== undefined) data.coupleNames = details.coupleNames;
    if (details.preferredLocations !== undefined)
      data.preferredLocations = details.preferredLocations;
    if (Object.keys(data).length === 0) return;
    await client.clientAccount.update({ where: { id: accountId }, data });
  }

  /** On activation, move the account prospect → active (schema comment); only from prospect (idempotent). */
  async activateAccount(accountId: string, client: Prisma.TransactionClient): Promise<void> {
    await client.clientAccount.updateMany({
      where: { id: accountId, status: "prospect" },
      data: { status: "active" },
    });
  }
}
