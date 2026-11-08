import { hotelRowSummary, hotelStatusLabel, hotelStatusTone } from "./hotels-admin.format";
import { hotelStaffViewFixture } from "./hotels-admin.test-utils";

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
});
