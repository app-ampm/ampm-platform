import { Injectable } from "@nestjs/common";
import type { BookingMilestoneListQuery } from "@ampm/core";

import { PrismaService } from "../../db/prisma.service.js";
import {
  Prisma,
  type BookingMilestoneStatus,
  type BookingMilestoneType,
} from "../../generated/prisma/client.js";

const MILESTONE_SELECT = {
  id: true,
  enquiryId: true,
  projectId: true,
  milestoneType: true,
  status: true,
  dueAt: true,
  completedAt: true,
  amount: true,
  contractId: true,
  documentId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.BookingMilestoneSelect;

export type BookingMilestoneRow = Prisma.BookingMilestoneGetPayload<{
  select: typeof MILESTONE_SELECT;
}>;

export interface BookingMilestoneWriteData {
  readonly enquiryId: string;
  readonly projectId: string | null;
  readonly milestoneType: BookingMilestoneType;
  readonly dueAt: Date | null;
  readonly amount: string | null;
  readonly currency: string | null;
  readonly contractId: string | null;
  readonly documentId: string | null;
}

export interface BookingMilestoneEditPatch {
  readonly dueAt?: Date | null;
  readonly amount?: string | null;
  readonly currency?: string | null;
  readonly contractId?: string | null;
  readonly documentId?: string | null;
}

export interface MilestoneStatusPatch {
  readonly status: BookingMilestoneStatus;
  readonly completedAt?: Date | null;
}

export interface DueMilestone {
  readonly id: string;
  readonly enquiryId: string;
  readonly milestoneType: BookingMilestoneType;
  readonly assignedUserId: string | null;
}

/**
 * Prisma access for booking milestones (api.md repository layer: queries + scoping, no business rules).
 * Every query carries `deletedAt: null`. Status writes are compare-and-swap on the expected status, so two
 * concurrent moves cannot both win; `markOverdue` is the sweep's CAS. The confirmed-guard reads are intra
 * module (booking_milestones is a Module-D table owned by the enquiry).
 */
@Injectable()
export class BookingMilestonesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: BookingMilestoneWriteData,
    createdBy: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<BookingMilestoneRow> {
    return client.bookingMilestone.create({
      data: { ...data, status: "pending", createdBy },
      select: MILESTONE_SELECT,
    });
  }

  async findById(id: string): Promise<BookingMilestoneRow | null> {
    return this.prisma.bookingMilestone.findFirst({
      where: { id, deletedAt: null },
      select: MILESTONE_SELECT,
    });
  }

  async findByIdInScope(
    id: string,
    scopeWhere: Prisma.BookingMilestoneWhereInput,
  ): Promise<BookingMilestoneRow | null> {
    return this.prisma.bookingMilestone.findFirst({
      where: { ...scopeWhere, id, deletedAt: null },
      select: MILESTONE_SELECT,
    });
  }

  async listStaff(
    scopeWhere: Prisma.BookingMilestoneWhereInput,
    query: BookingMilestoneListQuery,
  ): Promise<{ rows: BookingMilestoneRow[]; nextCursor: string | null }> {
    const byEnquiry = query.enquiryId ? { enquiryId: query.enquiryId } : {};
    return this.page({ ...scopeWhere, ...byEnquiry, ...this.filters(query) }, query);
  }

  /** Milestones for one enquiry (the client path, after the service verified the enquiry is the caller's). */
  async listForEnquiry(
    enquiryId: string,
    query: BookingMilestoneListQuery,
  ): Promise<{ rows: BookingMilestoneRow[]; nextCursor: string | null }> {
    return this.page({ enquiryId, ...this.filters(query) }, query);
  }

  /** Compare-and-swap edit: the row changes only if it still holds `expectedStatus`, so an edit cannot
   *  land on a milestone a concurrent transition has just made terminal. Returns the rows changed. */
  async update(
    id: string,
    expectedStatus: BookingMilestoneStatus,
    patch: BookingMilestoneEditPatch,
    actorId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    const result = await client.bookingMilestone.updateMany({
      where: { id, status: expectedStatus, deletedAt: null },
      data: { ...patch, updatedBy: actorId },
    });
    return result.count;
  }

  /** Compare-and-swap on the status: the milestone moves only if it still holds `expectedStatus`. */
  async updateStatus(
    id: string,
    expectedStatus: BookingMilestoneStatus,
    patch: MilestoneStatusPatch,
    actorId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    const result = await client.bookingMilestone.updateMany({
      where: { id, status: expectedStatus, deletedAt: null },
      data: { ...patch, updatedBy: actorId },
    });
    return result.count;
  }

  /** The overdue sweep's CAS: a pending milestone past its due date becomes overdue; returns whether this
   *  call won, so the sweep notifies exactly once across reruns and concurrent workers. */
  async markOverdue(
    id: string,
    now: Date,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<boolean> {
    const result = await client.bookingMilestone.updateMany({
      where: { id, status: "pending", deletedAt: null, dueAt: { not: null, lte: now } },
      data: { status: "overdue" },
    });
    return result.count === 1;
  }

  /** Pending milestones past their due date, with the enquiry's assignee (the reminder recipient). */
  async findDueMilestones(now: Date): Promise<DueMilestone[]> {
    const rows = await this.prisma.bookingMilestone.findMany({
      where: { status: "pending", deletedAt: null, dueAt: { not: null, lte: now } },
      select: {
        id: true,
        enquiryId: true,
        milestoneType: true,
        enquiry: { select: { assignedUserId: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      enquiryId: row.enquiryId,
      milestoneType: row.milestoneType,
      assignedUserId: row.enquiry.assignedUserId,
    }));
  }

  /** AC-05.6 guard: a milestone of this type is completed for the enquiry. */
  async hasDoneMilestone(enquiryId: string, milestoneType: BookingMilestoneType): Promise<boolean> {
    const row = await this.prisma.bookingMilestone.findFirst({
      where: { enquiryId, milestoneType, status: "done", deletedAt: null },
      select: { id: true },
    });
    return row !== null;
  }

  /** AC-05.6 guard (interim signed-contract signal): a done `contract_signed` milestone carrying an
   *  uploaded document — kept intra-module until Module G/N land. */
  async hasSignedContract(enquiryId: string): Promise<boolean> {
    const row = await this.prisma.bookingMilestone.findFirst({
      where: {
        enquiryId,
        milestoneType: "contract_signed",
        status: "done",
        documentId: { not: null },
        deletedAt: null,
      },
      select: { id: true },
    });
    return row !== null;
  }

  private filters(query: BookingMilestoneListQuery): Prisma.BookingMilestoneWhereInput {
    const where: Prisma.BookingMilestoneWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.milestoneType) where.milestoneType = query.milestoneType;
    return where;
  }

  private async page(
    where: Prisma.BookingMilestoneWhereInput,
    query: BookingMilestoneListQuery,
  ): Promise<{ rows: BookingMilestoneRow[]; nextCursor: string | null }> {
    const limit = query.limit;
    const rows = await this.prisma.bookingMilestone.findMany({
      where: { ...where, deletedAt: null },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: MILESTONE_SELECT,
    });
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    return {
      rows: pageRows,
      nextCursor: hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null,
    };
  }
}
