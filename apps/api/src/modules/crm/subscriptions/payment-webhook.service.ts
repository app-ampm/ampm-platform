import { Inject, Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import { JobQueue } from "../../../jobs/job-queue.js";
import { PAYMENT_ADAPTER, type PaymentAdapter } from "./payment.adapter.js";
import {
  subscriptionActivationJob,
  SubscriptionActivationService,
} from "./subscription-activation.service.js";
import { WebhookEventsRepository } from "./webhook-events.repository.js";

/**
 * Ingests a provider webhook whose signature the controller has already verified (a bad signature is a
 * 401 that writes nothing — AC-02.6). It stores the raw event idempotently (a redelivery is a no-op —
 * AC-02.5) and then enqueues the idempotent activation job for a capture, or fails the payment for a
 * failure (AC-02.3). The durable work happens in the worker job, so the webhook returns fast (api.md).
 */
@Injectable()
export class PaymentWebhookService {
  constructor(
    private readonly webhookEvents: WebhookEventsRepository,
    private readonly activation: SubscriptionActivationService,
    private readonly jobs: JobQueue,
    @Inject(PAYMENT_ADAPTER) private readonly adapter: PaymentAdapter,
  ) {}

  async ingest(rawBody: Buffer, eventId: string | undefined): Promise<void> {
    const event = this.adapter.parseEvent(rawBody);
    const payload = JSON.parse(rawBody.toString("utf8")) as Prisma.InputJsonValue;
    // A deterministic dedupe key when the provider sends no event id, so a redelivery still de-dupes.
    const dedupeId =
      eventId ?? `${event.eventType}:${event.orderId ?? event.paymentId ?? "unknown"}`;
    const stored = await this.webhookEvents.store({
      provider: "razorpay",
      eventId: dedupeId,
      eventType: event.eventType,
      providerRef: event.orderId,
      payload,
    });
    if (!stored.id) return;
    // Re-drive an event that is still `received`: a fresh one, or a duplicate whose first processing
    // never ran (e.g. the enqueue failed before the job was created). A duplicate that already reached
    // a terminal status is a true redelivery and a no-op. The activation itself stays idempotent.
    if (stored.duplicate && stored.status !== "received") return;

    if (event.eventType === "payment.captured") {
      await this.jobs.enqueue(
        subscriptionActivationJob,
        { webhookEventId: stored.id },
        { idempotencyKey: `crm.subscription.activate.${event.orderId ?? stored.id}` },
      );
      return;
    }
    if (event.eventType === "payment.failed" && event.orderId) {
      await this.activation.failByProviderRef(event.orderId);
    }
    await this.webhookEvents.markProcessed(stored.id);
  }
}
