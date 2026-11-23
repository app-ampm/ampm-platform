import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  hotelRoomUnitType,
  hotelVenueSetting,
  isIndoorSetting,
  roomCatalogueRequestFields,
  roomCatalogueViewFields,
  VENUE_OTHER_LAYOUTS_MAX,
  venueCatalogueRequestFields,
  venueCatalogueViewFields,
  venueOtherLayout,
  venueOtherLayouts,
  venueSettingOf,
  type HotelVenueSetting,
} from "./hotel-rooms-venues.js";

describe("the room and venue enums (keep in step with Prisma)", () => {
  it("lists the unit types and the settings", () => {
    expect(hotelRoomUnitType.options).toEqual([
      "room",
      "suite",
      "villa",
      "cottage",
      "tent",
      "tent_suite",
      "apartment",
      "other",
    ]);
    expect(hotelVenueSetting.options).toEqual(["indoor", "outdoor", "semi_open"]);
  });
});

describe("a venue's setting and its is_indoor flag (D-178)", () => {
  it.each<[HotelVenueSetting, boolean]>([
    ["indoor", true],
    ["outdoor", false],
    ["semi_open", false],
  ])("stores %s with is_indoor %s", (setting, indoor) => {
    expect(isIndoorSetting(setting)).toBe(indoor);
  });

  it("reads a venue with no stored setting from is_indoor, and a stored one as it is", () => {
    expect(venueSettingOf({ setting: null, isIndoor: true })).toBe("indoor");
    expect(venueSettingOf({ setting: null, isIndoor: false })).toBe("outdoor");
    expect(venueSettingOf({ setting: "semi_open", isIndoor: false })).toBe("semi_open");
    expect(venueSettingOf({ setting: "outdoor", isIndoor: true })).toBe("outdoor");
  });

  it("round-trips every setting through the flag it stores", () => {
    for (const setting of hotelVenueSetting.options) {
      const stored = { setting, isIndoor: isIndoorSetting(setting) };
      expect(venueSettingOf(stored)).toBe(setting);
      expect(venueSettingOf({ setting: null, isIndoor: stored.isIndoor })).toBe(
        setting === "indoor" ? "indoor" : "outdoor",
      );
    }
  });
});

describe("venueOtherLayout", () => {
  it.each([
    { layout: "Classroom", max: 120 },
    { layout: "U-shape", max: 40, min: 30 },
    { layout: "Cluster", max: 80, min: 80 },
  ])("accepts %o", (entry) => {
    expect(venueOtherLayout.safeParse(entry).success).toBe(true);
  });

  it.each([
    ["a minimum above the maximum", { layout: "U-shape", max: 30, min: 40 }],
    ["no guests", { layout: "Boardroom", max: 0 }],
    ["more than 100,000 guests", { layout: "Exhibit", max: 100_001 }],
    ["a fraction of a guest", { layout: "Exhibit", max: 10.5 }],
    ["a blank name", { layout: "  ", max: 10 }],
    ["a name over 60 characters", { layout: "x".repeat(61), max: 10 }],
    ["an unknown key", { layout: "Classroom", max: 120, seats: 120 }],
    ["a null minimum", { layout: "Classroom", max: 120, min: null }],
  ])("refuses %s", (_case, entry) => {
    expect(venueOtherLayout.safeParse(entry).success).toBe(false);
  });

  it("names the minimum when it is above the maximum", () => {
    const result = venueOtherLayout.safeParse({ layout: "U-shape", max: 30, min: 40 });
    expect(result.success ? [] : result.error.issues.map((issue) => issue.path.join("."))).toEqual([
      "min",
    ]);
  });
});

describe("venueOtherLayouts", () => {
  const layouts = (count: number) =>
    Array.from({ length: count }, (_, i) => ({ layout: `Synthetic layout ${i + 1}`, max: 10 + i }));

  it("takes up to twelve layouts", () => {
    expect(venueOtherLayouts.safeParse(layouts(VENUE_OTHER_LAYOUTS_MAX)).success).toBe(true);
    expect(venueOtherLayouts.safeParse(layouts(VENUE_OTHER_LAYOUTS_MAX + 1)).success).toBe(false);
  });

  it("refuses a layout named twice, ignoring case", () => {
    const repeated = [
      { layout: "Classroom", max: 120 },
      { layout: "CLASSROOM", max: 100 },
    ];
    expect(venueOtherLayouts.safeParse(repeated).success).toBe(false);
  });
});

describe("the room fields (D-178)", () => {
  const room = z.object(roomCatalogueRequestFields).strict();

  it("bounds the size in sq ft and the labels", () => {
    expect(room.safeParse({ unitType: "tent_suite", sizeSqft: 1_000_000 }).success).toBe(true);
    expect(room.safeParse({ sizeSqft: 1_000_001 }).success).toBe(false);
    expect(room.safeParse({ sizeSqft: 650.5 }).success).toBe(false);
    expect(room.safeParse({ viewLabel: "x".repeat(256) }).success).toBe(false);
    expect(room.safeParse({ unitType: "castle" }).success).toBe(false);
  });

  it("gives the view the same keys", () => {
    expect(Object.keys(roomCatalogueViewFields).sort()).toEqual(
      Object.keys(roomCatalogueRequestFields).sort(),
    );
  });
});

describe("the venue fields (D-178)", () => {
  const venue = z.object(venueCatalogueRequestFields).strict();

  it.each([
    [{ lengthM: 2_000, widthM: 12.75, ceilingHeightM: 100 }, true],
    [{ lengthM: 2_000.01 }, false],
    [{ widthM: 12.755 }, false],
    [{ ceilingHeightM: 100.5 }, false],
    [{ lengthM: -1 }, false],
    [{ areaSqft: 10_000_000, prefunctionAreaSqft: 10_000_000 }, true],
    [{ areaSqft: 10_000_001 }, false],
    [{ prefunctionAreaSqm: 1_000_001 }, false],
    [{ capacityNotes: "x".repeat(1_000) }, true],
    [{ capacityNotes: "x".repeat(1_001) }, false],
    [{ otherLayouts: [{ layout: "Classroom", max: 120 }] }, true],
    [{ otherLayouts: null }, true],
  ])("checks %o", (fields, ok) => {
    expect(venue.safeParse(fields).success).toBe(ok);
  });

  it("gives the view the same keys plus a setting that is never null", () => {
    expect(Object.keys(venueCatalogueViewFields).sort()).toEqual(
      [...Object.keys(venueCatalogueRequestFields), "setting"].sort(),
    );
    expect(venueCatalogueViewFields.setting.safeParse(null).success).toBe(false);
  });
});
