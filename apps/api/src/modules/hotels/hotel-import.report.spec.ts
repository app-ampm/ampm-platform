import { describe, expect, it } from "vitest";

import type { ImportFile } from "./hotel-import.file.js";
import { planImport } from "./hotel-import.plan.js";
import { summarise } from "./hotel-import.report.js";
import { importContext as context, importRow as row } from "./testing/import-plan-fixtures.js";

describe("summarise", () => {
  it("counts what the plan does and the destinations it would create, rows by line", () => {
    const rows = [
      { line: 2, row: row({ brand: "Synthetic Collection" }) },
      {
        line: 3,
        row: row({ slug: "synthetic-cove", name: "Cove", destinationSlug: "synthetic-new" }),
      },
      { line: 5, row: row({ slug: "synthetic-cove", name: "Cove Again" }) },
    ];
    const file: ImportFile = {
      rows,
      rejected: [{ line: 4, slug: null, errors: [{ field: "name", message: "Required" }] }],
      totalRows: 4,
    };
    const ctx = context();
    const summary = summarise(file, planImport(rows, ctx), ctx.destinations);
    expect(summary).toMatchObject({
      created: 1,
      updated: 0,
      unchanged: 1,
      valid: 2,
      newDestinations: 1,
    });
    expect(summary.rows.map((report) => [report.line, report.outcome])).toEqual([
      [2, "unchanged"],
      [3, "create"],
      [4, "error"],
      [5, "error"],
    ]);
    expect(summary.rejected.map((rejected) => rejected.line)).toEqual([4, 5]);
    expect(summary.rejected[0]).toEqual({
      line: 4,
      errors: [{ field: "name", message: "Required" }],
    });
  });
});
