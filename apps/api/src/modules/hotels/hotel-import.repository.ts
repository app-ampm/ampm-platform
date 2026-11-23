import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../db/prisma.service.js";
import { Prisma } from "../../generated/prisma/client.js";
import { STAFF_HOTEL_SELECT } from "./hotels-admin.repository.js";

/*
 * The import's own reads and its job record (TW-25; AC-35.1; D-181). The lookups deliberately include
 * soft-deleted rows: a hotel's and a destination's slug stay unique across deleted rows, so a row naming a
 * deleted one must be reported, not inserted into the unique index. The hotel writes themselves go
 * through HotelsAdminRepository.
 */

/** A hotel a file names: every staff column, its deletion and its destination's slug. */
const IMPORT_TARGET_SELECT = {
  ...STAFF_HOTEL_SELECT,
  deletedAt: true,
  destination: { select: { slug: true } },
} as const satisfies Prisma.HotelSelect;

export type ImportTargetRow = Prisma.HotelGetPayload<{ select: typeof IMPORT_TARGET_SELECT }>;

const IMPORT_DESTINATION_SELECT = {
  id: true,
  slug: true,
  country: true,
  deletedAt: true,
} as const satisfies Prisma.DestinationSelect;

export type ImportDestinationRow = Prisma.DestinationGetPayload<{
  select: typeof IMPORT_DESTINATION_SELECT;
}>;

/** What a finished job records. */
export interface ImportJobOutcome {
  readonly status: "validating" | "applied" | "failed";
  readonly rowCount: number;
  readonly errorReportJson: Prisma.InputJsonValue;
}

@Injectable()
export class HotelImportRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The hotels with these web addresses, soft-deleted ones INCLUDED (see the file comment). */
  findHotelsBySlugs(
    slugs: readonly string[],
    tx?: Prisma.TransactionClient,
  ): Promise<ImportTargetRow[]> {
    return (tx ?? this.prisma).hotel.findMany({
      where: { slug: { in: [...slugs] } },
      select: IMPORT_TARGET_SELECT,
    });
  }

  /** The destinations with these slugs, soft-deleted ones INCLUDED (see the file comment). */
  findDestinationsBySlugs(
    slugs: readonly string[],
    tx?: Prisma.TransactionClient,
  ): Promise<ImportDestinationRow[]> {
    return (tx ?? this.prisma).destination.findMany({
      where: { slug: { in: [...slugs] } },
      select: IMPORT_DESTINATION_SELECT,
    });
  }

  async createImportJob(
    importType: "hotels" | "guests" | "vendors",
    actorId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const row = await (tx ?? this.prisma).importJob.create({
      data: { importType, status: "validating", createdBy: actorId, updatedBy: actorId },
      select: { id: true },
    });
    return row.id;
  }

  async finishImportJob(
    id: string,
    outcome: ImportJobOutcome,
    actorId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await (tx ?? this.prisma).importJob.update({
      where: { id },
      data: { ...outcome, updatedBy: actorId },
    });
  }
}
