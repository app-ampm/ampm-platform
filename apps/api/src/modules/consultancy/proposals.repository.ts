import { Injectable } from "@nestjs/common";
import type { HotelProposalListQuery } from "@ampm/core";

import { PrismaService } from "../../db/prisma.service.js";
import {
  Prisma,
  type HotelProposalStatus,
  type HotelRateItemType,
} from "../../generated/prisma/client.js";

const LINE_SELECT = {
  id: true,
  proposalId: true,
  itemType: true,
  description: true,
  quantity: true,
  unitAmount: true,
  totalAmount: true,
  clientVisible: true,
} as const satisfies Prisma.HotelProposalLineSelect;

const PROPOSAL_SELECT = {
  id: true,
  enquiryId: true,
  hotelId: true,
  versionNumber: true,
  status: true,
  validUntil: true,
  clientTotalAmount: true,
  internalTotalAmount: true,
  currency: true,
  documentId: true,
  sharedAt: true,
  decidedAt: true,
  decidedByUserId: true,
  approvalId: true,
  supersedesProposalId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  lines: { where: { deletedAt: null }, orderBy: { createdAt: "asc" }, select: LINE_SELECT },
} as const satisfies Prisma.HotelProposalSelect;

export type ProposalRow = Prisma.HotelProposalGetPayload<{ select: typeof PROPOSAL_SELECT }>;
export type ProposalLineRow = ProposalRow["lines"][number];

/** A line as written (money already converted to a numeric(14,2) string by the service). */
export interface ProposalLineWrite {
  readonly itemType: HotelRateItemType;
  readonly description: string;
  readonly quantity: number;
  readonly unitAmount: string;
  readonly totalAmount: string;
  readonly clientVisible: boolean;
}

export interface ProposalWriteData {
  readonly enquiryId: string;
  readonly hotelId: string;
  readonly versionNumber: number;
  readonly validUntil: Date | null;
  readonly clientTotalAmount: string;
  readonly internalTotalAmount: string;
  readonly currency: string;
  readonly supersedesProposalId: string | null;
}

export interface ProposalTermsPatch {
  readonly validUntil?: Date | null;
  readonly clientTotalAmount?: string;
  readonly internalTotalAmount?: string;
}

export interface ProposalStatusPatch {
  readonly status: HotelProposalStatus;
  readonly sharedAt?: Date;
  readonly decidedAt?: Date;
  readonly decidedByUserId?: string | null;
  readonly supersedesProposalId?: string;
}

/**
 * Prisma access for hotel proposals (api.md repository layer: queries + scoping, no business rules).
 * Every query carries `deletedAt: null`. A proposal is created with its lines in one nested write; a
 * revision is a brand-new version row. Status writes are a compare-and-swap. Client reads are reached
 * only after the service has verified the proposal's enquiry is the caller's own.
 */
@Injectable()
export class ProposalsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The next version number for an enquiry (v1, v2, …); computed in the create transaction. */
  async nextVersion(enquiryId: string, client: Prisma.TransactionClient): Promise<number> {
    const max = await client.hotelProposal.aggregate({
      where: { enquiryId, deletedAt: null },
      _max: { versionNumber: true },
    });
    return (max._max.versionNumber ?? 0) + 1;
  }

  async create(
    data: ProposalWriteData,
    lines: readonly ProposalLineWrite[],
    createdBy: string,
    client: Prisma.TransactionClient,
  ): Promise<ProposalRow> {
    return client.hotelProposal.create({
      data: {
        ...data,
        status: "draft",
        createdBy,
        lines: { create: lines.map((line) => ({ ...line, createdBy })) },
      },
      select: PROPOSAL_SELECT,
    });
  }

  async findById(id: string): Promise<ProposalRow | null> {
    return this.prisma.hotelProposal.findFirst({
      where: { id, deletedAt: null },
      select: PROPOSAL_SELECT,
    });
  }

  async findByIdInScope(
    id: string,
    scopeWhere: Prisma.HotelProposalWhereInput,
  ): Promise<ProposalRow | null> {
    return this.prisma.hotelProposal.findFirst({
      where: { ...scopeWhere, id, deletedAt: null },
      select: PROPOSAL_SELECT,
    });
  }

  async listStaff(
    scopeWhere: Prisma.HotelProposalWhereInput,
    query: HotelProposalListQuery,
  ): Promise<{ rows: ProposalRow[]; nextCursor: string | null }> {
    return this.page({ ...scopeWhere, ...this.filters(query) }, query);
  }

  /** The client path: a draft is AMPM's internal work-in-progress, so it is never listed to the client
   *  (denial = absence). A client-supplied `?status=draft` is ignored; the floor is `not draft`. */
  async listForEnquiry(
    enquiryId: string,
    query: HotelProposalListQuery,
  ): Promise<{ rows: ProposalRow[]; nextCursor: string | null }> {
    const status =
      query.status && query.status !== "draft" ? query.status : { not: "draft" as const };
    return this.page({ enquiryId, status }, query);
  }

  /** A proposal still in play for an enquiry (anything but superseded/declined) — so `create` can refuse
   *  a second live version and require a `revise` instead (one live version per enquiry). */
  async liveProposalExists(enquiryId: string): Promise<boolean> {
    const row = await this.prisma.hotelProposal.findFirst({
      where: { enquiryId, status: { notIn: ["superseded", "declined"] }, deletedAt: null },
      select: { id: true },
    });
    return row !== null;
  }

  /**
   * Replace a draft's terms and (when `lines` is given) its whole line set. A compare-and-swap on
   * `status: "draft"` makes "immutable once shared" atomic (AC-09): if a concurrent share has flipped the
   * row, 0 rows change and the lines are left untouched — the service then 409s. Lines are soft-deleted
   * and re-created only after a non-zero swap, so a shared version's lines are never touched.
   */
  async updateDraft(
    id: string,
    patch: ProposalTermsPatch,
    lines: readonly ProposalLineWrite[] | undefined,
    actorId: string,
    client: Prisma.TransactionClient,
  ): Promise<number> {
    const result = await client.hotelProposal.updateMany({
      where: { id, status: "draft", deletedAt: null },
      data: { ...patch, updatedBy: actorId },
    });
    if (result.count === 0 || lines === undefined) return result.count;
    await client.hotelProposalLine.updateMany({
      where: { proposalId: id, deletedAt: null },
      data: { deletedAt: new Date(), updatedBy: actorId },
    });
    await client.hotelProposalLine.createMany({
      data: lines.map((line) => ({ ...line, proposalId: id, createdBy: actorId })),
    });
    return result.count;
  }

  /**
   * Compare-and-swap on the status: the proposal moves only if it still holds `expectedStatus`, so two
   * concurrent moves (a client decision racing a staff supersede) cannot both win. Returns rows changed.
   */
  async updateStatus(
    id: string,
    expectedStatus: HotelProposalStatus,
    patch: ProposalStatusPatch,
    actorId: string,
    client: Prisma.TransactionClient,
  ): Promise<number> {
    const result = await client.hotelProposal.updateMany({
      where: { id, status: expectedStatus },
      data: { ...patch, updatedBy: actorId },
    });
    return result.count;
  }

  private filters(query: HotelProposalListQuery): Prisma.HotelProposalWhereInput {
    const where: Prisma.HotelProposalWhereInput = {};
    if (query.enquiryId) where.enquiryId = query.enquiryId;
    if (query.status) where.status = query.status;
    return where;
  }

  private async page(
    where: Prisma.HotelProposalWhereInput,
    query: HotelProposalListQuery,
  ): Promise<{ rows: ProposalRow[]; nextCursor: string | null }> {
    const limit = query.limit;
    const rows = await this.prisma.hotelProposal.findMany({
      where: { ...where, deletedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: PROPOSAL_SELECT,
    });
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    return {
      rows: pageRows,
      nextCursor: hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null,
    };
  }
}
