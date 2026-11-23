import {
  buildHotelBody,
  draftFromHotel,
  hasErrors,
  hasInternalNotes,
  internalNotesBody,
  validateDraft,
} from "./hotel-profile.form";
import { hotelStaffViewFixture } from "./hotels-admin.test-utils";

/** The hotel as someone who cannot read its internal rating and notes gets it (D-171). */
function profileOnly() {
  const {
    internalRating: _rating,
    internalNotes: _notes,
    ...profile
  } = hotelStaffViewFixture({
    internalRating: 4,
    internalNotes: "Synthetic note",
  });
  return profile;
}

/** A hotel with every D-178 field filled in, synthetic values only. */
const FILLED = hotelStaffViewFixture({
  parentGroup: "Synthetic Group",
  nameAliases: ["The Lakeside", "Lakeside Palace Hotel"],
  city: "Udaipur",
  postalCode: "313001",
  mapsUrl: "https://maps.app.goo.gl/SyntheticPin1",
  latitude: 12.345678,
  longitude: 76.54321,
  airportDistanceKm: 22.5,
  airportDriveMinutes: 40,
  totalEventSpaceSqm: 1200,
  totalEventSpaceSqft: 12917,
  weddingBuyoutPolicy: "depends",
  minNights: 2,
  parallelFunctions: "not_allowed",
  cuisines: ["Indian", "Coastal"],
  isPureVegetarian: false,
  servesAlcohol: true,
});

describe("hotel profile form", () => {
  describe("draftFromHotel", () => {
    it("starts a create draft empty, with the draft status, flags off and nothing known", () => {
      expect(draftFromHotel(null)).toMatchObject({
        name: "",
        destinationId: "",
        totalRooms: "",
        internalRating: "",
        status: "draft",
        demoVisible: false,
        publicShowcase: false,
        nameAliases: "",
        latitude: "",
        cuisines: [],
        isPureVegetarian: "unknown",
        weddingBuyoutPolicy: "unset",
        parallelFunctions: "unset",
      });
    });

    it("seeds an edit draft from the hotel, numbers rendered as text", () => {
      const draft = draftFromHotel(
        hotelStaffViewFixture({ totalRooms: 120, internalRating: 4, brand: "Synthetic Hotels" }),
      );
      expect(draft).toMatchObject({
        name: "The Lakeside Palace",
        totalRooms: "120",
        internalRating: "4",
        brand: "Synthetic Hotels",
        status: "active",
      });
    });

    it("seeds every D-178 field: lists as lines, numbers as text, answers as choices", () => {
      expect(draftFromHotel(FILLED)).toMatchObject({
        parentGroup: "Synthetic Group",
        nameAliases: "The Lakeside\nLakeside Palace Hotel",
        city: "Udaipur",
        postalCode: "313001",
        latitude: "12.345678",
        longitude: "76.54321",
        airportDistanceKm: "22.5",
        airportDriveMinutes: "40",
        totalEventSpaceSqm: "1200",
        totalEventSpaceSqft: "12917",
        weddingBuyoutPolicy: "depends",
        minNights: "2",
        parallelFunctions: "not_allowed",
        cuisines: ["Indian", "Coastal"],
        isPureVegetarian: "no",
        hasSeparateVegKitchen: "unknown",
        servesAlcohol: "yes",
      });
    });

    it("renders null text and number fields as empty strings", () => {
      const draft = draftFromHotel(hotelStaffViewFixture({ brand: null, totalRooms: null }));
      expect(draft.brand).toBe("");
      expect(draft.totalRooms).toBe("");
    });

    it("seeds the facilities draft one per line", () => {
      const draft = draftFromHotel(hotelStaffViewFixture({ facilities: ["Spa", "Valet parking"] }));
      expect(draft.facilities).toBe("Spa\nValet parking");
      expect(draftFromHotel(hotelStaffViewFixture({ facilities: null })).facilities).toBe("");
    });
  });

  describe("validateDraft", () => {
    const valid = draftFromHotel(FILLED);

    it("passes a complete draft", () => {
      expect(hasErrors(validateDraft(valid))).toBe(false);
      expect(hasErrors(validateDraft(valid, "India"))).toBe(false);
    });

    it("requires a name and a destination", () => {
      const errors = validateDraft({ ...valid, name: "   ", destinationId: "" });
      expect(errors.name).toBeDefined();
      expect(errors.destinationId).toBeDefined();
    });

    it("rejects a non-numeric room count and an out-of-range rating", () => {
      expect(validateDraft({ ...valid, totalRooms: "lots" }).totalRooms).toBeDefined();
      expect(validateDraft({ ...valid, totalRooms: "100001" }).totalRooms).toBeDefined();
      expect(validateDraft({ ...valid, internalRating: "9" }).internalRating).toBeDefined();
      expect(validateDraft({ ...valid, internalRating: "3" }).internalRating).toBeUndefined();
    });

    it("checks the event space as whole numbers within the contract's bounds", () => {
      expect(validateDraft({ ...valid, totalEventSpaceSqm: "12.5" }).totalEventSpaceSqm).toBe(
        "Event space in m² is a whole number, up to 1,000,000",
      );
      expect(
        validateDraft({ ...valid, totalEventSpaceSqft: "10000001" }).totalEventSpaceSqft,
      ).toBeDefined();
    });

    it("keeps to 20 distinct name variants", () => {
      const lines = (count: number) => Array.from({ length: count }, (_, i) => `Name ${i}`);
      expect(validateDraft({ ...valid, nameAliases: lines(20).join("\n") }).nameAliases).toBe(
        undefined,
      );
      expect(validateDraft({ ...valid, nameAliases: lines(21).join("\n") }).nameAliases).toBe(
        "Keep to 20 name variants, one per line",
      );
      expect(
        validateDraft({ ...valid, nameAliases: "The Lakeside\nthe lakeside" }).nameAliases,
      ).toBe("Give each name variant once");
      expect(validateDraft({ ...valid, nameAliases: "x".repeat(256) }).nameAliases).toBe(
        "Each name variant is at most 255 characters",
      );
    });

    it("applies the PIN rule only when the destination is in India", () => {
      const pin = { ...valid, postalCode: "013001" };
      expect(validateDraft(pin, "India").postalCode).toBe(
        "A PIN code is 6 digits and does not start with 0",
      );
      expect(validateDraft(pin).postalCode).toBeUndefined();
      expect(
        validateDraft({ ...valid, postalCode: "313 001" }, "India").postalCode,
      ).toBeUndefined();
    });
  });

  describe("buildHotelBody", () => {
    it("trims text, sends null for empties, parses numbers, and omits the slug and street view", () => {
      const body = buildHotelBody({
        ...draftFromHotel(null),
        destinationId: "dest-1",
        name: "  Lakeside  ",
        brand: "",
        totalRooms: "80",
        website: "  https://x.test  ",
        internalRating: "",
        status: "active",
        demoVisible: true,
        latitude: " 12.345678 ",
        longitude: "-76.54321",
      });
      expect(body).toMatchObject({
        destinationId: "dest-1",
        name: "Lakeside",
        brand: null,
        totalRooms: 80,
        website: "https://x.test",
        status: "active",
        demoVisible: true,
        latitude: 12.345678,
        longitude: -76.54321,
      });
      expect("slug" in body).toBe(false);
      expect("streetViewRef" in body).toBe(false);
      // D-171: the internal rating and notes join the body only through internalNotesBody.
      expect("internalRating" in body).toBe(false);
      expect("internalNotes" in body).toBe(false);
    });

    it("sends every D-178 field it seeded back unchanged, so a save never wipes one", () => {
      expect(buildHotelBody(draftFromHotel(FILLED))).toMatchObject({
        parentGroup: "Synthetic Group",
        nameAliases: ["The Lakeside", "Lakeside Palace Hotel"],
        city: "Udaipur",
        mapsUrl: "https://maps.app.goo.gl/SyntheticPin1",
        airportDistanceKm: 22.5,
        totalEventSpaceSqft: 12917,
        weddingBuyoutPolicy: "depends",
        minNights: 2,
        parallelFunctions: "not_allowed",
        cuisines: ["Indian", "Coastal"],
        isPureVegetarian: false,
        hasSeparateVegKitchen: null,
        servesAlcohol: true,
      });
    });

    it("sends not known, not set and blanks as null", () => {
      expect(buildHotelBody(draftFromHotel(null))).toMatchObject({
        parentGroup: null,
        nameAliases: null,
        latitude: null,
        totalEventSpaceSqm: null,
        weddingBuyoutPolicy: null,
        parallelFunctions: null,
        cuisines: null,
        isPureVegetarian: null,
        servesAlcohol: null,
      });
    });

    it("parses the facilities one per line, a | also separating two, or null when blank", () => {
      expect(
        buildHotelBody({
          ...draftFromHotel(null),
          facilities: "Spa, salon and gym\n Pool | Lawn \n",
        }).facilities,
      ).toEqual(["Spa, salon and gym", "Pool", "Lawn"]);
      expect(buildHotelBody({ ...draftFromHotel(null), facilities: " \n " }).facilities).toBeNull();
    });

    it("sends an imported hotel's lists back as they are on an unrelated save", () => {
      const imported = hotelStaffViewFixture({
        facilities: ["Spa, salon", "Pool"],
        nameAliases: ["Synthetic Bay, Old Town", "The Synthetic Bay"],
      });
      const body = buildHotelBody({ ...draftFromHotel(imported), brand: "Example Collection" });
      expect(body.facilities).toEqual(["Spa, salon", "Pool"]);
      expect(body.nameAliases).toEqual(["Synthetic Bay, Old Town", "The Synthetic Bay"]);
    });
  });

  describe("the internal rating and notes (D-171)", () => {
    it("knows whether the hotel carries them", () => {
      expect(hasInternalNotes(hotelStaffViewFixture())).toBe(true);
      expect(hasInternalNotes(profileOnly())).toBe(false);
    });

    it("seeds them empty for a hotel that came without them", () => {
      const draft = draftFromHotel(profileOnly());
      expect(draft).toMatchObject({
        name: "The Lakeside Palace",
        internalRating: "",
        internalNotes: "",
      });
    });

    it("builds their part of the body: trimmed text or null, the rating parsed", () => {
      const draft = { ...draftFromHotel(null), internalRating: "4", internalNotes: "  Note  " };
      expect(internalNotesBody(draft)).toEqual({ internalRating: 4, internalNotes: "Note" });
      const empty = draftFromHotel(null);
      expect(internalNotesBody(empty)).toEqual({ internalRating: null, internalNotes: null });
    });
  });
});
