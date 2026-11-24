import {
  HOTEL_RECORD_TABS,
  hotelRecordEyebrow,
  hotelRecordSection,
  visibleHotelRecordTabs,
} from "./hotel-record.format";
import { hotelStaffDetailViewFixture } from "./hotels-admin.test-utils";

const holds = (...keys: string[]) => ({ can: (key: string) => keys.includes(key) });
const labels = (tabs: readonly { readonly label: string }[]) => tabs.map((tab) => tab.label);

describe("hotel-record.format", () => {
  it("offers the five sections that have a page, in T5's order with Documents in Menus' place", () => {
    expect(labels(HOTEL_RECORD_TABS)).toEqual([
      "Rooms, venues & contacts",
      "Rate cards",
      "Documents",
      "Media",
      "References",
    ]);
  });

  it("shows the Documents tab only to a role that reads documents (D-187 §6)", () => {
    expect(labels(visibleHotelRecordTabs(holds(), "rates"))).toEqual([
      "Rooms, venues & contacts",
      "Rate cards",
      "Media",
      "References",
    ]);
    expect(labels(visibleHotelRecordTabs(holds("hotels.hotel_documents.read"), "rates"))).toContain(
      "Documents",
    );
  });

  it("keeps the open section's tab in the strip before the person's grants are known", () => {
    expect(labels(visibleHotelRecordTabs(holds(), "documents"))).toContain("Documents");
  });

  it("reads a tab's value back as a section, and nothing else", () => {
    expect(hotelRecordSection("rates")).toBe("rates");
    expect(hotelRecordSection("documents")).toBe("documents");
    expect(hotelRecordSection("menus")).toBeUndefined();
  });

  it("puts the hotel's destination in the eyebrow once it has loaded", () => {
    expect(hotelRecordEyebrow(hotelStaffDetailViewFixture())).toBe("Hotels · Udaipur");
    expect(hotelRecordEyebrow(undefined)).toBe("Hotels");
  });
});
