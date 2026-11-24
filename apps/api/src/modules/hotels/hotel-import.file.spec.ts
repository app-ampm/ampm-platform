import { HOTEL_IMPORT_MAX_ROWS } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { readImportFile } from "./hotel-import.file.js";
import { HOTELS_IMPORT } from "./hotel-import.kinds.js";

const file = (...lines: string[]) => new TextEncoder().encode(lines.join("\n"));
const readHotels = (bytes: Uint8Array) => readImportFile(bytes, HOTELS_IMPORT);

describe("readImportFile: the hotels template", () => {
  it("reads the schema-valid rows by line, skipping blank lines and counting the rest", () => {
    const read = readHotels(
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
      {
        line: 4,
        slug: "synthetic-nameless",
        name: null,
        errors: [expect.objectContaining({ field: "name" })],
      },
    ]);
  });

  it("refuses a row whose cells run past the header, as an unquoted comma leaves them", () => {
    const read = readHotels(
      file(
        "destinationSlug,name,address",
        "synthetic-coast,Synthetic Bay Hotel,Beach Road, Synthetic Town",
      ),
    );
    expect(read.rows).toEqual([]);
    expect(read.rejected[0]).toMatchObject({
      line: 2,
      slug: "synthetic-bay-hotel",
      name: "Synthetic Bay Hotel",
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
      expect(() => readHotels(bytes)).toThrow(
        expect.objectContaining({
          code: "validation_failed",
          message: expect.stringMatching(message),
        }),
      );
    }
  });

  it("names the file as the failing field", () => {
    expect(() => readHotels(file("name"))).toThrow(
      expect.objectContaining({
        details: [{ path: "file", message: "Missing column(s): destinationSlug." }],
      }),
    );
  });

  it("refuses a file with the header but no hotel rows, blank lines not counting as one", () => {
    for (const bytes of [
      file("destinationSlug,name"),
      file("destinationSlug,name", ",", " , ", ""),
    ]) {
      expect(() => readHotels(bytes)).toThrow(
        expect.objectContaining({
          code: "validation_failed",
          status: 400,
          details: [{ path: "file", message: "The file has no hotel rows." }],
        }),
      );
    }
  });

  it("refuses a file of more lines than any import needs before splitting it into rows", () => {
    for (const ending of ["\n", "\r", "\r\n"]) {
      const lines = new TextEncoder().encode(`destinationSlug,name${ending.repeat(200_000)}`);
      expect(() => readHotels(lines)).toThrow(/more than 100000 lines/);
    }
  });

  it("refuses a quote that never closes, so it cannot swallow the rows below it", () => {
    const bytes = file(
      "destinationSlug,name,descriptionClient,internalNotes",
      'synthetic-coast,Synthetic Bay Hotel,"Lake view,Synthetic note A',
      "synthetic-coast,Synthetic Cove,Nice,Synthetic note B",
    );
    expect(() => readHotels(bytes)).toThrow(
      expect.objectContaining({
        status: 400,
        details: [{ path: "file", message: expect.stringMatching(/^Line 2 opens a quote/) }],
      }),
    );
  });

  it("keeps a quote inside a cell as text, as an inch mark is written", () => {
    const read = readHotels(
      file(
        "destinationSlug,name,facilities",
        'synthetic-coast,Synthetic Bay Hotel,55" TV|Pool',
        "synthetic-coast,Synthetic Cove,Spa",
        'synthetic-coast,Synthetic Dunes,32" TV',
      ),
    );
    expect(read.rejected).toEqual([]);
    expect(read.rows.map(({ line, row }) => [line, row.name, row.facilities])).toEqual([
      [2, "Synthetic Bay Hotel", ['55" TV', "Pool"]],
      [3, "Synthetic Cove", ["Spa"]],
      [4, "Synthetic Dunes", ['32" TV']],
    ]);
  });

  it("reads rows ended by a carriage return alone, as Excel for Mac saves them, or mixed", () => {
    for (const text of [
      "destinationSlug,name\rsynthetic-coast,Synthetic Bay Hotel\rsynthetic-coast,Synthetic Cove\r",
      "destinationSlug,name,city\r\nsynthetic-coast,Synthetic Bay Hotel\rsynthetic-coast,Synthetic Cove\r\n",
    ]) {
      const read = readHotels(new TextEncoder().encode(text));
      expect(read.rows.map(({ line, row }) => [line, row.name, row.city])).toEqual([
        [2, "Synthetic Bay Hotel", undefined],
        [3, "Synthetic Cove", undefined],
      ]);
    }
  });

  it("refuses a file holding a null character, which no text column can store", () => {
    const bytes = file("destinationSlug,name", "synthetic-coast,Synthetic\u0000Bay");
    expect(() => readHotels(bytes)).toThrow(
      expect.objectContaining({
        status: 400,
        details: [{ path: "file", message: expect.stringMatching(/null character/) }],
      }),
    );
  });

  it("takes the first row that is not blank as the header, counting lines from the file's top", () => {
    for (const lead of [",,,", ""]) {
      const read = readHotels(
        file(lead, "destinationSlug,name,city,state", "synthetic-coast,Synthetic Bay Hotel,,"),
      );
      expect(read.rows).toEqual([
        { line: 3, row: { destinationSlug: "synthetic-coast", name: "Synthetic Bay Hotel" } },
      ]);
    }
  });

  it(`refuses more than ${HOTEL_IMPORT_MAX_ROWS} rows`, () => {
    const rows = Array.from(
      { length: HOTEL_IMPORT_MAX_ROWS + 1 },
      (_, i) => `synthetic-coast,Hotel ${i}`,
    );
    expect(() => readHotels(file("destinationSlug,name", ...rows))).toThrow(/at most 2000/);
  });
});
