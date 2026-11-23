import { describe, expect, it } from "vitest";

import {
  canonicalFieldsJson,
  fieldChanges,
  normaliseEmail,
  normaliseRowName,
  normaliseUrl,
  normaliseWhitespace,
  type HotelFieldKinds,
} from "./hotel-change-set";

describe("the normalisers", () => {
  it("collapses whitespace, line breaks included", () => {
    expect(normaliseWhitespace("  Lake \t view\r\n suite  ")).toBe("Lake view suite");
  });

  it("matches row names ignoring case and spacing", () => {
    expect(normaliseRowName("  The  DURBAR Hall ")).toBe("the durbar hall");
  });

  it("lower-cases an email", () => {
    expect(normaliseEmail(" Events@Synthetic-Hotel.example ")).toBe(
      "events@synthetic-hotel.example",
    );
  });

  it("lower-cases a link's scheme and host only", () => {
    expect(normaliseUrl(" HTTPS://WWW.Synthetic-Hotel.Example/Rooms?Tab=A ")).toBe(
      "https://www.synthetic-hotel.example/Rooms?Tab=A",
    );
    expect(normaliseUrl("https://User@Example.COM:8443/X")).toBe("https://User@example.com:8443/X");
    expect(normaliseUrl("  not a link ")).toBe("not a link");
  });
});

type RoomField = "roomCount" | "viewLabel" | "sizeSqm" | "sizeSqft" | "facilities" | "description";

const ROOM: HotelFieldKinds<RoomField> = {
  roomCount: "number",
  viewLabel: "text",
  sizeSqm: "number",
  sizeSqft: "number",
  facilities: "list",
  description: "text",
};
const AREAS = { areas: [{ sqm: "sizeSqm", sqft: "sizeSqft" }] } as const;

describe("fieldChanges", () => {
  const stored = {
    roomCount: 12,
    viewLabel: "Lake",
    sizeSqm: 46,
    sizeSqft: 500,
    facilities: ["Balcony", "Bathtub"],
    description: "A suite\nover the lake",
  };

  it("names only the fields whose filled value differs once normalised", () => {
    const incoming = {
      roomCount: 14,
      viewLabel: "  Lake ",
      facilities: ["Balcony", " Bathtub "],
      description: "A suite over  the lake",
    };
    expect(fieldChanges(stored, incoming, ROOM)).toEqual(["roomCount"]);
  });

  it("never clears: a blank, null or empty list is no change", () => {
    const blanks = { roomCount: undefined, viewLabel: "  ", facilities: [], description: null };
    expect(fieldChanges(stored, blanks, ROOM)).toEqual([]);
  });

  it("counts 0 and a list in a new order as values", () => {
    expect(fieldChanges(stored, { roomCount: 0 }, ROOM)).toEqual(["roomCount"]);
    expect(fieldChanges(stored, { facilities: ["Bathtub", "Balcony"] }, ROOM)).toEqual([
      "facilities",
    ]);
  });

  it("names every filled field on a create, in the fields' order", () => {
    expect(fieldChanges(null, { description: "x", roomCount: 2, viewLabel: "" }, ROOM)).toEqual([
      "roomCount",
      "description",
    ]);
  });

  it("derives the m² from a filled sq ft before comparing", () => {
    expect(fieldChanges(stored, { sizeSqft: 500, sizeSqm: 50 }, ROOM, AREAS)).toEqual([]);
    expect(fieldChanges(stored, { sizeSqft: 600 }, ROOM, AREAS)).toEqual(["sizeSqm", "sizeSqft"]);
    expect(fieldChanges(null, { sizeSqft: 600 }, ROOM, AREAS)).toEqual(["sizeSqm", "sizeSqft"]);
  });

  it("names a stored sq ft cleared by an m² given alone", () => {
    expect(fieldChanges(stored, { sizeSqm: 50 }, ROOM, AREAS)).toEqual(["sizeSqm", "sizeSqft"]);
    expect(fieldChanges(stored, { sizeSqm: 46 }, ROOM, AREAS)).toEqual(["sizeSqft"]);
    expect(fieldChanges({ ...stored, sizeSqft: null }, { sizeSqm: 50 }, ROOM, AREAS)).toEqual([
      "sizeSqm",
    ]);
  });

  it("compares without the units rule when no pairs are given", () => {
    expect(fieldChanges(stored, { sizeSqm: 50 }, ROOM)).toEqual(["sizeSqm"]);
  });

  it("compares entries key by key, ignoring key order and spacing", () => {
    const kinds: HotelFieldKinds<"otherLayouts"> = { otherLayouts: "entries" };
    const layouts = [{ layout: "U-shape", max: 40, min: 30 }];
    const same = [{ min: 30, max: 40, layout: " U-shape" }];
    expect(fieldChanges({ otherLayouts: layouts }, { otherLayouts: same }, kinds)).toEqual([]);
    const wider = [{ layout: "U-shape", max: 45, min: 30 }];
    expect(fieldChanges({ otherLayouts: layouts }, { otherLayouts: wider }, kinds)).toEqual([
      "otherLayouts",
    ]);
  });

  it("compares a phone, a link and an email by their normalisers", () => {
    const kinds: HotelFieldKinds<"phone" | "website" | "email"> = {
      phone: "phone",
      website: "url",
      email: "email",
    };
    const contact = {
      phone: "+911412345678",
      website: "https://www.synthetic-hotel.example/",
      email: "sales@synthetic-hotel.example",
    };
    const sameAgain = {
      phone: "0141 234 5678",
      website: "HTTPS://WWW.SYNTHETIC-HOTEL.EXAMPLE/",
      email: "Sales@Synthetic-Hotel.example",
    };
    expect(fieldChanges(contact, sameAgain, kinds)).toEqual([]);
    expect(
      fieldChanges({ phone: "front desk, ext 4" }, { phone: "front desk,  ext 4" }, kinds),
    ).toEqual([]);
  });
});

describe("canonicalFieldsJson", () => {
  it("writes the compared fields in order, normalised, a blank as null", () => {
    const record = { description: "  A  suite ", roomCount: 4, viewLabel: "", other: "ignored" };
    expect(canonicalFieldsJson(record, ROOM)).toBe(
      '[["roomCount",4],["viewLabel",null],["sizeSqm",null],["sizeSqft",null],["facilities",null],["description","A suite"]]',
    );
  });

  it("is the same for values that compare the same", () => {
    const a = { roomCount: 4, facilities: ["Pool", "Spa"], description: "Lake view" };
    const b = { roomCount: 4, facilities: [" Pool", "Spa "], description: "Lake  view" };
    expect(canonicalFieldsJson(a, ROOM)).toBe(canonicalFieldsJson(b, ROOM));
    expect(canonicalFieldsJson({ ...a, roomCount: 5 }, ROOM)).not.toBe(
      canonicalFieldsJson(a, ROOM),
    );
  });
});
