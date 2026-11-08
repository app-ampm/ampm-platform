import { Module } from "@nestjs/common";

import { AppLogger } from "../../../common/logger.service.js";
import { ENV, type Env } from "../../../env.js";
import { PolicyModule } from "../../../policy/policy.module.js";
import { ConfigModule } from "../../admin/config/config.module.js";
import { NotificationModule } from "../../admin/notification/notification.module.js";
import { PaymentWebhookController } from "./payment-webhook.controller.js";
import { PaymentWebhookService } from "./payment-webhook.service.js";
import { PaymentsController } from "./payments.controller.js";
import { PaymentsService } from "./payments.service.js";
import {
  PAYMENT_ADAPTER,
  RazorpayPaymentAdapter,
  StubPaymentAdapter,
  type PaymentAdapter,
} from "./payment.adapter.js";
import { PaymentsRepository } from "./payments.repository.js";
import { PlansController } from "./plans.controller.js";
import { PlansRepository } from "./plans.repository.js";
import { PlansService } from "./plans.service.js";
import { PortalController } from "./portal.controller.js";
import { PortalService } from "./portal.service.js";
import { SubscriptionActivationService } from "./subscription-activation.service.js";
import { SubscriptionExpiryService } from "./subscription-expiry.service.js";
import { SubscriptionsController } from "./subscriptions.controller.js";
import { SubscriptionsRepository } from "./subscriptions.repository.js";
import { SubscriptionsService } from "./subscriptions.service.js";
import { WebhookEventsRepository } from "./webhook-events.repository.js";

/**
 * Module B — CRM subscriptions (feature 8.3): the public plan catalogue, the purchase that opens a
 * Razorpay order, the signed webhook and the Finance manual bank transfer that both run the one
 * activation step, and the expiry sweep. PolicyModule provides PrincipalService (to recompute
 * entitlements by invalidating the cache), ConfigModule the expiry notice window, NotificationModule
 * the client notices. The payment gateway is chosen by configuration: the in-process stub in
 * development/staging, Razorpay in production (env.ts refuses the stub there).
 */
@Module({
  imports: [NotificationModule, PolicyModule, ConfigModule],
  controllers: [
    PlansController,
    SubscriptionsController,
    PaymentWebhookController,
    PaymentsController,
    PortalController,
  ],
  providers: [
    PlansService,
    PlansRepository,
    SubscriptionsService,
    SubscriptionsRepository,
    PortalService,
    SubscriptionActivationService,
    SubscriptionExpiryService,
    PaymentsRepository,
    PaymentsService,
    WebhookEventsRepository,
    PaymentWebhookService,
    {
      provide: PAYMENT_ADAPTER,
      inject: [ENV, AppLogger],
      useFactory: (env: Env, logger: AppLogger): PaymentAdapter =>
        env.PAYMENT_PROVIDER === "razorpay" &&
        env.RAZORPAY_KEY_ID &&
        env.RAZORPAY_KEY_SECRET &&
        env.RAZORPAY_WEBHOOK_SECRET
          ? new RazorpayPaymentAdapter(
              env.RAZORPAY_KEY_ID,
              env.RAZORPAY_KEY_SECRET,
              env.RAZORPAY_WEBHOOK_SECRET,
              logger,
            )
          : new StubPaymentAdapter(),
    },
  ],
})
export class SubscriptionsModule {}
