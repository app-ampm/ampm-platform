import type { HotelImportRow } from "@ampm/core";

import {
  planImport,
  type ImportContext,
  type ImportDestination,
  type ImportTarget,
  type RowPlan,
} from "../hotel-import.plan.js";

/*
 * A synthetic catalogue for the import planner's specs (data.md: fictitious names): one stored hotel at
 * a destination in India, a second destination abroad, and an uploader holding every key unless a spec
 * says otherwise. Test-only: the build leaves `testing/` folders out.
 */

export const STORED_HOTEL_ID = "0192f1a0-0000-7000-8000-0000000000b1";

export const COAST: ImportDestination = {
  id: "0192f1a0-0000-7000-8000-0000000000c1",
  country: "India",
  deletedAt: null,
};

export const ABROAD: ImportDestination = {
  id: "0192f1a0-0000-7000-8000-0000000000c2",
  country: "Portugal",
  deletedAt: null,
};

/** The synthetic hotel as stored: published, demo-visible, with booking terms and notes. */
export const STORED: ImportTarget = {
  id: STORED_HOTEL_ID,
  deletedAt: null,
  destinationSlug: "synthetic-coast",
  postalCode: "403515",
  values: {
    name: "Synthetic Bay Hotel",
    brand: "Synthetic Collection",
    status: "active",
    demoVisible: true,
    publicShowcase: true,
    latitude: 15.5,
    airportDistanceKm: 12.5,
    postalCode: "403515",
    cuisines: ["Indian", "Goan"],
    bookingNotes: "Synthetic booking note",
    internalNotes: "Synthetic internal note",
  },
};

/** An uploader with the import's create key and none of the others. */
export const CREATE_ONLY: Partial<ImportContext> = {
  canUpdate: false,
  canWriteNotes: false,
  canCreateDestinations: false,
  canAddMedia: false,
};

/**
 * What the planner reads: the stored hotel, both destinations, two cuisine options and every key.
 *
 * @example
 * planImport(rows, importContext({ canUpdate: false }));
 */
export function importContext(overrides: Partial<ImportContext> = {}): ImportContext {
  return {
    hotels: new Map([["synthetic-bay", STORED]]),
    destinations: new Map([
      ["synthetic-coast", COAST],
      ["synthetic-abroad", ABROAD],
    ]),
    cuisineOptions: ["Indian", "Italian"],
    canUpdate: true,
    canWriteNotes: true,
    canCreateDestinations: true,
    canAddMedia: true,
    ...overrides,
  };
}

/** A row naming the stored hotel by its slug, with any other cells. */
export const importRow = (cells: Partial<HotelImportRow> = {}): HotelImportRow => ({
  destinationSlug: "synthetic-coast",
  name: "Synthetic Bay Hotel",
  slug: "synthetic-bay",
  ...cells,
});

/**
 * The plan of one row on line 2.
 *
 * @example
 * planOne({ minNights: 3 }); // { outcome: "update", changed: ["minNights"], … }
 */
export function planOne(cells: Partial<HotelImportRow>, context = importContext()): RowPlan {
  const [plan] = planImport([{ line: 2, row: importRow(cells) }], context);
  if (plan === undefined) throw new Error("planImport answered no plan for one row");
  return plan;
}
