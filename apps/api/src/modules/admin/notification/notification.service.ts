import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import {
  errors,
  notificationView,
  page,
  uuid,
  type NotificationChannel,
  type NotificationStatus,
  type NotificationView,
  type RecipientType,
} from "@ampm/core";
import type { Scope } from "@ampm/policy";
import { z } from "zod";

import { recordScope } from "../../../db/scoping.js";
import { JobQueue } from "../../../jobs/job-queue.js";
import { defineJob } from "../../../jobs/job.types.js";
import type { Principal } from "../../../policy/principal.types.js";
import { NOTIFICATION_ADAPTER, type NotificationAdapter } from "./notification.adapter.js";
import {
  NotificationRepository,
  type NotificationRow,
  type StatusPatch,
} from "./notification.repository.js";

/** The send job: loads the row and delivers it. The payload carries only the id (nothing in Redis is the only copy). */
export const sendNotificationJob = defineJob(
  "notification.send",
  z.object({ notificationId: uuid }),
);

/** What a caller asks to notify someone of; `eventType` keys the per-user channel preference. */
export interface QueueNotification {
  readonly recipientType: RecipientType;
  readonly recipientId: string;
  readonly channel: NotificationChannel;
  readonly eventType: string;
  readonly templateKey: string;
  readonly entityType?: string | null;
  readonly entityId?: string | null;
}

export type QueueResult = { suppressed: true } | { suppressed: false; notificationId: string };

interface NotificationList {
  readonly items: NotificationView[];
  readonly nextCursor: string | null;
}

/** The mechanics the status may move through; a notification is not a policy-governed transition (§7). */
const ADVANCES: Record<NotificationStatus, readonly NotificationStatus[]> = {
  queued: ["sent", "delivered", "failed"],
  sent: ["delivered", "failed"],
  delivered: ["read"],
  failed: [],
  read: [],
};

function canAdvance(from: NotificationStatus, to: NotificationStatus): boolean {
  return ADVANCES[from].includes(to);
}

function renderBody(templateKey: string): string {
  // Sprint 3: a trivial renderer; per-channel, localised templates land in sprint 5.
  return `[${templateKey}]`;
}

function toView(row: NotificationRow): NotificationView {
  return {
    id: row.id,
    channel: row.channel,
    templateKey: row.templateKey,
    status: row.status,
    entityType: row.entityType,
    entityId: row.entityId,
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
  };
}

/**
 * Module A notifications. `queue` applies the recipient's channel preference, writes a `queued`
 * row and enqueues the send job; the job renders the message, delivers an in-app notification by
 * marking it delivered (the readable row is the delivery) and every other channel through the
 * provider-neutral adapter, advancing the status. Idempotent: the send job is keyed on the row id
 * and only ever runs on a still-`queued` row, so a replay is a no-op (D-031).
 *
 * @example
 * await this.notifications.queue({ recipientType: "user", recipientId, channel: "in_app",
 *   eventType: "enquiry.updated", templateKey: "enquiry.updated", entityType: "hotel_enquiry", entityId });
 */
@Injectable()
export class NotificationService implements OnModuleInit {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly jobs: JobQueue,
    @Inject(NOTIFICATION_ADAPTER) private readonly adapter: NotificationAdapter,
  ) {}

  onModuleInit(): void {
    this.jobs.register(sendNotificationJob, (payload) => this.deliver(payload.notificationId));
  }

  async queue(input: QueueNotification): Promise<QueueResult> {
    if (
      input.recipientType === "user" &&
      !(await this.repository.isChannelEnabled(input.recipientId, input.eventType, input.channel))
    ) {
      return { suppressed: true };
    }
    const row = await this.repository.create({
      recipientType: input.recipientType,
      recipientId: input.recipientId,
      channel: input.channel,
      templateKey: input.templateKey,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    });
    await this.jobs.enqueue(
      sendNotificationJob,
      { notificationId: row.id },
      { idempotencyKey: `notification.send:${row.id}` },
    );
    return { suppressed: false, notificationId: row.id };
  }

  async listOwn(
    principal: Principal,
    scope: Scope,
    query: { limit: number; cursor?: string },
  ): Promise<NotificationList> {
    const result = await this.repository.listForRecipient(
      recordScope(principal, scope),
      query.limit,
      query.cursor,
    );
    return page(notificationView).parse({
      items: result.rows.map(toView),
      nextCursor: result.nextCursor,
    });
  }

  private async deliver(notificationId: string): Promise<void> {
    const row = await this.repository.findById(notificationId);
    if (!row || row.status !== "queued") return;
    if (row.channel === "in_app") {
      await this.advance(row, { status: "delivered", deliveredAt: new Date() });
      return;
    }
    const result = await this.adapter.send({
      channel: row.channel,
      recipientType: row.recipientType,
      recipientId: row.recipientId,
      templateKey: row.templateKey,
      body: renderBody(row.templateKey),
    });
    await this.advance(row, {
      status: "sent",
      providerRef: result.providerRef,
      sentAt: new Date(),
    });
  }

  private async advance(row: NotificationRow, patch: StatusPatch): Promise<void> {
    if (!canAdvance(row.status, patch.status)) {
      throw errors.conflict(`notification ${row.id} cannot move ${row.status} to ${patch.status}`);
    }
    await this.repository.updateStatus(row.id, patch);
  }
}
