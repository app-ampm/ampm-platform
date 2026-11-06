import {
  Controller,
  Headers,
  HttpCode,
  Inject,
  Post,
  Req,
  type RawBodyRequest,
} from "@nestjs/common";
import { errors } from "@ampm/core";
import type { Request } from "express";

import { RateLimit } from "../../../common/rate-limit/rate-limit.decorator.js";
import { AuditExempt, Public } from "../../../policy/decorators.js";
import { PaymentWebhookService } from "./payment-webhook.service.js";
import { PAYMENT_ADAPTER, type PaymentAdapter } from "./payment.adapter.js";

/**
 * The payment gateway webhook (feature 8.3). Authenticated by the provider's signature, not a session,
 * so it is `@Public()` and rate-limited (architecture §6 step 1). The signature is verified at the edge
 * over the RAW request bytes — a bad or absent signature is a 401 that writes nothing (AC-02.6) — and
 * only then is the event stored and an idempotent activation job enqueued. Audited through the stored
 * event and the activation's own audit, so the route itself is `@AuditExempt`.
 */
@Controller("crm")
export class PaymentWebhookController {
  constructor(
    @Inject(PAYMENT_ADAPTER) private readonly adapter: PaymentAdapter,
    private readonly webhook: PaymentWebhookService,
  ) {}

  @Post("webhooks/razorpay")
  @Public()
  @RateLimit({ name: "crm.webhook.razorpay", limit: 120, windowMs: 60_000 })
  @AuditExempt(
    "provider webhook authenticated by signature; the stored event and the activation audit are the record",
  )
  @HttpCode(200)
  async razorpay(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-razorpay-signature") signature: string | undefined,
    @Headers("x-razorpay-event-id") eventId: string | undefined,
  ): Promise<{ received: true }> {
    const rawBody = req.rawBody;
    if (!rawBody || !this.adapter.verifyWebhookSignature(rawBody, signature)) {
      throw errors.unauthenticated("invalid webhook signature");
    }
    await this.webhook.ingest(rawBody, eventId);
    return { received: true };
  }
}
