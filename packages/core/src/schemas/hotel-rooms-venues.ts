import { z } from "zod";

import { hasAtMostDecimals } from "../hotel-units.js";
import { storableText } from "./common.js";

/*
 * The room and venue facts fact sheets carry (D-178; docs/planning/hotel-information-form-plan.md §5.2,
 * §6.2, Slice 3): a room's unit type, view, bed configuration and size in sq ft; a venue's setting, area in
 * sq ft, dimensions, ceiling height, pre-function area, other layouts and capacity notes. Every one is
 * CLIENT class but reaches only the staff views until the client views grow (Slice 12). Plain field
 * objects, spread into the staff room and venue contracts (hotels-admin.ts) and the import rows: Zod
 * refuses `.partial()` on a refined object, so no cross-field rule sits on them. The units rule (a filled
 * sq ft gives the m²) is core `areaWrite`, applied by the API before it writes.
 */

/** What a room category is (HotelRoomUnitType in the Prisma schema; keep in step). Null: not stated. */
export const hotelRoomUnitType = z.enum([
  "room",
  "suite",
  "villa",
  "cottage",
  "tent",
  "tent_suite",
  "apartment",
  "other",
]);
export type HotelRoomUnitType = z.infer<typeof hotelRoomUnitType>;

/**
 * Where a venue is (HotelVenueSetting in the Prisma schema; keep in step): indoor, outdoor, or covered and
 * semi-open. The API keeps `is_indoor` in step ({@link isIndoorSetting}): true only for indoor, so
 * semi-open reads as outdoor to a client until Slice 12.
 */
export const hotelVenueSetting = z.enum(["indoor", "outdoor", "semi_open"]);
export type HotelVenueSetting = z.infer<typeof hotelVenueSetting>;

/**
 * The `is_indoor` flag a venue's setting stores (D-178): true only for indoor. One rule for every write
 * (the staff routes and the import), since no request carries the flag.
 *
 * @example
 * isIndoorSetting("indoor"); // true
 * isIndoorSetting("semi_open"); // false
 */
export function isIndoorSetting(setting: HotelVenueSetting): boolean {
  return setting === "indoor";
}

/**
 * A venue's setting as the staff view shows it and the import compares and hashes it: the stored setting
 * while `is_indoor` agrees with it ({@link isIndoorSetting}), else what `is_indoor` says, indoor when true
 * and outdoor otherwise. A venue has no setting when it was saved before Slice 3 or by a direct insert,
 * and one its flag contradicts when the previous image edited it after a rollback (that image writes
 * `is_indoor` alone); the flag is what clients read, so it wins. One rule, so the view, the import's
 * compare and the version token never disagree with each other or with a client.
 *
 * @example
 * venueSettingOf({ setting: null, isIndoor: true }); // "indoor"
 * venueSettingOf({ setting: "semi_open", isIndoor: false }); // "semi_open"
 * venueSettingOf({ setting: "indoor", isIndoor: false }); // "outdoor"
 */
export function venueSettingOf(venue: {
  readonly setting: HotelVenueSetting | null;
  readonly isIndoor: boolean;
}): HotelVenueSetting {
  if (venue.setting !== null && isIndoorSetting(venue.setting) === venue.isIndoor) {
    return venue.setting;
  }
  return venue.isIndoor ? "indoor" : "outdoor";
}

/** The most other layouts a venue keeps (other_layouts_json). */
export const VENUE_OTHER_LAYOUTS_MAX = 12;

/** The longest other-layout name. */
export const VENUE_OTHER_LAYOUT_NAME_MAX = 60;

/** The largest capacity a venue states, for any layout. */
export const VENUE_CAPACITY_MAX = 100_000;

/**
 * One of a venue's other layouts beside banquet, theatre and reception (D-178): its free-text name, the
 * most guests it takes and, for a range, the fewest.
 *
 * @example
 * venueOtherLayout.parse({ layout: "U-shape", max: 40, min: 30 });
 */
export const venueOtherLayout = z
  .object({
    layout: storableText().min(1).max(VENUE_OTHER_LAYOUT_NAME_MAX),
    max: z.number().int().min(1).max(VENUE_CAPACITY_MAX),
    min: z.number().int().min(1).max(VENUE_CAPACITY_MAX).optional(),
  })
  .strict()
  .refine((entry) => entry.min === undefined || entry.min <= entry.max, {
    message: "The minimum is above the maximum",
    path: ["min"],
  });
export type VenueOtherLayout = z.infer<typeof venueOtherLayout>;

const distinctLayouts = (layouts: readonly VenueOtherLayout[]): boolean =>
  new Set(layouts.map((entry) => entry.layout.toLowerCase())).size === layouts.length;

/**
 * A venue's other layouts: at most {@link VENUE_OTHER_LAYOUTS_MAX}, each named once ignoring case.
 *
 * @example
 * venueOtherLayouts.parse([{ layout: "Classroom", max: 120 }, { layout: "U-shape", max: 40, min: 30 }]);
 */
export const venueOtherLayouts = z
  .array(venueOtherLayout)
  .max(VENUE_OTHER_LAYOUTS_MAX)
  .refine(distinctLayouts, "Give each layout once");

/** A length in metres, 0 to `max`, to two decimal places (numeric(6,2)). */
const metres = (max: number) =>
  z
    .number()
    .min(0)
    .max(max)
    .refine((value) => hasAtMostDecimals(value, 2), "At most two decimal places");

const label = storableText().max(255);

/**
 * The D-178 room fields as a request writes them, each `.nullish()`: absent leaves a value, null clears
 * it. The staff room requests and the rooms import row spread them.
 *
 * @example
 * z.object(roomCatalogueRequestFields).parse({ unitType: "tent_suite", sizeSqft: 700 });
 */
export const roomCatalogueRequestFields = {
  unitType: hotelRoomUnitType.nullish(),
  viewLabel: label.nullish(),
  bedConfiguration: label.nullish(),
  sizeSqft: z.number().int().min(0).max(1_000_000).nullish(),
};

/**
 * The same room fields as the staff room view carries them.
 *
 * @example
 * z.object(roomCatalogueViewFields).parse({ unitType: null, viewLabel: "Lake", bedConfiguration: null, sizeSqft: 650 });
 */
export const roomCatalogueViewFields = {
  unitType: hotelRoomUnitType.nullable(),
  viewLabel: z.string().nullable(),
  bedConfiguration: z.string().nullable(),
  sizeSqft: z.number().int().nullable(),
};

/**
 * The D-178 venue fields as a request writes them, each `.nullish()`. The venue's `setting` is not among
 * them: it is required on create and never cleared, so the staff venue requests carry it themselves.
 *
 * @example
 * z.object(venueCatalogueRequestFields).parse({ areaSqft: 3_000, lengthM: 30.5, capacityNotes: "160 to 180 seated" });
 */
export const venueCatalogueRequestFields = {
  areaSqft: z.number().int().min(0).max(10_000_000).nullish(),
  lengthM: metres(2_000).nullish(),
  widthM: metres(2_000).nullish(),
  ceilingHeightM: metres(100).nullish(),
  prefunctionAreaSqm: z.number().int().min(0).max(1_000_000).nullish(),
  prefunctionAreaSqft: z.number().int().min(0).max(10_000_000).nullish(),
  otherLayouts: venueOtherLayouts.nullish(),
  capacityNotes: storableText().max(1_000).nullish(),
};

/**
 * The same venue fields as the staff venue view carries them, with `setting` never null: the API reads a
 * venue saved before Slice 3 from `is_indoor` ({@link venueSettingOf}).
 *
 * @example
 * venueCatalogueViewFields.setting.parse("semi_open");
 */
export const venueCatalogueViewFields = {
  setting: hotelVenueSetting,
  areaSqft: z.number().int().nullable(),
  lengthM: z.number().nullable(),
  widthM: z.number().nullable(),
  ceilingHeightM: z.number().nullable(),
  prefunctionAreaSqm: z.number().int().nullable(),
  prefunctionAreaSqft: z.number().int().nullable(),
  otherLayouts: venueOtherLayouts.nullable(),
  capacityNotes: z.string().nullable(),
};
