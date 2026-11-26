import { z } from "zod";

import type { ErrorDetail } from "../errors";
import type { HotelInfoRequestKind } from "./hotel-info-requests";
import {
  HOTEL_FORM_SECTION_KEYS,
  hotelFormSectionKey,
  type HotelFormSectionKey,
} from "./hotel-form-section-keys";
import { HOTEL_FORM_SECTION_DRAFTS, type HotelFormSectionAnswers } from "./hotel-form-sections";

/*
 * What submitting needs, and when a section counts as complete (D-190 §2; plan §4.4). Submit asks little:
 * on an onboarding request the hotel's name, city and state and a contact with an email or a phone; on a
 * refresh nothing, since "blanks leave our records unchanged" and the request already names its hotel.
 * On every request a contact, room or venue row that holds an answer needs its name, which the merge
 * matches rows on; a blank row is left out, and a refresh section marked "No changes" asks for nothing.
 * Empty sections only warn, through completeness: a section is complete when every question AMPM's PDF
 * asks in it is answered, or when it is marked "No changes"; the fact sheet section always is until its
 * uploads arrive (Slice 9). Both read the answers as stored through the section's draft, so a saved draft
 * that no longer reads is named, never trusted.
 */

/**
 * One missing item: its section, the field's path inside the section's answers (null for the whole
 * section), and what to do.
 */
export const hotelFormMissingItem = z
  .object({ section: hotelFormSectionKey, field: z.string().nullable(), message: z.string() })
  .strict();
export type HotelFormMissingItem = z.infer<typeof hotelFormMissingItem>;

/** One section as submit reads it: its answers as stored, and whether it is marked "No changes". */
export interface HotelFormSectionState {
  readonly answers: unknown;
  readonly noChanges: boolean;
}

/** What submit checks: the request's kind, and its saved sections (one never saved is left out). */
export interface HotelFormSubmitInput {
  readonly kind: HotelInfoRequestKind;
  readonly sections: Partial<Readonly<Record<HotelFormSectionKey, HotelFormSectionState>>>;
}

/** What a section whose saved answers no longer read is named with. */
const UNREADABLE = "Check this section and save it again";

type Answers = HotelFormSectionAnswers;
type Missing = Omit<HotelFormMissingItem, "section">;
type Drafts = { readonly [K in HotelFormSectionKey]: z.ZodType<Answers[K]> };
type Complete = { readonly [K in HotelFormSectionKey]: (answers: Answers[K]) => boolean };
type Required = {
  readonly [K in HotelFormSectionKey]: (
    answers: Answers[K],
    kind: HotelInfoRequestKind,
  ) => Missing[];
};

const DRAFTS: Drafts = HOTEL_FORM_SECTION_DRAFTS;

const answered = (value: unknown): boolean =>
  value !== undefined && value !== null && !(Array.isArray(value) && value.length === 0);

/** Whether a row holds any answer besides its key. */
const hasAnswer = (row: object): boolean =>
  Object.entries(row).some(([key, value]) => key !== "rowId" && answered(value));

const filled = <T extends object>(rows: readonly T[] | null | undefined): T[] =>
  (rows ?? []).filter(hasAnswer);

const COMPLETE: Complete = {
  property: (a) =>
    [a.name, a.street, a.city, a.state, a.postalCode, a.mapsUrl, a.website].every(answered) &&
    answered(a.isChain) &&
    (a.isChain !== true || answered(a.groupName)) &&
    answered(a.airport?.km) &&
    answered(a.railwayStation?.km),
  contact: (a) =>
    (a.contacts ?? []).some((c) => answered(c.name) && answered(c.phone) && answered(c.email)),
  rooms: (a) => {
    const rows = filled(a.rows);
    const full = rows.every((r) => [r.name, r.roomCount, r.size, r.maxOccupancy].every(answered));
    return answered(a.totalRooms) && rows.length > 0 && full;
  },
  venues: (a) => {
    const rows = filled(a.rows);
    const full = rows.every(
      (r) =>
        [r.name, r.setting, r.area].every(answered) && (answered(r.seated) || answered(r.floating)),
    );
    return rows.length > 0 && full;
  },
  booking_terms: (a) =>
    [a.weddingBuyoutPolicy, a.minNights, a.parallelFunctions].every(answered) &&
    (a.weddingBuyoutPolicy === "required" || answered(a.minRoomsWithoutBuyout)),
  food_beverage: (a) => answered(a.cuisines),
  fact_sheet_media: () => true,
};

const missing = (field: string, message: string): Missing => ({ field, message });

/** Every row of a list that holds an answer but no name, by its place in the list. */
function unnamed(
  rows: readonly { readonly name?: string | null | undefined }[] | null | undefined,
  list: string,
  message: string,
): Missing[] {
  return (rows ?? []).flatMap((row, index) =>
    hasAnswer(row) && !answered(row.name) ? [missing(`${list}.${index}.name`, message)] : [],
  );
}

const REQUIRED: Required = {
  property: (a, kind) => {
    if (kind === "refresh") return [];
    const items: Missing[] = [];
    if (!answered(a.name)) items.push(missing("name", "Enter the hotel's name"));
    if (!answered(a.city)) items.push(missing("city", "Enter the city"));
    if (!answered(a.state)) items.push(missing("state", "Choose the state"));
    return items;
  },
  contact: (a, kind) => {
    const contacts = a.contacts ?? [];
    const reachable = contacts.some((c) => answered(c.email) || answered(c.phone));
    const channel =
      kind === "onboarding" && !reachable
        ? [missing("contacts", "Add a contact with an email or a phone number")]
        : [];
    return [...channel, ...unnamed(contacts, "contacts", "Name this contact")];
  },
  rooms: (a) => unnamed(a.rows, "rows", "Name this room category"),
  venues: (a) => unnamed(a.rows, "rows", "Name this venue"),
  booking_terms: () => [],
  food_beverage: () => [],
  fact_sheet_media: () => [],
};

/** A section's answers read through its draft, or null when they no longer read. */
function read<K extends HotelFormSectionKey>(key: K, answers: unknown): Answers[K] | null {
  const parsed = DRAFTS[key].safeParse(answers ?? {});
  return parsed.success ? parsed.data : null;
}

/**
 * Whether a section is complete: its answers read, and it is marked "No changes" or every question of
 * AMPM's PDF in it is answered (the fact sheet section always, until Slice 9). The API stores it as
 * `is_complete` on every save.
 *
 * @example
 * isHotelFormSectionComplete("food_beverage", { cuisines: ["Indian"] }, false); // true
 */
export function isHotelFormSectionComplete<K extends HotelFormSectionKey>(
  key: K,
  answers: unknown,
  noChanges: boolean,
): boolean {
  const draft = read(key, answers);
  return draft !== null && (noChanges || COMPLETE[key](draft));
}

/**
 * A section's missing items. Its answers are read first, even on a refresh section marked "No changes":
 * the revision holds every section as its draft reads it, so one that no longer reads is named here
 * rather than failing the submit after this check passed.
 */
function sectionItems<K extends HotelFormSectionKey>(
  key: K,
  { kind, sections }: HotelFormSubmitInput,
): HotelFormMissingItem[] {
  const saved = sections[key];
  const draft = read(key, saved?.answers);
  if (draft === null) return [{ section: key, field: null, message: UNREADABLE }];
  if (kind === "refresh" && saved?.noChanges === true) return [];
  return REQUIRED[key](draft, kind).map((item) => ({ section: key, ...item }));
}

/**
 * Every missing item a submit is refused for, by section in the form's order, then by field: empty when
 * the request may be submitted. The API refuses with 400 `submitIncomplete` carrying them
 * ({@link hotelFormMissingItemDetails}); the review page (HF-06) lists them with Edit links.
 *
 * @example
 * checkSubmit({ kind: "onboarding", sections: { property: { answers: draft, noChanges: false } } });
 * // [{ section: "contact", field: "contacts", message: "Add a contact with an email or a phone number" }]
 */
export function checkSubmit(input: HotelFormSubmitInput): HotelFormMissingItem[] {
  return HOTEL_FORM_SECTION_KEYS.flatMap((key) => sectionItems(key, input));
}

/**
 * The missing items as the error envelope's details: the path is the section, then the field.
 *
 * @example
 * new AppError("validation_failed", HOTEL_FORM_ERRORS.submitIncomplete, hotelFormMissingItemDetails(items));
 */
export function hotelFormMissingItemDetails(items: readonly HotelFormMissingItem[]): ErrorDetail[] {
  return items.map(({ section, field, message }) => ({
    path: field === null ? section : `${section}.${field}`,
    message,
  }));
}

/** What the page reads of a refused call: an `AppError`, as the api-client raises it, will do. */
export interface HotelFormRefusedCall {
  readonly code: string;
  readonly details?: readonly ErrorDetail[] | undefined;
}

/**
 * The missing items a refused submit carried, read back from its details; empty for any other error.
 *
 * @example
 * const items = hotelFormMissingItemsOf(error); // the review page's list
 */
export function hotelFormMissingItemsOf(error: HotelFormRefusedCall): HotelFormMissingItem[] {
  if (error.code !== "validation_failed") return [];
  return (error.details ?? []).flatMap((detail) => {
    const [section, ...rest] = (detail.path ?? "").split(".");
    const key = hotelFormSectionKey.safeParse(section);
    if (!key.success) return [];
    const field = rest.length === 0 ? null : rest.join(".");
    return [{ section: key.data, field, message: detail.message }];
  });
}
