import { CONFIG_REGISTRY, createMemoryLogger, type NotificationTemplates } from "@ampm/core";

import type { AppLogger } from "../src/common/logger.service.js";
import { InlineJobDriver } from "../src/jobs/inline.driver.js";
import { JobQueue } from "../src/jobs/job-queue.js";
import type { ConfigService } from "../src/modules/admin/config/config.service.js";
import {
  ConsoleNotificationAdapter,
  type NotificationAdapter,
  type NotificationAdapters,
} from "../src/modules/admin/notification/notification.adapter.js";
import {
  NotificationRepository,
  type NewNotification,
  type NotificationPage,
  type NotificationRow,
  type StatusPatch,
} from "../src/modules/admin/notification/notification.repository.js";
import { NotificationService } from "../src/modules/admin/notification/notification.service.js";

/*
 * The notification unit tests' in-memory repository and service harness, shared by the spec files in
 * src/modules/admin/notification. It lives under test/ so the production build (which excludes test/
 * and *spec.ts) never compiles it.
 */

export const TEMPLATES = CONFIG_REGISTRY["notification.templates"].default;

export class FakeNotificationRepository extends NotificationRepository {
  readonly rows = new Map<string, NotificationRow>();
  readonly disabled = new Set<string>();
  recipientEmailValue: string | null = "recipient@example.com";
  recipientPhoneValue: string | null = "+919876543210";
  private seq = 0;

  async create(data: NewNotification): Promise<NotificationRow> {
    this.seq += 1;
    const id = `00000000-0000-7000-8000-${String(this.seq).padStart(12, "0")}`;
    const row: NotificationRow = {
      id,
      recipientType: data.recipientType,
      recipientId: data.recipientId,
      channel: data.channel,
      templateKey: data.templateKey,
      entityType: data.entityType ?? null,
      entityId: data.entityId ?? null,
      status: "queued",
      providerRef: null,
      sentAt: null,
      deliveredAt: null,
      data: data.data ?? null,
      recipientAddress: data.recipientAddress ?? null,
      replyTo: data.replyTo ?? null,
      createdAt: new Date("2026-10-28T00:00:00.000Z"),
    };
    this.rows.set(id, row);
    return row;
  }

  async findById(id: string): Promise<NotificationRow | null> {
    return this.rows.get(id) ?? null;
  }

  async updateStatus(id: string, patch: StatusPatch): Promise<void> {
    const row = this.rows.get(id);
    if (!row) return;
    this.rows.set(id, {
      ...row,
      status: patch.status,
      providerRef: patch.providerRef ?? row.providerRef,
      sentAt: patch.sentAt ?? row.sentAt,
      deliveredAt: patch.deliveredAt ?? row.deliveredAt,
      data: patch.clearData ? null : row.data,
      recipientAddress: patch.clearData ? null : row.recipientAddress,
      replyTo: patch.clearData ? null : row.replyTo,
    });
  }

  async listForRecipient(): Promise<NotificationPage> {
    return { rows: [...this.rows.values()], nextCursor: null };
  }

  async isChannelEnabled(userId: string, eventType: string, channel: string): Promise<boolean> {
    return !this.disabled.has(`${userId}|${eventType}|${channel}`);
  }

  async recipientEmail(): Promise<string | null> {
    return this.recipientEmailValue;
  }

  async recipientPhone(): Promise<string | null> {
    return this.recipientPhoneValue;
  }
}

export function makeService(
  repo: FakeNotificationRepository,
  options: { adapter?: NotificationAdapter; templates?: NotificationTemplates } = {},
): NotificationService {
  const { logger } = createMemoryLogger();
  const jobs = new JobQueue(new InlineJobDriver(logger));
  const config = { get: async () => options.templates ?? TEMPLATES } as unknown as ConfigService;
  const adapter = options.adapter ?? new ConsoleNotificationAdapter(logger);
  const adapters: NotificationAdapters = { for: () => adapter };
  const service = new NotificationService(
    repo,
    jobs,
    config,
    logger as unknown as AppLogger,
    adapters,
  );
  service.onModuleInit();
  return service;
}
