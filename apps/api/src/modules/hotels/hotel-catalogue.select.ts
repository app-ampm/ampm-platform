import type { HotelCatalogueKey } from "@ampm/core";

import type { Prisma } from "../../generated/prisma/client.js";

/**
 * The D-178 hotel columns (location and access, event space, booking terms, food), as the staff hotel
 * selects read them for every profile reader (D-171). Their INTERNAL ones, the name variants and booking
 * terms, ride the same profile; the client discovery selects in hotels.repository.ts never read this
 * block (the CLIENT ones reach clients in Slice 12). The `satisfies` keeps it in step with the core list.
 *
 * @example
 * const STAFF_HOTEL_SELECT = { id: true, name: true, ...HOTEL_CATALOGUE_SELECT };
 */
export const HOTEL_CATALOGUE_SELECT = {
  parentGroup: true,
  nameAliases: true,
  locality: true,
  city: true,
  state: true,
  postalCode: true,
  mapsUrl: true,
  airportName: true,
  airportDistanceKm: true,
  airportDriveMinutes: true,
  railwayStationName: true,
  railwayDistanceKm: true,
  railwayDriveMinutes: true,
  cityCentreDistanceKm: true,
  cityCentreDriveMinutes: true,
  accessNotes: true,
  totalEventSpaceSqm: true,
  totalEventSpaceSqft: true,
  weddingBuyoutPolicy: true,
  minRoomsWithoutBuyout: true,
  minNights: true,
  parallelFunctions: true,
  bookingNotes: true,
  cuisines: true,
  isPureVegetarian: true,
  hasSeparateVegKitchen: true,
  servesAlcohol: true,
} as const satisfies Prisma.HotelSelect & Record<HotelCatalogueKey, true>;
