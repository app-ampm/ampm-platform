import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../db/prisma.service.js";
import { Prisma, type WebhookEventStatus } from "../../../generated/prisma/client.js";

export interface WebhookEventWriteData {
  readonly provider: string;
  readonly eventId: string;
  readonly eventType: string;
  readonly providerRef: string | null;
  readonly payload: Prisma.InputJsonValue;
}

export interface WebhookEventRow {
  readonly id: string;
  readonly eventType: string;
  readonly providerRef: string | null;
}

/**
 * The outcome of storing an event: the row id, whether it already existed, and its current status.
 * `status` lets the caller re-drive a duplicate that is still `received` (its first processing never
 * ran — e.g. an enqueue failure) while treating a `processed`/`failed`/`ignored` duplicate as a no-op.
 */
export interface WebhookEventStore {
  readonly id: string | null;
  readonly duplicate: boolean;
  readonly status: WebhookEventStatus | null;
}

/**
 * The raw provider-webhook store (api.md: "store the raw event"). Its unique (provider, event_id)
 * makes a redelivery a no-op at ingest; only signature-verified events are ever stored.
 */
@Injectable()
export class WebhookEventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Store a verified event, idempotently. A second delivery of the same (provider, event_id) trips the
   * unique index and returns `{ duplicate: true }`, so the caller enqueues nothing more (AC-02.5).
   */
  async store(data: WebhookEventWriteData): Promise<WebhookEventStore> {
    try {
      const row = await this.prisma.webhookEvent.create({
        data,
        select: { id: true, status: true },
      });
      return { id: row.id, duplicate: false, status: row.status };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await this.prisma.webhookEvent.findFirst({
          where: { provider: data.provider, eventId: data.eventId },
          select: { id: true, status: true },
        });
        return { id: existing?.id ?? null, duplicate: true, status: existing?.status ?? null };
      }
      throw error;
    }
  }

  async findById(id: string): Promise<WebhookEventRow | null> {
    return this.prisma.webhookEvent.findUnique({
      where: { id },
      select: { id: true, eventType: true, providerRef: true },
    });
  }

  async markProcessed(id: string): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: { id },
      data: { status: "processed", processedAt: new Date() },
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: { id },
      data: { status: "failed", error: error.slice(0, 1024), processedAt: new Date() },
    });
  }
}
