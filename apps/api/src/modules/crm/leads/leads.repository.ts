import { Injectable } from "@nestjs/common";
import type { ContactPreference, LeadStatus } from "@ampm/core";

import { PrismaService } from "../../../db/prisma.service.js";
import { Prisma } from "../../../generated/prisma/client.js";

/** A lead with its source and owner joined, as the Sales workspace reads it (every field INTERNAL). */
export interface LeadRow {
  readonly id: string;
  readonly status: LeadStatus;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly contactPreference: ContactPreference | null;
  readonly tentativeDateFrom: Date | null;
  readonly tentativeDateTo: Date | null;
  readonly destinationId: string | null;
  readonly destinationText: string | null;
  readonly guestEstimate: number | null;
  readonly requirements: string | null;
  readonly source: { sourceKey: string; name: string };
  readonly consentMarketing: boolean;
  readonly consentAt: Date | null;
  readonly consentNoticeVersion: string | null;
  readonly requestedDemo: boolean;
  readonly ownerUserId: string | null;
  readonly ownerName: string | null;
  readonly convertedAccountId: string | null;
  readonly convertedAt: Date | null;
  readonly closedReason: string | null;
  readonly duplicateOfLeadId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface LeadWriteData {
  readonly sourceId: string;
  readonly status: LeadStatus;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly contactPreference: ContactPreference | null;
  readonly tentativeDateFrom: Date | null;
  readonly tentativeDateTo: Date | null;
  readonly destinationId: string | null;
  readonly destinationText: string | null;
  readonly guestEstimate: number | null;
  readonly requirements: string | null;
  readonly consentMarketing: boolean;
  readonly consentAt: Date | null;
  readonly consentNoticeVersion: string | null;
  readonly requestedDemo: boolean;
  readonly ownerUserId: string | null;
  readonly duplicateOfLeadId: string | null;
  readonly createdBy: string | null;
}

/** The mutable subset an update may set; `undefined` leaves a column unchanged, `null` clears it. */
export interface LeadUpdatePatch {
  name?: string;
  email?: string | null;
  phone?: string | null;
  contactPreference?: ContactPreference | null;
  tentativeDateFrom?: Date | null;
  tentativeDateTo?: Date | null;
  destinationId?: string | null;
  destinationText?: string | null;
  guestEstimate?: number | null;
  requirements?: string | null;
  status?: LeadStatus;
  ownerUserId?: string | null;
  closedReason?: string;
  convertedAccountId?: string;
  convertedAt?: Date;
  duplicateOfLeadId?: string;
}

export interface LeadListFilters {
  readonly status?: LeadStatus | undefined;
  readonly ownerUserId?: string | undefined;
  readonly source?: string | undefined;
  readonly q?: string | undefined;
}

export interface LeadSourceRef {
  readonly id: string;
  readonly sourceKey: string;
  readonly name: string;
}

export interface FunnelCounts {
  readonly total: number;
  readonly byStatus: { status: LeadStatus; count: number }[];
  readonly bySource: { sourceKey: string; name: string; count: number }[];
}

const WITH_JOINS = {
  include: {
    source: { select: { sourceKey: true, name: true } },
    owner: { select: { name: true } },
  },
} as const;

type JoinedLead = Prisma.LeadGetPayload<typeof WITH_JOINS>;

function toRow(lead: JoinedLead): LeadRow {
  return {
    id: lead.id,
    status: lead.status,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    contactPreference: lead.contactPreference,
    tentativeDateFrom: lead.tentativeDateFrom,
    tentativeDateTo: lead.tentativeDateTo,
    destinationId: lead.destinationId,
    destinationText: lead.destinationText,
    guestEstimate: lead.guestEstimate,
    requirements: lead.requirements,
    source: { sourceKey: lead.source.sourceKey, name: lead.source.name },
    consentMarketing: lead.consentMarketing,
    consentAt: lead.consentAt,
    consentNoticeVersion: lead.consentNoticeVersion,
    requestedDemo: lead.requestedDemo,
    ownerUserId: lead.ownerUserId,
    ownerName: lead.owner ? lead.owner.name : null,
    convertedAccountId: lead.convertedAccountId,
    convertedAt: lead.convertedAt,
    closedReason: lead.closedReason,
    duplicateOfLeadId: lead.duplicateOfLeadId,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };
}

@Injectable()
export class LeadsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveSourceByKey(key: string): Promise<LeadSourceRef | null> {
    return this.prisma.leadSource.findFirst({
      where: { sourceKey: key, isActive: true, deletedAt: null },
      select: { id: true, sourceKey: true, name: true },
    });
  }

  async create(data: LeadWriteData): Promise<string> {
    const lead = await this.prisma.lead.create({ data, select: { id: true } });
    return lead.id;
  }

  async findById(id: string): Promise<LeadRow | null> {
    const lead = await this.prisma.lead.findFirst({
      where: { id, deletedAt: null },
      ...WITH_JOINS,
    });
    return lead ? toRow(lead) : null;
  }

  async list(
    filters: LeadListFilters,
    limit: number,
    cursor?: string,
  ): Promise<{ rows: LeadRow[]; nextCursor: string | null }> {
    const where: Prisma.LeadWhereInput = { deletedAt: null };
    if (filters.status) where.status = filters.status;
    if (filters.ownerUserId) where.ownerUserId = filters.ownerUserId;
    if (filters.source) where.source = { sourceKey: filters.source };
    if (filters.q) {
      const q = filters.q;
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ];
    }
    const leads = await this.prisma.lead.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      ...WITH_JOINS,
    });
    const hasMore = leads.length > limit;
    const rows = (hasMore ? leads.slice(0, limit) : leads).map(toRow);
    return { rows, nextCursor: hasMore ? rows[rows.length - 1]!.id : null };
  }

  /** The earliest existing non-deleted lead that shares the email or phone, oldest first (AC-01.6). */
  async findDuplicateId(contact: {
    email: string | null;
    phone: string | null;
  }): Promise<string | null> {
    const or: Prisma.LeadWhereInput[] = [];
    if (contact.email) or.push({ email: contact.email });
    if (contact.phone) or.push({ phone: contact.phone });
    if (or.length === 0) return null;
    const match = await this.prisma.lead.findFirst({
      where: { deletedAt: null, OR: or },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return match ? match.id : null;
  }

  async update(
    id: string,
    patch: LeadUpdatePatch,
    updatedBy: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    await client.lead.update({ where: { id }, data: { ...patch, updatedBy } });
  }

  /** True when the user is a live, active staff member — the only principal a lead may be owned by (C4). */
  async isActiveStaff(userId: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { id: userId, userType: "staff", status: "active", deletedAt: null },
    });
    return count > 0;
  }

  /** Closes the duplicate as `merged`, pointing it at the survivor; runs inside the merge transaction. */
  closeAsDuplicate(
    duplicateId: string,
    survivorId: string,
    actorId: string,
    client: Prisma.TransactionClient,
  ): Promise<unknown> {
    return client.lead.update({
      where: { id: duplicateId },
      data: {
        status: "closed",
        closedReason: "merged",
        duplicateOfLeadId: survivorId,
        updatedBy: actorId,
      },
    });
  }

  /** Mark a lead converted and point it at its new account; runs inside the convert transaction (8.2).
   *  The lead is read-only afterwards (the service guards every mutator on `status === "converted"`). */
  markConverted(
    leadId: string,
    accountId: string,
    actorId: string,
    client: Prisma.TransactionClient,
  ): Promise<unknown> {
    return client.lead.update({
      where: { id: leadId },
      data: {
        status: "converted",
        convertedAccountId: accountId,
        convertedAt: new Date(),
        updatedBy: actorId,
      },
    });
  }

  async salesRecipientIds(): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        status: "active",
        deletedAt: null,
        roles: { some: { role: { roleKey: "sales" } } },
      },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  async funnel(from: Date | null, to: Date | null): Promise<FunnelCounts> {
    const where: Prisma.LeadWhereInput = { deletedAt: null };
    if (from || to) {
      // The window is whole UTC days: `to` is inclusive, so filter strictly before the day after it,
      // never with `lte` on its midnight (a wedding-time-zone funnel is a later refinement).
      const dayAfterTo = to ? new Date(to.getTime() + 24 * 60 * 60 * 1000) : null;
      where.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(dayAfterTo ? { lt: dayAfterTo } : {}),
      };
    }
    const [byStatusRaw, bySourceRaw, sources] = await Promise.all([
      this.prisma.lead.groupBy({ by: ["status"], where, _count: { _all: true } }),
      this.prisma.lead.groupBy({ by: ["sourceId"], where, _count: { _all: true } }),
      this.prisma.leadSource.findMany({ select: { id: true, sourceKey: true, name: true } }),
    ]);
    const sourceById = new Map(sources.map((s) => [s.id, s]));
    const byStatus = byStatusRaw.map((row) => ({ status: row.status, count: row._count._all }));
    const bySource = bySourceRaw.map((row) => {
      const ref = sourceById.get(row.sourceId);
      return {
        sourceKey: ref ? ref.sourceKey : "unknown",
        name: ref ? ref.name : "Unknown",
        count: row._count._all,
      };
    });
    const total = byStatus.reduce((sum, row) => sum + row.count, 0);
    return { total, byStatus, bySource };
  }
}
