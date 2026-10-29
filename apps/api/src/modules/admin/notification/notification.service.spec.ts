import { CONFIG_REGISTRY, createMemoryLogger, type NotificationTemplates } from "@ampm/core";
import { describe, expect, it } from "vitest";

import type { AppLogger } from "../../../common/logger.service.js";
import { InlineJobDriver } from "../../../jobs/inline.driver.js";
import { JobQueue } from "../../../jobs/job-queue.js";
import type { Principal } from "../../../policy/principal.types.js";
import type { ConfigService } from "../config/config.service.js";
import {
  ConsoleNotificationAdapter,
  type NotificationAdapter,
  type NotificationAdapters,
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

const TEMPLATES = CONFIG_REGISTRY["notification.templates"].default;

class FakeNotificationRepository extends NotificationRepository {
  readonly rows = new Map<string, NotificationRow>();
  readonly disabled = new Set<string>();
  recipientEmailValue: string | null = "recipient@example.com";
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
}

function makeService(
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
    repo.disabled.add("user-1|staff.invited|email");
    const service = makeService(repo);
    const result = await service.queue({
      recipientType: "user",
      recipientId: "user-1",
      channel: "email",
      eventType: "staff.invited",
      templateKey: "staff.invite",
    });
    expect(result).toEqual({ suppressed: true });
    expect(repo.rows.size).toBe(0);
  });

  it("renders the template with the notification's variables and sends it", async () => {
    const repo = new FakeNotificationRepository();
    const sent: NotificationDelivery[] = [];
    const adapter: NotificationAdapter = {
      async send(delivery) {
        sent.push(delivery);
        return { providerRef: "provider-ref-1" };
      },
    };
    const service = makeService(repo, { adapter });
    const result = await service.queue({
      recipientType: "user",
      recipientId: "user-1",
      channel: "email",
      eventType: "staff.invited",
      templateKey: "staff.invite",
      variables: { name: "Pat", activationUrl: "https://app.example/activate?token=abc" },
    });
    if (result.suppressed) throw new Error("unexpected suppression");
    const row = repo.rows.get(result.notificationId);
    expect(row?.status).toBe("sent");
    expect(row?.providerRef).toBe("provider-ref-1");
    expect(sent).toHaveLength(1);
    expect(sent[0]?.address).toBe("recipient@example.com");
    const content = sent[0]?.content;
    if (content?.kind !== "email") throw new Error("expected rendered email content");
    expect(content.subject).toContain("AMPM");
    expect(content.text).toContain("Pat");
    expect(content.text).toContain("https://app.example/activate?token=abc");
    expect(content.html).toContain("Hi Pat");
  });

  it("fails closed without dispatching when a required variable is missing", async () => {
    const repo = new FakeNotificationRepository();
    const sent: NotificationDelivery[] = [];
    const adapter: NotificationAdapter = {
      async send(delivery) {
        sent.push(delivery);
        return { providerRef: "nope" };
      },
    };
    const service = makeService(repo, { adapter });
    // staff.invite needs {name, activationUrl}; provide neither.
    const result = await service.queue({
      recipientType: "user",
      recipientId: "user-1",
      channel: "email",
      eventType: "staff.invited",
      templateKey: "staff.invite",
    });
    if (result.suppressed) throw new Error("unexpected suppression");
    expect(repo.rows.get(result.notificationId)?.status).toBe("failed");
    expect(sent).toHaveLength(0);
  });

  it("fails closed when no template exists for the key", async () => {
    const repo = new FakeNotificationRepository();
    const sent: NotificationDelivery[] = [];
    const service = makeService(repo, {
      templates: {},
      adapter: {
        async send(delivery) {
          sent.push(delivery);
          return { providerRef: "nope" };
        },
      },
    });
    const result = await service.queue({
      recipientType: "user",
      recipientId: "user-1",
      channel: "email",
      eventType: "x",
      templateKey: "unknown.template",
    });
    if (result.suppressed) throw new Error("unexpected suppression");
    expect(repo.rows.get(result.notificationId)?.status).toBe("failed");
    expect(sent).toHaveLength(0);
  });

  it("fails closed when only some required variables are present", async () => {
    const repo = new FakeNotificationRepository();
    const sent: NotificationDelivery[] = [];
    const service = makeService(repo, {
      adapter: {
        async send(delivery) {
          sent.push(delivery);
          return { providerRef: "nope" };
        },
      },
    });
    // staff.invite needs { name, activationUrl }; supply only name.
    const result = await service.queue({
      recipientType: "user",
      recipientId: "user-1",
      channel: "email",
      eventType: "staff.invited",
      templateKey: "staff.invite",
      variables: { name: "Pat" },
    });
    if (result.suppressed) throw new Error("unexpected suppression");
    expect(repo.rows.get(result.notificationId)?.status).toBe("failed");
    expect(sent).toHaveLength(0);
  });

  it("never serialises the server-only data (the invite token) onto a notification view", async () => {
    const repo = new FakeNotificationRepository();
    // A row still carrying render variables, as a queued row does before delivery clears them.
    const id = "00000000-0000-7000-8000-0000000000d1";
    repo.rows.set(id, {
      id,
      recipientType: "user",
      recipientId: "u1",
      channel: "email",
      templateKey: "staff.invite",
      entityType: null,
      entityId: null,
      status: "sent",
      providerRef: "p",
      sentAt: new Date("2026-10-28T00:00:00.000Z"),
      deliveredAt: null,
      data: { activationUrl: "https://app.example/activate?token=SECRET" },
      createdAt: new Date("2026-10-28T00:00:00.000Z"),
    });
    const service = makeService(repo);
    const principal = { type: "staff", userId: "u1", memberships: [] } as unknown as Principal;
    const list = await service.listOwn(principal, "own", { limit: 10 });
    expect(JSON.stringify(list)).not.toContain("SECRET");
    expect(list.items.every((item) => !("data" in item))).toBe(true);
  });

  it("fails closed when the email recipient has no resolvable address", async () => {
    const repo = new FakeNotificationRepository();
    repo.recipientEmailValue = null;
    const sent: NotificationDelivery[] = [];
    const service = makeService(repo, {
      adapter: {
        async send(delivery) {
          sent.push(delivery);
          return { providerRef: "nope" };
        },
      },
    });
    const result = await service.queue({
      recipientType: "user",
      recipientId: "user-1",
      channel: "email",
      eventType: "staff.invited",
      templateKey: "staff.invite",
      variables: { name: "Pat", activationUrl: "https://app.example/activate?token=abc" },
    });
    if (result.suppressed) throw new Error("unexpected suppression");
    expect(repo.rows.get(result.notificationId)?.status).toBe("failed");
    expect(sent).toHaveLength(0);
  });

  it("marks the notification failed and clears its data when the adapter send throws", async () => {
    const repo = new FakeNotificationRepository();
    const service = makeService(repo, {
      adapter: {
        async send() {
          throw new Error("smtp boom");
        },
      },
    });
    const result = await service.queue({
      recipientType: "user",
      recipientId: "user-1",
      channel: "email",
      eventType: "staff.invited",
      templateKey: "staff.invite",
      variables: { name: "Pat", activationUrl: "https://app.example/activate?token=abc" },
    });
    if (result.suppressed) throw new Error("unexpected suppression");
    const row = repo.rows.get(result.notificationId);
    expect(row?.status).toBe("failed");
    expect(row?.data).toBeNull();
  });
});
