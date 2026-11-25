import { Injectable } from "@nestjs/common";
import { STAFF_ROLES } from "@ampm/policy";

import { PrismaService } from "../../../db/prisma.service.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import type { FormRequest } from "./hotel-form-state.js";

/*
 * The hotel information requests as the public form reads them (D-189 §4 and §5): found only by the
 * SHA-256 of their link's secret, never by id from outside, and read with nothing about the hotel but
 * whether it was deleted. Soft-deleted requests are left out. Module C, as the request tables are.
 */

/** Every column the form reads of a request; the hotel only for whether it was deleted. */
export const FORM_REQUEST_SELECT = {
  id: true,
  isTest: true,
  status: true,
  expiresAt: true,
  statusOnlyUntil: true,
  tokenGeneration: true,
  displayLabel: true,
  staffNote: true,
  hotel: { select: { deletedAt: true } },
} as const satisfies Prisma.HotelInfoRequestSelect;

type FormRequestRow = Prisma.HotelInfoRequestGetPayload<{ select: typeof FORM_REQUEST_SELECT }>;

/** A request as the form reads it, from its row. */
export function toFormRequest(row: FormRequestRow): FormRequest {
  const { hotel, ...fields } = row;
  return { ...fields, hotelDeleted: hotel !== null && hotel.deletedAt !== null };
}

/** A request found by its link, with the stored hash the caller compares in constant time. */
export interface LinkedRequest extends FormRequest {
  readonly tokenHash: string;
}

/** The staff roles the global SMS cap's alert goes to (D-189 §3), as the disk check's (D-177). */
const ALERT_ROLE_KEYS: string[] = [STAFF_ROLES.SA.key, STAFF_ROLES.HT.key];

@Injectable()
export class HotelFormRequestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The live (not deleted) request whose link's hash this is; null when none. */
  async findByLinkHash(hash: string): Promise<LinkedRequest | null> {
    const row = await this.prisma.hotelInfoRequest.findFirst({
      where: { tokenHash: hash, deletedAt: null },
      select: { ...FORM_REQUEST_SELECT, tokenHash: true },
    });
    if (row === null) return null;
    const { tokenHash, ...request } = row;
    return { ...toFormRequest(request), tokenHash };
  }

  /**
   * Locks a request's row until the transaction ends, then reads it: a verify takes it first, so the
   * people of one request are counted and created one verify at a time, and a staff change (revoke,
   * reissue) that is writing is waited for and seen. Null when it is gone or deleted.
   */
  async lockForForm(id: string, tx: Prisma.TransactionClient): Promise<FormRequest | null> {
    await tx.$queryRaw`
      SELECT id FROM hotel_info_requests WHERE id = ${id}::uuid AND deleted_at IS NULL FOR UPDATE`;
    const row = await tx.hotelInfoRequest.findFirst({
      where: { id, deletedAt: null },
      select: FORM_REQUEST_SELECT,
    });
    return row === null ? null : toFormRequest(row);
  }

  /** The active staff users who hold the Super Admin or the Hotel team role. */
  async alertRecipientIds(): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        userType: "staff",
        status: "active",
        deletedAt: null,
        roles: { some: { role: { roleKey: { in: ALERT_ROLE_KEYS }, deletedAt: null } } },
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    return users.map((user) => user.id);
  }

  /** Runs `work` in one transaction: a change, its event and its audit commit together. */
  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }
}
