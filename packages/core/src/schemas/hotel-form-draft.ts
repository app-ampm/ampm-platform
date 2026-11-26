import { z } from "zod";

import type { ErrorDetail } from "../errors";
import { isoDateTime } from "./common";
import { hotelFormLinkState, hotelFormRequestStatus } from "./hotel-form";
import { hotelCuisineOptionsView } from "./hotel-catalogue";
import { hotelInfoRequestKind } from "./hotel-info-requests";
import {
  HOTEL_FORM_SECTION_MAX_BYTES,
  hotelFormSectionKey,
  type HotelFormSectionKey,
} from "./hotel-form-section-keys";
import { HOTEL_FORM_SECTION_DRAFTS, type HotelFormSectionAnswers } from "./hotel-form-sections";
import type { HotelFormRefusedCall } from "./hotel-form-submit";

/*
 * The hotel form's draft (D-190 §3; plan §4.4 and §7.1): what `GET /hotel-form/draft` answers a signed-in
 * person, what a section's autosave sends and gets back, and the details of its two 409s. Every section is
 * answered, saved or not: an unsaved one has version 0, empty answers and no editor, and its first save
 * sends `expectedVersion` 0. A 409's details travel in the error envelope as one detail whose message is
 * the JSON of the model below, as a session refusal carries its reason; the page reads them back with
 * the `…Of` readers. Nothing here comes from AMPM's catalogue (plan decision 16).
 */

/**
 * A section as the draft answers it: its answers, version, completeness (counted from the stored answers
 * by the current schema, on every read), No changes, last editor and whether that was the person signed
 * in, and whether its stored answers no longer read.
 */
function sectionView<K extends HotelFormSectionKey>(key: K) {
  return z
    .object({
      answers: HOTEL_FORM_SECTION_DRAFTS[key],
      version: z.number().int().min(0),
      isComplete: z.boolean(),
      noChanges: z.boolean(),
      /**
       * The name of the person who saved it last: null until a first save, and null for a person who
       * withdrew their privacy notice consent (`lastEditedAt` still says when), whom the page calls a
       * colleague.
       */
      lastEditedBy: z.string().nullable(),
      lastEditedAt: isoDateTime.nullable(),
      /**
       * Whether the signed-in person saved it last (false until a first save), told by person, never by
       * name: a colleague may share the person's name, and the person may have changed theirs since.
       */
      isLastSaveYours: z.boolean(),
      /**
       * The stored answers no longer read under the current schema (saved before a change to the form's
       * questions): the section is answered with empty answers and is not complete, so the page asks for
       * it again and the submit check names it; its next save, on its version, replaces the stored row.
       * One such section never fails the whole draft.
       */
      isUnreadable: z.boolean(),
    })
    .strict();
}

/** Every section, each in its own draft's model. */
export const hotelFormDraftSections = z
  .object({
    property: sectionView("property"),
    contact: sectionView("contact"),
    rooms: sectionView("rooms"),
    venues: sectionView("venues"),
    booking_terms: sectionView("booking_terms"),
    food_beverage: sectionView("food_beverage"),
    fact_sheet_media: sectionView("fact_sheet_media"),
  })
  .strict();
export type HotelFormDraftSections = z.infer<typeof hotelFormDraftSections>;

/**
 * The request as the draft shows it: its reference, kind, status and the page's state, AMPM's label and
 * note, when the link stops working, and who submitted it and when (null until a submit).
 */
export const hotelFormDraftRequest = z
  .object({
    reference: z.string(),
    kind: hotelInfoRequestKind,
    status: hotelFormRequestStatus,
    state: hotelFormLinkState.exclude(["not_active"]),
    displayLabel: z.string().nullable(),
    staffNote: z.string().nullable(),
    expiresAt: isoDateTime,
    submittedAt: isoDateTime.nullable(),
    submittedBy: z.string().nullable(),
  })
  .strict();
export type HotelFormDraftRequest = z.infer<typeof hotelFormDraftRequest>;

/**
 * A person helping with the form: their name and designation, never their mobile. Both are null for
 * another person who withdrew their privacy notice consent: the page calls them a colleague.
 */
export const hotelFormContributor = z
  .object({
    fullName: z.string().nullable(),
    designation: z.string().nullable(),
    isYou: z.boolean(),
  })
  .strict();
export type HotelFormContributor = z.infer<typeof hotelFormContributor>;

/** The caps the page enforces before the API does (`HOTEL_FORM_CAPS`). */
export const hotelFormCaps = z
  .object({
    sectionMaxBytes: z.record(hotelFormSectionKey, z.number().int().positive()),
    roomRows: z.number().int().positive(),
    venueRows: z.number().int().positive(),
    contacts: z.number().int().positive(),
    otherLayoutsPerVenue: z.number().int().positive(),
  })
  .strict();
export type HotelFormCaps = z.infer<typeof hotelFormCaps>;

/**
 * `GET /hotel-form/draft`'s answer: the request, every section, the people helping, the caps, and the
 * chips' options: cuisines from configuration `hotel.cuisine_options`, facilities from core
 * `HOTEL_FACILITY_OPTIONS`, each with its Other.
 */
export const hotelFormDraftView = z
  .object({
    request: hotelFormDraftRequest,
    sections: hotelFormDraftSections,
    contributors: z.array(hotelFormContributor),
    caps: hotelFormCaps,
    options: z
      .object({ cuisines: hotelCuisineOptionsView, facilities: hotelCuisineOptionsView })
      .strict(),
  })
  .strict();
export type HotelFormDraftView = z.infer<typeof hotelFormDraftView>;

/** `PUT /hotel-form/draft/sections/:sectionKey`'s params. */
export const hotelFormSectionParams = z.object({ sectionKey: hotelFormSectionKey }).strict();
export type HotelFormSectionParams = z.infer<typeof hotelFormSectionParams>;

/**
 * A section's save: its answers in full, the version they were based on (0 before a first save), and
 * "No changes since last time" (refresh requests).
 *
 * @example
 * hotelFormSectionSaveRequest(params.sectionKey).safeParse(body);
 */
export function hotelFormSectionSaveRequest<K extends HotelFormSectionKey>(key: K) {
  return z
    .object({
      answers: HOTEL_FORM_SECTION_DRAFTS[key],
      expectedVersion: z.number().int().min(0),
      noChanges: z.boolean(),
    })
    .strict();
}
export interface HotelFormSectionSaveRequest<K extends HotelFormSectionKey = HotelFormSectionKey> {
  readonly answers: HotelFormSectionAnswers[K];
  readonly expectedVersion: number;
  readonly noChanges: boolean;
}

/**
 * A save's answer: the section as it stands after the save, which may be a colleague's when this save
 * changed nothing: its version, whether it is complete, the SHA-256 of its content, who saved it last and
 * when (`lastEditedBy` null for a person who withdrew their privacy notice consent), and whether that was
 * the person saving, which the page caches instead of assuming the saver.
 */
export const hotelFormSectionSaved = z
  .object({
    version: z.number().int().min(1),
    isComplete: z.boolean(),
    contentHash: z.string().regex(/^[0-9a-f]{64}$/),
    lastEditedBy: z.string().nullable(),
    lastEditedAt: isoDateTime,
    isLastSaveYours: z.boolean(),
  })
  .strict();
export type HotelFormSectionSaved = z.infer<typeof hotelFormSectionSaved>;

/** The detail path of a section's 409 `sectionConflict`. */
export const HOTEL_FORM_CONFLICT_PATH = "conflict";

/** The detail path of a 409 `readOnly`. */
export const HOTEL_FORM_READ_ONLY_PATH = "readOnly";

/** The sections' drafts by key, typed so a key's parse gives that section's answers. */
const DRAFTS: { readonly [K in HotelFormSectionKey]: z.ZodType<HotelFormSectionAnswers[K]> } =
  HOTEL_FORM_SECTION_DRAFTS;

/** A conflict as it travels: its answers are read through their own section's draft. */
const conflictEnvelope = z
  .object({
    section: hotelFormSectionKey,
    version: z.number().int().min(1),
    answers: z.unknown(),
    noChanges: z.boolean(),
    editedBy: z.string().nullable(),
    editedAt: isoDateTime,
  })
  .strict();

/**
 * A colleague's newer save of the section (409 `sectionConflict`): its version, answers and No changes,
 * and who saved it when (`editedBy` null for a colleague who withdrew their privacy notice consent), so
 * the page offers "Keep mine" (saved on their version) or "Take theirs".
 */
export interface HotelFormSectionConflict<K extends HotelFormSectionKey = HotelFormSectionKey> {
  readonly section: K;
  readonly version: number;
  readonly answers: HotelFormSectionAnswers[K];
  readonly noChanges: boolean;
  readonly editedBy: string | null;
  readonly editedAt: string;
}

/**
 * Who submitted a request no longer open to changes, and when (409 `readOnly`): `submittedBy` is null
 * for a person who withdrew their privacy notice consent, and before a submit.
 */
export const hotelFormReadOnly = z
  .object({
    status: hotelFormRequestStatus,
    submittedBy: z.string().nullable(),
    submittedAt: isoDateTime.nullable(),
  })
  .strict();
export type HotelFormReadOnly = z.infer<typeof hotelFormReadOnly>;

/**
 * A `sectionConflict`'s details for the error envelope.
 *
 * @example
 * new AppError("conflict", HOTEL_FORM_ERRORS.sectionConflict, hotelFormSectionConflictDetails(conflict));
 */
export function hotelFormSectionConflictDetails(conflict: HotelFormSectionConflict): ErrorDetail[] {
  return [{ path: HOTEL_FORM_CONFLICT_PATH, message: JSON.stringify(conflict) }];
}

/** A `readOnly`'s details for the error envelope; submit's `alreadySubmitted` carries the same. */
export function hotelFormReadOnlyDetails(readOnly: HotelFormReadOnly): ErrorDetail[] {
  return [{ path: HOTEL_FORM_READ_ONLY_PATH, message: JSON.stringify(readOnly) }];
}

/** The detail path of a section's 400 `sectionTooLarge`: its answers, never one of the section keys. */
export const HOTEL_FORM_TOO_LARGE_PATH = "answers";

/**
 * A `sectionTooLarge`'s details: the cap the section is over, in KB (HOTEL_FORM_SECTION_MAX_BYTES).
 *
 * @example
 * new AppError("validation_failed", HOTEL_FORM_ERRORS.sectionTooLarge, hotelFormSectionTooLargeDetails(key));
 */
export function hotelFormSectionTooLargeDetails(key: HotelFormSectionKey): ErrorDetail[] {
  const kb = HOTEL_FORM_SECTION_MAX_BYTES[key] / 1024;
  return [{ path: HOTEL_FORM_TOO_LARGE_PATH, message: `Keep this section under ${kb} KB` }];
}

/** The JSON a 409 carries under `path`, or undefined when it carries none that parses. */
function conflictJson(error: HotelFormRefusedCall, path: string): unknown {
  if (error.code !== "conflict") return undefined;
  const detail = error.details?.find((entry) => entry.path === path);
  if (detail === undefined) return undefined;
  try {
    return JSON.parse(detail.message);
  } catch {
    return undefined;
  }
}

/**
 * The colleague's save a refused save of `section` carried, or null when the error is not that.
 *
 * @example
 * const theirs = hotelFormSectionConflictOf(error, "rooms"); // offer Keep mine or Take theirs
 */
export function hotelFormSectionConflictOf<K extends HotelFormSectionKey>(
  error: HotelFormRefusedCall,
  section: K,
): HotelFormSectionConflict<K> | null {
  const envelope = conflictEnvelope.safeParse(conflictJson(error, HOTEL_FORM_CONFLICT_PATH));
  if (!envelope.success || envelope.data.section !== section) return null;
  const answers = DRAFTS[section].safeParse(envelope.data.answers);
  if (!answers.success) return null;
  return { ...envelope.data, section, answers: answers.data };
}

/**
 * Who submitted the request and when, from a refused save, or null when the error is not a `readOnly`.
 *
 * @example
 * const locked = hotelFormReadOnlyOf(error); // "Submitted by … at …", the unsaved text kept
 */
export function hotelFormReadOnlyOf(error: HotelFormRefusedCall): HotelFormReadOnly | null {
  const parsed = hotelFormReadOnly.safeParse(conflictJson(error, HOTEL_FORM_READ_ONLY_PATH));
  return parsed.success ? parsed.data : null;
}
