import { Injectable } from "@nestjs/common";
import type { NotificationChannel, NotificationStatus, RecipientType } from "@ampm/core";

import { PrismaService } from "../../../db/prisma.service.js";
import type { RecordScope } from "../../../db/scoping.js";

export interface NotificationRow {
  readonly id: string;
  readonly recipientType: RecipientType;
  readonly recipientId: string;
  readonly channel: NotificationChannel;
  readonly templateKey: string;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly status: NotificationStatus;
  readonly providerRef: string | null;
  readonly sentAt: Date | null;
  readonly deliveredAt: Date | null;
  readonly createdAt: Date;
}

export interface NewNotification {
  readonly recipientType: RecipientType;
  readonly recipientId: string;
  readonly channel: NotificationChannel;
  readonly templateKey: string;
  readonly entityType?: string | null;
  readonly entityId?: string | null;
}

export interface StatusPatch {
  readonly status: NotificationStatus;
  readonly providerRef?: string;
  readonly sentAt?: Date;
  readonly deliveredAt?: Date;
}

export interface NotificationPage {
  readonly rows: readonly NotificationRow[];
  readonly nextCursor: string | null;
}

export abstract class NotificationRepository {
  abstract create(data: NewNotification): Promise<NotificationRow>;
  abstract findById(id: string): Promise<NotificationRow | null>;
  abstract updateStatus(id: string, patch: StatusPatch): Promise<void>;
  /** The caller's own notifications; `scope.ownerId` (own) maps to `recipient_id`, absent for SA (all). */
  abstract listForRecipient(
    scope: RecordScope,
    limit: number,
    cursor?: string,
  ): Promise<NotificationPage>;
  /** A user's channel preference; the default is enabled, so only a row set to `false` suppresses. */
  abstract isChannelEnabled(userId: string, eventType: string, channel: string): Promise<boolean>;
}

@Injectable()
export class PrismaNotificationRepository extends NotificationRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(data: NewNotification): Promise<NotificationRow> {
    const row = await this.prisma.notification.create({
      data: {
        recipientType: data.recipientType,
        recipientId: data.recipientId,
        channel: data.channel,
        templateKey: data.templateKey,
        entityType: data.entityType ?? null,
        entityId: data.entityId ?? null,
        status: "queued",
      },
    });
    return row;
  }

  async findById(id: string): Promise<NotificationRow | null> {
    // notifications is partitioned (composite PK id + created_at), so id alone is not a findUnique key.
    return this.prisma.notification.findFirst({ where: { id } });
  }

  async updateStatus(id: string, patch: StatusPatch): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id },
      data: {
        status: patch.status,
        ...(patch.providerRef !== undefined ? { providerRef: patch.providerRef } : {}),
        ...(patch.sentAt !== undefined ? { sentAt: patch.sentAt } : {}),
        ...(patch.deliveredAt !== undefined ? { deliveredAt: patch.deliveredAt } : {}),
      },
    });
  }

  async listForRecipient(
    scope: RecordScope,
    limit: number,
    cursor?: string,
  ): Promise<NotificationPage> {
    // Notifications are recipient-owned, not project-owned: only the own-scope `ownerId` applies
    // (mapped to recipient_id); there is no project, demo or soft-delete column to scope by. SA holds
    // scope "all" (no ownerId) and reads the whole user log (permission-matrix §5.1 "Notifications log").
    // Keyset pagination on the time-ordered uuid v7 id: notifications is partitioned (composite PK
    // id + created_at), so id alone is not a Prisma `cursor`; an id range uses the PK's leading column.
    const where = {
      recipientType: "user" as const,
      ...(scope.ownerId !== undefined ? { recipientId: scope.ownerId } : {}),
      ...(cursor ? { id: { lt: cursor } } : {}),
    };
    const rows = await this.prisma.notification.findMany({
      where,
      orderBy: { id: "desc" },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return { rows: page, nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null };
  }

  async isChannelEnabled(userId: string, eventType: string, channel: string): Promise<boolean> {
    const preference = await this.prisma.notificationPreference.findUnique({
      where: { userId_eventType_channel: { userId, eventType, channel } },
    });
    return preference ? preference.enabled : true;
  }
}
