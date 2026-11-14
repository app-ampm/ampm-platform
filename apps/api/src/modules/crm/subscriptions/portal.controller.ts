import { Controller, HttpCode, Post } from "@nestjs/common";
import {
  devCompletePaymentRequest,
  errors,
  portalSubscriptionCreateRequest,
  portalVerifyPaymentRequest,
  type DevCompletePaymentRequest,
  type DevCompletePaymentResponse,
  type PortalSubscriptionCreateRequest,
  type PortalVerifyPaymentRequest,
  type PortalVerifyPaymentResponse,
  type SubscriptionCreateResponse,
} from "@ampm/core";

import { RateLimit } from "../../../common/rate-limit/rate-limit.decorator.js";
import { ZodBody } from "../../../common/zod.js";
import { AuditExempt, CurrentPrincipal, SelfAudited } from "../../../policy/decorators.js";
import type { Principal } from "../../../policy/principal.types.js";
import { PortalService } from "./portal.service.js";

/**
 * The client portal (feature CP-11). A signed-in client buys a plan for their OWN account — the account
 * is derived from the principal, never the request — then completes the payment: Razorpay's hosted
 * checkout posts its result back to verify-payment (signature verified server-side), or, dev-only with the
 * stub gateway, complete-payment finishes it directly. complete-payment is refused outside a stub,
 * non-production config.
 */
@Controller("crm/portal")
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  @Post("subscriptions")
  @HttpCode(201)
  @SelfAudited()
  subscribe(
    @ZodBody(portalSubscriptionCreateRequest) body: PortalSubscriptionCreateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<SubscriptionCreateResponse> {
    if (principal.type !== "client") throw errors.notFound(); // denial equals absence
    return this.portal.subscribe(principal.userId, body.planId);
  }

  @Post("complete-payment")
  @HttpCode(200)
  @AuditExempt(
    "dev-only stub payment completion for the caller's own subscription; the activation step self-audits as the system principal, and the route is refused unless PAYMENT_PROVIDER=stub and NODE_ENV is not production",
  )
  completePayment(
    @ZodBody(devCompletePaymentRequest) body: DevCompletePaymentRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<DevCompletePaymentResponse> {
    if (principal.type !== "client") throw errors.notFound();
    return this.portal.completePayment(principal.userId, body.subscriptionId);
  }

  @Post("verify-payment")
  @HttpCode(200)
  @RateLimit({ name: "crm.portal.verify-payment", limit: 30, windowMs: 60_000 })
  @AuditExempt(
    "client posts back Razorpay's checkout result for their OWN subscription; the signature is verified server-side and the activation step self-audits as the system principal — the same record the webhook writes",
  )
  verifyPayment(
    @ZodBody(portalVerifyPaymentRequest) body: PortalVerifyPaymentRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<PortalVerifyPaymentResponse> {
    if (principal.type !== "client") throw errors.notFound(); // denial equals absence
    return this.portal.verifyPayment(principal.userId, body);
  }
}
