import { randomUUID } from "node:crypto";

import { Injectable, type OnModuleInit } from "@nestjs/common";
import { uuid } from "@ampm/core";
import { z } from "zod";

import { AppLogger } from "../../../common/logger.service.js";
import { requestContext, type RequestContext } from "../../../common/request-context.js";
import { PrismaService } from "../../../db/prisma.service.js";
import type { ActivationSource, Prisma } from "../../../generated/prisma/client.js";
import { JobQueue } from "../../../jobs/job-queue.js";
import { defineJob } from "../../../jobs/job.types.js";
import { AuditService } from "../../../policy/audit.service.js";
import { PrincipalService } from "../../../policy/principal.service.js";
import type { Principal } from "../../../policy/principal.types.js";
import { NotificationService } from "../../admin/notification/notification.service.js";
import { PaymentsRepository } from "./payments.repository.js";
import { PlansRepository } from "./plans.repository.js";
import { SubscriptionsRepository } from "./subscriptions.repository.js";
import { WebhookEventsRepository } from "./webhook-events.repository.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The worker job runs as the system principal, so the activation audit attributes to SYS (AC-21). */
const SYSTEM_PRINCIPAL: Principal = { type: "system", name: "subscription-activation" };

/**
 * The webhook activation job (dead-letter after 5, §9). The payload carries only the stored event's id
 * — nothing in Redis is the only copy — and the handler reads the event to find the gateway reference.
 */
export const subscriptionActivationJob = defineJob(
  "crm.subscription.activate",
  z.object({ webhookEventId: uuid }),
  { attempts: 5 },
);

export interface ActivationResult {
  readonly activated: boolean;
  readonly accountId: string | null;
  readonly subscriptionId: string | null;
}

interface ActivationInput {
  readonly providerRef: string;
  readonly source: ActivationSource;
  readonly actorId: string | null;
}

/**
 * Activates a subscription once its payment has succeeded — the single step both the signed webhook and
 * the Finance manual bank transfer run (AC-02.4). Idempotent by construction: the `pending_payment`
 * guard inside the transaction means a duplicate webhook updates zero rows, so exactly one activation,
 * audit and notification happen whatever the number of deliveries (AC-02.5). Entitlements are computed,
 * never stored, so "recompute entitlements" is simply invalidating the ≤5-minute cache after commit.
 */
@Injectable()
export class SubscriptionActivationService implements OnModuleInit {
  constructor(
    private readonly subscriptions: SubscriptionsRepository,
    private readonly payments: PaymentsRepository,
    private readonly plans: PlansRepository,
    private readonly webhookEvents: WebhookEventsRepository,
    private readonly audit: AuditService,
    private readonly principals: PrincipalService,
    private readonly notifications: NotificationService,
    private readonly prisma: PrismaService,
    private readonly jobs: JobQueue,
    private readonly logger: AppLogger,
  ) {}

  onModuleInit(): void {
    this.jobs.register(
      subscriptionActivationJob,
      (payload) => this.runWebhookActivation(payload.webhookEventId),
      (payload) =>
        this.webhookEvents.markFailed(payload.webhookEventId, "activation failed after retries"),
    );
  }

  /** The job body: activate from the stored event as the system principal, recording a job_runs row. */
  async runWebhookActivation(webhookEventId: string): Promise<void> {
    await this.recordRun(`${subscriptionActivationJob.name}.${webhookEventId}`, async () => {
      const event = await this.webhookEvents.findById(webhookEventId);
      if (!event) return;
      const providerRef = event.providerRef;
      if (providerRef) {
        await requestContext.run(this.systemContext(), () =>
          this.activateByProviderRef({ providerRef, source: "gateway_webhook", actorId: null }),
        );
      }
      await this.webhookEvents.markProcessed(webhookEventId);
    });
  }

  /** A failed-payment event: mark the payment failed; the subscription stays pending_payment (AC-02.3). */
  async failByProviderRef(providerRef: string): Promise<void> {
    await requestContext.run(this.systemContext(), () =>
      this.prisma.$transaction(async (tx) => {
        const payment = await this.payments.findByProviderRef(providerRef, tx);
        if (payment && payment.status !== "succeeded") {
          await this.payments.markFailed(payment.id, tx);
          await this.audit.record(
            {
              action: "update",
              entityType: "payment",
              entityId: payment.id,
              before: { status: payment.status },
              after: { status: "failed" },
            },
            tx,
          );
        }
      }),
    );
  }

  async activateByProviderRef(input: ActivationInput): Promise<ActivationResult> {
    const now = new Date();
    const result = await this.prisma.$transaction((tx) => this.activateInTx(input, now, tx));
    if (result.activated && result.accountId) await this.afterActivation(result.accountId);
    return result;
  }

  private async activateInTx(
    input: ActivationInput,
    now: Date,
    tx: Prisma.TransactionClient,
  ): Promise<ActivationResult> {
    const none: ActivationResult = { activated: false, accountId: null, subscriptionId: null };
    const payment = await this.payments.findByProviderRef(input.providerRef, tx);
    if (!payment || !payment.relatedId) return none;
    const sub = await this.subscriptions.loadForActivation(payment.relatedId, tx);
    if (!sub) return none;
    if (payment.status !== "succeeded") await this.markPaymentSucceeded(payment, now, tx);
    if (sub.status !== "pending_payment") return none;
    const termDays = await this.plans.termDaysById(sub.planId, tx);
    const endsAt = termDays != null ? new Date(now.getTime() + termDays * DAY_MS) : null;
    const count = await this.subscriptions.activate(
      payment.relatedId,
      { startsAt: now, endsAt, activationSource: input.source, activatedByUserId: input.actorId },
      tx,
    );
    if (count !== 1) return none;
    await this.subscriptions.activateAccount(sub.accountId, tx);
    await this.audit.record(
      {
        action: "update",
        entityType: "subscription",
        entityId: payment.relatedId,
        before: { status: "pending_payment" },
        after: { status: "active", activationSource: input.source },
      },
      tx,
    );
    return { activated: true, accountId: sub.accountId, subscriptionId: payment.relatedId };
  }

  /** Mark a payment succeeded and audit the transition (payments are RESTRICTED-FINANCE, §9). */
  private async markPaymentSucceeded(
    payment: { id: string; status: string },
    now: Date,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await this.payments.markSucceeded(payment.id, now, tx);
    await this.audit.record(
      {
        action: "update",
        entityType: "payment",
        entityId: payment.id,
        before: { status: payment.status },
        after: { status: "succeeded" },
      },
      tx,
    );
  }

  /** After commit: recompute entitlements (bust the cache) and send the client an in-app confirmation. */
  private async afterActivation(accountId: string): Promise<void> {
    const userIds = await this.subscriptions.accountClientUserIds(accountId);
    for (const userId of userIds) {
      this.principals.invalidateEntitlements(userId);
      await this.notify(userId, "subscription.activated");
    }
  }

  private async notify(userId: string, key: string): Promise<void> {
    try {
      await this.notifications.queue({
        recipientType: "user",
        recipientId: userId,
        channel: "in_app",
        eventType: key,
        templateKey: key,
        entityType: "user",
        entityId: userId,
      });
    } catch (error) {
      this.logger.warn("crm.subscription.notice_failed", { key, error: String(error) });
    }
  }

  private systemContext(): RequestContext {
    // A fresh request id per run (≤ the audit_events.request_id 64-char column), as the middleware does.
    return { requestId: randomUUID(), ip: null, principal: SYSTEM_PRINCIPAL, access: null };
  }

  private async recordRun<T>(idempotencyKey: string, fn: () => Promise<T>): Promise<T> {
    const run = await this.prisma.jobRun.create({
      data: { jobName: subscriptionActivationJob.name, idempotencyKey, startedAt: new Date() },
    });
    try {
      const value = await fn();
      await this.prisma.jobRun.update({
        where: { id: run.id },
        data: { status: "succeeded", finishedAt: new Date() },
      });
      return value;
    } catch (error) {
      await this.prisma.jobRun.update({
        where: { id: run.id },
        data: { status: "failed", error: String(error).slice(0, 1024), finishedAt: new Date() },
      });
      throw error;
    }
  }
}
