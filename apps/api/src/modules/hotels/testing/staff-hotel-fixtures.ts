import type { HotelCatalogueKey } from "@ampm/core";
import { vi } from "vitest";

import type { AuditService } from "../../../policy/audit.service.js";
import type { ConfigService } from "../../admin/config/config.service.js";
import type { HotelInfoRequestRevoker } from "../hotel-info-request-revoker.js";
import type {
  HotelsAdminRepository,
  HotelUpdatePatch,
  HotelWriteData,
  StaffHotelDetailRow,
  StaffHotelRow,
} from "../hotels-admin.repository.js";
import { HotelsAdminService } from "../hotels-admin.service.js";

/*
 * Synthetic staff hotels for the unit specs (data.md: fictitious names, example.com addresses). Test-only:
 * the build leaves `testing/` folders out.
 */

export const HOTEL_ID = "0192f1a0-0000-7000-8000-0000000000a1";
export const DESTINATION_ID = "0192f1a0-0000-7000-8000-0000000000a2";

/** The cuisine options the specs' configuration offers. */
export const CUISINE_OPTIONS = ["Indian", "Continental", "Italian"];

/** The D-178 columns of a hotel that has none of them yet, as the repository reads it. */
export function emptyCatalogueColumns(): Pick<StaffHotelRow, HotelCatalogueKey> {
  return {
    parentGroup: null,
    nameAliases: null,
    locality: null,
    city: null,
    state: null,
    postalCode: null,
    mapsUrl: null,
    airportName: null,
    airportDistanceKm: null,
    airportDriveMinutes: null,
    railwayStationName: null,
    railwayDistanceKm: null,
    railwayDriveMinutes: null,
    cityCentreDistanceKm: null,
    cityCentreDriveMinutes: null,
    accessNotes: null,
    totalEventSpaceSqm: null,
    totalEventSpaceSqft: null,
    weddingBuyoutPolicy: null,
    minRoomsWithoutBuyout: null,
    minNights: null,
    parallelFunctions: null,
    bookingNotes: null,
    cuisines: null,
    isPureVegetarian: null,
    hasSeparateVegKitchen: null,
    servesAlcohol: null,
  };
}

/** The long-standing profile columns of the synthetic hotel, its RESTRICTED-NOTES pair included. */
function profileColumns(): Omit<StaffHotelRow, HotelCatalogueKey> {
  return {
    id: HOTEL_ID,
    destinationId: DESTINATION_ID,
    name: "Synthetic Lake Hotel",
    slug: "synthetic-lake-hotel",
    brand: null,
    starCategory: "5",
    address: null,
    latitude: null,
    longitude: null,
    descriptionClient: null,
    website: null,
    status: "active",
    demoVisible: false,
    publicShowcase: false,
    internalRating: 4,
    internalNotes: "Synthetic note",
    totalRooms: 40,
    streetViewRef: null,
    facilities: null,
    lastVerifiedAt: null,
  };
}

const DESTINATION: StaffHotelDetailRow["destination"] = {
  id: DESTINATION_ID,
  name: "Synthetic Destination",
  slug: "synthetic-destination",
  region: null,
  state: null,
  country: "India",
  description: null,
  status: "active",
  publicVisible: false,
};

const CONTACT: StaffHotelDetailRow["contacts"][number] = {
  id: "0192f1a0-0000-7000-8000-0000000000a3",
  hotelId: HOTEL_ID,
  name: "Test Contact",
  roleTitle: null,
  phone: null,
  email: "contact@example.com",
  isPrimary: true,
};

/** A synthetic catalogue hotel as the repository reads it, with internal notes and one contact. */
export function staffHotelRow(overrides: Partial<StaffHotelRow> = {}): StaffHotelDetailRow {
  return {
    ...profileColumns(),
    ...emptyCatalogueColumns(),
    ...overrides,
    destination: { ...DESTINATION },
    rooms: [],
    venues: [],
    contacts: [{ ...CONTACT }],
  };
}

/**
 * The staff hotel service over fakes: a repository that holds one hotel (with any overrides), an audit
 * that records nothing, and a configuration that offers CUISINE_OPTIONS.
 *
 * @example
 * const { service, repo } = buildHotelsAdminService({ bookingNotes: "Synthetic booking note" });
 */
export function buildHotelsAdminService(overrides: Partial<StaffHotelRow> = {}) {
  const row = staffHotelRow(overrides);
  const profile: StaffHotelRow = { ...row };
  const repo = {
    findDetail: vi.fn(async () => row),
    findById: vi.fn(async () => profile),
    list: vi.fn(async () => ({ rows: [profile], nextCursor: null })),
    findDestinationById: vi.fn(async (_id: string) => row.destination),
    slugExists: vi.fn(async () => false),
    createHotel: vi.fn(async (_data: HotelWriteData, _actorId: string) => HOTEL_ID),
    updateHotel: vi.fn(
      async (_id: string, _patch: HotelUpdatePatch, _actorId: string) => undefined,
    ),
    softDeleteHotel: vi.fn(async (_id: string, _actorId: string, _tx?: unknown) => undefined),
    transaction: <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn({}),
  };
  const audit = { record: vi.fn(async () => undefined) };
  const config = { get: vi.fn(async () => ({ options: CUISINE_OPTIONS })) };
  const revoker = {
    revokeForDeletedHotel: vi.fn(async (_hotelId: string, _tx: unknown) => undefined),
  };
  const service = new HotelsAdminService(
    repo as unknown as HotelsAdminRepository,
    audit as unknown as AuditService,
    config as unknown as ConfigService,
    revoker as unknown as HotelInfoRequestRevoker,
  );
  return { service, repo, audit, config, revoker };
}
