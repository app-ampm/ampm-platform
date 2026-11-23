import { HOTEL_IMPORT_MAX_ROWS } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { readHotelImportFile } from "./hotel-import.file.js";

const file = (...lines: string[]) => new TextEncoder().encode(lines.join("\n"));

describe("readHotelImportFile", () => {
  it("reads the schema-valid rows by line, skipping blank lines and counting the rest", () => {
    const read = readHotelImportFile(
      file(
        "destinationSlug,name,slug,totalRooms",
        "synthetic-coast,Synthetic Bay Hotel,,40",
        ",,,",
        "synthetic-coast,,synthetic-nameless,10",
      ),
    );
    expect(read.totalRows).toBe(2);
    expect(read.rows).toEqual([
      {
        line: 2,
        row: { destinationSlug: "synthetic-coast", name: "Synthetic Bay Hotel", totalRooms: 40 },
      },
    ]);
    expect(read.rejected).toEqual([
      { line: 4, slug: "synthetic-nameless", errors: [expect.objectContaining({ field: "name" })] },
    ]);
  });

  it("refuses a row whose cells run past the header, as an unquoted comma leaves them", () => {
    const read = readHotelImportFile(
      file(
        "destinationSlug,name,address",
        "synthetic-coast,Synthetic Bay Hotel,Beach Road, Synthetic Town",
      ),
    );
    expect(read.rows).toEqual([]);
    expect(read.rejected[0]).toMatchObject({
      line: 2,
      slug: "synthetic-bay-hotel",
      errors: [{ field: "row" }],
    });
  });

  it("refuses the whole file, naming it, when it is not UTF-8, empty or off-template", () => {
    const refusals: [Uint8Array, RegExp][] = [
      [Uint8Array.from([0x6e, 0x61, 0x6d, 0x65, 0xe9]), /UTF-8 CSV/],
      [file(""), /The file is empty/],
      [file("destinationSlug,name,mystery"), /Unknown column\(s\): mystery/],
      [file("name,city"), /Missing column\(s\): destinationSlug/],
    ];
    for (const [bytes, message] of refusals) {
      expect(() => readHotelImportFile(bytes)).toThrow(
        expect.objectContaining({
          code: "validation_failed",
          message: expect.stringMatching(message),
        }),
      );
    }
  });

  it("names the file as the failing field", () => {
    expect(() => readHotelImportFile(file("name"))).toThrow(
      expect.objectContaining({
        details: [{ path: "file", message: "Missing column(s): destinationSlug." }],
      }),
    );
  });

  it("refuses a file of more lines than any import needs before splitting it into rows", () => {
    const lines = new TextEncoder().encode(`destinationSlug,name${"\n".repeat(200_000)}`);
    expect(() => readHotelImportFile(lines)).toThrow(/more than 100000 lines/);
  });

  it(`refuses more than ${HOTEL_IMPORT_MAX_ROWS} rows`, () => {
    const rows = Array.from(
      { length: HOTEL_IMPORT_MAX_ROWS + 1 },
      (_, i) => `synthetic-coast,Hotel ${i}`,
    );
    expect(() => readHotelImportFile(file("destinationSlug,name", ...rows))).toThrow(
      /at most 2000/,
    );
  });
});
