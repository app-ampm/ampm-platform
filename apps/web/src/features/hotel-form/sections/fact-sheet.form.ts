import { hotelFormFactSheetMediaDraft, type HotelFormSectionAnswers } from "@ampm/core";

import { answerReader, fieldId, textOf } from "./field-values";
import type { BuiltAnswers, SectionModel } from "./section-model";

/*
 * Fact sheet, photos and floor plans (plan §5.1, upload field 1; D-190 §2): for now only "When was the
 * fact sheet last updated?" as a month (YYYY-MM); the uploads arrive in Slice 9.
 */

type Answers = HotelFormSectionAnswers["fact_sheet_media"];

const SHAPE = hotelFormFactSheetMediaDraft.shape;

export interface FactSheetFields {
  /** A month as the browser's month field gives it (YYYY-MM), or as typed where it has none. */
  readonly factSheetAsOf: string;
  readonly noLongerOffered: string;
}

/** A fact sheet field's id. */
export const factSheetId = (part: string) => fieldId("fact_sheet_media", part);

function fieldsOf(answers: Answers): FactSheetFields {
  return {
    factSheetAsOf: textOf(answers.factSheetAsOf),
    noLongerOffered: textOf(answers.noLongerOffered),
  };
}

function answersOf(fields: FactSheetFields, saved: Answers): BuiltAnswers<"fact_sheet_media"> {
  const r = answerReader();
  const answers: Answers = {
    factSheetAsOf: r.read(
      factSheetId("factSheetAsOf"),
      SHAPE.factSheetAsOf,
      fields.factSheetAsOf,
      saved.factSheetAsOf,
    ),
    noLongerOffered: r.read(
      factSheetId("noLongerOffered"),
      SHAPE.noLongerOffered,
      fields.noLongerOffered,
      saved.noLongerOffered,
    ),
  };
  return { answers, errors: r.errors };
}

/**
 * The fact sheet section's fields and their reading.
 *
 * @example
 * const fields = FACT_SHEET_MODEL.fieldsOf(draft.sections.fact_sheet_media.answers, newKey);
 */
export const FACT_SHEET_MODEL: SectionModel<"fact_sheet_media", FactSheetFields> = {
  fieldsOf,
  answersOf,
};
