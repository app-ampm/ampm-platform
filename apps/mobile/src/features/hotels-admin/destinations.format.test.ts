import { destinationPlace, destinationRowSummary, hotelCountLabel } from "./destinations.format";
import { destinationListItemFixture } from "./hotels-admin.test-utils";

describe("destinationPlace", () => {
  it("joins region, state and country, skipping blanks", () => {
    expect(destinationPlace({ region: "Mewar", state: "Rajasthan", country: "India" })).toBe(
      "Mewar, Rajasthan, India",
    );
    expect(destinationPlace({ region: null, state: " ", country: "India" })).toBe("India");
  });
});

describe("hotelCountLabel", () => {
  it("counts the hotels in words", () => {
    expect(hotelCountLabel(0)).toBe("No hotels");
    expect(hotelCountLabel(1)).toBe("1 hotel");
    expect(hotelCountLabel(12)).toBe("12 hotels");
  });
});

describe("destinationRowSummary", () => {
  it("reads the name, the place, the status and the hotel count", () => {
    expect(destinationRowSummary(destinationListItemFixture())).toBe(
      "Udaipur, Rajasthan, India, active, 3 hotels",
    );
  });
});
