import { HOTEL_IMPORT_COLUMNS } from "@ampm/core";
import { describe, expect, it } from "vitest";

import {
  buildCandidate,
  CSV_MAX_CELL_LENGTH,
  CSV_MAX_CELLS,
  decodeCsv,
  headerProblems,
  isBlankRow,
  parseCsv,
  slugify,
  titleCaseSlug,
} from "./hotel-import.js";

const utf8 = (text: string) => new TextEncoder().encode(text);

describe("decodeCsv", () => {
  it("reads UTF-8 and drops a byte-order mark, as Excel's CSV UTF-8 writes one", () => {
    expect(decodeCsv(utf8("\uFEFFdestinationSlug,name\nudaipur,Café Lake"))).toBe(
      "destinationSlug,name\nudaipur,Café Lake",
    );
  });

  it("refuses bytes that are not UTF-8, such as Windows-1252", () => {
    expect(
      decodeCsv(Uint8Array.from([0x6e, 0x61, 0x6d, 0x65, 0x0a, 0x43, 0x61, 0x66, 0xe9])),
    ).toBeNull();
  });

  it("refuses the replacement character a browser leaves when it misreads the encoding", () => {
    expect(decodeCsv(utf8("name\nCaf\uFFFD"))).toBeNull();
  });
});

describe("parseCsv", () => {
  it("parses rows and columns", () => {
    expect(parseCsv("a,b\n1,2\n3,4")).toEqual({
      records: [
        ["a", "b"],
        ["1", "2"],
        ["3", "4"],
      ],
    });
  });

  it("handles quoted fields with commas and escaped quotes", () => {
    expect(parseCsv('name,note\n"Synthetic Bay, Coast","He said ""hi"""')).toEqual({
      records: [
        ["name", "note"],
        ["Synthetic Bay, Coast", 'He said "hi"'],
      ],
    });
  });

  it("handles CRLF, a quoted embedded newline and empty cells", () => {
    expect(parseCsv('a\r\n"x\ny"')).toEqual({ records: [["a"], ["x\ny"]] });
    expect(parseCsv('a,,""\n,')).toEqual({
      records: [
        ["a", "", ""],
        ["", ""],
      ],
    });
  });

  it("ignores a single trailing newline, and reads nothing from empty text", () => {
    expect(parseCsv("a\nb\n")).toEqual({ records: [["a"], ["b"]] });
    expect(parseCsv("")).toEqual({ records: [] });
  });

  it("keeps the lenient reading of a quote inside a cell and a stray carriage return", () => {
    expect(parseCsv('ab"c,d"e,f\r\ng\rh')).toEqual({ records: [["abc,de", "f"], ["gh"]] });
  });

  it("stops at a runaway cell or record, naming its line, before holding the rest", () => {
    const long = "x".repeat(CSV_MAX_CELL_LENGTH + 1);
    expect(parseCsv(`name\nok\n"${long}"`)).toEqual({
      problem: expect.stringMatching(/^Line 3 has a cell longer than 20,000 characters/),
    });
    expect(parseCsv(`name\n${long}`)).toMatchObject({ problem: expect.stringMatching(/^Line 2/) });
    const escapedQuotes = `"${'""'.repeat(CSV_MAX_CELL_LENGTH + 1)}"`;
    expect(parseCsv(escapedQuotes)).toMatchObject({ problem: expect.stringMatching(/^Line 1/) });
    expect(parseCsv(",".repeat(5 * 1024 * 1024))).toEqual({
      problem: `Line 1 has more than ${CSV_MAX_CELLS} cells; the template has ${HOTEL_IMPORT_COLUMNS.length} columns.`,
    });
  });

  it("takes a cell as long as the widest column", () => {
    const parsed = parseCsv(`notes\n"${"x".repeat(10_000)}"`);
    expect("records" in parsed && parsed.records[1]?.[0]?.length).toBe(10_000);
  });
});

describe("buildCandidate's list cells", () => {
  it("split at | and at a line break inside the cell, keeping a comma inside an entry", () => {
    expect(
      buildCandidate(
        ["facilities", "nameAliases"],
        ["Pool | Spa, salon and gym", "Bay Hotel\nThe Bay"],
      ),
    ).toEqual({
      facilities: ["Pool", "Spa, salon and gym"],
      nameAliases: ["Bay Hotel", "The Bay"],
    });
  });
});

describe("headerProblems", () => {
  it("accepts the template's headers in any order, the required ones present", () => {
    expect(headerProblems([...HOTEL_IMPORT_COLUMNS].reverse())).toEqual([]);
    expect(headerProblems(["name", "destinationSlug"])).toEqual([]);
  });

  it("refuses an unknown, blank or repeated header and a missing required one", () => {
    expect(headerProblems(["destinationSlug", "name", "mystery"])).toEqual([
      "Unknown column(s): mystery. Use the template's headers.",
    ]);
    expect(headerProblems(["destinationSlug", "name", ""])).toEqual([
      "Column(s) 3 have no header.",
    ]);
    expect(headerProblems(["destinationSlug", "name", "city", "city"])).toEqual([
      "Column(s) given twice: city.",
    ]);
    expect(headerProblems(["name"])).toEqual(["Missing column(s): destinationSlug."]);
  });

  it("checks a very wide header row in one pass, as a stray file may carry one", () => {
    const wide = Array.from({ length: 200_000 }, (_, i) => `stray${i}`);
    expect(headerProblems(["destinationSlug", "name", ...wide, ...wide])).toHaveLength(2);
  });

  it("names at most ten unknown headers, each cut short", () => {
    const strays = Array.from({ length: 12 }, (_, i) => `stray${i}${"x".repeat(100)}`);
    const [problem] = headerProblems(["destinationSlug", "name", ...strays]);
    expect(problem?.match(/stray/g)).toHaveLength(10);
    expect(problem).not.toContain("x".repeat(61));
  });
});

describe("buildCandidate", () => {
  it("converts number and true/false cells and leaves a blank cell out", () => {
    const headers = [
      "destinationSlug",
      "name",
      "totalRooms",
      "airportDistanceKm",
      "servesAlcohol",
      "brand",
    ];
    expect(buildCandidate(headers, ["udaipur", "The Lake", "84", "12.5", "yes", ""])).toEqual({
      destinationSlug: "udaipur",
      name: "The Lake",
      totalRooms: 84,
      airportDistanceKm: 12.5,
      servesAlcohol: true,
    });
  });

  it("leaves a non-numeric number as its string so the schema reports it", () => {
    expect(buildCandidate(["totalRooms"], ["many"])).toEqual({ totalRooms: "many" });
  });

  it("splits a list cell on |, trims the entries and drops the empty ones", () => {
    expect(buildCandidate(["cuisines", "nameAliases"], [" Indian | Italian ||", "|"])).toEqual({
      cuisines: ["Indian", "Italian"],
    });
  });

  it("passes a text column like imageRef through unchanged", () => {
    expect(buildCandidate(["name", "imageRef"], ["X", "hero.jpg"])).toEqual({
      name: "X",
      imageRef: "hero.jpg",
    });
  });

  it("parses true/false, yes/no and 1/0, in any case", () => {
    expect(buildCandidate(["demoVisible"], ["FALSE"])).toEqual({ demoVisible: false });
    expect(buildCandidate(["publicShowcase"], ["0"])).toEqual({ publicShowcase: false });
    expect(buildCandidate(["isPureVegetarian"], ["No"])).toEqual({ isPureVegetarian: false });
    expect(buildCandidate(["hasSeparateVegKitchen"], ["1"])).toEqual({
      hasSeparateVegKitchen: true,
    });
    expect(buildCandidate(["demoVisible"], ["maybe"])).toEqual({ demoVisible: "maybe" });
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
