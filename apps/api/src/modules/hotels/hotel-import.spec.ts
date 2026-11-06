import { describe, expect, it } from "vitest";

import { buildCandidate, isBlankRow, parseCsv, slugify, titleCaseSlug } from "./hotel-import.js";

describe("parseCsv", () => {
  it("parses rows and columns", () => {
    expect(parseCsv("a,b\n1,2\n3,4")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("handles quoted fields with commas and escaped quotes", () => {
    expect(parseCsv('name,note\n"Lake, Palace","He said ""hi"""')).toEqual([
      ["name", "note"],
      ["Lake, Palace", 'He said "hi"'],
    ]);
  });

  it("handles CRLF and a quoted embedded newline", () => {
    expect(parseCsv('a\r\n"x\ny"')).toEqual([["a"], ["x\ny"]]);
  });

  it("ignores a single trailing newline", () => {
    expect(parseCsv("a\nb\n")).toEqual([["a"], ["b"]]);
  });
});

describe("buildCandidate", () => {
  const headers = ["destinationSlug", "name", "totalRooms", "demoVisible", "mystery"];

  it("coerces numbers and booleans, drops blanks and unknown columns", () => {
    expect(buildCandidate(headers, ["udaipur", "The Lake", "84", "true", "ignored"])).toEqual({
      destinationSlug: "udaipur",
      name: "The Lake",
      totalRooms: 84,
      demoVisible: true,
    });
  });

  it("leaves a non-numeric number as its string so the schema reports it", () => {
    expect(buildCandidate(["totalRooms"], ["many"])).toEqual({ totalRooms: "many" });
  });

  it("passes a string column like imageRef through unchanged (slice 5b)", () => {
    expect(buildCandidate(["name", "imageRef"], ["X", "hero.jpg"])).toEqual({
      name: "X",
      imageRef: "hero.jpg",
    });
  });

  it("omits a blank cell rather than sending an empty string", () => {
    expect(buildCandidate(["name", "brand"], ["X", ""])).toEqual({ name: "X" });
  });

  it("parses false / 0 / no as false", () => {
    expect(buildCandidate(["demoVisible"], ["false"])).toEqual({ demoVisible: false });
    expect(buildCandidate(["demoVisible"], ["0"])).toEqual({ demoVisible: false });
    expect(buildCandidate(["demoVisible"], ["no"])).toEqual({ demoVisible: false });
  });
});

describe("slugify / titleCaseSlug / isBlankRow", () => {
  it("slugifies a name to the slug contract's shape", () => {
    expect(slugify("The Lake Pavilion")).toBe("the-lake-pavilion");
    expect(slugify("  Rosé & Fort!! ")).toBe("ros-fort");
  });

  it("title-cases a slug for a generated destination name", () => {
    expect(titleCaseSlug("north-goa")).toBe("North Goa");
  });

  it("detects a fully blank spreadsheet row", () => {
    expect(isBlankRow(["", "  ", ""])).toBe(true);
    expect(isBlankRow(["", "x"])).toBe(false);
  });
});
