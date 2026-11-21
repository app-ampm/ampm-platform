import { Injectable } from "@nestjs/common";
import type { SavedHotelStaffListQuery } from "@ampm/core";

import { PrismaService } from "../../db/prisma.service.js";
import type { RecordScope } from "../../db/scoping.js";
import type { Prisma } from "../../generated/prisma/client.js";

/*
 * What the staff row needs: the hotel's CLIENT-class identity (name, stars, status, destination) and the
 * client's own note. The hotel's RESTRICTED-NOTES columns and its contacts are never selected. The
 * account's name comes from the CRM `client_accounts` table through the saved hotel's own relation: the
 * recorded cross-module read shortcut (D-063), narrowed to the id and the name.
 */
const STAFF_SAVED_SELECT = {
  id: true,
  note: true,
  createdAt: true,
  hotel: {
    select: {
      id: true,
      name: true,
      starCategory: true,
      status: true,
      destination: { select: { name: true } },
    },
  },
  account: { select: { id: true, name: true } },
} as const satisfies Prisma.SavedHotelSelect;

export type SavedHotelStaffRow = Prisma.SavedHotelGetPayload<{
  select: typeof STAFF_SAVED_SELECT;
}>;

/**
 * Clients' saved hotels for staff (permission-matrix §5.3). Every query is scoped: the guard's scope
 * (a Project Manager reaches only saves linked to a wedding they are assigned to), live rows only, and
 * never a demo account's (demo isolation, A-28: the demo prospect's saves are reset nightly and are no
 * client's real interest). Queries only; the service maps the rows.
 */
@Injectable()
export class SavedHotelsStaffRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Newest save first, optionally one client's list; cursor-paginated by saved-hotel id. */
  async list(
    scope: RecordScope,
    query: SavedHotelStaffListQuery,
  ): Promise<{ rows: SavedHotelStaffRow[]; nextCursor: string | null }> {
    const where: Prisma.SavedHotelWhereInput = {
      ...scope.where,
      ...(query.accountId ? { accountId: query.accountId } : {}),
      account: { deletedAt: null, isDemo: scope.isDemo ?? false },
      hotel: { deletedAt: null },
    };
    const saved = await this.prisma.savedHotel.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: STAFF_SAVED_SELECT,
    });
    const hasMore = saved.length > query.limit;
    const rows = hasMore ? saved.slice(0, query.limit) : saved;
    return { rows, nextCursor: hasMore ? (rows.at(-1)?.id ?? null) : null };
  }
}
