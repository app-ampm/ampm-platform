import type { HotelFormSectionAnswers, HotelFormSectionKey } from "@ampm/core";

/*
 * What a section's page needs from its fields (D-190 §5): how saved answers fill them, and how what is
 * typed is read back into answers to save. Each section's `*.form.ts` holds its own; the page and the
 * autosave are the same for all seven.
 */

/** Answers read from the fields: each field as typed when it reads, else as saved; why each did not. */
export interface BuiltAnswers<K extends HotelFormSectionKey> {
  readonly answers: HotelFormSectionAnswers[K];
  /** Each refused field's message, by the field's id. */
  readonly errors: Readonly<Record<string, string>>;
}

/** A section's fields and their reading, for one section key. */
export interface SectionModel<K extends HotelFormSectionKey, F> {
  /** The fields filled from saved answers; `newKey` names a row the page adds (a UUID). */
  readonly fieldsOf: (answers: HotelFormSectionAnswers[K], newKey: () => string) => F;
  /** The answers the fields hold, read against the saved ones. */
  readonly answersOf: (fields: F, saved: HotelFormSectionAnswers[K]) => BuiltAnswers<K>;
}
