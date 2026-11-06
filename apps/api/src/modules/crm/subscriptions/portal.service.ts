import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import {
  errors,
  type DevCompletePaymentResponse,
  type SubscriptionCreateResponse,
} from "@ampm/core";

import { requestContext } from "../../../common/request-context.js";
import { PrismaService } from "../../../db/prisma.service.js";
import { ENV, type Env } from "../../../env.js";
import { AuditService } from "../../../policy/audit.service.js";
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
    await requestContext.run(
      {
        requestId: randomUUID(),
        ip: null,
        principal: { type: "system", name: "dev-payment" },
        access: null,
      },
      () =>
        this.activation.activateByProviderRef({
          providerRef,
          source: "gateway_webhook",
          actorId: null,
        }),
    );
    return { subscriptionId, status: "active" };
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
