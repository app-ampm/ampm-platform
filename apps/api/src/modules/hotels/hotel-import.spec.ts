import { HOTEL_IMPORT_COLUMNS, HOTEL_IMPORT_TEMPLATES } from "@ampm/core";
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
const HOTELS = HOTEL_IMPORT_TEMPLATES.hotels;
/** A hotels row's typed cells, as the reader builds them. */
const candidate = (headers: readonly string[], cells: readonly string[]) =>
  buildCandidate(headers, cells, HOTELS).values;

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

  it("opens quotes only at a cell's start, blanks aside: a quote inside a cell is text", () => {
    expect(parseCsv('ab"c,55" TV|Pool,f\n32" TV')).toEqual({
      records: [['ab"c', '55" TV|Pool', "f"], ['32" TV']],
    });
    expect(parseCsv('a, "1 Road, Old Town","x"y"z"')).toEqual({
      records: [["a", " 1 Road, Old Town", 'xy"z"']],
    });
  });

  it("refuses a quote that never closes, naming its line, before it swallows the rows after it", () => {
    expect(parseCsv('name,note\nok,"Lake view,x\nnext,row')).toEqual({
      problem:
        "Line 2 opens a quote that never closes; close the quoted cell, or remove the quote.",
    });
    // A later quote closes it only after the rows between have run it past the longest cell.
    const swallowed = `name,note\nok,"Lake view\n${"next,row\n".repeat(3_000)}last,"x"`;
    expect(parseCsv(swallowed)).toEqual({
      problem: expect.stringMatching(/^Line 2 has a cell longer .*check that its closing quote/),
    });
  });

  it("ends a record at a line feed, a carriage return or the two together", () => {
    expect(parseCsv("a,b\rc,d\r\ne,f\ng\r\r\nh")).toEqual({
      records: [["a", "b"], ["c", "d"], ["e", "f"], ["g"], [""], ["h"]],
    });
    expect(parseCsv('"x\ry"\r')).toEqual({ records: [["x\ry"]] });
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
      problem: `Line 1 has more than ${CSV_MAX_CELLS} cells; no import template has that many columns.`,
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
      candidate(["facilities", "nameAliases"], ["Pool | Spa, salon and gym", "Bay Hotel\nThe Bay"]),
    ).toEqual({
      facilities: ["Pool", "Spa, salon and gym"],
      nameAliases: ["Bay Hotel", "The Bay"],
    });
  });
});

describe("headerProblems", () => {
  it("accepts the template's headers in any order, the required ones present", () => {
    expect(headerProblems([...HOTEL_IMPORT_COLUMNS].reverse(), HOTELS)).toEqual([]);
    expect(headerProblems(["name", "destinationSlug"], HOTELS)).toEqual([]);
  });

  it("refuses an unknown, blank or repeated header and a missing required one", () => {
    expect(headerProblems(["destinationSlug", "name", "mystery"], HOTELS)).toEqual([
      "Unknown column(s): mystery. Use the template's headers.",
    ]);
    expect(headerProblems(["destinationSlug", "name", ""], HOTELS)).toEqual([
      "Column(s) 3 have no header.",
    ]);
    expect(headerProblems(["destinationSlug", "name", "city", "city"], HOTELS)).toEqual([
      "Column(s) given twice: city.",
    ]);
    expect(headerProblems(["name"], HOTELS)).toEqual(["Missing column(s): destinationSlug."]);
  });

  it("checks a very wide header row in one pass, as a stray file may carry one", () => {
    const wide = Array.from({ length: 200_000 }, (_, i) => `stray${i}`);
    expect(headerProblems(["destinationSlug", "name", ...wide, ...wide], HOTELS)).toHaveLength(2);
  });

  it("names at most ten unknown headers, each cut short", () => {
    const strays = Array.from({ length: 12 }, (_, i) => `stray${i}${"x".repeat(100)}`);
    const [problem] = headerProblems(["destinationSlug", "name", ...strays], HOTELS);
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
    expect(candidate(headers, ["udaipur", "The Lake", "84", "12.5", "yes", ""])).toEqual({
      destinationSlug: "udaipur",
      name: "The Lake",
      totalRooms: 84,
      airportDistanceKm: 12.5,
      servesAlcohol: true,
    });
  });

  it("leaves a non-numeric number as its string so the schema reports it", () => {
    expect(candidate(["totalRooms"], ["many"])).toEqual({ totalRooms: "many" });
  });

  it("splits a list cell on |, trims the entries and drops the empty ones", () => {
    expect(candidate(["cuisines", "nameAliases"], [" Indian | Italian ||", "|"])).toEqual({
      cuisines: ["Indian", "Italian"],
    });
  });

  it("passes a text column like imageRef through unchanged", () => {
    expect(candidate(["name", "imageRef"], ["X", "hero.jpg"])).toEqual({
      name: "X",
      imageRef: "hero.jpg",
    });
  });

  it("parses true/false, yes/no and 1/0, in any case", () => {
    expect(candidate(["demoVisible"], ["FALSE"])).toEqual({ demoVisible: false });
    expect(candidate(["publicShowcase"], ["0"])).toEqual({ publicShowcase: false });
    expect(candidate(["isPureVegetarian"], ["No"])).toEqual({ isPureVegetarian: false });
    expect(candidate(["hasSeparateVegKitchen"], ["1"])).toEqual({
      hasSeparateVegKitchen: true,
    });
    expect(candidate(["demoVisible"], ["maybe"])).toEqual({ demoVisible: "maybe" });
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
