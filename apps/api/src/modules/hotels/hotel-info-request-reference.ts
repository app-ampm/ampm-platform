import { errors, hotelInfoRequestReference } from "@ampm/core";

import type { Prisma } from "../../generated/prisma/client.js";

/** Anything that runs raw SQL: the PrismaService, or a transaction's client. */
export type ReferenceClient = Pick<Prisma.TransactionClient, "$queryRaw">;

/**
 * Draws a hotel information request's reference (D-188 §1): HIR, the year of `createdAt` in UTC (the
 * year its `created_at` is stored in) and the next number of the sequence `hotel_info_request_ref_seq`,
 * with four digits at least. The sequence never resets, so the year is only read. Drawing inside the
 * transaction that creates the request is safe: a sequence never hands out a number twice, though a
 * rolled-back transaction leaves a gap.
 *
 * @example
 * const reference = await nextHotelInfoRequestReference(tx, now); // "HIR-2026-0001"
 */
export async function nextHotelInfoRequestReference(
  client: ReferenceClient,
  createdAt: Date,
): Promise<string> {
  const rows = await client.$queryRaw<{ value: bigint }[]>`
    SELECT nextval('hotel_info_request_ref_seq') AS value`;
  const value = rows[0]?.value;
  if (value === undefined) throw errors.internal("The request reference sequence answered nothing");
  return hotelInfoRequestReference(createdAt.getUTCFullYear(), Number(value));
}
