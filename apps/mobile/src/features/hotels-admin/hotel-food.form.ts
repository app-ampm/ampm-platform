import { HOTEL_CUISINES_MAX, type HotelCreateRequest, type HotelStaffListItem } from "@ampm/core";

import { booleanFromTriState, triStateFrom, type TriState } from "./hotel-form-fields";

/*
 * The profile editor's food and beverage part (D-178): the hotel's cuisines, picked from the configured
 * options (`hotel.cuisine_options`) or "Other", and three yes / no facts the hotel may not have given
 * yet (pure vegetarian, a separate vegetarian kitchen, alcohol served). Not known is null, never false:
 * a toggle would save "no alcohol" for a hotel that has simply not said. A label the hotel already has
 * stays offered and chosen even when the options no longer list it, so a save never drops it unasked.
 */

export interface FoodDraft {
  readonly cuisines: readonly string[];
  readonly isPureVegetarian: TriState;
  readonly hasSeparateVegKitchen: TriState;
  readonly servesAlcohol: TriState;
}

/** Edit seeds from the hotel; create starts with no cuisines and every fact not known. */
export function foodDraftFrom(hotel: HotelStaffListItem | null): FoodDraft {
  return {
    cuisines: hotel?.cuisines ?? [],
    isPureVegetarian: triStateFrom(hotel?.isPureVegetarian ?? null),
    hasSeparateVegKitchen: triStateFrom(hotel?.hasSeparateVegKitchen ?? null),
    servesAlcohol: triStateFrom(hotel?.servesAlcohol ?? null),
  };
}

export type FoodErrors = { readonly cuisines: string | undefined };

export function validateFood(draft: FoodDraft): FoodErrors {
  return {
    cuisines:
      draft.cuisines.length > HOTEL_CUISINES_MAX
        ? `Choose up to ${HOTEL_CUISINES_MAX} cuisines`
        : undefined,
  };
}

type FoodBody = Pick<
  HotelCreateRequest,
  "cuisines" | "isPureVegetarian" | "hasSeparateVegKitchen" | "servesAlcohol"
>;

/** The food part of the body: the cuisines, or null when none; not known as null. */
export function foodBody(draft: FoodDraft): FoodBody {
  return {
    cuisines: draft.cuisines.length === 0 ? null : [...draft.cuisines],
    isPureVegetarian: booleanFromTriState(draft.isPureVegetarian),
    hasSeparateVegKitchen: booleanFromTriState(draft.hasSeparateVegKitchen),
    servesAlcohol: booleanFromTriState(draft.servesAlcohol),
  };
}

const sameLabel = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** Whether the label is among the chosen cuisines; labels match ignoring case, as the contract does. */
export function isCuisineChosen(chosen: readonly string[], label: string): boolean {
  return chosen.some((item) => sameLabel(item, label));
}

/** The labels in their order, each once whatever its spelling: the first spelling stays. */
export function distinctLabels(labels: readonly string[]): string[] {
  const distinct: string[] = [];
  for (const label of labels) {
    if (!distinct.some((item) => sameLabel(item, label))) distinct.push(label);
  }
  return distinct;
}

/**
 * The chips to offer: the configured options, then each label the hotel has (saved or just chosen) that
 * they no longer list, kept so staff can see it, remove it and take the removal back, then the label for
 * anything else.
 *
 * @example
 * cuisineChoices(["Indian", "Italian"], "Other", ["Coastal"]); // ["Indian", "Italian", "Coastal", "Other"]
 */
export function cuisineChoices(
  options: readonly string[],
  other: string,
  kept: readonly string[],
): string[] {
  const offered = distinctLabels([...options, ...kept]).filter((item) => !sameLabel(item, other));
  return [...offered, other];
}

/** The chosen cuisines with the label added, or removed (every spelling of it) when it was chosen. */
export function toggleCuisine(chosen: readonly string[], label: string): string[] {
  return isCuisineChosen(chosen, label)
    ? chosen.filter((item) => !sameLabel(item, label))
    : [...chosen, label];
}
