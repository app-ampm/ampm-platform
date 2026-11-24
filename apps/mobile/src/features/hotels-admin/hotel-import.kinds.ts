import type { StaffAccess } from "@ampm/api-client";
import type { HotelImportKind } from "@ampm/core";

/*
 * What the TW-25 import screen says of each kind it imports (D-181; Slice 3): the picker's label, the
 * nouns of its rows, the grant the server's route checks, and the files its downloads save as. One
 * entry per kind (the Record is exhaustive), so Slice 4's rates kind is one more entry.
 */

export interface ImportKindCopy {
  /** The picker's label: "Rooms". */
  readonly label: string;
  /** One row's record and several: "room category", "room categories". */
  readonly noun: readonly [one: string, many: string];
  /** A create row's outcome: "New room category". */
  readonly createLabel: string;
  /** The toast once an import wrote something: "Room categories imported". */
  readonly importedTitle: string;
  /** The grant the kind's import route checks (the kind's create key; the server checks each row too). */
  readonly grantKey: string;
}

export const IMPORT_KIND_COPY: Readonly<Record<HotelImportKind, ImportKindCopy>> = {
  hotels: {
    label: "Hotels",
    noun: ["hotel", "hotels"],
    createLabel: "New hotel",
    importedTitle: "Hotels imported",
    grantKey: "hotels.hotel_profiles_client_fields.create",
  },
  rooms: {
    label: "Rooms",
    noun: ["room category", "room categories"],
    createLabel: "New room category",
    importedTitle: "Room categories imported",
    grantKey: "hotels.room_categories_venues.create",
  },
  venues: {
    label: "Venues",
    noun: ["venue", "venues"],
    createLabel: "New venue",
    importedTitle: "Venues imported",
    grantKey: "hotels.room_categories_venues.create",
  },
};

/** The kinds in the order the picker offers them. */
export const IMPORT_KINDS: readonly HotelImportKind[] = ["hotels", "rooms", "venues"];

/**
 * Whether a picker's value is a kind (a segmented control reports a plain string).
 *
 * @example
 * isImportKind("rooms"); // true
 */
export function isImportKind(value: string): value is HotelImportKind {
  return IMPORT_KINDS.some((kind) => kind === value);
}

/**
 * The kinds a staff member may import, as the routes' grants decide (a custom role's included, D-164):
 * the screen offers only these; the server stays the gate, and checks each row's create or update key.
 *
 * @example
 * importableKinds(staffAccessFor(me)); // HT: ["hotels", "rooms", "venues"]
 */
export function importableKinds(access: StaffAccess): HotelImportKind[] {
  return IMPORT_KINDS.filter((kind) => access.can(IMPORT_KIND_COPY[kind].grantKey));
}

/**
 * A count with the kind's noun: "1 venue", "3 room categories".
 *
 * @example
 * kindCount("rooms", 2); // "2 room categories"
 */
export function kindCount(kind: HotelImportKind, count: number): string {
  const [one, many] = IMPORT_KIND_COPY[kind].noun;
  return `${count} ${count === 1 ? one : many}`;
}

/** The file the kind's template downloads as: "rooms-import-template.csv". */
export function importTemplateFile(kind: HotelImportKind): string {
  return `${kind}-import-template.csv`;
}

/** The file a result's per-row report downloads as: "venues-import-report.csv". */
export function importReportFile(kind: HotelImportKind): string {
  return `${kind}-import-report.csv`;
}
