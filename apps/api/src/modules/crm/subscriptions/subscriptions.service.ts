import { Inject, Injectable } from "@nestjs/common";
import {
  errors,
  type ManualPaymentRequest,
  type SubscriptionCreateRequest,
  type SubscriptionCreateResponse,
  type SubscriptionListQuery,
  type SubscriptionPage,
  type SubscriptionView,
} from "@ampm/core";

import { PrismaService } from "../../../db/prisma.service.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { AuditService } from "../../../policy/audit.service.js";
import { toClientMoney } from "./money.js";
import { PAYMENT_ADAPTER, type PaymentAdapter } from "./payment.adapter.js";
import { PaymentsRepository, type PaymentWriteData } from "./payments.repository.js";
import { PlansRepository, type PlanRow } from "./plans.repository.js";
import { SubscriptionActivationService } from "./subscription-activation.service.js";
import { SubscriptionsRepository, type SubscriptionRow } from "./subscriptions.repository.js";
import { toSubscriptionView } from "./subscriptions.view.js";

/**
 * Subscriptions (Module B CRM, feature 8.3). A purchase creates a `pending_payment` subscription, an
 * `initiated` payment and a gateway order for hosted checkout; the signed webhook (or a Finance manual
 * bank transfer, TW-14) then activates it through the shared activation step. The client self-purchase
 * screen (CP-11) defers, so the purchase route is staff-initiated (`crm.subscriptions.create`).
 */
@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly subscriptions: SubscriptionsRepository,
    private readonly payments: PaymentsRepository,
    private readonly plans: PlansRepository,
    private readonly activation: SubscriptionActivationService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_ADAPTER) private readonly adapter: PaymentAdapter,
  ) {}

  async create(
    request: SubscriptionCreateRequest,
    actorId: string,
  ): Promise<SubscriptionCreateResponse> {
    const plan = await this.plans.findActiveById(request.planId);
    if (!plan) throw errors.notFound("No such plan");
    if (!(await this.subscriptions.accountExists(request.accountId))) {
      throw errors.notFound("No such account");
    }
    // Reuse an existing pending subscription for this account + plan: a retried purchase (e.g. after an
    // earlier order call failed) picks it back up rather than orphaning or duplicating it.
    const subscriptionId =
      (await this.subscriptions.findPendingForAccountPlan(request.accountId, plan.id)) ??
      (await this.createPendingSubscription(request, plan, actorId));
    // The gateway order is a network call, kept outside the transaction; card data never touches AMPM.
    const order = await this.adapter.createOrder({
      amountMinor: toClientMoney(plan.priceAmount).minor,
      currency: plan.currency,
      receipt: subscriptionId,
    });
    await this.recordPayment(
      gatewayPaymentData(request.accountId, subscriptionId, plan, order.orderId, actorId),
    );
    return {
      subscriptionId,
      status: "pending_payment",
      order: {
        provider: "razorpay",
        orderId: order.orderId,
        amount: toClientMoney(plan.priceAmount),
        keyId: order.keyId,
      },
    };
  }

  /** Create the pending subscription and record any basic wedding details (§0a) in one transaction. */
  private async createPendingSubscription(
    request: SubscriptionCreateRequest,
    plan: PlanRow,
    actorId: string,
  ): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const id = await this.subscriptions.create(
        {
          accountId: request.accountId,
          planId: plan.id,
          status: "pending_payment",
          createdBy: actorId,
        },
        tx,
      );
      if (request.weddingDetails) {
        await this.subscriptions.applyWeddingDetails(request.accountId, request.weddingDetails, tx);
      }
      return id;
    });
  }

  /**
   * Create a payment and its audit in one transaction — payments are RESTRICTED-FINANCE records, so
   * every create and change is audited with before/after (permission-matrix §9); this is the codebase's
   * first finance-table audit.
   */
  private async recordPayment(data: PaymentWriteData): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const paymentId = await this.payments.create(data, tx);
      await this.audit.record(
        {
          action: "create",
          entityType: "payment",
          entityId: paymentId,
          after: {
            status: data.status,
            purpose: data.purpose,
            method: data.method,
            amount: data.amount.toString(),
          },
        },
        tx,
      );
    });
  }

  /**
   * Record a manual bank transfer against a pending subscription (TW-14, Finance), then run the same
   * activation step as the webhook (AC-02.4). The amount comes from the plan, not the request. Runs in
   * the Finance user's request, so the activation audit attributes to them.
   */
  async recordManualPayment(
    subscriptionId: string,
    request: ManualPaymentRequest,
    actorId: string,
  ): Promise<SubscriptionView> {
    const sub = await this.subscriptions.findById(subscriptionId);
    if (!sub) throw errors.notFound("No such subscription");
    if (sub.status !== "pending_payment") {
      throw errors.conflict("This subscription is not awaiting payment");
    }
    const plan = await this.plans.findActiveById(sub.planId);
    if (!plan) throw errors.conflict("The subscription's plan is no longer available");
    const providerRef = `manual_${subscriptionId}`;
    try {
      await this.recordPayment(manualPaymentData(sub, plan, providerRef, request, actorId));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw errors.conflict("A manual payment is already recorded for this subscription");
      }
      throw error;
    }
    await this.activation.activateByProviderRef({ providerRef, source: "manual", actorId });
    const updated = await this.subscriptions.findById(subscriptionId);
    if (!updated) throw errors.notFound("No such subscription");
    return toSubscriptionView(updated);
  }

  async list(query: SubscriptionListQuery): Promise<SubscriptionPage> {
    const { rows, nextCursor } = await this.subscriptions.list(
      { accountId: query.accountId, status: query.status },
      query.limit,
      query.cursor,
    );
    return { items: rows.map(toSubscriptionView), nextCursor };
  }

  async get(subscriptionId: string): Promise<SubscriptionView> {
    const row = await this.subscriptions.findById(subscriptionId);
    if (!row) throw errors.notFound("No such subscription");
    return toSubscriptionView(row);
  }
}

/** The inbound, client-visible gateway payment a purchase records (initiated until the webhook lands). */
function gatewayPaymentData(
  accountId: string,
  subscriptionId: string,
  plan: PlanRow,
  orderId: string,
  actorId: string,
): PaymentWriteData {
  return {
    accountId,
    direction: "inbound",
    counterpartyType: "client",
    purpose: "subscription",
    relatedType: "subscription",
    relatedId: subscriptionId,
    amount: plan.priceAmount,
    currency: plan.currency,
    method: "gateway",
    provider: "razorpay",
    providerRef: orderId,
    status: "initiated",
    paidAt: null,
    recordedBy: null,
    clientVisible: true,
    createdBy: actorId,
  };
}

/** The inbound, client-visible manual payment Finance records (already succeeded, off-gateway). */
function manualPaymentData(
  sub: SubscriptionRow,
  plan: PlanRow,
  providerRef: string,
  request: ManualPaymentRequest,
  actorId: string,
): PaymentWriteData {
  return {
    accountId: sub.accountId,
    direction: "inbound",
    counterpartyType: "client",
    purpose: "subscription",
    relatedType: "subscription",
    relatedId: sub.id,
    amount: plan.priceAmount,
    currency: plan.currency,
    method: request.method,
    provider: null,
    providerRef,
    status: "succeeded",
    paidAt: request.paidAt ? new Date(request.paidAt) : new Date(),
    recordedBy: actorId,
    clientVisible: true,
    createdBy: actorId,
  };
}
