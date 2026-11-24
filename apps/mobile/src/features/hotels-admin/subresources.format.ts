import type {
  HotelContactView,
  HotelRoomUnitType,
  HotelVenueSetting,
  HotelVenueType,
  RoomCategoryView,
  VenueOtherLayout,
  VenueView,
} from "@ampm/core";

import type { UnitTypeChoice } from "./rooms.form";

/*
 * Labels and row summaries for a hotel's room categories, venues and contacts (TW-22; D-178): the venue
 * types in the order the pickers offer them, the unit types and settings, what each capacity counts
 * (decision 11), and the one-line summaries of the "Rooms, venues & contacts" rows, which give staff
 * both units. No fetching, no rules.
 */

const VENUE_TYPE_LABEL: Record<HotelVenueType, string> = {
  ballroom: "Ballroom",
  lawn: "Lawn",
  poolside: "Poolside",
  rooftop: "Rooftop",
  courtyard: "Courtyard",
  beach: "Beach",
  other: "Other",
  terrace: "Terrace",
  garden: "Garden",
  amphitheatre: "Amphitheatre",
  meeting_room: "Meeting room",
  lounge: "Lounge",
};

/**
 * The venue types in the order the pickers offer them: an explicit list with Other last, never the
 * contract's order (Postgres appends a new type after `other`).
 */
export const VENUE_TYPES: readonly HotelVenueType[] = [
  "ballroom",
  "lawn",
  "poolside",
  "rooftop",
  "courtyard",
  "beach",
  "terrace",
  "garden",
  "amphitheatre",
  "meeting_room",
  "lounge",
  "other",
];

export function venueTypeLabel(type: HotelVenueType): string {
  return VENUE_TYPE_LABEL[type];
}

/** The unit types in the order the room editor offers them, "Not set" first. */
export const UNIT_TYPE_CHOICES: readonly UnitTypeChoice[] = [
  "unset",
  "room",
  "suite",
  "villa",
  "cottage",
  "tent",
  "tent_suite",
  "apartment",
  "other",
];

const UNIT_TYPE_LABEL: Record<UnitTypeChoice, string> = {
  unset: "Not set",
  room: "Room",
  suite: "Suite",
  villa: "Villa",
  cottage: "Cottage",
  tent: "Tent",
  tent_suite: "Tent suite",
  apartment: "Apartment",
  other: "Other",
};

export function unitTypeLabel(choice: UnitTypeChoice): string {
  return UNIT_TYPE_LABEL[choice];
}

/** The settings in the order the venue editor offers them. */
export const VENUE_SETTINGS: readonly HotelVenueSetting[] = ["indoor", "outdoor", "semi_open"];

const VENUE_SETTING_LABEL: Record<HotelVenueSetting, string> = {
  indoor: "Indoor",
  outdoor: "Outdoor",
  semi_open: "Covered or semi-open",
};

export function venueSettingLabel(setting: HotelVenueSetting): string {
  return VENUE_SETTING_LABEL[setting];
}

/** What each capacity counts (decision 11), as the venue editor labels it. */
export const CAPACITY_LABEL: Readonly<
  Record<"capacityBanquet" | "capacityTheatre" | "capacityReception", string>
> = {
  capacityBanquet: "Seated (dinner at round tables)",
  capacityTheatre: "Theatre (rows of chairs)",
  capacityReception: "Floating (standing reception or cocktails)",
};

/** A count or a measure as staff read it, grouped the Indian way: "1,292", "30.5". */
function figure(value: number): string {
  return value.toLocaleString("en-IN");
}

/** An area in both units when the hotel gave sq ft: "45 m² (484 sq ft)"; null when neither is known. */
function areaText(sqm: number | null, sqft: number | null): string | null {
  if (sqm === null) return sqft === null ? null : `${figure(sqft)} sq ft`;
  return sqft === null ? `${figure(sqm)} m²` : `${figure(sqm)} m² (${figure(sqft)} sq ft)`;
}

/** What a room category's count counts: "rooms", or the unit type's own noun ("villas"). */
const UNIT_NOUN: Record<HotelRoomUnitType, readonly [one: string, many: string]> = {
  room: ["room", "rooms"],
  suite: ["suite", "suites"],
  villa: ["villa", "villas"],
  cottage: ["cottage", "cottages"],
  tent: ["tent", "tents"],
  tent_suite: ["tent suite", "tent suites"],
  apartment: ["apartment", "apartments"],
  other: ["unit", "units"],
};

function unitsText({ roomCount, unitType }: RoomCategoryView): string | null {
  if (roomCount === null) {
    return unitType === null || unitType === "room" ? null : unitTypeLabel(unitType);
  }
  const [one, many] = UNIT_NOUN[unitType ?? "room"];
  return `${figure(roomCount)} ${roomCount === 1 ? one : many}`;
}

function joined(parts: readonly (string | null)[]): string {
  return parts.filter((part): part is string => part !== null && part !== "").join(" · ");
}

/**
 * A room category's summary for its row: how many (in its unit type's noun), occupancy, size in both
 * units, view and bed configuration.
 *
 * @example
 * roomSummary(room); // "4 villas · sleeps 3 · 120 m² (1,292 sq ft) · Lake view · King bed"
 */
export function roomSummary(room: RoomCategoryView): string {
  return joined([
    unitsText(room),
    room.maxOccupancy === null ? null : `sleeps ${room.maxOccupancy}`,
    areaText(room.sizeSqm, room.sizeSqft),
    room.viewLabel,
    room.bedConfiguration,
  ]);
}

function dimensionsText({ lengthM, widthM, ceilingHeightM }: VenueView): string | null {
  const floor =
    lengthM !== null && widthM !== null ? `${figure(lengthM)} × ${figure(widthM)} m` : null;
  const ceiling = ceilingHeightM === null ? null : `${figure(ceilingHeightM)} m ceiling`;
  return floor && ceiling ? `${floor}, ${ceiling}` : (floor ?? ceiling);
}

function capacityText(count: number | null, meaning: string): string | null {
  return count === null ? null : `${figure(count)} ${meaning}`;
}

function layoutsText(layouts: readonly VenueOtherLayout[] | null): string | null {
  const count = layouts?.length ?? 0;
  if (count === 0) return null;
  return `${count} other ${count === 1 ? "layout" : "layouts"}`;
}

/**
 * A venue's summary for its row: type, setting, area in both units, dimensions, the seated, theatre and
 * floating capacities, other layouts and pre-function area.
 *
 * @example
 * venueSummary(venue); // "Terrace · Covered or semi-open · 500 m² (5,382 sq ft) · 300 seated · 500 floating"
 */
export function venueSummary(venue: VenueView): string {
  const prefunction = areaText(venue.prefunctionAreaSqm, venue.prefunctionAreaSqft);
  return joined([
    venueTypeLabel(venue.venueType),
    venueSettingLabel(venue.setting),
    areaText(venue.areaSqm, venue.areaSqft),
    dimensionsText(venue),
    capacityText(venue.capacityBanquet, "seated"),
    capacityText(venue.capacityTheatre, "theatre"),
    capacityText(venue.capacityReception, "floating"),
    layoutsText(venue.otherLayouts),
    prefunction ? `pre-function ${prefunction}` : null,
  ]);
}

/** A contact's summary for its row: role, phone (in E.164 once saved since Slice 3) and email. */
export function contactSummary(contact: HotelContactView): string {
  return joined([contact.roleTitle, contact.phone, contact.email]);
}
