/**
 * The golden tables' refused variants (src/golden/facts.ts) must hold what the file promises: a
 * regenerated parse that drops or widens a condition fails the table. So every value outside a
 * list is tried, not only the first (ENGINE-3), and the view and the side are changed to each other
 * value as well as left out.
 */
import { describe, expect, it } from "vitest";

import { FIELD_GROUPS, SUBJECTS, VIEWS } from "../conditions";
import { refusedVariants } from "./facts";

describe("refusedVariants", () => {
  it("§5.9 line 250: 'hotel threads' is refused widened by every other subject, guest included", () => {
    const variants = refusedVariants({ subjects: ["hotel"] });
    expect(variants).toContainEqual({ subjects: [] });
    for (const subject of SUBJECTS.filter((candidate) => candidate !== "hotel")) {
      expect(variants, subject).toContainEqual({ subjects: ["hotel", subject] });
    }
  });

  it("§5.9 line 252, §5.6 line 204: a list of several values is widened by each value it leaves out", () => {
    const designs = refusedVariants({ subjects: ["design", "invitation"] });
    expect(designs).toContainEqual({ subjects: ["design", "invitation", "guest"] });
    const listed: readonly string[] = ["theme", "dress_code"];
    const theme = refusedVariants({ fields: ["theme", "dress_code"] });
    expect(theme).toContainEqual({ fields: [] });
    for (const field of FIELD_GROUPS.filter((candidate) => !listed.includes(candidate))) {
      expect(theme, field).toContainEqual({ fields: ["theme", "dress_code", field] });
    }
  });

  it("§6 line 359: the view is left out and changed to every other view; the side likewise", () => {
    const summary = refusedVariants({ view: "summary", checks: ["approved"] });
    expect(summary).toContainEqual({ view: undefined, checks: ["approved"] });
    expect(summary).toContainEqual({ view: "summary", checks: [] });
    for (const view of VIEWS.filter((candidate) => candidate !== "summary")) {
      expect(summary, view).toContainEqual({ view, checks: ["approved"] });
    }
    expect(refusedVariants({ side: "hotel" })).toEqual([{ side: undefined }, { side: "vendor" }]);
  });
});
