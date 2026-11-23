import {
  cuisineChoices,
  distinctLabels,
  foodBody,
  foodDraftFrom,
  isCuisineChosen,
  toggleCuisine,
  validateFood,
} from "./hotel-food.form";
import { hotelStaffViewFixture } from "./hotels-admin.test-utils";

const OPTIONS = ["Indian", "Continental", "Asian"];

describe("hotel-food.form", () => {
  it("seeds the cuisines and the three answers, not known where the hotel has not said", () => {
    expect(foodDraftFrom(null)).toEqual({
      cuisines: [],
      isPureVegetarian: "unknown",
      hasSeparateVegKitchen: "unknown",
      servesAlcohol: "unknown",
    });
    const hotel = hotelStaffViewFixture({
      cuisines: ["Indian"],
      isPureVegetarian: true,
      servesAlcohol: false,
    });
    expect(foodDraftFrom(hotel)).toEqual({
      cuisines: ["Indian"],
      isPureVegetarian: "yes",
      hasSeparateVegKitchen: "unknown",
      servesAlcohol: "no",
    });
  });

  it("builds the body: no cuisines as null, not known as null, never false", () => {
    expect(foodBody(foodDraftFrom(null))).toEqual({
      cuisines: null,
      isPureVegetarian: null,
      hasSeparateVegKitchen: null,
      servesAlcohol: null,
    });
    expect(
      foodBody({
        cuisines: ["Indian", "Other"],
        isPureVegetarian: "no",
        hasSeparateVegKitchen: "yes",
        servesAlcohol: "unknown",
      }),
    ).toEqual({
      cuisines: ["Indian", "Other"],
      isPureVegetarian: false,
      hasSeparateVegKitchen: true,
      servesAlcohol: null,
    });
  });

  it("keeps to 30 cuisines", () => {
    const many = Array.from({ length: 31 }, (_, index) => `Cuisine ${index}`);
    expect(validateFood({ ...foodDraftFrom(null), cuisines: many }).cuisines).toBe(
      "Choose up to 30 cuisines",
    );
    expect(validateFood(foodDraftFrom(null)).cuisines).toBeUndefined();
  });

  describe("the cuisine chips", () => {
    it("offers the options, then the hotel's labels they no longer list, then Other", () => {
      expect(cuisineChoices(OPTIONS, "Other", [])).toEqual([...OPTIONS, "Other"]);
      expect(cuisineChoices(OPTIONS, "Other", ["Coastal", "indian", "Other", "coastal"])).toEqual([
        ...OPTIONS,
        "Coastal",
        "Other",
      ]);
      // An options list that names Other itself still shows it once, last.
      expect(cuisineChoices(["Other", "Indian"], "Other", [])).toEqual(["Indian", "Other"]);
    });

    it("matches labels ignoring case and toggles every spelling of one", () => {
      expect(isCuisineChosen(["indian"], "Indian")).toBe(true);
      expect(toggleCuisine(["Indian", "Asian"], "asian")).toEqual(["Indian"]);
      expect(toggleCuisine(["Indian"], "Asian")).toEqual(["Indian", "Asian"]);
      expect(distinctLabels(["Coastal", "coastal", "Indian"])).toEqual(["Coastal", "Indian"]);
    });
  });
});
