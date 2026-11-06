import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../db/prisma.service.js";
import {
  Prisma,
  type PaymentCounterpartyType,
  type PaymentDirection,
  type PaymentMethod,
  type PaymentPurpose,
  type PaymentStatus,
} from "../../../generated/prisma/client.js";

/** A payment as Finance reads it. The client receipt view selects a narrower set (payments.view.ts). */
export interface PaymentRow {
  readonly id: string;
  readonly accountId: string;
  readonly direction: PaymentDirection;
  readonly purpose: PaymentPurpose;
  readonly amount: Prisma.Decimal;
  readonly currency: string;
  readonly method: PaymentMethod;
  readonly status: PaymentStatus;
  readonly provider: string | null;
  readonly providerRef: string | null;
  readonly relatedType: string | null;
  readonly relatedId: string | null;
  readonly paidAt: Date | null;
  readonly recordedBy: string | null;
  readonly createdAt: Date;
}

export interface PaymentWriteData {
  readonly accountId: string;
  readonly direction: PaymentDirection;
  readonly counterpartyType: PaymentCounterpartyType;
  readonly purpose: PaymentPurpose;
  readonly relatedType: string;
  readonly relatedId: string;
  readonly amount: Prisma.Decimal;
  readonly currency: string;
  readonly method: PaymentMethod;
  readonly provider: string | null;
  readonly providerRef: string;
  readonly status: PaymentStatus;
  readonly paidAt: Date | null;
  readonly recordedBy: string | null;
  readonly clientVisible: boolean;
  readonly createdBy: string | null;
}

export interface PaymentListFilters {
  readonly accountId?: string | undefined;
}

const PAYMENT_FIELDS = {
  id: true,
  accountId: true,
  direction: true,
  purpose: true,
  amount: true,
  currency: true,
  method: true,
  status: true,
  provider: true,
  providerRef: true,
  relatedType: true,
  relatedId: true,
  paidAt: true,
  recordedBy: true,
  createdAt: true,
} as const;

type SelectedPayment = Prisma.PaymentGetPayload<{ select: typeof PAYMENT_FIELDS }>;

function toRow(payment: SelectedPayment): PaymentRow {
  return { ...payment };
}

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: PaymentWriteData, client: Prisma.TransactionClient): Promise<string> {
    const payment = await client.payment.create({ data, select: { id: true } });
    return payment.id;
  }

  /** The payment behind a gateway reference (the webhook idempotency anchor); for the activation job. */
  async findByProviderRef(
    providerRef: string,
    client: Prisma.TransactionClient,
  ): Promise<{ id: string; status: PaymentStatus; relatedId: string | null } | null> {
    return client.payment.findFirst({
      where: { providerRef },
      select: { id: true, status: true, relatedId: true },
    });
  }

  async markSucceeded(id: string, paidAt: Date, client: Prisma.TransactionClient): Promise<void> {
    await client.payment.update({ where: { id }, data: { status: "succeeded", paidAt } });
  }

  /** The gateway order reference recorded for a subscription's purchase — the dev stub completion anchor. */
  async gatewayRefForSubscription(subscriptionId: string): Promise<string | null> {
    const payment = await this.prisma.payment.findFirst({
      where: {
        relatedType: "subscription",
        relatedId: subscriptionId,
        method: "gateway",
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: { providerRef: true },
    });
    return payment?.providerRef ?? null;
  }

  async markFailed(id: string, client: Prisma.TransactionClient): Promise<void> {
    await client.payment.update({ where: { id }, data: { status: "failed" } });
  }

  async list(
    filters: PaymentListFilters,
    limit: number,
    cursor?: string,
  ): Promise<{ rows: PaymentRow[]; nextCursor: string | null }> {
    const where: Prisma.PaymentWhereInput = { deletedAt: null };
    if (filters.accountId) where.accountId = filters.accountId;
    const payments = await this.prisma.payment.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: PAYMENT_FIELDS,
    });
    const hasMore = payments.length > limit;
    const rows = (hasMore ? payments.slice(0, limit) : payments).map(toRow);
    return { rows, nextCursor: hasMore ? rows[rows.length - 1]!.id : null };
  }
}
