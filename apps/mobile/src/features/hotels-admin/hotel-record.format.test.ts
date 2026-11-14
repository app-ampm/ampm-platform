import { HOTEL_RECORD_TABS, hotelRecordEyebrow, hotelRecordSection } from "./hotel-record.format";
import { hotelStaffDetailViewFixture } from "./hotels-admin.test-utils";

describe("hotel-record.format", () => {
  it("offers the three sections that have a page, in T5's order", () => {
    expect(HOTEL_RECORD_TABS.map((tab) => tab.label)).toEqual([
      "Rooms, venues & contacts",
      "Rate cards",
      "Media",
    ]);
  });

  it("reads a tab's value back as a section, and nothing else", () => {
    expect(hotelRecordSection("rates")).toBe("rates");
    expect(hotelRecordSection("menus")).toBeUndefined();
  });

  it("puts the hotel's destination in the eyebrow once it has loaded", () => {
    expect(hotelRecordEyebrow(hotelStaffDetailViewFixture())).toBe("Hotels · Udaipur");
    expect(hotelRecordEyebrow(undefined)).toBe("Hotels");
  });
});
