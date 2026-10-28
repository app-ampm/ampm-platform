import { createMemoryLogger } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { InlineJobDriver } from "../../../jobs/inline.driver.js";
import { JobQueue } from "../../../jobs/job-queue.js";
import {
  ConsoleNotificationAdapter,
  type NotificationAdapter,
  type NotificationDelivery,
} from "./notification.adapter.js";
import {
  NotificationRepository,
  type NewNotification,
  type NotificationPage,
  type NotificationRow,
  type StatusPatch,
} from "./notification.repository.js";
import { NotificationService } from "./notification.service.js";

class FakeNotificationRepository extends NotificationRepository {
  readonly rows = new Map<string, NotificationRow>();
  readonly disabled = new Set<string>();
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
    });
  }

  async listForRecipient(): Promise<NotificationPage> {
    return { rows: [...this.rows.values()], nextCursor: null };
  }

  async isChannelEnabled(userId: string, eventType: string, channel: string): Promise<boolean> {
    return !this.disabled.has(`${userId}|${eventType}|${channel}`);
  }
}

function makeService(
  repo: FakeNotificationRepository,
  adapter?: NotificationAdapter,
): NotificationService {
  const { logger } = createMemoryLogger();
  const jobs = new JobQueue(new InlineJobDriver(logger));
  const service = new NotificationService(
    repo,
    jobs,
    adapter ?? new ConsoleNotificationAdapter(logger),
  );
  service.onModuleInit();
  return service;
}

describe("NotificationService", () => {
  it("queues an in-app notification and the send job delivers it (the row is the delivery)", async () => {
    const repo = new FakeNotificationRepository();
    const service = makeService(repo);
    const result = await service.queue({
      recipientType: "user",
      recipientId: "user-1",
      channel: "in_app",
      eventType: "enquiry.updated",
      templateKey: "enquiry.updated",
    });
    expect(result.suppressed).toBe(false);
    if (result.suppressed) throw new Error("unexpected suppression");
    const row = repo.rows.get(result.notificationId);
    expect(row?.status).toBe("delivered");
    expect(row?.deliveredAt).not.toBeNull();
  });

  it("suppresses a channel the recipient has disabled, writing no row", async () => {
    const repo = new FakeNotificationRepository();
    repo.disabled.add("user-1|enquiry.updated|email");
    const service = makeService(repo);
    const result = await service.queue({
      recipientType: "user",
      recipientId: "user-1",
      channel: "email",
      eventType: "enquiry.updated",
      templateKey: "enquiry.updated",
    });
    expect(result).toEqual({ suppressed: true });
    expect(repo.rows.size).toBe(0);
  });

  it("delivers an external channel through the adapter and marks it sent", async () => {
    const repo = new FakeNotificationRepository();
    const sent: NotificationDelivery[] = [];
    const adapter: NotificationAdapter = {
      async send(delivery) {
        sent.push(delivery);
        return { providerRef: "provider-ref-1" };
      },
    };
    const service = makeService(repo, adapter);
    const result = await service.queue({
      recipientType: "user",
      recipientId: "user-1",
      channel: "email",
      eventType: "enquiry.updated",
      templateKey: "welcome",
    });
    if (result.suppressed) throw new Error("unexpected suppression");
    const row = repo.rows.get(result.notificationId);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.channel).toBe("email");
    expect(row?.status).toBe("sent");
    expect(row?.providerRef).toBe("provider-ref-1");
  });
});
