import { sqmFromSqft } from "@ampm/core";

import {
  areaBody,
  areaErrors,
  EVENT_SPACE_AREA,
  isSqmDerived,
  ROOM_SIZE_AREA,
  shownSqm,
  VENUE_AREA,
} from "./hotel-area.form";
import { buildHotelBody, draftFromHotel, validateDraft } from "./hotel-profile.form";
import { hotelStaffViewFixture } from "./hotels-admin.test-utils";

describe("hotel-area.form (the units rule in the editors)", () => {
  it("works the m² out from a filled sq ft with core's converter, and shows the typed m² otherwise", () => {
    expect(isSqmDerived("  ")).toBe(false);
    expect(isSqmDerived("650")).toBe(true);
    expect(shownSqm("", "1000", VENUE_AREA)).toBe("93");
    expect(shownSqm("95", "1000", VENUE_AREA)).toBe(String(sqmFromSqft(1000)));
    expect(shownSqm("80", "", VENUE_AREA)).toBe("80");
  });

  it("shows no m² while the sq ft is not a valid entry yet", () => {
    expect(shownSqm("80", "12x", VENUE_AREA)).toBe("");
    expect(shownSqm("80", "1000001", ROOM_SIZE_AREA)).toBe("");
  });

  it("checks the sq ft always and the m² only while it is typed", () => {
    expect(areaErrors("12.5", "1000", ROOM_SIZE_AREA)).toEqual({ sqm: undefined, sqft: undefined });
    expect(areaErrors("12.5", "", ROOM_SIZE_AREA)).toEqual({
      sqm: "Size in m² is a whole number, up to 100,000",
      sqft: undefined,
    });
    expect(areaErrors("", "1000001", ROOM_SIZE_AREA).sqft).toBe(
      "Size in sq ft is a whole number, up to 1,000,000",
    );
  });

  it("sends a filled sq ft with its worked-out m², or the typed m² and no sq ft", () => {
    expect(areaBody("95", "1000")).toEqual({ sqm: 93, sqft: 1000 });
    expect(areaBody("80", " ")).toEqual({ sqm: 80, sqft: null });
    expect(areaBody("", "")).toEqual({ sqm: null, sqft: null });
  });

  describe("the hotel's total event space", () => {
    const hotel = hotelStaffViewFixture({ totalEventSpaceSqm: 1100, totalEventSpaceSqft: 12917 });

    it("sends the m² worked out from the sq ft, whatever m² the draft holds", () => {
      const body = buildHotelBody(draftFromHotel(hotel));
      expect(body).toMatchObject({ totalEventSpaceSqm: 1200, totalEventSpaceSqft: 12917 });
    });

    it("keeps a typed m² when the sq ft is emptied, and checks it then", () => {
      const draft = {
        ...draftFromHotel(hotel),
        totalEventSpaceSqft: "",
        totalEventSpaceSqm: "1150",
      };
      expect(buildHotelBody(draft)).toMatchObject({
        totalEventSpaceSqm: 1150,
        totalEventSpaceSqft: null,
      });
      expect(validateDraft({ ...draft, totalEventSpaceSqm: "12.5" }).totalEventSpaceSqm).toBe(
        EVENT_SPACE_AREA.sqm.message,
      );
      expect(validateDraft({ ...draftFromHotel(hotel), totalEventSpaceSqm: "x" })).toMatchObject({
        totalEventSpaceSqm: undefined,
      });
    });
  });
});
