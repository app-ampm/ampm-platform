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

describe("hotel profile form", () => {
  describe("draftFromHotel", () => {
    it("starts a create draft empty, with the draft status and flags off", () => {
      expect(draftFromHotel(null)).toMatchObject({
        name: "",
        destinationId: "",
        totalRooms: "",
        internalRating: "",
        status: "draft",
        demoVisible: false,
        publicShowcase: false,
      });
    });

    it("seeds an edit draft from the hotel, numbers rendered as text", () => {
      const draft = draftFromHotel(
        hotelStaffViewFixture({ totalRooms: 120, internalRating: 4, brand: "Taj Hotels" }),
      );
      expect(draft).toMatchObject({
        name: "The Lakeside Palace",
        totalRooms: "120",
        internalRating: "4",
        brand: "Taj Hotels",
        status: "active",
      });
    });

    it("renders null text and number fields as empty strings", () => {
      const draft = draftFromHotel(hotelStaffViewFixture({ brand: null, totalRooms: null }));
      expect(draft.brand).toBe("");
      expect(draft.totalRooms).toBe("");
    });

    it("seeds the facilities draft as a comma-separated list", () => {
      const draft = draftFromHotel(hotelStaffViewFixture({ facilities: ["Spa", "Valet parking"] }));
      expect(draft.facilities).toBe("Spa, Valet parking");
      expect(draftFromHotel(hotelStaffViewFixture({ facilities: null })).facilities).toBe("");
    });
  });

  describe("validateDraft", () => {
    const valid = draftFromHotel(hotelStaffViewFixture());

    it("passes a complete draft", () => {
      expect(hasErrors(validateDraft(valid))).toBe(false);
    });

    it("requires a name and a destination", () => {
      const errors = validateDraft({ ...valid, name: "   ", destinationId: "" });
      expect(errors.name).toBeDefined();
      expect(errors.destinationId).toBeDefined();
    });

    it("rejects a non-numeric room count and an out-of-range rating", () => {
      expect(validateDraft({ ...valid, totalRooms: "lots" }).totalRooms).toBeDefined();
      expect(validateDraft({ ...valid, internalRating: "9" }).internalRating).toBeDefined();
      expect(validateDraft({ ...valid, internalRating: "3" }).internalRating).toBeUndefined();
    });
  });

  describe("buildHotelBody", () => {
    it("trims text, sends null for empties, parses numbers, and omits the slug and geo fields", () => {
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
      });
      expect(body).toMatchObject({
        destinationId: "dest-1",
        name: "Lakeside",
        brand: null,
        totalRooms: 80,
        website: "https://x.test",
        status: "active",
        demoVisible: true,
      });
      expect("slug" in body).toBe(false);
      expect("latitude" in body).toBe(false);
      // D-171: the internal rating and notes join the body only through internalNotesBody.
      expect("internalRating" in body).toBe(false);
      expect("internalNotes" in body).toBe(false);
    });

    it("parses the comma-separated facilities into a list, or null when blank", () => {
      expect(
        buildHotelBody({ ...draftFromHotel(null), facilities: "Spa, Valet parking , " }).facilities,
      ).toEqual(["Spa", "Valet parking"]);
      expect(buildHotelBody({ ...draftFromHotel(null), facilities: "   " }).facilities).toBeNull();
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
