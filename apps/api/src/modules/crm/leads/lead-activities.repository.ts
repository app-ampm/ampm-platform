import { Injectable } from "@nestjs/common";
import type { LeadActivityType } from "@ampm/core";

import { PrismaService } from "../../../db/prisma.service.js";
import { Prisma } from "../../../generated/prisma/client.js";

export interface LeadActivityRow {
  readonly id: string;
  readonly leadId: string;
  readonly activityType: LeadActivityType;
  readonly occurredAt: Date;
  readonly userId: string;
  readonly summary: string | null;
  readonly questionnaireJson: Prisma.JsonValue | null;
  readonly nextFollowUpAt: Date | null;
  readonly createdAt: Date;
}

export interface LeadActivityWriteData {
  readonly leadId: string;
  readonly activityType: LeadActivityType;
  readonly occurredAt: Date;
  readonly userId: string;
  readonly summary: string | null;
  readonly questionnaireJson: Prisma.InputJsonValue | undefined;
  readonly nextFollowUpAt: Date | null;
}

/** A follow-up reminder that is due: the activity, its lead and the owner to notify (AC-01.5). */
export interface DueReminder {
  readonly activityId: string;
  readonly leadId: string;
  readonly leadName: string;
  readonly ownerUserId: string;
}

function toRow(activity: {
  id: string;
  leadId: string;
  activityType: LeadActivityType;
  occurredAt: Date;
  userId: string;
  summary: string | null;
  questionnaireJson: Prisma.JsonValue | null;
  nextFollowUpAt: Date | null;
  createdAt: Date;
}): LeadActivityRow {
  return activity;
}

@Injectable()
export class LeadActivitiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: LeadActivityWriteData, createdBy: string): Promise<LeadActivityRow> {
    const activity = await this.prisma.leadActivity.create({
      data: {
        leadId: data.leadId,
        activityType: data.activityType,
        occurredAt: data.occurredAt,
        userId: data.userId,
        summary: data.summary,
        ...(data.questionnaireJson !== undefined
          ? { questionnaireJson: data.questionnaireJson }
          : {}),
        nextFollowUpAt: data.nextFollowUpAt,
        createdBy,
      },
    });
    return toRow(activity);
  }

  async listByLead(leadId: string): Promise<LeadActivityRow[]> {
    const rows = await this.prisma.leadActivity.findMany({
      where: { leadId, deletedAt: null },
      orderBy: { occurredAt: "desc" },
    });
    return rows.map(toRow);
  }

  /** Moves a merged duplicate's activities onto the survivor; runs inside the merge transaction. */
  reassignLead(
    fromLeadId: string,
    toLeadId: string,
    actorId: string,
    client: Prisma.TransactionClient,
  ): Promise<unknown> {
    return client.leadActivity.updateMany({
      where: { leadId: fromLeadId, deletedAt: null },
      data: { leadId: toLeadId, updatedBy: actorId },
    });
  }

  /** The soonest pending follow-up per lead, for the workspace view (null when none is scheduled). */
  async nextFollowUpByLead(leadIds: string[]): Promise<Map<string, Date>> {
    if (leadIds.length === 0) return new Map();
    const grouped = await this.prisma.leadActivity.groupBy({
      by: ["leadId"],
      where: { leadId: { in: leadIds }, deletedAt: null, nextFollowUpAt: { not: null } },
      _min: { nextFollowUpAt: true },
    });
    const map = new Map<string, Date>();
    for (const row of grouped) {
      if (row._min.nextFollowUpAt) map.set(row.leadId, row._min.nextFollowUpAt);
    }
    return map;
  }

  /** Activities whose follow-up is due, with the lead's owner, for the reminder job to claim. */
  async dueReminders(now: Date): Promise<DueReminder[]> {
    const rows = await this.prisma.leadActivity.findMany({
      where: {
        nextFollowUpAt: { not: null, lte: now },
        deletedAt: null,
        // Skip leads that are done: a reminder must never fire for a closed or converted lead.
        lead: {
          deletedAt: null,
          ownerUserId: { not: null },
          status: { notIn: ["closed", "converted"] },
        },
      },
      select: { id: true, leadId: true, lead: { select: { name: true, ownerUserId: true } } },
    });
    return rows.flatMap((row) =>
      row.lead.ownerUserId
        ? [
            {
              activityId: row.id,
              leadId: row.leadId,
              leadName: row.lead.name,
              ownerUserId: row.lead.ownerUserId,
            },
          ]
        : [],
    );
  }

  /**
   * Atomically consumes a due reminder: clears `next_follow_up_at` only if it is still due. Returns
   * true for the one caller that cleared it, so the reminder is sent exactly once across reruns and
   * concurrent workers (AC-01.5 idempotency).
   */
  async claim(activityId: string, now: Date): Promise<boolean> {
    const result = await this.prisma.leadActivity.updateMany({
      where: { id: activityId, deletedAt: null, nextFollowUpAt: { not: null, lte: now } },
      data: { nextFollowUpAt: null },
    });
    return result.count === 1;
  }
}
