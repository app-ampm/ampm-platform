import { Injectable } from "@nestjs/common";
import type { HotelEnquiryProposalSummary, HotelEnquiryStatus } from "@ampm/core";

import { PrismaService } from "../../db/prisma.service.js";
import type { Prisma } from "../../generated/prisma/client.js";

/**
 * What the staff views add to an enquiry row: who sent it, for which hotel, who holds it, and its newest
 * proposal.
 */
export interface EnquiryStaffExtras {
  readonly accountName: string | null;
  readonly hotelName: string | null;
  readonly assignedUserName: string | null;
  readonly latestProposal: HotelEnquiryProposalSummary | null;
}

export const NO_EXTRAS: EnquiryStaffExtras = {
  accountName: null,
  hotelName: null,
  assignedUserName: null,
  latestProposal: null,
};

interface EnquiryKeys {
  readonly id: string;
  readonly accountId: string;
  readonly hotelId: string;
  readonly assignedUserId: string | null;
}

/**
 * The read-side lookups the staff enquiry queue needs beside its rows (api.md repository layer: queries
 * only). One batched query per kind for a whole page, never one per row. The account's and the hotel's
 * names come from the CRM `client_accounts` and the Module C `hotels` tables, and the holder's from the
 * Module A `users` table: the same recorded cross-module read shortcut as `accountIdForUser` (D-063),
 * narrowed to the name column, to retire with it when a shared directory accessor lands. The latest
 * proposal and the stage counts are Module D's own.
 */
@Injectable()
export class EnquiryInsightsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The extras for each row, keyed by enquiry id. */
  async extrasFor(rows: readonly EnquiryKeys[]): Promise<Map<string, EnquiryStaffExtras>> {
    if (rows.length === 0) return new Map();
    const holderIds = rows.flatMap((row) => (row.assignedUserId ? [row.assignedUserId] : []));
    const [accounts, hotels, holders, proposals] = await Promise.all([
      this.accountNames(rows.map((row) => row.accountId)),
      this.hotelNames(rows.map((row) => row.hotelId)),
      this.userNames(holderIds),
      this.latestProposals(rows.map((row) => row.id)),
    ]);
    return new Map(
      rows.map((row) => [
        row.id,
        {
          accountName: accounts.get(row.accountId) ?? null,
          hotelName: hotels.get(row.hotelId) ?? null,
          assignedUserName: row.assignedUserId ? (holders.get(row.assignedUserId) ?? null) : null,
          latestProposal: proposals.get(row.id) ?? null,
        },
      ]),
    );
  }

  /** The extras for one row (an enquiry's detail, or the record a write returns). */
  async extrasOf(row: EnquiryKeys): Promise<EnquiryStaffExtras> {
    return (await this.extrasFor([row])).get(row.id) ?? NO_EXTRAS;
  }

  /** How many enquiries in scope hold each status; statuses with none are left out. */
  async countByStatus(
    scopeWhere: Prisma.HotelEnquiryWhereInput,
  ): Promise<ReadonlyMap<HotelEnquiryStatus, number>> {
    const groups = await this.prisma.hotelEnquiry.groupBy({
      by: ["status"],
      where: { ...scopeWhere, deletedAt: null },
      _count: { _all: true },
    });
    return new Map(groups.map((group) => [group.status, group._count._all]));
  }

  /** How many open enquiries in scope one person holds, or (null) nobody on the team holds yet. */
  async countOpenHeldBy(
    scopeWhere: Prisma.HotelEnquiryWhereInput,
    assignedUserId: string | null,
    openStatuses: readonly HotelEnquiryStatus[],
  ): Promise<number> {
    return this.prisma.hotelEnquiry.count({
      where: {
        ...scopeWhere,
        assignedUserId,
        status: { in: [...openStatuses] },
        deletedAt: null,
      },
    });
  }

  private async accountNames(ids: readonly string[]): Promise<Map<string, string>> {
    const accounts = await this.prisma.clientAccount.findMany({
      where: { id: { in: [...new Set(ids)] }, deletedAt: null },
      select: { id: true, name: true },
    });
    return new Map(accounts.map((account) => [account.id, account.name]));
  }

  /** Names only; a deleted user still names the enquiries they held, so it is not filtered out. */
  private async userNames(ids: readonly string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, name: true },
    });
    return new Map(users.map((user) => [user.id, user.name]));
  }

  private async hotelNames(ids: readonly string[]): Promise<Map<string, string>> {
    const hotels = await this.prisma.hotel.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, name: true },
    });
    return new Map(hotels.map((hotel) => [hotel.id, hotel.name]));
  }

  /** The highest version per enquiry (Postgres DISTINCT ON through Prisma's `distinct`). */
  private async latestProposals(
    enquiryIds: readonly string[],
  ): Promise<Map<string, HotelEnquiryProposalSummary>> {
    const proposals = await this.prisma.hotelProposal.findMany({
      where: { enquiryId: { in: [...enquiryIds] }, deletedAt: null },
      orderBy: [{ enquiryId: "asc" }, { versionNumber: "desc" }],
      distinct: ["enquiryId"],
      select: { id: true, enquiryId: true, versionNumber: true, status: true },
    });
    return new Map(
      proposals.map((proposal) => [
        proposal.enquiryId,
        { id: proposal.id, versionNumber: proposal.versionNumber, status: proposal.status },
      ]),
    );
  }
}
