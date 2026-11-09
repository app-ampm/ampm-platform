import type { HotelImportResult } from "@ampm/core";

import {
  hasRejections,
  importSummary,
  IMPORT_COLUMNS,
  IMPORT_TEMPLATE_HEADER,
  rejectedHeadline,
  rejectedRowText,
  REQUIRED_COLUMNS,
} from "./hotel-import.format";

function result(overrides: Partial<HotelImportResult> = {}): HotelImportResult {
  return {
    importJobId: "018f0000-0000-7000-8000-00000000f001",
    dryRun: false,
    applied: true,
    totalRows: 50,
    created: 48,
    updated: 0,
    destinationsCreated: 3,
    mediaRegistered: 0,
    rejected: [],
    ...overrides,
  };
}

describe("hotel-import.format", () => {
  it("lists the columns in order and marks the required ones", () => {
    expect(IMPORT_COLUMNS[0]).toBe("destinationSlug");
    expect(IMPORT_COLUMNS).toContain("name");
    expect(REQUIRED_COLUMNS).toEqual(["destinationSlug", "name"]);
    expect(IMPORT_TEMPLATE_HEADER.startsWith("destinationSlug,destinationName,slug,name,")).toBe(
      true,
    );
  });

  describe("importSummary", () => {
    it("reports a dry run as checked-not-saved, with the valid/rejected split", () => {
      const r = result({
        dryRun: true,
        applied: false,
        totalRows: 50,
        created: 0,
        updated: 0,
        destinationsCreated: 0,
        rejected: [
          { line: 5, errors: [] },
          { line: 9, errors: [] },
        ],
      });
      expect(importSummary(r)).toBe("Checked 50 rows: 48 valid, 2 rejected — nothing saved yet.");
    });

    it("summarises an applied import with its counts", () => {
      expect(
        importSummary(
          result({ created: 48, updated: 2, destinationsCreated: 3, mediaRegistered: 4 }),
        ),
      ).toBe("Imported 48 created · 2 updated · 3 new destinations · 4 images.");
    });

    it("omits zero destinations and images", () => {
      expect(
        importSummary(
          result({ created: 10, updated: 0, destinationsCreated: 0, mediaRegistered: 0 }),
        ),
      ).toBe("Imported 10 created · 0 updated.");
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
});
