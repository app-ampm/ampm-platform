import { hasErrors } from "./hotel-form-fields";
import { venueViewFixture } from "./hotels-admin.test-utils";
import {
  buildVenueBody,
  draftFromVenue,
  hasSetting,
  validateVenue,
  VENUE_FIELD_LABEL,
  venueUpdateBody,
  type ValidVenueDraft,
} from "./venues.form";

const filled: ValidVenueDraft = {
  ...draftFromVenue(null),
  name: "Synthetic Terrace",
  venueType: "terrace",
  setting: "semi_open",
  areaSqft: "3000",
  lengthM: "30.5",
  widthM: "9.75",
  ceilingHeightM: "4",
  capacityBanquet: "180",
  capacityReception: "250",
  capacityNotes: "160 to 180 seated with the stage in",
  otherLayouts: [{ key: "0", layout: "Classroom", max: "120", min: "" }],
  prefunctionAreaSqft: "800",
  facilities: "Stage, lights\nBar",
};

describe("venues.form", () => {
  it("holds the facilities to the contract's 100 entries of 120 characters, naming the field", () => {
    const commaList = Array.from({ length: 12 }, (_, i) => `Synthetic amenity ${i}`).join(", ");
    expect(validateVenue({ ...filled, facilities: commaList }).facilities).toBe(
      "Each facility is at most 120 characters; put each one on its own line",
    );
    expect(VENUE_FIELD_LABEL.facilities).toBe("Facilities");
    expect(hasErrors(validateVenue(filled))).toBe(false);
  });

  it("starts a new venue with no setting chosen, which a save refuses", () => {
    const draft = { ...draftFromVenue(null), name: "Synthetic Lawn" };
    expect(draft.setting).toBe("unset");
    expect(hasSetting(draft)).toBe(false);
    expect(validateVenue(draft).setting).toBe("Choose the venue's setting");
  });

  it("seeds an edit from the venue, its setting, layouts and facilities", () => {
    const venue = venueViewFixture({
      setting: "semi_open",
      isIndoor: false,
      lengthM: 30.5,
      otherLayouts: [{ layout: "U-shape", max: 40, min: 30 }],
    });
    expect(draftFromVenue(venue)).toMatchObject({
      setting: "semi_open",
      lengthM: "30.5",
      otherLayouts: [{ key: "0", layout: "U-shape", max: "40", min: "30" }],
      facilities: "stage\nAV",
    });
  });

  it("passes a full draft and labels the capacities with what they count", () => {
    expect(hasErrors(validateVenue(filled))).toBe(false);
    expect(VENUE_FIELD_LABEL.capacityBanquet).toBe("Seated (dinner at round tables)");
    expect(VENUE_FIELD_LABEL.capacityReception).toBe("Floating (standing reception or cocktails)");
  });

  it("checks lengths to two decimals within bounds, and capacities as whole numbers", () => {
    expect(validateVenue({ ...filled, lengthM: "30.555" }).lengthM).toBe(
      "Length is in metres, up to 2,000, to two decimals",
    );
    expect(validateVenue({ ...filled, ceilingHeightM: "100.01" }).ceilingHeightM).toBeDefined();
    expect(validateVenue({ ...filled, capacityTheatre: "600-700" }).capacityTheatre).toBe(
      "Theatre is a whole number, up to 100,000",
    );
  });

  it("refuses a bad layout row and names it as the layouts' problem", () => {
    const rows = [{ key: "0", layout: "Classroom", max: "40", min: "50" }];
    expect(validateVenue({ ...filled, otherLayouts: rows }).otherLayouts).toBe(
      "The fewest guests is above the most",
    );
  });

  it("builds the body: the setting, the m² of each area from its sq ft, layouts and facilities per line", () => {
    expect(buildVenueBody(filled)).toEqual({
      name: "Synthetic Terrace",
      venueType: "terrace",
      setting: "semi_open",
      areaSqm: 279,
      areaSqft: 3000,
      lengthM: 30.5,
      widthM: 9.75,
      ceilingHeightM: 4,
      capacityBanquet: 180,
      capacityTheatre: null,
      capacityReception: 250,
      capacityNotes: "160 to 180 seated with the stage in",
      otherLayouts: [{ layout: "Classroom", max: 120 }],
      prefunctionAreaSqm: 74,
      prefunctionAreaSqft: 800,
      facilities: ["Stage, lights", "Bar"],
      description: null,
    });
  });

  it("updates only what changed: a new setting, or nothing at all", () => {
    const venue = venueViewFixture();
    const opened: ValidVenueDraft = { ...draftFromVenue(venue), setting: venue.setting };
    expect(venueUpdateBody(opened, venue)).toEqual({});
    expect(venueUpdateBody({ ...opened, setting: "outdoor" }, venue)).toEqual({
      setting: "outdoor",
    });
    expect(venueUpdateBody({ ...opened, capacityTheatre: "420" }, venue)).toEqual({
      capacityTheatre: 420,
    });
  });
});
