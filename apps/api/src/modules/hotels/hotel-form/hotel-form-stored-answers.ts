import {
  HOTEL_FORM_SECTION_DRAFTS,
  type HotelFormSectionAnswers,
  type HotelFormSectionKey,
  type LogFields,
} from "@ampm/core";
import type { z } from "zod";

import type { SectionRow } from "./hotel-form-sections.repository.js";

/*
 * A saved section's answers as the form reads them back (D-190 §3, review fix D3): through its draft under
 * the current schema. Answers saved before a change to the form's questions may no longer read; such a
 * section is answered with the draft's empty answers and marked unreadable, so the page asks for it again,
 * the submit check names it and its next save replaces the row, while the rest of the draft reads as
 * usual. Why it no longer reads is kept to the issues' paths and codes, never an answer.
 */

/** Each section's draft, typed so a key's parse gives that section's answers. */
const DRAFTS: { readonly [K in HotelFormSectionKey]: z.ZodType<HotelFormSectionAnswers[K]> } =
  HOTEL_FORM_SECTION_DRAFTS;

/** How many of a parse's issues the log names: enough to see the change, never the whole section. */
const LOGGED_ISSUES = 5;

/** Where a stored answer no longer reads, and the kind of refusal: no value. */
export interface UnreadableIssue {
  readonly path: string;
  readonly code: string;
}

/** A saved section's answers through the current draft, or empty with why when they no longer read. */
export type StoredAnswers<K extends HotelFormSectionKey> =
  | { readonly answers: HotelFormSectionAnswers[K]; readonly isUnreadable: false }
  | {
      readonly answers: HotelFormSectionAnswers[K];
      readonly isUnreadable: true;
      readonly issues: readonly UnreadableIssue[];
    };

/**
 * A saved section's answers read through its draft under the current schema.
 *
 * @example
 * const stored = storedAnswersOf("rooms", row); // { answers: {}, isUnreadable: true, issues } when stale
 */
export function storedAnswersOf<K extends HotelFormSectionKey>(
  key: K,
  row: SectionRow,
): StoredAnswers<K> {
  const parsed = DRAFTS[key].safeParse(row.answers);
  if (parsed.success) return { answers: parsed.data, isUnreadable: false };
  const issues = parsed.error.issues.slice(0, LOGGED_ISSUES).map((issue) => ({
    path: issue.path.map(String).join("."),
    code: issue.code,
  }));
  return { answers: DRAFTS[key].parse({}), isUnreadable: true, issues };
}

/**
 * What the log says of a section that no longer reads: the request, the section, its versions and the
 * issues' paths and codes; never an answer, a name or anything the hotel typed.
 *
 * @example
 * logger.warn("hotel_form.section_unreadable", unreadableLogOf(requestId, row, stored.issues));
 */
export function unreadableLogOf(
  requestId: string,
  row: SectionRow,
  issues: readonly UnreadableIssue[],
): LogFields {
  return {
    requestId,
    section: row.sectionKey,
    version: row.version,
    schemaVersion: row.schemaVersion,
    issues: [...issues],
  };
}
