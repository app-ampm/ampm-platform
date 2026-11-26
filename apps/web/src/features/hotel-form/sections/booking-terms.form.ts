import { hotelFormBookingTermsDraft, type HotelFormSectionAnswers } from "@ampm/core";

import {
  answerReader,
  choiceInput,
  fieldId,
  numberInput,
  numberText,
  textOf,
} from "./field-values";
import type { BuiltAnswers, SectionModel } from "./section-model";

/*
 * Booking terms (plan §5.1: 2.3 and 4.1 asked once, 4.2, 4.3; D-190 §2), INTERNAL in the catalogue
 * (decision 12): whether a wedding needs a full buyout and, if not always, the fewest rooms without one;
 * the fewest nights; whether functions can run side by side; and notes.
 */

type Answers = HotelFormSectionAnswers["booking_terms"];

const SHAPE = hotelFormBookingTermsDraft.shape;

export interface BookingTermsFields {
  /** required, not_required, depends, or "". */
  readonly buyout: string;
  readonly minRooms: string;
  readonly minNights: string;
  /** allowed, not_allowed, depends, or "". */
  readonly parallel: string;
  readonly notes: string;
  readonly noLongerOffered: string;
}

/** A booking terms field's id. */
export const bookingId = (part: string) => fieldId("booking_terms", part);

/** Whether the fewest rooms without a buyout is asked: not when every wedding needs a full buyout. */
export const asksMinRooms = (buyout: string): boolean => buyout !== "required";

function fieldsOf(answers: Answers): BookingTermsFields {
  return {
    buyout: textOf(answers.weddingBuyoutPolicy),
    minRooms: numberText(answers.minRoomsWithoutBuyout),
    minNights: numberText(answers.minNights),
    parallel: textOf(answers.parallelFunctions),
    notes: textOf(answers.notes),
    noLongerOffered: textOf(answers.noLongerOffered),
  };
}

function answersOf(fields: BookingTermsFields, saved: Answers): BuiltAnswers<"booking_terms"> {
  const r = answerReader();
  const answers: Answers = {
    weddingBuyoutPolicy: r.read(
      bookingId("buyout"),
      SHAPE.weddingBuyoutPolicy,
      choiceInput(fields.buyout),
      saved.weddingBuyoutPolicy,
    ),
    // Asked only while a wedding can book without a full buyout; its words stay on the page meanwhile.
    minRoomsWithoutBuyout: asksMinRooms(fields.buyout)
      ? r.read(
          bookingId("minRooms"),
          SHAPE.minRoomsWithoutBuyout,
          numberInput(fields.minRooms),
          saved.minRoomsWithoutBuyout,
        )
      : null,
    minNights: r.read(
      bookingId("minNights"),
      SHAPE.minNights,
      numberInput(fields.minNights),
      saved.minNights,
    ),
    parallelFunctions: r.read(
      bookingId("parallel"),
      SHAPE.parallelFunctions,
      choiceInput(fields.parallel),
      saved.parallelFunctions,
    ),
    notes: r.read(bookingId("notes"), SHAPE.notes, fields.notes, saved.notes),
    noLongerOffered: r.read(
      bookingId("noLongerOffered"),
      SHAPE.noLongerOffered,
      fields.noLongerOffered,
      saved.noLongerOffered,
    ),
  };
  return { answers, errors: r.errors };
}

/**
 * The booking terms section's fields and their reading.
 *
 * @example
 * const fields = BOOKING_TERMS_MODEL.fieldsOf(draft.sections.booking_terms.answers, newKey);
 */
export const BOOKING_TERMS_MODEL: SectionModel<"booking_terms", BookingTermsFields> = {
  fieldsOf,
  answersOf,
};
