import {
  HOTEL_IMPORT_COLUMNS,
  HOTEL_IMPORT_MAX_BYTES,
  VENUE_IMPORT_COLUMNS,
  type HotelImportResult,
  type HotelImportRowReport,
} from "@ampm/core";

import {
  changingHeadline,
  changingRows,
  hasChanges,
  hasRejections,
  importColumnsHint,
  importInputProblem,
  importSummary,
  importTemplateCsv,
  moreRowsText,
  rejectedHeadline,
  rejectedRowText,
  rowOutcomeText,
  utf8Length,
} from "./hotel-import.format";

function result(overrides: Partial<HotelImportResult> = {}): HotelImportResult {
  return {
    importJobId: "018f0000-0000-7000-8000-00000000f001",
    kind: "hotels",
    dryRun: false,
    applied: true,
    totalRows: 50,
    created: 48,
    updated: 0,
    unchanged: 0,
    destinationsCreated: 3,
    mediaRegistered: 0,
    rejected: [],
    rows: [],
    ...overrides,
  };
}

function row(overrides: Partial<HotelImportRowReport> = {}): HotelImportRowReport {
  return {
    line: 2,
    slug: "synthetic-lake-hotel",
    name: "Synthetic Lake Hotel",
    outcome: "update",
    changedFields: [],
    ...overrides,
  };
}

describe("hotel-import.format", () => {
  it("takes each kind's columns from core", () => {
    expect(importColumnsHint("hotels").split(", ")).toEqual([...HOTEL_IMPORT_COLUMNS]);
    expect(importColumnsHint("venues").split(", ")).toEqual([...VENUE_IMPORT_COLUMNS]);
  });

  it("builds a kind's template as the header row alone, marked UTF-8 so Excel keeps ₹ and Indic names", () => {
    const template = importTemplateCsv("hotels");
    expect(template).toBe(`\uFEFF${HOTEL_IMPORT_COLUMNS.join(",")}`);
    expect(template.split("\r\n")).toHaveLength(1);
    expect(template.startsWith("\uFEFFdestinationSlug,destinationName,slug,name,")).toBe(true);
    expect(importTemplateCsv("venues")).toBe(`\uFEFF${VENUE_IMPORT_COLUMNS.join(",")}`);
  });

  describe("importSummary", () => {
    it("reports a dry run as checked-not-saved, with each outcome counted", () => {
      const r = result({
        dryRun: true,
        applied: false,
        totalRows: 50,
        created: 40,
        updated: 5,
        unchanged: 3,
        destinationsCreated: 0,
        rejected: [
          { line: 5, errors: [] },
          { line: 9, errors: [] },
        ],
      });
      expect(importSummary(r)).toBe(
        "Checked 50 rows: 40 to add, 5 to update, 3 unchanged, 2 rejected — nothing saved yet.",
      );
    });

    it("says how many new destinations a dry run would add", () => {
      const r = result({
        dryRun: true,
        applied: false,
        totalRows: 1,
        created: 1,
        updated: 0,
        destinationsCreated: 1,
      });
      expect(importSummary(r)).toBe(
        "Checked 1 row: 1 to add, 0 to update, 0 unchanged, 0 rejected — would add 1 new destination; nothing saved yet.",
      );
    });

    it("says how many images a dry run would register, beside any new destination", () => {
      const preview = { dryRun: true, applied: false, created: 0, updated: 0, rejected: [] };
      expect(
        importSummary(
          result({
            ...preview,
            totalRows: 1,
            unchanged: 1,
            destinationsCreated: 0,
            mediaRegistered: 1,
          }),
        ),
      ).toBe(
        "Checked 1 row: 0 to add, 0 to update, 1 unchanged, 0 rejected — would register 1 image; nothing saved yet.",
      );
      expect(
        importSummary(
          result({
            ...preview,
            totalRows: 2,
            created: 1,
            unchanged: 1,
            destinationsCreated: 1,
            mediaRegistered: 2,
          }),
        ),
      ).toBe(
        "Checked 2 rows: 1 to add, 0 to update, 1 unchanged, 0 rejected — would add 1 new destination; would register 2 images; nothing saved yet.",
      );
    });

    it("names one destination and one image in the singular", () => {
      expect(
        importSummary(
          result({ created: 1, updated: 0, destinationsCreated: 1, mediaRegistered: 1 }),
        ),
      ).toBe("Imported 1 created · 0 updated · 1 new destination · 1 image.");
    });

    it("summarises an applied import with its counts", () => {
      expect(
        importSummary(
          result({ created: 48, updated: 2, destinationsCreated: 3, mediaRegistered: 4 }),
        ),
      ).toBe("Imported 48 created · 2 updated · 3 new destinations · 4 images.");
    });

    it("omits zero unchanged rows, destinations and images, and counts unchanged rows when some are", () => {
      expect(
        importSummary(
          result({ created: 10, updated: 0, destinationsCreated: 0, mediaRegistered: 0 }),
        ),
      ).toBe("Imported 10 created · 0 updated.");
      expect(
        importSummary(result({ created: 1, updated: 1, unchanged: 8, destinationsCreated: 0 })),
      ).toBe("Imported 1 created · 1 updated · 8 unchanged.");
    });

    it("says nothing imported when a real run applied nothing (all rows rejected)", () => {
      expect(
        importSummary(
          result({
            applied: false,
            created: 0,
            updated: 0,
            totalRows: 1,
            rejected: [{ line: 1, errors: [] }],
          }),
        ),
      ).toBe("Nothing imported — all 1 row was rejected.");
    });

    it("counts the images a run registered on hotels that otherwise matched", () => {
      expect(
        importSummary(
          result({
            created: 0,
            updated: 0,
            unchanged: 3,
            destinationsCreated: 0,
            mediaRegistered: 3,
          }),
        ),
      ).toBe("Imported 0 created · 0 updated · 3 unchanged · 3 images.");
    });

    // The API answers `applied: false` when a real run wrote nothing (core hotelImportResult).
    it("says nothing imported when every row already matches, naming any rejected", () => {
      const unchanged = { applied: false, created: 0, updated: 0, destinationsCreated: 0 };
      expect(importSummary(result({ ...unchanged, totalRows: 4, unchanged: 4 }))).toBe(
        "Nothing imported — 4 unchanged.",
      );
      expect(
        importSummary(
          result({ ...unchanged, totalRows: 3, unchanged: 2, rejected: [{ line: 3, errors: [] }] }),
        ),
      ).toBe("Nothing imported — 2 unchanged, 1 rejected.");
    });
  });

  it("builds a rejected headline and a per-row line, and none when clean", () => {
    const r = result({
      totalRows: 50,
      rejected: [
        {
          line: 5,
          errors: [
            { field: "destinationSlug", message: "required" },
            { field: "website", message: "invalid url" },
          ],
        },
      ],
    });
    expect(hasRejections(r)).toBe(true);
    expect(rejectedHeadline(r)).toBe("1 of 50 rows rejected");
    expect(rejectedRowText(r.rejected[0]!)).toBe(
      "Line 5: destinationSlug — required; website — invalid url",
    );
    expect(hasRejections(result())).toBe(false);
    expect(rejectedHeadline(result())).toBeNull();
  });

  describe("the per-row report", () => {
    const report = result({
      dryRun: true,
      applied: false,
      rows: [
        row({ line: 4, slug: "synthetic-hill-resort", outcome: "create", changedFields: ["name"] }),
        row({ line: 2, changedFields: ["city", "mapsUrl"] }),
        row({ line: 3, slug: "synthetic-fort-hotel", outcome: "unchanged" }),
        row({ line: 5, slug: null, outcome: "error" }),
      ],
      rejected: [{ line: 5, errors: [{ field: "name", message: "required" }] }],
    });

    it("lists the rows that add or update a hotel, in file order, with the columns they change", () => {
      expect(changingRows(report).map((r) => r.line)).toEqual([2, 4]);
      expect(changingHeadline(report)).toBe("2 hotels to add or update");
      expect(changingHeadline(result({ rows: [row()] }))).toBe("1 hotel added or updated");
      expect(changingHeadline(result())).toBeNull();
      expect(rowOutcomeText(row({ changedFields: ["city", "mapsUrl"] }), "hotels")).toBe(
        "Line 2 · synthetic-lake-hotel · Update: city, mapsUrl",
      );
      expect(rowOutcomeText(row({ line: 4, slug: null, outcome: "create" }), "hotels")).toBe(
        "Line 4 · New hotel",
      );
    });

    // The downloaded report itself is tested in hotel-import.report.test.ts.
    it("caps the lists on screen and points at the report for the rest", () => {
      expect(moreRowsText(20)).toBeNull();
      expect(moreRowsText(23)).toBe("3 more in the downloaded report.");
    });
  });

  it("says whether a preview would add, update or register anything", () => {
    expect(hasChanges(result({ created: 0, updated: 1 }))).toBe(true);
    expect(hasChanges(result({ created: 0, updated: 0, unchanged: 3 }))).toBe(false);
    // An image never makes a row an update: a file that only adds images still imports something.
    expect(hasChanges(result({ created: 0, updated: 0, unchanged: 3, mediaRegistered: 2 }))).toBe(
      true,
    );
  });

  it("refuses an empty CSV and one over the 5 MB cap before it is sent", () => {
    expect(importInputProblem("  \n ")).toBe("Paste or choose a CSV first");
    expect(importInputProblem("destinationSlug,name")).toBeNull();
    expect(importInputProblem("a".repeat(HOTEL_IMPORT_MAX_BYTES + 1))).toBe(
      "The CSV is over 5 MB: split it into smaller files",
    );
    expect(utf8Length("aé€😀")).toBe(1 + 2 + 3 + 4);
  });
});
