import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../db/prisma.service.js";
import type { Prisma } from "../../generated/prisma/client.js";

/*
 * The hotel side of a hotel's documents library (D-187 §6): whether the hotel is live, and its lock.
 * The documents themselves are Module N's, reached only through its services (a downward C→N
 * dependency); this repository reads the hotels table alone.
 */
@Injectable()
export class HotelDocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Whether a live hotel has this id: a removed hotel has no documents library. */
  async hotelExists(hotelId: string): Promise<boolean> {
    const row = await this.prisma.hotel.findFirst({
      where: { id: hotelId, deletedAt: null },
      select: { id: true },
    });
    return row !== null;
  }

  /**
   * Locks a live hotel's row until the transaction ends, so uploads to one hotel count its documents
   * one at a time and never pass the cap together. False when there is no such hotel (removed meanwhile).
   */
  async lockLiveHotel(hotelId: string, tx: Prisma.TransactionClient): Promise<boolean> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM hotels WHERE id = ${hotelId}::uuid AND deleted_at IS NULL FOR UPDATE`;
    return rows.length > 0;
  }
}
