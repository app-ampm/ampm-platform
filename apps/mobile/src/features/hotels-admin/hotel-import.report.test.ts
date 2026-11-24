import { RUPEES_CELL_MESSAGE, type HotelImportRowReport } from "@ampm/core";

import { importReportCsv } from "./hotel-import.report";
import { dryRunResult, ratesDryRunResult } from "./hotel-import.test-utils";

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

describe("a hotels report", () => {
  it("downloads every row with its outcome, changes and errors, in line order", () => {
    const report = dryRunResult({
      rows: [
        row({ line: 4, slug: "synthetic-hill-resort", outcome: "create", changedFields: ["name"] }),
        row({ line: 2, changedFields: ["city", "mapsUrl"] }),
        row({ line: 3, slug: "synthetic-fort-hotel", outcome: "unchanged" }),
        row({ line: 5, slug: null, outcome: "error" }),
      ],
      rejected: [{ line: 5, errors: [{ field: "name", message: "required" }] }],
    });
    expect(importReportCsv(report).split("\r\n")).toEqual([
      "line,slug,outcome,changedFields,errors",
      '2,synthetic-lake-hotel,update,"city, mapsUrl",',
      "3,synthetic-fort-hotel,unchanged,,",
      "4,synthetic-hill-resort,create,name,",
      "5,,error,,name: required",
    ]);
  });

  it("keeps a rejected row the report does not list, quoting what a spreadsheet would split", () => {
    const unlisted = dryRunResult({
      rows: [],
      rejected: [{ line: 7, errors: [{ field: "name", message: 'is "short", at most 255' }] }],
    });
    expect(importReportCsv(unlisted).split("\r\n")[1]).toBe(
      '7,,error,,"name: is ""short"", at most 255"',
    );
  });
});

describe("a rates report", () => {
  it("names each row's card, item type (as a cell spells it), room and venue", () => {
    expect(importReportCsv(ratesDryRunResult()).split("\r\n")).toEqual([
      "line,hotelSlug,cardName,itemType,room,venue,outcome,changedFields,errors",
      "2,synthetic-lake-hotel,2026-27,Room rate,Lake View Suite,,update,amount,",
      '3,synthetic-lake-hotel,2026-27,Venue rental,,Synthetic Lawn,create,"itemType, venueName, amount, unit",',
      `4,synthetic-lake-hotel,2026-27,Per plate veg,,,error,,"amount: ${RUPEES_CELL_MESSAGE}"`,
    ]);
  });

  it("leaves the naming cells blank for a row whose item type did not read, or that is not listed", () => {
    const unread = row({ line: 2, name: "2026-27", outcome: "error" });
    const result = ratesDryRunResult({
      rows: [unread],
      rejected: [
        { line: 2, errors: [{ field: "itemType", message: "Invalid option" }] },
        { line: 3, errors: [{ field: "hotelSlug", message: "Required" }] },
      ],
    });
    expect(importReportCsv(result).split("\r\n").slice(1)).toEqual([
      "2,synthetic-lake-hotel,2026-27,,,,error,,itemType: Invalid option",
      "3,,,,,,error,,hotelSlug: Required",
    ]);
  });
});
