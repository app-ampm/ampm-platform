import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../db/prisma.service.js";
import { Prisma, type HotelEnquiryEventType } from "../../generated/prisma/client.js";

export interface EnquiryEventRow {
  readonly id: string;
  readonly enquiryId: string;
  readonly eventType: HotelEnquiryEventType;
  readonly occurredAt: Date;
  readonly userId: string;
  readonly summary: string | null;
  readonly internalOnly: boolean;
  readonly documentId: string | null;
  readonly createdAt: Date;
}

export interface EnquiryEventWriteData {
  readonly enquiryId: string;
  readonly eventType: HotelEnquiryEventType;
  readonly occurredAt: Date;
  readonly userId: string;
  readonly summary: string | null;
  readonly internalOnly: boolean;
  readonly documentId: string | null;
}

/**
 * The enquiry's append-only domain timeline (brief §2.5): create + list only — a correction is a new
 * event, never an update or delete. Writes take an optional transaction client so a status change and
 * its event commit together with the audit (api.md repository layer: Prisma only, no business rules).
 */
@Injectable()
export class EnquiryEventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: EnquiryEventWriteData,
    createdBy: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<EnquiryEventRow> {
    const row = await client.hotelEnquiryEvent.create({
      data: {
        enquiryId: data.enquiryId,
        eventType: data.eventType,
        occurredAt: data.occurredAt,
        userId: data.userId,
        summary: data.summary,
        internalOnly: data.internalOnly,
        documentId: data.documentId,
        createdBy,
      },
    });
    return toRow(row);
  }

  async listByEnquiry(enquiryId: string): Promise<EnquiryEventRow[]> {
    const rows = await this.prisma.hotelEnquiryEvent.findMany({
      where: { enquiryId, deletedAt: null },
      orderBy: { occurredAt: "desc" },
    });
    return rows.map(toRow);
  }
}

function toRow(event: {
  id: string;
  enquiryId: string;
  eventType: HotelEnquiryEventType;
  occurredAt: Date;
  userId: string;
  summary: string | null;
  internalOnly: boolean;
  documentId: string | null;
  createdAt: Date;
}): EnquiryEventRow {
  return {
    id: event.id,
    enquiryId: event.enquiryId,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    userId: event.userId,
    summary: event.summary,
    internalOnly: event.internalOnly,
    documentId: event.documentId,
    createdAt: event.createdAt,
  };
}
