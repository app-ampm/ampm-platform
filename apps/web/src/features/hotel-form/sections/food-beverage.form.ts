import { hotelFormFoodBeverageDraft, type HotelFormSectionAnswers } from "@ampm/core";

import { answerReader, booleanOf, fieldId, textOf, yesNoOf, type YesNo } from "./field-values";
import type { BuiltAnswers, SectionModel } from "./section-model";

/*
 * Food and beverage (plan §5.1: 5.2 and the new Yes or No facts; D-190 §2): cuisine chips from the
 * draft's options (configuration `hotel.cuisine_options`) with Other and its words, and three Yes or No
 * questions that can be left unanswered again. The menus are uploads (Slice 9).
 */

type Answers = HotelFormSectionAnswers["food_beverage"];

const SHAPE = hotelFormFoodBeverageDraft.shape;

export interface FoodBeverageFields {
  readonly cuisines: readonly string[];
  readonly cuisinesOther: string;
  readonly isPureVegetarian: YesNo;
  readonly hasSeparateVegKitchen: YesNo;
  readonly servesAlcohol: YesNo;
  readonly noLongerOffered: string;
}

/** The three Yes or No questions, in the section's order. */
export const FOOD_FACTS = ["isPureVegetarian", "hasSeparateVegKitchen", "servesAlcohol"] as const;
export type FoodFact = (typeof FOOD_FACTS)[number];

/** A food and beverage field's id. */
export const foodId = (part: string) => fieldId("food_beverage", part);

function fieldsOf(answers: Answers): FoodBeverageFields {
  return {
    cuisines: answers.cuisines ?? [],
    cuisinesOther: textOf(answers.cuisinesOther),
    isPureVegetarian: yesNoOf(answers.isPureVegetarian),
    hasSeparateVegKitchen: yesNoOf(answers.hasSeparateVegKitchen),
    servesAlcohol: yesNoOf(answers.servesAlcohol),
    noLongerOffered: textOf(answers.noLongerOffered),
  };
}

/**
 * The food and beverage fields read into answers; `other` is the Other chip's value from the draft's
 * cuisine options, whose words are kept only while it is chosen.
 */
function answersOf(
  fields: FoodBeverageFields,
  saved: Answers,
  other: string,
): BuiltAnswers<"food_beverage"> {
  const r = answerReader();
  const answers: Answers = {
    cuisines: r.read(foodId("cuisines"), SHAPE.cuisines, fields.cuisines, saved.cuisines),
    cuisinesOther: r.read(
      foodId("cuisinesOther"),
      SHAPE.cuisinesOther,
      fields.cuisines.includes(other) ? fields.cuisinesOther : null,
      saved.cuisinesOther,
    ),
    isPureVegetarian: booleanOf(fields.isPureVegetarian),
    hasSeparateVegKitchen: booleanOf(fields.hasSeparateVegKitchen),
    servesAlcohol: booleanOf(fields.servesAlcohol),
    noLongerOffered: r.read(
      foodId("noLongerOffered"),
      SHAPE.noLongerOffered,
      fields.noLongerOffered,
      saved.noLongerOffered,
    ),
  };
  return { answers, errors: r.errors };
}

/**
 * The food and beverage section's fields and their reading, for the draft's cuisine Other.
 *
 * @example
 * const model = foodBeverageModel(draft.options.cuisines.other);
 */
export function foodBeverageModel(
  other: string,
): SectionModel<"food_beverage", FoodBeverageFields> {
  return { fieldsOf, answersOf: (fields, saved) => answersOf(fields, saved, other) };
}
