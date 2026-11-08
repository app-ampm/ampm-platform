import {
  contactSummary,
  hotelRowSummary,
  hotelStatusLabel,
  hotelStatusTone,
  rateCardStatusLabel,
  rateCardStatusTone,
  rateItemTypeLabel,
  rateUnitLabel,
  roomSummary,
  venueSummary,
  venueTypeLabel,
  verificationFieldGroupLabel,
  verificationSourceLabel,
} from "./hotels-admin.format";
import {
  hotelContactViewFixture,
  hotelStaffViewFixture,
  roomCategoryViewFixture,
  venueViewFixture,
} from "./hotels-admin.test-utils";

describe("hotels-admin.format", () => {
  it("labels and tones the hotel status", () => {
    expect(hotelStatusLabel("draft")).toBe("Draft");
    expect(hotelStatusLabel("active")).toBe("Active");
    expect(hotelStatusTone("active")).toBe("success");
    expect(hotelStatusTone("inactive")).toBe("warning");
  });

  it("summarises a hotel row for screen readers", () => {
    expect(hotelRowSummary(hotelStaffViewFixture({ name: "Taj", status: "active" }))).toBe(
      "Taj, active",
    );
  });

  it("labels every venue type", () => {
    expect(venueTypeLabel("ballroom")).toBe("Ballroom");
    expect(venueTypeLabel("poolside")).toBe("Poolside");
    expect(venueTypeLabel("other")).toBe("Other");
  });

  describe("roomSummary", () => {
    it("joins the counts, occupancy and size that are set", () => {
      expect(roomSummary(roomCategoryViewFixture())).toBe("20 rooms · sleeps 3 · 45 sqm");
    });

    it("singularises a single room and drops the empty parts", () => {
      expect(
        roomSummary(roomCategoryViewFixture({ roomCount: 1, maxOccupancy: null, sizeSqm: null })),
      ).toBe("1 room");
    });

    it("is empty when nothing is set", () => {
      expect(
        roomSummary(
          roomCategoryViewFixture({ roomCount: null, maxOccupancy: null, sizeSqm: null }),
        ),
      ).toBe("");
    });
  });

  describe("venueSummary", () => {
    it("names the type, indoor/outdoor and banquet capacity", () => {
      expect(venueSummary(venueViewFixture())).toBe("Ballroom · Indoor · 300 banquet");
    });

    it("marks an outdoor venue and drops a missing banquet capacity", () => {
      expect(
        venueSummary(
          venueViewFixture({ venueType: "lawn", isIndoor: false, capacityBanquet: null }),
        ),
      ).toBe("Lawn · Outdoor");
    });
  });

  describe("contactSummary", () => {
    it("joins the role, phone and email that are set", () => {
      expect(contactSummary(hotelContactViewFixture())).toBe(
        "Events Manager · +91 98765 43210 · priya@lakeside.example",
      );
    });

    it("is empty when only the name is known", () => {
      expect(
        contactSummary(hotelContactViewFixture({ roleTitle: null, phone: null, email: null })),
      ).toBe("");
    });
  });

  it("labels and tones rate cards, items, units and verification sources", () => {
    expect(rateCardStatusLabel("verified")).toBe("Verified");
    expect(rateCardStatusTone("stale")).toBe("warning");
    expect(rateCardStatusTone("verified")).toBe("success");
    expect(rateItemTypeLabel("per_plate_veg")).toBe("Per plate (veg)");
    expect(rateUnitLabel("per_night")).toBe("per night");
    expect(verificationSourceLabel("site_visit")).toBe("Site visit");
    expect(verificationFieldGroupLabel("rates")).toBe("Rates");
  });
});
