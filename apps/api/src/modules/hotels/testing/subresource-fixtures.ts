import { vi } from "vitest";

import { Prisma } from "../../../generated/prisma/client.js";
import type { AuditService } from "../../../policy/audit.service.js";
import type {
  ContactRow,
  HotelSubresourcesRepository,
  RoomRow,
  VenueRow,
} from "../hotel-subresources.repository.js";
import { HotelSubresourcesService } from "../hotel-subresources.service.js";
import { HOTEL_ID } from "./staff-hotel-fixtures.js";

/*
 * Synthetic room categories, venues and contacts for the unit specs (data.md: fictitious names,
 * example.com addresses, the +9112345678xx phone range). Test-only: the build leaves `testing/` folders out.
 */

export const ROOM_ID = "0192f1a0-0000-7000-8000-0000000000f1";
export const VENUE_ID = "0192f1a0-0000-7000-8000-0000000000f2";
export const CONTACT_ID = "0192f1a0-0000-7000-8000-0000000000f3";
export const OTHER_CONTACT_ID = "0192f1a0-0000-7000-8000-0000000000f4";

/** A synthetic room category as the repository reads it, every D-178 column empty unless overridden. */
export function roomRow(overrides: Partial<RoomRow> = {}): RoomRow {
  return {
    id: ROOM_ID,
    hotelId: HOTEL_ID,
    name: "Synthetic Lake Suite",
    roomCount: 12,
    maxOccupancy: 3,
    sizeSqm: 46,
    facilities: ["Balcony"],
    description: null,
    unitType: null,
    viewLabel: null,
    bedConfiguration: null,
    sizeSqft: null,
    ...overrides,
  };
}

/** A synthetic venue as the repository reads it, saved before D-178 (no setting) unless overridden. */
export function venueRow(overrides: Partial<VenueRow> = {}): VenueRow {
  return {
    id: VENUE_ID,
    hotelId: HOTEL_ID,
    name: "Synthetic Grand Hall",
    venueType: "ballroom",
    isIndoor: true,
    areaSqm: 465,
    capacityBanquet: 300,
    capacityTheatre: 400,
    capacityReception: 450,
    facilities: null,
    description: null,
    setting: null,
    areaSqft: null,
    lengthM: null,
    widthM: null,
    ceilingHeightM: null,
    prefunctionAreaSqm: null,
    prefunctionAreaSqft: null,
    otherLayouts: null,
    capacityNotes: null,
    ...overrides,
  };
}

/** A synthetic hotel contact as the repository reads it. */
export function contactRow(overrides: Partial<ContactRow> = {}): ContactRow {
  return {
    id: CONTACT_ID,
    hotelId: HOTEL_ID,
    name: "Synthetic Sales Desk",
    roleTitle: null,
    phone: "+911234567801",
    email: "sales@example.com",
    isPrimary: false,
    ...overrides,
  };
}

/** A decimal column's value, as Prisma reads one back. */
export const decimal = (value: string): Prisma.Decimal => new Prisma.Decimal(value);

/** The room and venue side of the sub-resources repository: one stored room and one venue. */
function roomsAndVenues() {
  return {
    hotelExists: vi.fn(async (_hotelId: string) => true),
    createRoom: vi.fn(async (_hotelId: string, _data: unknown, _actorId: string) => roomRow()),
    updateRoom: vi.fn(async (_id: string, _patch: unknown, _actorId: string, _tx?: unknown) =>
      roomRow(),
    ),
    findRoomInHotel: vi.fn(async (_hotelId: string, _roomId: string) => ({
      id: ROOM_ID,
      sizeSqft: 500,
    })),
    createVenue: vi.fn(async (_hotelId: string, _data: unknown, _actorId: string) => venueRow()),
    updateVenue: vi.fn(async (_id: string, _patch: unknown, _actorId: string, _tx?: unknown) =>
      venueRow(),
    ),
    findVenueInHotel: vi.fn(async (_hotelId: string, _venueId: string) => ({
      id: VENUE_ID,
      areaSqft: null,
      prefunctionAreaSqft: 1_000,
    })),
    softDeleteRoom: vi.fn(async () => {}),
    softDeleteVenue: vi.fn(async () => {}),
  };
}

/** The contact side: one stored contact with a legacy phone, and the hotel's other live primaries. */
function contacts(primaries: readonly string[]) {
  return {
    createContact: vi.fn(async (_hotelId: string, _data: unknown, _actorId: string, _tx: unknown) =>
      contactRow(),
    ),
    updateContact: vi.fn(async (_id: string, _patch: unknown, _actorId: string, _tx: unknown) =>
      contactRow(),
    ),
    findContactInHotel: vi.fn(async (_hotelId: string, _contactId: string) => ({
      id: CONTACT_ID,
      phone: "Front desk 0141 234567",
    })),
    findLivePrimaries: vi.fn(async (_hotelId: string, _exceptId: string | null, _tx: unknown) =>
      primaries.map((id) => ({ id })),
    ),
    demoteContacts: vi.fn(async (_ids: readonly string[], _actorId: string, _tx: unknown) => {}),
    softDeleteContact: vi.fn(async () => {}),
  };
}

/**
 * The sub-resources service over fakes: a hotel that exists, one stored room, venue and contact, a live
 * primary contact elsewhere when `primaries` says so, and an audit that records nothing.
 *
 * @example
 * const { service, repo, audit } = buildSubresourcesService({ primaries: [OTHER_CONTACT_ID] });
 */
export function buildSubresourcesService(options: { readonly primaries?: readonly string[] } = {}) {
  const repo = {
    ...roomsAndVenues(),
    ...contacts(options.primaries ?? []),
    transaction: vi.fn(<T>(work: (tx: unknown) => Promise<T>): Promise<T> => work({})),
  };
  const audit = { record: vi.fn(async () => undefined) };
  const service = new HotelSubresourcesService(
    repo as unknown as HotelSubresourcesRepository,
    audit as unknown as AuditService,
  );
  return { service, repo, audit };
}
