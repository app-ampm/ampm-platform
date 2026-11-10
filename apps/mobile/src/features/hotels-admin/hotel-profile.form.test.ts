import { buildHotelBody, draftFromHotel, hasErrors, validateDraft } from "./hotel-profile.form";
import { hotelStaffViewFixture } from "./hotels-admin.test-utils";

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
        internalRating: null,
        status: "active",
        demoVisible: true,
      });
      expect("slug" in body).toBe(false);
      expect("latitude" in body).toBe(false);
    });
  });
});
