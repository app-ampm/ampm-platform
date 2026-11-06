import { Injectable } from "@nestjs/common";
import type { SiteVisitListQuery } from "@ampm/core";

import { PrismaService } from "../../db/prisma.service.js";
import { Prisma, type SiteVisitStatus } from "../../generated/prisma/client.js";

const SITE_VISIT_SELECT = {
  id: true,
  enquiryId: true,
  hotelId: true,
  scheduledAt: true,
  status: true,
  attendeesText: true,
  outcomeInternal: true,
  clientFeedback: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.SiteVisitSelect;

export type SiteVisitRow = Prisma.SiteVisitGetPayload<{ select: typeof SITE_VISIT_SELECT }>;

export interface SiteVisitWriteData {
  readonly enquiryId: string;
  readonly hotelId: string;
  readonly scheduledAt: Date;
  readonly attendeesText: string | null;
}

export interface SiteVisitEditPatch {
  readonly scheduledAt?: Date;
  readonly attendeesText?: string | null;
  readonly outcomeInternal?: string | null;
}

/**
 * Prisma access for site visits (api.md repository layer: queries + scoping, no business rules). Every
 * query carries `deletedAt: null`. Staff reads spread the scope the service built from the guard's
 * decision; client reads are reached only after the service has verified the enquiry is the caller's own.
 */
@Injectable()
export class SiteVisitsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: SiteVisitWriteData,
    createdBy: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<SiteVisitRow> {
    return client.siteVisit.create({
      data: { ...data, status: "proposed", createdBy },
      select: SITE_VISIT_SELECT,
    });
  }

  async findById(id: string): Promise<SiteVisitRow | null> {
    return this.prisma.siteVisit.findFirst({
      where: { id, deletedAt: null },
      select: SITE_VISIT_SELECT,
    });
  }

  async findByIdInScope(
    id: string,
    scopeWhere: Prisma.SiteVisitWhereInput,
  ): Promise<SiteVisitRow | null> {
    return this.prisma.siteVisit.findFirst({
      where: { ...scopeWhere, id, deletedAt: null },
      select: SITE_VISIT_SELECT,
    });
  }

  async listStaff(
    scopeWhere: Prisma.SiteVisitWhereInput,
    query: SiteVisitListQuery,
  ): Promise<{ rows: SiteVisitRow[]; nextCursor: string | null }> {
    return this.page({ ...scopeWhere, ...this.filters(query) }, query);
  }

  /** Visits for one enquiry (the client path, after the service verified the enquiry is the caller's). */
  async listForEnquiry(
    enquiryId: string,
    query: SiteVisitListQuery,
  ): Promise<{ rows: SiteVisitRow[]; nextCursor: string | null }> {
    return this.page({ enquiryId, ...(query.status ? { status: query.status } : {}) }, query);
  }

  /**
   * Edit guarded by the pre-read status (compare-and-swap): the row changes only if it still holds
   * `expectedStatus`, so an edit cannot land on a visit a concurrent transition has just made terminal
   * (the "terminal is read-only" invariant, enforced atomically rather than by a stale pre-read). Returns
   * the number of rows changed (0 = the visit moved underneath us).
   */
  async update(
    id: string,
    expectedStatus: SiteVisitStatus,
    patch: SiteVisitEditPatch,
    actorId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    const result = await client.siteVisit.updateMany({
      where: { id, status: expectedStatus },
      data: { ...patch, updatedBy: actorId },
    });
    return result.count;
  }

  /**
   * Compare-and-swap on the status: the visit moves only if it still holds `expectedStatus`, so two
   * concurrent transitions cannot both win. Returns the number of rows changed (0 = moved underneath us).
   */
  async updateStatus(
    id: string,
    expectedStatus: SiteVisitStatus,
    to: SiteVisitStatus,
    actorId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    const result = await client.siteVisit.updateMany({
      where: { id, status: expectedStatus },
      data: { status: to, updatedBy: actorId },
    });
    return result.count;
  }

  async updateFeedback(id: string, clientFeedback: string | null, actorId: string): Promise<void> {
    await this.prisma.siteVisit.update({
      where: { id },
      data: { clientFeedback, updatedBy: actorId },
    });
  }

  private filters(query: SiteVisitListQuery): Prisma.SiteVisitWhereInput {
    const where: Prisma.SiteVisitWhereInput = {};
    if (query.enquiryId) where.enquiryId = query.enquiryId;
    if (query.status) where.status = query.status;
    return where;
  }

  private async page(
    where: Prisma.SiteVisitWhereInput,
    query: SiteVisitListQuery,
  ): Promise<{ rows: SiteVisitRow[]; nextCursor: string | null }> {
    const limit = query.limit;
    const rows = await this.prisma.siteVisit.findMany({
      where: { ...where, deletedAt: null },
      orderBy: [{ scheduledAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: SITE_VISIT_SELECT,
    });
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    return {
      rows: pageRows,
      nextCursor: hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null,
    };
  }
}
