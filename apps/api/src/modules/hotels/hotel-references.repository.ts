import { Injectable } from "@nestjs/common";
import type { WeddingReferenceCreateRequest, WeddingReferenceUpdateRequest } from "@ampm/core";

import { PrismaService } from "../../db/prisma.service.js";
import { Prisma } from "../../generated/prisma/client.js";

/*
 * Reads and writes for a hotel's previous-wedding references (Module C `hotel_wedding_references`, feature
 * 9.3). Ownership is enforced by the controller's `hotels.wedding_references.*` keys plus the hotel scoping
 * here; every query carries `deletedAt: null` (soft-delete scoping, security.md). The GP-20 publishing
 * rule (`client_visible` ⇒ consent on file) lives in the service — the repository stores what it is given.
 */

const REFERENCE_SELECT = {
  id: true,
  hotelId: true,
  projectId: true,
  eventYear: true,
  guestCount: true,
  descriptionClient: true,
  clientVisible: true,
  consentDocumentId: true,
  createdAt: true,
} as const satisfies Prisma.HotelWeddingReferenceSelect;

export type WeddingReferenceRow = Prisma.HotelWeddingReferenceGetPayload<{
  select: typeof REFERENCE_SELECT;
}>;

/*
 * The client-detail projection: the social-proof content only. The internal `projectId`/`consentDocumentId`
 * are NOT selected, so they cannot reach a client response even by accident (security.md: one model per
 * audience). `clientVisible` is not selected either — the WHERE already restricts to the visible rows.
 */
const CLIENT_REFERENCE_SELECT = {
  id: true,
  eventYear: true,
  guestCount: true,
  descriptionClient: true,
} as const satisfies Prisma.HotelWeddingReferenceSelect;

export type WeddingReferenceClientRow = Prisma.HotelWeddingReferenceGetPayload<{
  select: typeof CLIENT_REFERENCE_SELECT;
}>;

@Injectable()
export class HotelReferencesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async hotelExists(hotelId: string): Promise<boolean> {
    const row = await this.prisma.hotel.findFirst({
      where: { id: hotelId, deletedAt: null },
      select: { id: true },
    });
    return row !== null;
  }

  list(hotelId: string): Promise<WeddingReferenceRow[]> {
    return this.prisma.hotelWeddingReference.findMany({
      where: { hotelId, deletedAt: null },
      orderBy: [{ eventYear: "desc" }, { id: "desc" }],
      select: REFERENCE_SELECT,
    });
  }

  /** A hotel's consented, client-visible references for a client/demo detail (repository scoping, GP-20). */
  listClientVisible(hotelId: string): Promise<WeddingReferenceClientRow[]> {
    return this.prisma.hotelWeddingReference.findMany({
      where: { hotelId, clientVisible: true, deletedAt: null },
      orderBy: [{ eventYear: "desc" }, { id: "desc" }],
      select: CLIENT_REFERENCE_SELECT,
    });
  }

  findInHotel(hotelId: string, referenceId: string): Promise<WeddingReferenceRow | null> {
    return this.prisma.hotelWeddingReference.findFirst({
      where: { id: referenceId, hotelId, deletedAt: null },
      select: REFERENCE_SELECT,
    });
  }

  create(
    hotelId: string,
    request: WeddingReferenceCreateRequest,
    actorId: string,
  ): Promise<WeddingReferenceRow> {
    return this.prisma.hotelWeddingReference.create({
      data: {
        hotelId,
        projectId: request.projectId ?? null,
        eventYear: request.eventYear,
        guestCount: request.guestCount ?? null,
        descriptionClient: request.descriptionClient ?? null,
        clientVisible: request.clientVisible,
        consentDocumentId: request.consentDocumentId ?? null,
        createdBy: actorId,
        updatedBy: actorId,
      },
      select: REFERENCE_SELECT,
    });
  }

  update(
    referenceId: string,
    patch: WeddingReferenceUpdateRequest,
    actorId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<WeddingReferenceRow> {
    return (tx ?? this.prisma).hotelWeddingReference.update({
      where: { id: referenceId },
      data: {
        projectId: patch.projectId,
        eventYear: patch.eventYear,
        guestCount: patch.guestCount,
        descriptionClient: patch.descriptionClient,
        clientVisible: patch.clientVisible,
        consentDocumentId: patch.consentDocumentId,
        updatedBy: actorId,
      },
      select: REFERENCE_SELECT,
    });
  }

  /** Soft-delete if present; idempotent (removing an already-removed reference is a no-op). */
  async softDelete(
    referenceId: string,
    actorId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await (tx ?? this.prisma).hotelWeddingReference.updateMany({
      where: { id: referenceId, deletedAt: null },
      data: { deletedAt: new Date(), updatedBy: actorId },
    });
  }

  /** Runs `work` in one transaction so a self-audited mutation and its audit event commit together. */
  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }
}
