import { hotelRoomUnitType, hotelVenueSetting, hotelVenueType } from "@ampm/core";

import {
  hotelContactViewFixture,
  roomCategoryViewFixture,
  venueViewFixture,
} from "./hotels-admin.test-utils";
import {
  CAPACITY_LABEL,
  contactSummary,
  roomSummary,
  UNIT_TYPE_CHOICES,
  unitTypeLabel,
  VENUE_SETTINGS,
  VENUE_TYPES,
  venueSettingLabel,
  venueSummary,
  venueTypeLabel,
} from "./subresources.format";

describe("subresources.format", () => {
  describe("the labels and the pickers' order", () => {
    it("offers every venue type once, in an explicit order with Other last", () => {
      expect([...VENUE_TYPES].sort()).toEqual([...hotelVenueType.options].sort());
      expect(VENUE_TYPES[VENUE_TYPES.length - 1]).toBe("other");
      expect(VENUE_TYPES.map(venueTypeLabel)).toEqual([
        "Ballroom",
        "Lawn",
        "Poolside",
        "Rooftop",
        "Courtyard",
        "Beach",
        "Terrace",
        "Garden",
        "Amphitheatre",
        "Meeting room",
        "Lounge",
        "Other",
      ]);
    });

    it("offers Not set and then every unit type", () => {
      expect(UNIT_TYPE_CHOICES).toEqual(["unset", ...hotelRoomUnitType.options]);
      expect(UNIT_TYPE_CHOICES.map(unitTypeLabel)).toEqual([
        "Not set",
        "Room",
        "Suite",
        "Villa",
        "Cottage",
        "Tent",
        "Tent suite",
        "Apartment",
        "Other",
      ]);
    });

    it("names the three settings, and what each capacity counts (decision 11)", () => {
      expect(VENUE_SETTINGS).toEqual([...hotelVenueSetting.options]);
      expect(VENUE_SETTINGS.map(venueSettingLabel)).toEqual([
        "Indoor",
        "Outdoor",
        "Covered or semi-open",
      ]);
      expect(CAPACITY_LABEL).toEqual({
        capacityBanquet: "Seated (dinner at round tables)",
        capacityTheatre: "Theatre (rows of chairs)",
        capacityReception: "Floating (standing reception or cocktails)",
      });
    });
  });

  describe("roomSummary", () => {
    it("joins the count, occupancy and size that are set, in m²", () => {
      expect(roomSummary(roomCategoryViewFixture())).toBe("20 rooms · sleeps 3 · 45 m²");
    });

    it("counts in the unit type's noun and gives both units, the view and the beds", () => {
      const villas = roomCategoryViewFixture({
        unitType: "villa",
        roomCount: 4,
        sizeSqm: 120,
        sizeSqft: 1292,
        viewLabel: "Lake view",
        bedConfiguration: "King or twin",
      });
      expect(roomSummary(villas)).toBe(
        "4 villas · sleeps 3 · 120 m² (1,292 sq ft) · Lake view · King or twin",
      );
      expect(roomSummary(roomCategoryViewFixture({ unitType: "tent_suite", roomCount: 1 }))).toBe(
        "1 tent suite · sleeps 3 · 45 m²",
      );
    });

    it("names a unit type with no count, singularises one room and drops the empty parts", () => {
      const suite = roomCategoryViewFixture({
        roomCount: null,
        maxOccupancy: null,
        sizeSqm: null,
        unitType: "suite",
      });
      expect(roomSummary(suite)).toBe("Suite");
      expect(
        roomSummary(roomCategoryViewFixture({ roomCount: 1, maxOccupancy: null, sizeSqm: null })),
      ).toBe("1 room");
      expect(
        roomSummary(
          roomCategoryViewFixture({ roomCount: null, maxOccupancy: null, sizeSqm: null }),
        ),
      ).toBe("");
    });
  });

  describe("venueSummary", () => {
    it("names the type, the setting, the area and the seated, floating and theatre capacities", () => {
      expect(venueSummary(venueViewFixture())).toBe(
        "Ballroom · Indoor · 500 m² · 300 seated · 500 floating · 400 theatre",
      );
    });

    // A summary cut short loses its end first, so the capacities TW-22 asks for come before the
    // dimensions, layouts and pre-function area.
    it("adds both units, then the capacities, then the dimensions, layouts and pre-function area", () => {
      const terrace = venueViewFixture({
        venueType: "terrace",
        setting: "semi_open",
        isIndoor: false,
        areaSqm: 279,
        areaSqft: 3000,
        lengthM: 30.5,
        widthM: 9,
        ceilingHeightM: 4.25,
        capacityTheatre: null,
        otherLayouts: [{ layout: "Classroom", max: 120 }],
        prefunctionAreaSqm: 60,
        prefunctionAreaSqft: null,
      });
      expect(venueSummary(terrace)).toBe(
        "Terrace · Covered or semi-open · 279 m² (3,000 sq ft) · 300 seated · 500 floating · " +
          "30.5 × 9 m, 4.25 m ceiling · 1 other layout · pre-function 60 m²",
      );
    });

    it("keeps to the type and setting when nothing else is known", () => {
      const lawn = venueViewFixture({
        venueType: "lawn",
        setting: "outdoor",
        isIndoor: false,
        areaSqm: null,
        capacityBanquet: null,
        capacityTheatre: null,
        capacityReception: null,
      });
      expect(venueSummary(lawn)).toBe("Lawn · Outdoor");
    });
  });

  describe("contactSummary", () => {
    it("joins the role, phone and email that are set", () => {
      expect(contactSummary(hotelContactViewFixture())).toBe(
        "Events Manager · +911234567801 · priya@lakeside.example",
      );
    });

    it("is empty when only the name is known", () => {
      expect(
        contactSummary(hotelContactViewFixture({ roleTitle: null, phone: null, email: null })),
      ).toBe("");
    });
  });
});
