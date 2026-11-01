import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import {
  errors,
  notificationView,
  page,
  renderTemplate,
  uuid,
  type ExternalChannel,
  type NotificationChannel,
  type NotificationStatus,
  type NotificationView,
  type RecipientType,
  type RenderedContent,
} from "@ampm/core";
import type { Scope } from "@ampm/policy";
import { z } from "zod";

import { AppLogger } from "../../../common/logger.service.js";
import { recordScope } from "../../../db/scoping.js";
import { JobQueue } from "../../../jobs/job-queue.js";
import { defineJob } from "../../../jobs/job.types.js";
import type { Principal } from "../../../policy/principal.types.js";
import { ConfigService } from "../config/config.service.js";
import {
  NOTIFICATION_ADAPTERS,
  type NotificationAdapters,
  type NotificationResult,
} from "./notification.adapter.js";
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
  /** Per-notification render variables (e.g. the activation link); stored server-only on the row. */
  readonly variables?: Readonly<Record<string, string>>;
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

/** The render variables a caller may attach to a notification (e.g. the activation link); all strings. */
const renderVariables = z.record(z.string(), z.string());

/** The channels delivered through the adapter; in-app is delivered by the service, so it maps to null. */
function externalChannel(channel: NotificationChannel): ExternalChannel | null {
  return channel === "email" || channel === "sms" || channel === "whatsapp" || channel === "push"
    ? channel
    : null;
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
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
    @Inject(NOTIFICATION_ADAPTERS) private readonly adapters: NotificationAdapters,
  ) {}

  onModuleInit(): void {
    this.jobs.register(
      sendNotificationJob,
      (payload) => this.deliver(payload.notificationId),
      // After every delivery attempt has failed the job dead-letters: mark the row failed and clear
      // its render variables so no invite token is held at rest on a permanently-queued row (D-044).
      (payload) => this.failPermanently(payload.notificationId),
    );
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
      data: input.variables,
    });
    await this.jobs.enqueue(
      sendNotificationJob,
      { notificationId: row.id },
      // '.' separator, not ':': BullMQ refuses a custom jobId containing ':' (bullmq.driver.ts, A1).
      { idempotencyKey: `notification.send.${row.id}` },
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
    // Leaving `queued` also clears the row's render variables: they may carry a single-use invite
    // link, and are only needed while the row is still queued and re-renderable. A replay runs only on
    // a queued row, so this stays deterministic while holding the token at rest for sub-seconds (D-044).
    if (row.channel === "in_app") {
      await this.advance(row, { status: "delivered", deliveredAt: new Date(), clearData: true });
      return;
    }
    const channel = externalChannel(row.channel);
    const content = channel ? await this.render(row.templateKey, channel, row.data) : null;
    if (!channel || !content) {
      await this.advance(row, { status: "failed", clearData: true });
      return;
    }
    await this.dispatch(row, channel, content);
  }

  /** Resolves the address, dispatches through the channel's adapter, and advances the row (5.3). */
  private async dispatch(
    row: NotificationRow,
    channel: ExternalChannel,
    content: RenderedContent,
  ): Promise<void> {
    // Email needs a delivery address; resolve it here (adapters never read persistence) and fail
    // closed when the recipient has none, rather than hand the adapter an unsendable message.
    const address =
      channel === "email" ? await this.repository.recipientEmail(row.recipientId) : null;
    if (channel === "email" && !address) {
      this.logger.warn("notification.no_address", { templateKey: row.templateKey, channel });
      await this.advance(row, { status: "failed", clearData: true });
      return;
    }
    let result: NotificationResult;
    try {
      result = await this.adapters.for(channel).send({
        channel,
        recipientType: row.recipientType,
        recipientId: row.recipientId,
        address,
        templateKey: row.templateKey,
        content,
      });
    } catch (error) {
      // A failed external send is transient and retryable (SMTP blips, provider outages): rethrow so
      // the job retries with backoff. Only after every attempt fails does the job dead-letter, where
      // `failPermanently` marks the row failed and clears its render variables (B2, D-044). The row
      // stays `queued` and re-renderable across the retries.
      this.logger.warn("notification.send_failed", { templateKey: row.templateKey, channel });
      throw error instanceof Error ? error : new Error(String(error));
    }
    await this.advance(row, {
      status: "sent",
      providerRef: result.providerRef,
      sentAt: new Date(),
      clearData: true,
    });
  }

  /** Renders the channel's content; returns null (and logs the names) when it is absent or incomplete. */
  private async render(
    templateKey: string,
    channel: ExternalChannel,
    data: unknown,
  ): Promise<RenderedContent | null> {
    const templates = await this.config.get("notification.templates");
    const template = templates[templateKey];
    const rendered = template
      ? renderTemplate(template, channel, renderVariables.catch({}).parse(data))
      : null;
    if (!rendered || !rendered.content || rendered.missing.length > 0) {
      this.logger.warn("notification.render_failed", {
        templateKey,
        channel,
        missing: rendered ? rendered.missing.join(",") : "<template>",
      });
      return null;
    }
    return rendered.content;
  }

  /**
   * The job's dead-letter handler: every send attempt failed, so mark the still-`queued` row failed
   * and clear its render variables (the invite token). A no-op if the row has since left `queued`.
   */
  private async failPermanently(notificationId: string): Promise<void> {
    const row = await this.repository.findById(notificationId);
    if (!row || row.status !== "queued") return;
    await this.advance(row, { status: "failed", clearData: true });
  }

  private async advance(row: NotificationRow, patch: StatusPatch): Promise<void> {
    if (!canAdvance(row.status, patch.status)) {
      throw errors.conflict(`notification ${row.id} cannot move ${row.status} to ${patch.status}`);
    }
    await this.repository.updateStatus(row.id, patch);
  }
}
