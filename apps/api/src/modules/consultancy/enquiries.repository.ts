import { Injectable } from "@nestjs/common";
import type { HotelEnquiryListQuery } from "@ampm/core";

import { PrismaService } from "../../db/prisma.service.js";
import {
  Prisma,
  type HotelEnquiryOutcome,
  type HotelEnquiryStatus,
} from "../../generated/prisma/client.js";

const ENQUIRY_SELECT = {
  id: true,
  accountId: true,
  projectId: true,
  hotelId: true,
  requestedByUserId: true,
  assignedUserId: true,
  serviceAgreementId: true,
  status: true,
  dateFrom: true,
  dateTo: true,
  datesFlexible: true,
  guestEstimate: true,
  roomsRequired: true,
  functionsSummary: true,
  contactPreference: true,
  notesClient: true,
  notesInternal: true,
  submittedAt: true,
  closedAt: true,
  outcome: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.HotelEnquirySelect;

export type EnquiryRow = Prisma.HotelEnquiryGetPayload<{ select: typeof ENQUIRY_SELECT }>;

export interface EnquiryWriteData {
  readonly accountId: string;
  readonly hotelId: string;
  readonly requestedByUserId: string;
  readonly status: HotelEnquiryStatus;
  readonly dateFrom: Date;
  readonly dateTo: Date;
  readonly datesFlexible: boolean;
  readonly guestEstimate: number;
  readonly roomsRequired: number | null;
  readonly functionsSummary: string | null;
  readonly contactPreference: string | null;
  readonly notesClient: string | null;
  readonly submittedAt: Date | null;
}

export interface EnquiryStatusPatch {
  readonly status: HotelEnquiryStatus;
  readonly outcome?: HotelEnquiryOutcome | null;
  readonly closedAt?: Date | null;
}

export interface EnquiryStaffPatch {
  readonly assignedUserId?: string | null;
  readonly notesInternal?: string | null;
}

/**
 * Prisma access for hotel enquiries (api.md repository layer: queries + scoping, no business rules).
 * Every query carries `deletedAt: null`; the client paths are scoped to the caller's own account, and
 * the staff list spreads the `recordScope` where (project membership + soft delete) the guard resolved.
 */
@Injectable()
export class EnquiriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The caller's own account from their contact row — never from the request (security.md). Reads a CRM
   * table (account_contacts) from Module D: the same recorded cross-module shortcut HotelsRepository and
   * PortalService use (D-063); to move onto the principal when account resolution is consolidated.
   */
  async accountIdForUser(userId: string): Promise<string | null> {
    const contact = await this.prisma.accountContact.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { accountId: true },
    });
    return contact ? contact.accountId : null;
  }

  async create(
    data: EnquiryWriteData,
    createdBy: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<EnquiryRow> {
    return client.hotelEnquiry.create({
      data: {
        accountId: data.accountId,
        hotelId: data.hotelId,
        requestedByUserId: data.requestedByUserId,
        status: data.status,
        dateFrom: data.dateFrom,
        dateTo: data.dateTo,
        datesFlexible: data.datesFlexible,
        guestEstimate: data.guestEstimate,
        roomsRequired: data.roomsRequired,
        functionsSummary: data.functionsSummary,
        contactPreference: data.contactPreference,
        notesClient: data.notesClient,
        submittedAt: data.submittedAt,
        createdBy,
      },
      select: ENQUIRY_SELECT,
    });
  }

  async findById(id: string): Promise<EnquiryRow | null> {
    return this.prisma.hotelEnquiry.findFirst({
      where: { id, deletedAt: null },
      select: ENQUIRY_SELECT,
    });
  }

  async findByIdForAccount(id: string, accountId: string): Promise<EnquiryRow | null> {
    return this.prisma.hotelEnquiry.findFirst({
      where: { id, accountId, deletedAt: null },
      select: ENQUIRY_SELECT,
    });
  }

  /** Staff read of one enquiry within the guard's scope: an out-of-scope id is 404 (denial equals absence). */
  async findByIdInScope(
    id: string,
    scopeWhere: Prisma.HotelEnquiryWhereInput,
  ): Promise<EnquiryRow | null> {
    return this.prisma.hotelEnquiry.findFirst({
      where: { ...scopeWhere, id, deletedAt: null },
      select: ENQUIRY_SELECT,
    });
  }

  /**
   * The client users on an account (its portal logins), for a status-change notice (AC-05.3). Reads the
   * CRM `account_contacts` table from Module D — the same recorded D-063 cross-module shortcut as
   * `accountIdForUser`; both retire when account resolution moves onto the principal / a shared accessor.
   */
  async accountClientUserIds(accountId: string): Promise<string[]> {
    const contacts = await this.prisma.accountContact.findMany({
      where: { accountId, userId: { not: null }, deletedAt: null },
      select: { userId: true },
    });
    return contacts.flatMap((contact) => (contact.userId ? [contact.userId] : []));
  }

  /** The caller's existing open (non-closed) enquiry for this hotel, so a re-submit is idempotent (AC-26). */
  async findOpenForAccountHotel(accountId: string, hotelId: string): Promise<EnquiryRow | null> {
    return this.prisma.hotelEnquiry.findFirst({
      where: { accountId, hotelId, status: { not: "closed" }, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: ENQUIRY_SELECT,
    });
  }

  async listForAccount(
    accountId: string,
    query: HotelEnquiryListQuery,
  ): Promise<{ rows: EnquiryRow[]; nextCursor: string | null }> {
    return this.page({ accountId, ...this.filters(query) }, query);
  }

  async listStaff(
    scopeWhere: Prisma.HotelEnquiryWhereInput,
    query: HotelEnquiryListQuery,
  ): Promise<{ rows: EnquiryRow[]; nextCursor: string | null }> {
    return this.page({ ...scopeWhere, ...this.filters(query) }, query);
  }

  async updateStatus(
    id: string,
    patch: EnquiryStatusPatch,
    actorId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    await client.hotelEnquiry.update({ where: { id }, data: { ...patch, updatedBy: actorId } });
  }

  /**
   * A race-guarded status write: moves the row only while its status is still one of `fromStatuses`, so a
   * transition that raced a concurrent one moves 0 rows (the UPDATE's own WHERE is the guard) rather than
   * clobbering the row. Returns the rows moved; the caller treats 0 as "already moved". The precondition
   * (which statuses) is the service's, so the repository stays a generic conditional update.
   */
  async updateStatusFrom(
    id: string,
    fromStatuses: readonly HotelEnquiryStatus[],
    patch: EnquiryStatusPatch,
    actorId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    const { count } = await client.hotelEnquiry.updateMany({
      where: { id, status: { in: [...fromStatuses] }, deletedAt: null },
      data: { ...patch, updatedBy: actorId },
    });
    return count;
  }

  async updateStaffFields(
    id: string,
    patch: EnquiryStaffPatch,
    actorId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    await client.hotelEnquiry.update({ where: { id }, data: { ...patch, updatedBy: actorId } });
  }

  async updateNotesClient(id: string, notesClient: string | null, actorId: string): Promise<void> {
    await this.prisma.hotelEnquiry.update({
      where: { id },
      data: { notesClient, updatedBy: actorId },
    });
  }

  private filters(query: HotelEnquiryListQuery): Prisma.HotelEnquiryWhereInput {
    const where: Prisma.HotelEnquiryWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.hotelId) where.hotelId = query.hotelId;
    return where;
  }

  private async page(
    where: Prisma.HotelEnquiryWhereInput,
    query: HotelEnquiryListQuery,
  ): Promise<{ rows: EnquiryRow[]; nextCursor: string | null }> {
    const limit = query.limit;
    const rows = await this.prisma.hotelEnquiry.findMany({
      where: { ...where, deletedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: ENQUIRY_SELECT,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return { rows: page, nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null };
  }
}
