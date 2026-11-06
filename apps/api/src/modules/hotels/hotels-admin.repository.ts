import { Injectable } from "@nestjs/common";
import type { HotelStatus } from "@ampm/core";

import { PrismaService } from "../../db/prisma.service.js";
import { Prisma } from "../../generated/prisma/client.js";

/*
 * The STAFF hotel catalogue repository (HT/SA; feature 9.1). Unlike the client discovery repository,
 * this selects the RESTRICTED-NOTES internal fields (internal_rating/notes) and joins contacts, because
 * the audience is staff with the `hotels.*` keys. No entitlement scope here — authorisation is the
 * controller's `@RequirePermission` plus the soft-delete filter. Writes take an optional transaction so
 * the import can upsert many rows atomically. Rooms/venues/contacts are read on the detail; their write
 * paths are a follow-up within 9.1.
 */

const STAFF_HOTEL_SELECT = {
  id: true,
  destinationId: true,
  name: true,
  slug: true,
  brand: true,
  starCategory: true,
  address: true,
  latitude: true,
  longitude: true,
  descriptionClient: true,
  website: true,
  status: true,
  demoVisible: true,
  publicShowcase: true,
  internalRating: true,
  internalNotes: true,
  totalRooms: true,
  streetViewRef: true,
  lastVerifiedAt: true,
} as const;

const DESTINATION_SELECT = {
  id: true,
  name: true,
  slug: true,
  region: true,
  state: true,
  country: true,
  description: true,
  status: true,
  publicVisible: true,
} as const;

const ROOM_SELECT = {
  id: true,
  hotelId: true,
  name: true,
  roomCount: true,
  maxOccupancy: true,
  sizeSqm: true,
  facilities: true,
  description: true,
} as const;

const VENUE_SELECT = {
  id: true,
  hotelId: true,
  name: true,
  venueType: true,
  isIndoor: true,
  areaSqm: true,
  capacityBanquet: true,
  capacityTheatre: true,
  capacityReception: true,
  facilities: true,
  description: true,
} as const;

const CONTACT_SELECT = {
  id: true,
  hotelId: true,
  name: true,
  roleTitle: true,
  phone: true,
  email: true,
  isPrimary: true,
} as const;

const STAFF_HOTEL_DETAIL_SELECT = {
  ...STAFF_HOTEL_SELECT,
  destination: { select: DESTINATION_SELECT },
  rooms: { where: { deletedAt: null }, orderBy: { name: "asc" }, select: ROOM_SELECT },
  venues: { where: { deletedAt: null }, orderBy: { name: "asc" }, select: VENUE_SELECT },
  contacts: {
    where: { deletedAt: null },
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    select: CONTACT_SELECT,
  },
} as const satisfies Prisma.HotelSelect;

export type StaffHotelRow = Prisma.HotelGetPayload<{ select: typeof STAFF_HOTEL_SELECT }>;
export type StaffHotelDetailRow = Prisma.HotelGetPayload<{
  select: typeof STAFF_HOTEL_DETAIL_SELECT;
}>;
export type DestinationRow = Prisma.DestinationGetPayload<{ select: typeof DESTINATION_SELECT }>;

/** The columns the import or a create writes to a hotel; `destinationId`/`slug`/`name` are always set. */
export type HotelWriteData = Omit<
  Prisma.HotelUncheckedCreateInput,
  "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy" | "deletedAt"
>;
export type HotelUpdatePatch = Partial<Omit<HotelWriteData, "slug">>;
export type DestinationWriteData = Omit<
  Prisma.DestinationUncheckedCreateInput,
  "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy" | "deletedAt"
>;
export type DestinationUpdatePatch = Partial<Omit<DestinationWriteData, "slug">>;

@Injectable()
export class HotelsAdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    filters: { destinationId?: string; status?: HotelStatus; q?: string },
    limit: number,
    cursor?: string,
  ): Promise<{ rows: StaffHotelRow[]; nextCursor: string | null }> {
    const where: Prisma.HotelWhereInput = { deletedAt: null };
    if (filters.destinationId) where.destinationId = filters.destinationId;
    if (filters.status) where.status = filters.status;
    if (filters.q) where.name = { contains: filters.q, mode: "insensitive" };
    const hotels = await this.prisma.hotel.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: STAFF_HOTEL_SELECT,
    });
    const hasMore = hotels.length > limit;
    const rows = hasMore ? hotels.slice(0, limit) : hotels;
    return { rows, nextCursor: hasMore ? rows[rows.length - 1]!.id : null };
  }

  findDetail(hotelId: string): Promise<StaffHotelDetailRow | null> {
    return this.prisma.hotel.findFirst({
      where: { id: hotelId, deletedAt: null },
      select: STAFF_HOTEL_DETAIL_SELECT,
    });
  }

  findById(hotelId: string): Promise<StaffHotelRow | null> {
    return this.prisma.hotel.findFirst({
      where: { id: hotelId, deletedAt: null },
      select: STAFF_HOTEL_SELECT,
    });
  }

  async slugExists(slug: string, exceptId?: string): Promise<boolean> {
    const row = await this.prisma.hotel.findFirst({
      where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    return row !== null;
  }

  async createHotel(data: HotelWriteData, actorId: string): Promise<string> {
    const row = await this.prisma.hotel.create({
      data: { ...data, createdBy: actorId, updatedBy: actorId },
      select: { id: true },
    });
    return row.id;
  }

  async updateHotel(
    hotelId: string,
    patch: HotelUpdatePatch,
    actorId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await (tx ?? this.prisma).hotel.update({
      where: { id: hotelId },
      data: { ...patch, updatedBy: actorId },
    });
  }

  async softDeleteHotel(
    hotelId: string,
    actorId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await (tx ?? this.prisma).hotel.update({
      where: { id: hotelId },
      data: { deletedAt: new Date(), updatedBy: actorId },
    });
  }

  // --- Destinations ---

  listDestinations(): Promise<DestinationRow[]> {
    return this.prisma.destination.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: DESTINATION_SELECT,
    });
  }

  findDestinationBySlug(
    slug: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ id: string } | null> {
    return (tx ?? this.prisma).destination.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true },
    });
  }

  findDestinationById(id: string): Promise<DestinationRow | null> {
    return this.prisma.destination.findFirst({
      where: { id, deletedAt: null },
      select: DESTINATION_SELECT,
    });
  }

  async createDestination(
    data: DestinationWriteData,
    actorId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const row = await (tx ?? this.prisma).destination.create({
      data: { ...data, createdBy: actorId, updatedBy: actorId },
      select: { id: true },
    });
    return row.id;
  }

  async updateDestination(
    id: string,
    patch: DestinationUpdatePatch,
    actorId: string,
  ): Promise<void> {
    await this.prisma.destination.update({ where: { id }, data: { ...patch, updatedBy: actorId } });
  }

  // --- Import support (feature 9.1 / AC-35.1). Upsert by slug so a re-run of the same file is a no-op. ---

  /** The hotel's current id if the slug exists (not soft-deleted), else null — the import's create/update fork. */
  async hotelIdBySlug(slug: string, tx: Prisma.TransactionClient): Promise<string | null> {
    const row = await tx.hotel.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  async insertHotel(
    data: HotelWriteData,
    actorId: string,
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const row = await tx.hotel.create({
      data: { ...data, createdBy: actorId, updatedBy: actorId },
      select: { id: true },
    });
    return row.id;
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
    data: {
      status: "validating" | "applied" | "failed";
      rowCount: number;
      errorReportJson: Prisma.InputJsonValue;
    },
    actorId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await (tx ?? this.prisma).importJob.update({
      where: { id },
      data: { ...data, updatedBy: actorId },
    });
  }

  /** Runs `work` inside a single transaction so the valid rows of an import apply all-or-nothing. */
  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }
}
