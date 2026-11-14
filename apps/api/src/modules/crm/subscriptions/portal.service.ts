import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import {
  errors,
  type DevCompletePaymentResponse,
  type PortalVerifyPaymentRequest,
  type PortalVerifyPaymentResponse,
  type SubscriptionCreateResponse,
} from "@ampm/core";

import { requestContext, type RequestContext } from "../../../common/request-context.js";
import { PrismaService } from "../../../db/prisma.service.js";
import { ENV, type Env } from "../../../env.js";
import { AuditService } from "../../../policy/audit.service.js";
import { PAYMENT_ADAPTER, type PaymentAdapter } from "./payment.adapter.js";
import { PaymentsRepository } from "./payments.repository.js";
import { SubscriptionActivationService } from "./subscription-activation.service.js";
import { SubscriptionsRepository } from "./subscriptions.repository.js";
import { SubscriptionsService } from "./subscriptions.service.js";

/**
 * The client portal (feature CP-11). `subscribe` lets a signed-in client start a purchase for their OWN
 * account — the account is derived from the principal, never the request body (security.md) — and audits
 * the subscription create as the client (the staff route's interceptor audit does not fire for a client
 * principal). `completePayment` is a development-only convenience that finishes a stub gateway payment for
 * the caller's own pending subscription by running the real activation step as the system principal. It is
 * refused unless the stub gateway is active and NODE_ENV is not production (fail-closed, like dev-login).
 */
@Injectable()
export class PortalService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(PAYMENT_ADAPTER) private readonly adapter: PaymentAdapter,
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly subscriptions: SubscriptionsRepository,
    private readonly activation: SubscriptionActivationService,
    private readonly payments: PaymentsRepository,
    private readonly audit: AuditService,
  ) {}

  async subscribe(userId: string, planId: string): Promise<SubscriptionCreateResponse> {
    const accountId = await this.accountIdForUser(userId);
    const result = await this.subscriptionsService.create({ accountId, planId }, userId);
    // The staff purchase audits the subscription create via the interceptor, which does not fire for a
    // client principal — so the client self-purchase audits its own subscription create here (§9).
    await this.audit.record({
      action: "create",
      entityType: "subscription",
      entityId: result.subscriptionId,
      after: { status: result.status },
    });
    return result;
  }

  async completePayment(
    userId: string,
    subscriptionId: string,
  ): Promise<DevCompletePaymentResponse> {
    // Fail-closed, like dev-login: without the stub gateway, or in production, this endpoint does not exist.
    if (this.env.PAYMENT_PROVIDER !== "stub" || this.env.NODE_ENV === "production") {
      throw errors.notFound();
    }
    // Scope to the caller's OWN subscription — never complete an arbitrary account's payment.
    const accountId = await this.accountIdForUser(userId);
    const sub = await this.subscriptions.findById(subscriptionId);
    if (!sub || sub.accountId !== accountId) throw errors.notFound();
    const providerRef = await this.payments.gatewayRefForSubscription(subscriptionId);
    if (!providerRef) throw errors.notFound("No pending gateway payment for this subscription");
    // Run as the system principal, exactly as the webhook job does, so the activation audit attributes to SYS.
    await requestContext.run(this.systemContext("dev-payment"), () =>
      this.activation.activateByProviderRef({
        providerRef,
        source: "gateway_webhook",
        actorId: null,
      }),
    );
    return { subscriptionId, status: "active" };
  }

  /**
   * Confirm a Razorpay hosted-checkout payment for the caller's OWN pending subscription (CP-11): verify
   * the checkout signature, then run the same activation the webhook runs. Idempotent — a webhook that
   * already activated this order makes the activation a no-op — and scoped to the caller's own account.
   */
  async verifyPayment(
    userId: string,
    request: PortalVerifyPaymentRequest,
  ): Promise<PortalVerifyPaymentResponse> {
    const accountId = await this.accountIdForUser(userId);
    const sub = await this.subscriptions.findById(request.subscriptionId);
    if (!sub || sub.accountId !== accountId) throw errors.notFound(); // denial equals absence
    const providerRef = await this.verifiedOrderRef(request);
    await requestContext.run(this.systemContext("portal-payment"), () =>
      this.activation.activateByProviderRef({
        providerRef,
        source: "gateway_webhook",
        actorId: null,
      }),
    );
    const updated = await this.subscriptions.findById(request.subscriptionId);
    return { subscriptionId: request.subscriptionId, status: updated?.status ?? sub.status };
  }

  /**
   * The verified gateway order reference for a verify request: the order recorded for this subscription,
   * whose id the caller echoed back and whose checkout signature is genuine. A mismatched order id or a
   * bad signature is a 400 that activates nothing (do NOT mark as paid) — fail-closed, like the webhook.
   */
  private async verifiedOrderRef(request: PortalVerifyPaymentRequest): Promise<string> {
    const providerRef = await this.payments.gatewayRefForSubscription(request.subscriptionId);
    if (!providerRef || providerRef !== request.razorpayOrderId) {
      throw errors.validation(
        [{ path: "razorpayOrderId", message: "Does not match this subscription's order" }],
        "Invalid payment",
      );
    }
    if (
      !this.adapter.verifyCheckoutSignature(
        request.razorpayOrderId,
        request.razorpayPaymentId,
        request.razorpaySignature,
      )
    ) {
      throw errors.validation(
        [{ path: "razorpaySignature", message: "Signature verification failed" }],
        "Invalid payment signature",
      );
    }
    return providerRef;
  }

  /** A system-principal request context (a fresh request id), so an activation audits as SYS (AC-21). */
  private systemContext(name: string): RequestContext {
    return { requestId: randomUUID(), ip: null, principal: { type: "system", name }, access: null };
  }

  /** The client's own account, derived from their contact row — never trusted from the request. */
  private async accountIdForUser(userId: string): Promise<string> {
    const contact = await this.prisma.accountContact.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { accountId: true },
    });
    if (!contact) throw errors.notFound(); // no account for this client → denial equals absence
    return contact.accountId;
  }
}
