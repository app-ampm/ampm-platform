import { Injectable } from "@nestjs/common";
import type { ServiceAgreementListQuery } from "@ampm/core";

import { PrismaService } from "../../../db/prisma.service.js";
import {
  Prisma,
  type ServiceAgreementStatus,
  type ServiceFeeStructure,
} from "../../../generated/prisma/client.js";

/**
 * The statuses a client may see on the portal: an agreement AMPM has sent them, onward. A `draft` is
 * AMPM's internal work-in-progress (not yet offered) and `cancelled` is void, so both are absence (404)
 * to the client — never a placeholder fee or an unsent scope leaking before the agreement is issued.
 */
const CLIENT_VISIBLE_STATUSES: readonly ServiceAgreementStatus[] = [
  "sent",
  "accepted",
  "active",
  "completed",
];

const AGREEMENT_SELECT = {
  id: true,
  accountId: true,
  projectId: true,
  serviceTypeId: true,
  hotelEnquiryId: true,
  scopeText: true,
  feeAmount: true,
  feeStructure: true,
  currency: true,
  termsVersion: true,
  status: true,
  acceptedAt: true,
  acceptedByUserId: true,
  documentId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  serviceType: { select: { serviceKey: true, name: true, category: true } },
} as const satisfies Prisma.ServiceAgreementSelect;

export type AgreementRow = Prisma.ServiceAgreementGetPayload<{ select: typeof AGREEMENT_SELECT }>;

export interface AgreementWriteData {
  readonly accountId: string;
  readonly serviceTypeId: string;
  readonly hotelEnquiryId: string | null;
  readonly scopeText: string;
  readonly feeAmount: Prisma.Decimal;
  readonly feeStructure: ServiceFeeStructure;
  readonly currency: string;
  readonly termsVersion: string | null;
}

export interface AgreementTermsPatch {
  readonly scopeText?: string;
  readonly feeAmount?: Prisma.Decimal;
  readonly feeStructure?: ServiceFeeStructure;
  readonly termsVersion?: string | null;
}

export interface AgreementStatusPatch {
  readonly status: Prisma.ServiceAgreementUpdateInput["status"];
  readonly acceptedAt?: Date | null;
  readonly acceptedByUserId?: string | null;
}

/**
 * Prisma access for service agreements (api.md repository layer: queries + scoping, no business rules).
 * Every query carries `deletedAt: null`; client paths are scoped to the caller's own account, the staff
 * list spreads the `recordScope` where the guard resolved. `serviceType` is joined for the view's key,
 * name and category, and (on create) read to resolve the agreement's category.
 */
@Injectable()
export class ServiceAgreementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The caller's own account from their contact row — never from the request (security.md); the D-063
   *  cross-table shortcut the CRM/consultancy services share until a shared account accessor lands. */
  async accountIdForUser(userId: string): Promise<string | null> {
    const contact = await this.prisma.accountContact.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { accountId: true },
    });
    return contact ? contact.accountId : null;
  }

  /** The client users (portal logins) on an account, for the entitlement-cache bust + a status notice. */
  async accountClientUserIds(accountId: string): Promise<string[]> {
    const contacts = await this.prisma.accountContact.findMany({
      where: { accountId, userId: { not: null }, deletedAt: null },
      select: { userId: true },
    });
    return contacts.flatMap((contact) => (contact.userId ? [contact.userId] : []));
  }

  /** Whether a live (non-soft-deleted) client account exists, so a create with a bad `account_id` is a
   *  validation error at the edge rather than a dangling-FK 500. A sibling CRM read, like
   *  `accountIdForUser` above (both retire when account resolution moves onto a shared accessor). */
  async accountExists(accountId: string): Promise<boolean> {
    const row = await this.prisma.clientAccount.findFirst({
      where: { id: accountId, deletedAt: null },
      select: { id: true },
    });
    return row !== null;
  }

  /** The service_type's category (and existence), to set the agreement's subject and reject a bad id. */
  async serviceTypeCategory(serviceTypeId: string): Promise<string | null> {
    const row = await this.prisma.serviceType.findFirst({
      where: { id: serviceTypeId, isActive: true, deletedAt: null },
      select: { category: true },
    });
    return row ? row.category : null;
  }

  /** The AC-05.7 gate query (read by the consultancy module through the service): is there an active
   *  agreement for this enquiry? A plain `hotel_enquiry_id` scan — no cross-module table read elsewhere. */
  async hasActiveForEnquiry(enquiryId: string): Promise<boolean> {
    const row = await this.prisma.serviceAgreement.findFirst({
      where: { hotelEnquiryId: enquiryId, status: "active", deletedAt: null },
      select: { id: true },
    });
    return row !== null;
  }

  async create(
    data: AgreementWriteData,
    createdBy: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<AgreementRow> {
    return client.serviceAgreement.create({
      data: { ...data, status: "draft", createdBy },
      select: AGREEMENT_SELECT,
    });
  }

  async findByIdInScope(
    id: string,
    scopeWhere: Prisma.ServiceAgreementWhereInput,
  ): Promise<AgreementRow | null> {
    return this.prisma.serviceAgreement.findFirst({
      where: { ...scopeWhere, id, deletedAt: null },
      select: AGREEMENT_SELECT,
    });
  }

  async findByIdForAccount(id: string, accountId: string): Promise<AgreementRow | null> {
    return this.prisma.serviceAgreement.findFirst({
      where: { id, accountId, status: { in: [...CLIENT_VISIBLE_STATUSES] }, deletedAt: null },
      select: AGREEMENT_SELECT,
    });
  }

  async listStaff(
    scopeWhere: Prisma.ServiceAgreementWhereInput,
    query: ServiceAgreementListQuery,
  ): Promise<{ rows: AgreementRow[]; nextCursor: string | null }> {
    return this.page({ ...scopeWhere, ...this.filters(query) }, query);
  }

  async listForAccount(
    accountId: string,
    query: ServiceAgreementListQuery,
  ): Promise<{ rows: AgreementRow[]; nextCursor: string | null }> {
    // The account scope comes from the resolved principal, NEVER from the query — a client-supplied
    // `accountId` is ignored here, so it cannot widen the scope to another tenant (security.md). The
    // status is floored to the client-visible set, narrowed only to a client-visible value if asked.
    const where: Prisma.ServiceAgreementWhereInput = {
      accountId,
      status:
        query.status && CLIENT_VISIBLE_STATUSES.includes(query.status)
          ? query.status
          : { in: [...CLIENT_VISIBLE_STATUSES] },
    };
    if (query.hotelEnquiryId) where.hotelEnquiryId = query.hotelEnquiryId;
    return this.page(where, query);
  }

  async updateTerms(
    id: string,
    patch: AgreementTermsPatch,
    actorId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    await client.serviceAgreement.update({ where: { id }, data: { ...patch, updatedBy: actorId } });
  }

  /**
   * Compare-and-swap on the status: the row moves only if it still holds `expectedStatus`, so two
   * concurrent transitions (e.g. activate vs. cancel, or a double-submit) cannot both win and write a
   * misleading audit before/after. Returns the number of rows changed (0 = the row moved underneath us).
   */
  async updateStatus(
    id: string,
    expectedStatus: ServiceAgreementStatus,
    patch: AgreementStatusPatch,
    actorId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    const result = await client.serviceAgreement.updateMany({
      where: { id, status: expectedStatus },
      data: { ...patch, updatedBy: actorId },
    });
    return result.count;
  }

  private filters(query: ServiceAgreementListQuery): Prisma.ServiceAgreementWhereInput {
    const where: Prisma.ServiceAgreementWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.accountId) where.accountId = query.accountId;
    if (query.hotelEnquiryId) where.hotelEnquiryId = query.hotelEnquiryId;
    return where;
  }

  private async page(
    where: Prisma.ServiceAgreementWhereInput,
    query: ServiceAgreementListQuery,
  ): Promise<{ rows: AgreementRow[]; nextCursor: string | null }> {
    const limit = query.limit;
    const rows = await this.prisma.serviceAgreement.findMany({
      where: { ...where, deletedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: AGREEMENT_SELECT,
    });
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    return {
      rows: pageRows,
      nextCursor: hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null,
    };
  }
}
