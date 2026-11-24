import {
  normaliseRowName,
  type HotelImportChangedField,
  type HotelImportRowItem,
  type HotelRateCardStatus,
  type HotelRateItemType,
  type HotelRateItemUnit,
  type RateImportComparedField,
  type RateImportRow,
  type RateItemCreateRequest,
  type RateItemUpdateRequest,
} from "@ampm/core";

import type { RateImportGrants } from "./hotel-audience.js";
import type { ChildHotel } from "./hotel-import.child-plan.js";
import type { ImportRow } from "./hotel-import.file.js";
import type { PlanMatch } from "./hotel-import.job.js";
import type { FieldError } from "./hotel-import.plan.js";
import {
  CARD_DATE_FIELDS,
  NO_CARD,
  planCreate,
  planExisting,
  referenceGrantErrors,
  refusal,
  resolveRefs,
  storedCardErrors,
  type RateRefs,
  type RateRowInput,
} from "./hotel-import.rates-rules.js";

/*
 * What each row of a Rates file does (D-170, D-184; plan §4.8, Slice 4). Pure. A row names its hotel by
 * web address, which must be a live hotel, and its card by name, exactly once normalised, among the
 * hotel's live cards that are not retired (a retired card's name is free). No such card: the import
 * creates a DRAFT card, which every row naming it joins, its name and dates the first importable row's;
 * a later row filling other dates is refused. One draft card: the rows go into it, and a filled date that
 * differs from the card's is refused, since an import never changes a card. A verified or stale card is
 * refused: rates go only into draft cards, and a card is verified in the staff app. Within its card a row
 * names one item by type, room and venue (hotel-import.rates-rules.ts); the same item named twice for one
 * card is refused on its later line. A refused row keeps what it matched (`PlanMatch`), so an import tells
 * a row whose target changed since its preview from one refused on that very target.
 */

/** A stored item's compared values as the plan reads them: amounts in whole paise. */
export interface RateItemValues {
  readonly amount: number;
  readonly amountMax: number | null;
  readonly unit: HotelRateItemUnit;
  readonly minQuantity: number | null;
  readonly isIndicative: boolean;
  readonly inclusions: string | null;
}

/** One live item of a stored card: its key (type, room, venue) and its compared values. */
export interface StoredRateItem {
  readonly id: string;
  readonly itemType: HotelRateItemType;
  readonly roomCategoryId: string | null;
  readonly venueId: string | null;
  readonly values: RateItemValues;
}

/** A live rate card of a named hotel: its name in NFC, its dates as YYYY-MM-DD, its live items. */
export interface StoredRateCard {
  readonly id: string;
  readonly name: string;
  readonly status: HotelRateCardStatus;
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly items: readonly StoredRateItem[];
}

/** A named hotel's live room or venue, its name in NFC. */
export interface RateItemRef {
  readonly id: string;
  readonly name: string;
}

/** What the plan reads beside the rows: the hotels by web address, the rest by hotel id. */
export interface RatePlanContext {
  readonly hotels: ReadonlyMap<string, ChildHotel>;
  readonly cards: ReadonlyMap<string, readonly StoredRateCard[]>;
  readonly rooms: ReadonlyMap<string, readonly RateItemRef[]>;
  readonly venues: ReadonlyMap<string, readonly RateItemRef[]>;
  readonly grants: RateImportGrants;
}

/** A card the import creates for the rows naming it: one per hotel and normalised name (`key`). */
export interface NewRateCard {
  readonly kind: "new";
  readonly key: string;
  readonly name: string;
  readonly validFrom: string | null;
  readonly validTo: string | null;
}

/** The card a new item goes into: a stored draft card, or one the import creates. */
export type RateCardTarget = { readonly kind: "stored"; readonly cardId: string } | NewRateCard;

/** The report fields every plan carries: a matched card's and room's or venue's stored names. */
export interface RatePlanKey {
  readonly line: number;
  readonly slug: string;
  readonly name: string;
  readonly item: HotelImportRowItem;
}

/** One rates row's plan. */
export type RateRowPlan =
  | (RatePlanKey & {
      readonly outcome: "error";
      readonly errors: readonly FieldError[];
      readonly match: PlanMatch;
    })
  | (RatePlanKey & {
      readonly outcome: "create";
      readonly hotelId: string;
      readonly card: RateCardTarget;
      readonly data: RateItemCreateRequest;
      readonly changedFields: readonly HotelImportChangedField[];
    })
  | (RatePlanKey & {
      readonly outcome: "update";
      readonly hotelId: string;
      readonly cardId: string;
      readonly targetId: string;
      readonly patch: RateItemUpdateRequest;
      readonly changedFields: readonly RateImportComparedField[];
    })
  | (RatePlanKey & {
      readonly outcome: "unchanged";
      readonly hotelId: string;
      readonly cardId: string;
      readonly targetId: string;
    });

/** A row as the file-level rules read it: its plan so far, and its item's key within its card. */
interface Located {
  readonly row: RateImportRow;
  readonly plan: RateRowPlan;
  /** Set once the row got as far as naming an item, whatever was then decided for it. */
  readonly itemKey: string | null;
}

/**
 * Every row's plan, in file order.
 *
 * @example
 * const plans = planRateRows(file.rows, context);
 */
export function planRateRows(
  rows: readonly ImportRow<RateImportRow>[],
  context: RatePlanContext,
): RateRowPlan[] {
  const located = rows.map((row) => locate(row, context));
  return settleNewCards(located, refuseRepeats(located));
}

/**
 * What a plan matched, refused or not: the item it updates, leaves or was refused on; the stored card it
 * matched no single item in; no card (a new one); or nothing (`unmatched`: refused before its card).
 *
 * @example
 * changedSincePreview(stored.target, rateMatchOf(plan), (id) => versions.get(id) ?? null);
 */
export function rateMatchOf(plan: RateRowPlan): PlanMatch {
  if (plan.outcome === "error") return plan.match;
  if (plan.outcome !== "create") return { matches: "row", targetId: plan.targetId };
  return plan.card.kind === "stored" ? { matches: "none", parentId: plan.card.cardId } : NO_CARD;
}

/** A row's live hotel and its card's name among the hotel's cards, then the rules of that card. */
function locate({ line, row }: ImportRow<RateImportRow>, context: RatePlanContext): Located {
  const refused = (message: string, field = "cardName"): Located => {
    const plan = refusal(line, row, [{ field, message }], { matches: "unmatched" });
    return { row, plan, itemKey: null };
  };
  const hotel = context.hotels.get(row.hotelSlug);
  if (hotel === undefined) return refused("No hotel has this web address", "hotelSlug");
  if (hotel.deletedAt !== null) return refused("This hotel was deleted", "hotelSlug");
  const name = normaliseRowName(row.cardName);
  const cards = (context.cards.get(hotel.id) ?? []).filter(
    (card) => card.status !== "retired" && normaliseRowName(card.name) === name,
  );
  const [card, other] = cards;
  if (other !== undefined) {
    return refused(
      context.grants.readsCards
        ? `Two rate cards are named ${row.cardName}; rename one in the staff app first`
        : "A rate card already has this name, and you cannot read rate cards",
    );
  }
  const refs = resolveRefs(row, hotel.id, context);
  const input: RateRowInput = { line, row, hotelId: hotel.id, refs, grants: context.grants };
  return card === undefined ? inNewCard(input, name) : inStoredCard(input, card);
}

/** A row of a stored card: refused on the card or its references, else its item created or matched. */
function inStoredCard(input: RateRowInput, card: StoredRateCard): Located {
  const { line, row, refs } = input;
  const items = refs.errors.length > 0 ? [] : card.items.filter((item) => isItem(item, row, refs));
  const [stored, twin] = items;
  const match: PlanMatch =
    stored !== undefined && twin === undefined
      ? { matches: "row", targetId: stored.id }
      : { matches: "none", parentId: card.id };
  const errors = storedCardErrors(row, card, refs, input.grants);
  if (twin !== undefined && errors.length === 0) {
    const message = "This card has two such items; change one in the staff app first";
    errors.push({ field: "itemType", message });
  }
  if (errors.length > 0) return { row, plan: refusal(line, row, errors, match), itemKey: null };
  const key = keyOf(input, card.name);
  const itemKey = `card:${card.id}|${itemKeyOf(row.itemType, refs)}`;
  const plan =
    stored === undefined
      ? planCreate(input, key, { kind: "stored", cardId: card.id })
      : planExisting(input, key, card.id, stored);
  return { row, plan, itemKey };
}

/**
 * A row no stored card has the name of: refused on its references (one the uploader may not read, before
 * whether it exists), else a new item of a new card.
 */
function inNewCard(input: RateRowInput, name: string): Located {
  const { line, row, refs } = input;
  const unread = referenceGrantErrors(row, input.grants);
  const errors = unread.length > 0 ? unread : refs.errors;
  if (errors.length > 0) return { row, plan: refusal(line, row, errors, NO_CARD), itemKey: null };
  const card: NewRateCard = {
    kind: "new",
    key: `${input.hotelId}:${name}`,
    name: row.cardName,
    validFrom: row.validFrom ?? null,
    validTo: row.validTo ?? null,
  };
  const itemKey = `new:${card.key}|${itemKeyOf(row.itemType, refs)}`;
  return { row, plan: planCreate(input, keyOf(input, row.cardName), card), itemKey };
}

/** Whether a stored item is the one a row names: the same type, room and venue. */
function isItem(item: StoredRateItem, row: RateImportRow, refs: RateRefs): boolean {
  return (
    item.itemType === row.itemType &&
    item.roomCategoryId === (refs.room?.id ?? null) &&
    item.venueId === (refs.venue?.id ?? null)
  );
}

/** A plan's report key: its card's name, and its item's room and venue by their stored names. */
function keyOf({ line, row, refs }: RateRowInput, name: string): RatePlanKey {
  const item = {
    itemType: row.itemType,
    roomName: refs.room?.name ?? null,
    venueName: refs.venue?.name ?? null,
  };
  return { line, slug: row.hotelSlug, name, item };
}

/** An item's key within its card: its type, room and venue. */
function itemKeyOf(itemType: HotelRateItemType, refs: RateRefs): string {
  return `${itemType}|${refs.room?.id ?? ""}|${refs.venue?.id ?? ""}`;
}

/**
 * The later of two rows naming the same item for the same card is refused, whatever was decided for the
 * earlier one (as a repeated room or venue name is, Slice 3).
 */
function refuseRepeats(located: readonly Located[]): RateRowPlan[] {
  const firstLine = new Map<string, number>();
  return located.map(({ row, plan, itemKey }) => {
    if (itemKey === null) return plan;
    const first = firstLine.get(itemKey);
    if (first === undefined) {
      firstLine.set(itemKey, plan.line);
      return plan;
    }
    const errors = [{ field: "itemType", message: `Line ${first} already names this item` }];
    return refusal(plan.line, row, errors, rateMatchOf(plan));
  });
}

/**
 * Each new card is created by the first of its rows that can be imported, under that row's name and
 * dates, which its report names; its later rows join it, refused when a date they fill differs.
 */
function settleNewCards(located: readonly Located[], plans: RateRowPlan[]): RateRowPlan[] {
  const creators = new Map<string, { readonly line: number; readonly card: NewRateCard }>();
  return plans.map((plan, index) => {
    const row = located[index]?.row;
    if (plan.outcome !== "create" || plan.card.kind !== "new" || row === undefined) return plan;
    const creator = creators.get(plan.card.key);
    if (creator === undefined) {
      creators.set(plan.card.key, { line: plan.line, card: plan.card });
      const cardFields = CARD_DATE_FIELDS.filter((field) => row[field] !== undefined);
      return { ...plan, changedFields: ["cardName", ...cardFields, ...plan.changedFields] };
    }
    const message = `Line ${creator.line} starts this new card with other dates; give its rows the same dates, or leave them blank`;
    const differ = CARD_DATE_FIELDS.filter(
      (field) => row[field] !== undefined && row[field] !== creator.card[field],
    );
    if (differ.length > 0) {
      return refusal(
        plan.line,
        row,
        differ.map((field) => ({ field, message })),
        NO_CARD,
      );
    }
    return { ...plan, name: creator.card.name, card: creator.card };
  });
}
