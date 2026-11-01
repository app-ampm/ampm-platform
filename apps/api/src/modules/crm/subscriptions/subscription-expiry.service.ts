import { randomUUID } from "node:crypto";

import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { z } from "zod";

import { AppLogger } from "../../../common/logger.service.js";
import { requestContext, type RequestContext } from "../../../common/request-context.js";
import { PrismaService } from "../../../db/prisma.service.js";
import { ENV, type Env } from "../../../env.js";
import { JobQueue } from "../../../jobs/job-queue.js";
import { defineJob } from "../../../jobs/job.types.js";
import { AuditService } from "../../../policy/audit.service.js";
import { PrincipalService } from "../../../policy/principal.service.js";
import type { Principal } from "../../../policy/principal.types.js";
import { ConfigService } from "../../admin/config/config.service.js";
import { NotificationService } from "../../admin/notification/notification.service.js";
import { SubscriptionsRepository } from "./subscriptions.repository.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const SYSTEM_PRINCIPAL: Principal = { type: "system", name: "subscription-expiry" };

/** The subscription expiry sweep (§8, AC-02.7): active → expiring at the notice window, → expired at term end. */
export const subscriptionExpiryJob = defineJob("crm.subscription.expiry_sweep", z.object({}));

/**
 * Moves subscriptions through their term's end. Scheduled hourly in the worker (inline/on-demand in
 * dev and tests). It changes status only — it deletes nothing (AC-02.7) — and "removes the subscription
 * modules" happens for free: entitlements are computed from the status, so an `expired` subscription
 * resolves to the lapsed source on the next request once its account's cache is invalidated.
 */
@Injectable()
export class SubscriptionExpiryService implements OnModuleInit {
  constructor(
    private readonly subscriptions: SubscriptionsRepository,
    private readonly audit: AuditService,
    private readonly principals: PrincipalService,
    private readonly notifications: NotificationService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jobs: JobQueue,
    private readonly logger: AppLogger,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async onModuleInit(): Promise<void> {
    this.jobs.register(subscriptionExpiryJob, async () => {
      await this.runSweep();
    });
    if (this.env.JOB_WORKER) {
      await this.jobs.scheduleRepeatable(subscriptionExpiryJob, "0 * * * *", {});
    }
  }

  async runSweep(now: Date = new Date()): Promise<{ expiring: number; expired: number }> {
    const { expiryNoticeDays } = await this.config.get("subscription.policy");
    const noticeBefore = new Date(now.getTime() + expiryNoticeDays * DAY_MS);
    return requestContext.run(this.systemContext(), async () => {
      const expired = await this.markExpired(now);
      const expiring = await this.markExpiring(now, noticeBefore);
      if (expired + expiring > 0) {
        this.logger.info("crm.subscription.expiry_sweep", { expiring, expired });
      }
      return { expiring, expired };
    });
  }

  /** Past the term end: active|expiring → expired; this removes the subscription's entitlements. */
  private async markExpired(now: Date): Promise<number> {
    const due = await this.subscriptions.findDueForExpiry(now);
    for (const ref of due) {
      await this.prisma.$transaction(async (tx) => {
        const count = await this.subscriptions.transition(
          ref.id,
          ["active", "expiring"],
          "expired",
          tx,
        );
        if (count === 1) {
          await this.audit.record(
            {
              action: "update",
              entityType: "subscription",
              entityId: ref.id,
              after: { status: "expired" },
            },
            tx,
          );
        }
      });
      await this.afterChange(ref.accountId, "subscription.expired", true);
    }
    return due.length;
  }

  /** Inside the notice window: active → expiring; access is retained, so only notify (no cache bust). */
  private async markExpiring(now: Date, noticeBefore: Date): Promise<number> {
    const due = await this.subscriptions.findDueForExpiringNotice(now, noticeBefore);
    for (const ref of due) {
      await this.prisma.$transaction(async (tx) => {
        const count = await this.subscriptions.transition(ref.id, ["active"], "expiring", tx);
        if (count === 1) {
          await this.audit.record(
            {
              action: "update",
              entityType: "subscription",
              entityId: ref.id,
              after: { status: "expiring" },
            },
            tx,
          );
        }
      });
      await this.afterChange(ref.accountId, "subscription.expiring", false);
    }
    return due.length;
  }

  private async afterChange(accountId: string, key: string, invalidate: boolean): Promise<void> {
    const userIds = await this.subscriptions.accountClientUserIds(accountId);
    for (const userId of userIds) {
      if (invalidate) this.principals.invalidateEntitlements(userId);
      await this.notify(userId, key);
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
    return { requestId: randomUUID(), ip: null, principal: SYSTEM_PRINCIPAL, access: null };
  }
}
