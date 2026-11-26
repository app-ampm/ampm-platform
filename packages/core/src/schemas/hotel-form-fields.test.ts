import { describe, expect, it } from "vitest";
import { z } from "zod";

import { HOTEL_PHONE_REFUSAL } from "../hotel-phone";
import { LONE_SURROGATE_MESSAGE, NUL_TEXT_MESSAGE } from "./common";
import {
  HOTEL_FORM_PIN_REFUSAL,
  hotelFormAccessPoint,
  hotelFormArea,
  hotelFormCapacity,
  hotelFormEmail,
  hotelFormMapsUrl,
  hotelFormMonth,
  hotelFormPhone,
  hotelFormPostalCode,
  hotelFormRowId,
  hotelFormText,
  hotelFormWebsite,
  ROOM_AREA_LIMITS,
  VENUE_AREA_LIMITS,
} from "./hotel-form-fields";

/*
 * The fields of the hotel form's section drafts (D-190 §2): every one may be left blank (absent, null or
 * empty text, all stored as nothing), and a filled one keeps the catalogue's bounds and the form's field
 * rules. Synthetic data only: example domains, reserved test numbers.
 */

const messageOf = (schema: z.ZodType, value: unknown): string | undefined =>
  schema.safeParse(value).error?.issues[0]?.message;

describe("hotelFormText", () => {
  const text = hotelFormText(10);

  it("trims, and takes blank text as no answer", () => {
    expect(text.parse("  Lake  ")).toBe("Lake");
    expect(text.parse("   ")).toBeNull();
    expect(text.parse(null)).toBeNull();
    expect(text.parse(undefined)).toBeUndefined();
  });

  it("refuses text over its bound, the null character and a lone surrogate on the field", () => {
    expect(messageOf(text, "x".repeat(11))).toBe("Use at most 10 characters");
    expect(messageOf(text, "Lake\u0000")).toBe(NUL_TEXT_MESSAGE);
    expect(messageOf(text, "Lake \ud83d")).toBe(LONE_SURROGATE_MESSAGE);
    expect(messageOf(z.object({ name: text }).strict(), { name: 4 })).toBeDefined();
  });
});

describe("hotelFormPhone", () => {
  it("stores a phone in E.164, however it is typed, and a blank as no answer", () => {
    expect(hotelFormPhone.parse("0141-234 5678")).toBe("+911412345678");
    expect(hotelFormPhone.parse("+91 70000 01234")).toBe("+917000001234");
    expect(hotelFormPhone.parse("1800 123 4567")).toBe("+9118001234567");
    expect(hotelFormPhone.parse("")).toBeNull();
  });

  it("refuses what is not one full number with the catalogue's words", () => {
    for (const typed of ["12345", "+91 141 234 5678 ext 12", "call the desk"]) {
      expect(messageOf(hotelFormPhone, typed), typed).toBe(HOTEL_PHONE_REFUSAL);
    }
  });
});

describe("hotelFormEmail", () => {
  it("stores an address lower-case, and refuses one that is not an address", () => {
    expect(hotelFormEmail.parse(" Sales@Synthetic-Hotel.Example ")).toBe(
      "sales@synthetic-hotel.example",
    );
    expect(hotelFormEmail.parse(" ")).toBeNull();
    expect(messageOf(hotelFormEmail, "sales at hotel")).toBe(
      "Enter an email address such as name@hotel.example",
    );
  });
});

describe("hotelFormPostalCode", () => {
  it("takes a PIN: 6 digits not starting with 0, spaces dropped", () => {
    expect(hotelFormPostalCode.parse(" 313 001 ")).toBe("313001");
    expect(hotelFormPostalCode.parse("")).toBeNull();
    for (const typed of ["013001", "31300", "3130011", "31300A"]) {
      expect(messageOf(hotelFormPostalCode, typed), typed).toBe(HOTEL_FORM_PIN_REFUSAL);
    }
  });
});

describe("hotelFormMapsUrl and hotelFormWebsite", () => {
  it("take only a Google Maps link, never fetched, and refuse a redirector", () => {
    expect(hotelFormMapsUrl.parse("https://maps.app.goo.gl/AbC123xyz")).toBe(
      "https://maps.app.goo.gl/AbC123xyz",
    );
    expect(messageOf(hotelFormMapsUrl, "https://www.google.com/url?q=https://example.com")).toBe(
      "Use an https Google Maps link",
    );
  });

  it("take a website over https only, reading one typed without a scheme as https", () => {
    expect(hotelFormWebsite.parse("www.synthetic-hotel.example")).toBe(
      "https://www.synthetic-hotel.example/",
    );
    expect(messageOf(hotelFormWebsite, "http://synthetic-hotel.example")).toBe(
      "Use the hotel's https address, such as https://www.hotel.example",
    );
  });

  it("say a website is too long when it is, https:// included, not that it is not https", () => {
    const host = `${"a".repeat(240)}.example`;
    expect(host).toHaveLength(248);
    expect(messageOf(hotelFormWebsite, host)).toBe(
      "Use an address of at most 255 characters, https:// included",
    );
  });
});

describe("hotelFormMonth", () => {
  it("takes a month as YYYY-MM, from 2000 to 2099", () => {
    expect(hotelFormMonth.parse("2026-09")).toBe("2026-09");
    for (const typed of ["2026-13", "2026-9", "1999-12", "2100-01", "September 2026"]) {
      expect(messageOf(hotelFormMonth, typed), typed).toBe("Give the month, such as 2026-09");
    }
  });
});

describe("hotelFormArea", () => {
  const room = hotelFormArea(ROOM_AREA_LIMITS);

  it("holds a whole number with its unit, sq ft or m², within the catalogue's bounds", () => {
    expect(room.parse({ value: 450, unit: "sqft" })).toEqual({ value: 450, unit: "sqft" });
    expect(room.parse({ unit: "sqm", value: 42 })).toEqual({ unit: "sqm", value: 42 });
    expect(room.parse(null)).toBeNull();
    expect(room.safeParse({ value: ROOM_AREA_LIMITS.sqft, unit: "sqft" }).success).toBe(true);
    expect(room.safeParse({ value: ROOM_AREA_LIMITS.sqft, unit: "sqm" }).success).toBe(false);
    expect(room.safeParse({ value: 42.5, unit: "sqm" }).success).toBe(false);
    expect(room.safeParse({ value: 42, unit: "acre" }).success).toBe(false);
    expect(room.safeParse({ value: 42 }).success).toBe(false);
    expect(room.safeParse({ value: 42, unit: "sqm", note: "x" }).success).toBe(false);
  });

  it("takes a unit whose number is not given yet, as a half-filled answer submit asks to finish", () => {
    expect(room.parse({ unit: "sqft" })).toEqual({ unit: "sqft" });
    expect(room.parse({ unit: "sqm", value: null })).toEqual({ unit: "sqm", value: null });
  });

  it("gives a venue the catalogue's larger venue bounds", () => {
    const venue = hotelFormArea(VENUE_AREA_LIMITS);
    expect(venue.safeParse({ value: 40_000, unit: "sqft" }).success).toBe(true);
    expect(VENUE_AREA_LIMITS.sqft).toBeGreaterThan(ROOM_AREA_LIMITS.sqft);
  });
});

describe("hotelFormCapacity", () => {
  it("is a number, or a minimum and a maximum", () => {
    expect(hotelFormCapacity.parse(300)).toBe(300);
    expect(hotelFormCapacity.parse({ min: 250, max: 300 })).toEqual({ min: 250, max: 300 });
    expect(hotelFormCapacity.parse({ min: 300, max: 300 })).toEqual({ min: 300, max: 300 });
    expect(hotelFormCapacity.parse(null)).toBeNull();
  });

  it("takes a range with one end not given yet, as a half-filled answer submit asks to finish", () => {
    expect(hotelFormCapacity.parse({ min: 250 })).toEqual({ min: 250 });
    expect(hotelFormCapacity.parse({ min: null, max: 300 })).toEqual({ min: null, max: 300 });
  });

  it("refuses a minimum above the maximum on the minimum, and any other shape in words", () => {
    const backwards = hotelFormCapacity.safeParse({ min: 400, max: 300 });
    expect(backwards.error?.issues[0]).toMatchObject({
      path: ["min"],
      message: "The minimum is above the maximum",
    });
    for (const value of ["300", true, [250, 300]]) {
      expect(messageOf(hotelFormCapacity, value), JSON.stringify(value)).toBe(
        "Give a number of guests, or a minimum and a maximum",
      );
    }
    expect(messageOf(hotelFormCapacity, -1)).toBe("Use 0 or more");
    expect(hotelFormCapacity.safeParse({ min: -1, max: 3 }).error?.issues[0]).toMatchObject({
      path: ["min"],
      message: "Use 0 or more",
    });
    for (const value of [12.5, 100_001, { min: 1, max: 2, note: "x" }]) {
      expect(hotelFormCapacity.safeParse(value).success, JSON.stringify(value)).toBe(false);
    }
  });
});

describe("hotelFormAccessPoint and hotelFormRowId", () => {
  it("names a place with its distance in km to one decimal and its drive in minutes", () => {
    expect(
      hotelFormAccessPoint.parse({ name: " Synthetic Airport ", km: 22.5, minutes: 40 }),
    ).toEqual({ name: "Synthetic Airport", km: 22.5, minutes: 40 });
    expect(hotelFormAccessPoint.safeParse({ km: 22.55 }).success).toBe(false);
    expect(hotelFormAccessPoint.safeParse({ minutes: 601 }).success).toBe(false);
    expect(hotelFormAccessPoint.safeParse({ km: 3, road: "NH 48" }).success).toBe(false);
  });

  it("keys a room or venue row by a UUID the page makes, which every row needs", () => {
    expect(hotelFormRowId.parse("0192f1a0-0000-4000-8000-0000000000a1")).toBe(
      "0192f1a0-0000-4000-8000-0000000000a1",
    );
    expect(hotelFormRowId.safeParse("row-1").success).toBe(false);
    expect(hotelFormRowId.safeParse(null).success).toBe(false);
  });
});
