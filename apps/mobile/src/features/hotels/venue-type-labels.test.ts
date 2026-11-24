import { hotelVenueType } from "@ampm/core";

import { venueTypeLabel } from "./hotels.format";

describe("the client venue type labels (CP-05)", () => {
  it("names every venue type the contract carries, so no venue reads blank", () => {
    for (const type of hotelVenueType.options) {
      expect(venueTypeLabel(type).trim()).not.toBe("");
    }
  });

  it("names the five Slice 3 types, and calls an Other venue a Venue", () => {
    expect(venueTypeLabel("terrace")).toBe("Terrace");
    expect(venueTypeLabel("garden")).toBe("Garden");
    expect(venueTypeLabel("amphitheatre")).toBe("Amphitheatre");
    expect(venueTypeLabel("meeting_room")).toBe("Meeting room");
    expect(venueTypeLabel("lounge")).toBe("Lounge");
    expect(venueTypeLabel("other")).toBe("Venue");
  });
});
