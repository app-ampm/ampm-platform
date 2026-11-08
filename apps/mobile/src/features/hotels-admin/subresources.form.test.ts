import { hasErrors } from "./hotel-form-fields";
import {
  buildContactBody,
  buildRoomBody,
  buildVenueBody,
  draftFromContact,
  draftFromRoom,
  draftFromVenue,
  validateContact,
  validateRoom,
  validateVenue,
} from "./subresources.form";
import {
  hotelContactViewFixture,
  roomCategoryViewFixture,
  venueViewFixture,
} from "./hotels-admin.test-utils";

describe("subresource forms", () => {
  describe("rooms", () => {
    it("seeds an edit draft from the room, numbers and facilities as text", () => {
      expect(draftFromRoom(roomCategoryViewFixture())).toMatchObject({
        name: "Deluxe Lake View",
        roomCount: "20",
        maxOccupancy: "3",
        sizeSqm: "45",
        facilities: "wifi, minibar",
      });
    });

    it("starts a create draft empty", () => {
      expect(draftFromRoom(null)).toEqual({
        name: "",
        roomCount: "",
        maxOccupancy: "",
        sizeSqm: "",
        facilities: "",
        description: "",
      });
    });

    it("requires a name and rejects a non-whole count", () => {
      const valid = draftFromRoom(roomCategoryViewFixture());
      expect(hasErrors(validateRoom(valid))).toBe(false);
      const errors = validateRoom({ ...valid, name: "  ", roomCount: "12.5" });
      expect(errors.name).toBeDefined();
      expect(errors.roomCount).toBeDefined();
    });

    it("builds the body: trims the name, parses ints, splits facilities, nulls the blanks", () => {
      expect(
        buildRoomBody({
          name: "  Suite  ",
          roomCount: "10",
          maxOccupancy: "",
          sizeSqm: "60",
          facilities: "wifi, , balcony ",
          description: "  ",
        }),
      ).toEqual({
        name: "Suite",
        roomCount: 10,
        maxOccupancy: null,
        sizeSqm: 60,
        facilities: ["wifi", "balcony"],
        description: null,
      });
    });
  });

  describe("venues", () => {
    it("defaults a create draft to an indoor ballroom", () => {
      expect(draftFromVenue(null)).toMatchObject({ venueType: "ballroom", isIndoor: true });
    });

    it("seeds an edit draft from the venue", () => {
      expect(
        draftFromVenue(venueViewFixture({ isIndoor: false, venueType: "lawn" })),
      ).toMatchObject({
        name: "Grand Ballroom",
        venueType: "lawn",
        isIndoor: false,
        capacityBanquet: "300",
      });
    });

    it("requires a name and rejects a non-whole capacity", () => {
      const valid = draftFromVenue(venueViewFixture());
      expect(hasErrors(validateVenue(valid))).toBe(false);
      const errors = validateVenue({ ...valid, name: "", capacityBanquet: "lots" });
      expect(errors.name).toBeDefined();
      expect(errors.capacityBanquet).toBeDefined();
    });

    it("builds the body with the type, indoor flag and parsed capacities", () => {
      const body = buildVenueBody(draftFromVenue(venueViewFixture({ isIndoor: false })));
      expect(body).toMatchObject({
        name: "Grand Ballroom",
        venueType: "ballroom",
        isIndoor: false,
        capacityBanquet: 300,
        capacityTheatre: 400,
      });
    });
  });

  describe("contacts", () => {
    it("seeds an edit draft from the contact", () => {
      expect(draftFromContact(hotelContactViewFixture())).toMatchObject({
        name: "Priya Sharma",
        roleTitle: "Events Manager",
        email: "priya@lakeside.example",
        isPrimary: true,
      });
    });

    it("requires a name and rejects a malformed email", () => {
      const valid = draftFromContact(hotelContactViewFixture());
      expect(hasErrors(validateContact(valid))).toBe(false);
      const errors = validateContact({ ...valid, name: "", email: "not-an-email" });
      expect(errors.name).toBeDefined();
      expect(errors.email).toBeDefined();
    });

    it("allows a blank email and lower-cases a given one", () => {
      expect(
        validateContact({ ...draftFromContact(null), name: "Sam", email: "" }).email,
      ).toBeUndefined();
      expect(
        buildContactBody({
          name: "Sam",
          roleTitle: "",
          phone: "",
          email: "  SAM@Hotel.COM ",
          isPrimary: false,
        }),
      ).toEqual({
        name: "Sam",
        roleTitle: null,
        phone: null,
        email: "sam@hotel.com",
        isPrimary: false,
      });
    });
  });
});
