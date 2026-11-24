import { describe, expect, it } from "vitest";

import { refusedReport, summarise, type RowReport } from "./hotel-import.report.js";

const planned = (line: number, outcome: RowReport["outcome"]): RowReport => ({
  line,
  slug: "synthetic-bay",
  name: "Synthetic Bay Hotel",
  outcome,
  changedFields: outcome === "update" ? ["brand"] : [],
  errors: [],
});

describe("summarise", () => {
  it("counts what the plan does, reporting every row by line, the refused ones with their reasons", () => {
    const refusedBeforePlanning = {
      line: 4,
      slug: null,
      name: null,
      errors: [{ field: "name", message: "Required" }],
    };
    const changed = { field: "row", message: "Changed since preview; validate the file again" };
    const summary = summarise({
      totalRows: 5,
      refused: [refusedBeforePlanning],
      reports: [
        planned(2, "unchanged"),
        planned(3, "create"),
        planned(5, "update"),
        refusedReport({ line: 6, slug: "synthetic-cove", name: "Synthetic Cove" }, [changed]),
      ],
      newDestinations: 1,
    });
    expect(summary).toMatchObject({
      created: 1,
      updated: 1,
      unchanged: 1,
      valid: 3,
      newDestinations: 1,
    });
    expect(summary.rows.map((report) => [report.line, report.outcome, report.name])).toEqual([
      [2, "unchanged", "Synthetic Bay Hotel"],
      [3, "create", "Synthetic Bay Hotel"],
      [4, "error", null],
      [5, "update", "Synthetic Bay Hotel"],
      [6, "error", "Synthetic Cove"],
    ]);
    expect(summary.rows[3]).toEqual({
      line: 5,
      slug: "synthetic-bay",
      name: "Synthetic Bay Hotel",
      outcome: "update",
      changedFields: ["brand"],
    });
    expect(summary.rejected).toEqual([
      { line: 4, errors: [{ field: "name", message: "Required" }] },
      { line: 6, errors: [changed] },
    ]);
  });
});
