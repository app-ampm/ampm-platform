import {
  fieldChanges,
  normaliseRowName,
  RATE_IMPORT_COLUMNS,
  RATE_IMPORT_COMPARED_FIELDS,
  type HotelFieldValues,
  type RateImportComparedField,
  type RateImportRow,
  type RateItemCreateRequest,
  type RateItemUpdateRequest,
} from "@ampm/core";

import type { RateImportGrants } from "./hotel-audience.js";
import type { PlanMatch } from "./hotel-import.job.js";
import type { FieldError } from "./hotel-import.plan.js";
import type {
  RateCardTarget,
  RateItemRef,
  RateItemValues,
  RatePlanContext,
  RatePlanKey,
  RateRowPlan,
  StoredRateCard,
  StoredRateItem,
} from "./hotel-import.rates-plan.js";

/*
 * The rules of one Rates row within its card (D-184, Slice 4), for the planner (hotel-import.rates-plan.ts).
 * Pure. Its room or venue must be one live room or venue of the hotel by name, once normalised. A stored
 * card must be a readable draft whose dates the row does not contradict. A new item needs its amount and
 * its unit and is created hidden, indicative unless the row says otherwise; a matched item changes in the
 * filled cells that differ, amounts compared in paise, so a blank never clears and visibility never
 * changes. An upper bound is never below its amount, the stored one when the row fills only one of the
 * two. Each refusal says what to do, and a row is held to the uploader's own keys.
 */

/** The card's dates, which a row reads only when the import creates its card. */
export const CARD_DATE_FIELDS = ["validFrom", "validTo"] as const;

/** The match of a row whose card the import creates: no stored card has its name. */
export const NO_CARD: PlanMatch = { matches: "none" };

const BOUND_MESSAGE = "amountMax must be at least amount";

/** A row's room and venue among the hotel's live ones, or why a filled one names none. */
export interface RateRefs {
  readonly room: RateItemRef | null;
  readonly venue: RateItemRef | null;
  readonly errors: readonly FieldError[];
}

/** What one row's rules read: the row, its hotel, its references and the uploader's keys. */
export interface RateRowInput {
  readonly line: number;
  readonly row: RateImportRow;
  readonly hotelId: string;
  readonly refs: RateRefs;
  readonly grants: RateImportGrants;
}

/** The columns that name the item, in template order: what a new item's report names. */
const ITEM_COLUMNS = RATE_IMPORT_COLUMNS.filter(
  (column) => !["hotelSlug", "cardName", "validFrom", "validTo"].includes(column),
);

/**
 * A refused row's plan, reported by its own cells: no stored name reaches a report for a row refused,
 * perhaps on a card or a room its uploader may not read.
 *
 * @example
 * refusal(3, row, [{ field: "hotelSlug", message: "This hotel was deleted" }], { matches: "unmatched" });
 */
export function refusal(
  line: number,
  row: RateImportRow,
  errors: readonly FieldError[],
  match: PlanMatch,
): RateRowPlan {
  const item = {
    itemType: row.itemType,
    roomName: row.roomName ?? null,
    venueName: row.venueName ?? null,
  };
  return { line, slug: row.hotelSlug, name: row.cardName, item, outcome: "error", errors, match };
}

/** The words a reference's refusals use. */
const ROOM = { field: "roomName", noun: "room", plural: "rooms" } as const;
const VENUE = { field: "venueName", noun: "venue", plural: "venues" } as const;

/**
 * A row's room and venue, each by name among the hotel's live ones once normalised: none or two of a
 * filled name is refused on its column.
 *
 * @example
 * resolveRefs(row, hotelId, context).room?.id;
 */
export function resolveRefs(
  row: RateImportRow,
  hotelId: string,
  context: RatePlanContext,
): RateRefs {
  const room = resolveRef(context.rooms.get(hotelId) ?? [], row.roomName, ROOM);
  const venue = resolveRef(context.venues.get(hotelId) ?? [], row.venueName, VENUE);
  return { room: room.ref, venue: venue.ref, errors: [...room.errors, ...venue.errors] };
}

function resolveRef(
  refs: readonly RateItemRef[],
  name: string | undefined,
  words: typeof ROOM | typeof VENUE,
): { readonly ref: RateItemRef | null; readonly errors: readonly FieldError[] } {
  if (name === undefined) return { ref: null, errors: [] };
  const key = normaliseRowName(name);
  const [found, twin] = refs.filter((ref) => normaliseRowName(ref.name) === key);
  if (found !== undefined && twin === undefined) return { ref: found, errors: [] };
  const message =
    found === undefined
      ? `No ${words.noun} named ${name}`
      : `Two ${words.plural} are named ${name}; rename one in the staff app first`;
  return { ref: null, errors: [{ field: words.field, message }] };
}

/**
 * Why a row cannot go into a stored card, in order, or nothing: the uploader cannot read cards (one
 * reason, whatever else holds); they cannot read the rooms and venues it names; the card is not a draft;
 * a date the row fills differs from the card's; a room or venue it names is not one live one.
 *
 * @example
 * storedCardErrors(row, card, refs, grants); // [] when the row may go into the card
 */
export function storedCardErrors(
  row: RateImportRow,
  card: StoredRateCard,
  refs: RateRefs,
  grants: RateImportGrants,
): FieldError[] {
  if (!grants.readsCards) {
    const message = "A rate card already has this name, and you cannot read rate cards";
    return [{ field: "cardName", message }];
  }
  const unread = referenceGrantErrors(row, grants);
  if (unread.length > 0) return unread;
  if (card.status !== "draft") {
    const message = `Rates are imported only into draft cards, and this card is ${card.status}; give the file a new card name`;
    return [{ field: "cardName", message }];
  }
  const message = "This card's dates differ from the file's; change them in the staff app";
  const differ = CARD_DATE_FIELDS.filter(
    (field) => row[field] !== undefined && row[field] !== card[field],
  );
  if (differ.length > 0) return differ.map((field) => ({ field, message }));
  return [...refs.errors];
}

/**
 * The room or venue a row names, refused to an uploader who cannot read rooms and venues, whether or not
 * it exists.
 *
 * @example
 * referenceGrantErrors({ ...row, roomName: "Lake View Suite" }, { ...grants, readsRoomsVenues: false });
 * // [{ field: "roomName", message: "You cannot read rooms and venues" }]
 */
export function referenceGrantErrors(row: RateImportRow, grants: RateImportGrants): FieldError[] {
  if (grants.readsRoomsVenues) return [];
  return (["roomName", "venueName"] as const)
    .filter((field) => row[field] !== undefined)
    .map((field) => ({ field, message: "You cannot read rooms and venues" }));
}

/**
 * A row matching no stored item: a new hidden item, if the row has what one needs and the create key.
 *
 * @example
 * planCreate(input, key, { kind: "stored", cardId });
 */
export function planCreate(
  input: RateRowInput,
  key: RatePlanKey,
  card: RateCardTarget,
): RateRowPlan {
  const { row, refs } = input;
  const match: PlanMatch =
    card.kind === "stored" ? { matches: "none", parentId: card.cardId } : NO_CARD;
  const errors = createErrors(row, card, input.grants);
  if (errors.length > 0 || row.amount === undefined || row.unit === undefined) {
    return refusal(key.line, row, errors, match);
  }
  const data: RateItemCreateRequest = {
    itemType: row.itemType,
    roomCategoryId: refs.room?.id ?? null,
    venueId: refs.venue?.id ?? null,
    amount: row.amount,
    amountMax: row.amountMax ?? null,
    isIndicative: row.isIndicative ?? true,
    unit: row.unit,
    minQuantity: row.minQuantity ?? null,
    inclusionsText: row.inclusions ?? null,
    clientVisible: false,
  };
  const changedFields = ITEM_COLUMNS.filter((column) => row[column] !== undefined);
  return { ...key, outcome: "create", hotelId: input.hotelId, card, data, changedFields };
}

/** What a new item lacks, or what the uploader may not do: never a database error. */
function createErrors(
  row: RateImportRow,
  card: RateCardTarget,
  grants: RateImportGrants,
): FieldError[] {
  const errors: FieldError[] = [];
  if (row.amount === undefined) {
    errors.push({ field: "amount", message: "A new item needs its amount" });
  }
  if (row.unit === undefined) {
    const message = "A new item needs its unit: per night, per plate, per event or percent";
    errors.push({ field: "unit", message });
  }
  if (row.amount && row.amountMax && row.amountMax.minor < row.amount.minor) {
    errors.push({ field: "amountMax", message: BOUND_MESSAGE });
  }
  if (!grants.canCreate) {
    errors.push(
      card.kind === "new"
        ? { field: "cardName", message: "You cannot add rate cards" }
        : { field: "itemType", message: "You cannot add rate items" },
    );
  }
  return errors;
}

/**
 * A row matching one stored item: unchanged, or an update of the filled cells that differ, if the update
 * key allows it and the item's bounds stay in order.
 *
 * @example
 * planExisting(input, key, cardId, stored); // { outcome: "update", changedFields: ["amount"], … }
 */
export function planExisting(
  input: RateRowInput,
  key: RatePlanKey,
  cardId: string,
  stored: StoredRateItem,
): RateRowPlan {
  const { row } = input;
  const changed = fieldChanges(stored.values, comparedOf(row), RATE_IMPORT_COMPARED_FIELDS);
  const matched = { ...key, hotelId: input.hotelId, cardId, targetId: stored.id };
  if (changed.length === 0) return { ...matched, outcome: "unchanged" };
  const match: PlanMatch = { matches: "row", targetId: stored.id };
  if (!input.grants.canUpdate) {
    const message = "This card already has this item, and you cannot change rate items";
    return refusal(key.line, row, [{ field: "itemType", message }], match);
  }
  const bound = boundError(row, stored.values);
  if (bound !== null) return refusal(key.line, row, [bound], match);
  return { ...matched, outcome: "update", patch: patchOf(row, changed), changedFields: changed };
}

/** A row's compared values as the plan compares them: amounts in paise. */
function comparedOf(row: RateImportRow): HotelFieldValues<RateImportComparedField> {
  return {
    amount: row.amount?.minor,
    amountMax: row.amountMax?.minor,
    unit: row.unit,
    minQuantity: row.minQuantity,
    isIndicative: row.isIndicative,
    inclusions: row.inclusions,
  };
}

/** An update's bounds out of order, on the cell the row fills: the other bound is the stored one. */
function boundError(row: RateImportRow, stored: RateItemValues): FieldError | null {
  if (row.amount === undefined && row.amountMax === undefined) return null;
  const amount = row.amount?.minor ?? stored.amount;
  const amountMax = row.amountMax?.minor ?? stored.amountMax;
  if (amountMax === null || amountMax >= amount) return null;
  return { field: row.amountMax === undefined ? "amount" : "amountMax", message: BOUND_MESSAGE };
}

/** A matched item's changed columns: the row's values of the fields it changes, nothing else. */
function patchOf(
  row: RateImportRow,
  changed: readonly RateImportComparedField[],
): RateItemUpdateRequest {
  const keep = new Set<RateImportComparedField>(changed);
  const patch: RateItemUpdateRequest = {};
  if (keep.has("amount")) patch.amount = row.amount;
  if (keep.has("amountMax")) patch.amountMax = row.amountMax;
  if (keep.has("unit")) patch.unit = row.unit;
  if (keep.has("minQuantity")) patch.minQuantity = row.minQuantity;
  if (keep.has("isIndicative")) patch.isIndicative = row.isIndicative;
  if (keep.has("inclusions")) patch.inclusionsText = row.inclusions;
  return patch;
}
