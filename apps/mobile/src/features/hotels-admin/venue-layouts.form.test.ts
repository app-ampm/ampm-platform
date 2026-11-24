import { VENUE_OTHER_LAYOUTS_MAX } from "@ampm/core";

import {
  canAddLayout,
  layoutDraftsFrom,
  layoutRowErrors,
  layoutsBody,
  layoutsError,
  layoutsListError,
  newLayoutDraft,
  type LayoutDraft,
} from "./venue-layouts.form";

function row(key: string, layout: string, max: string, min = ""): LayoutDraft {
  return { key, layout, max, min };
}

function rows(count: number): LayoutDraft[] {
  return Array.from({ length: count }, (_, i) => row(String(i), `Layout ${i + 1}`, "50"));
}

describe("venue-layouts.form", () => {
  it("seeds the rows from the stored layouts, and keys a new row apart from the rest", () => {
    const drafts = layoutDraftsFrom([
      { layout: "Classroom", max: 120 },
      { layout: "U-shape", max: 40, min: 30 },
    ]);
    expect(drafts).toEqual([row("0", "Classroom", "120"), row("1", "U-shape", "40", "30")]);
    expect(newLayoutDraft([row("0", "A", "1"), row("3", "B", "2")])).toEqual(row("4", "", ""));
    expect(layoutDraftsFrom(null)).toEqual([]);
  });

  it("stops adding at the cap", () => {
    expect(canAddLayout(rows(VENUE_OTHER_LAYOUTS_MAX - 1))).toBe(true);
    expect(canAddLayout(rows(VENUE_OTHER_LAYOUTS_MAX))).toBe(false);
  });

  it("checks a row box by box, and leaves a blank row alone", () => {
    expect(layoutRowErrors(row("0", "", "", ""))).toEqual({
      layout: undefined,
      max: undefined,
      min: undefined,
    });
    expect(layoutRowErrors(row("0", "", "40"))).toMatchObject({ layout: "Name the layout" });
    expect(layoutRowErrors(row("0", "Classroom", ""))).toMatchObject({
      max: "Give the most guests it takes",
    });
    expect(layoutRowErrors(row("0", "Classroom", "0")).max).toBe(
      "The most guests is a whole number from 1 to 100,000",
    );
    expect(layoutRowErrors(row("0", "U-shape", "40", "50")).min).toBe(
      "The fewest guests is above the most",
    );
    expect(layoutRowErrors(row("0", "x".repeat(61), "40")).layout).toBe(
      "A layout name is at most 60 characters",
    );
  });

  it("sends the filled rows as core's entries, a minimum only when given, or null", () => {
    expect(
      layoutsBody([row("0", " Classroom ", "120"), row("1", "", ""), row("2", "U", "40", "30")]),
    ).toEqual([
      { layout: "Classroom", max: 120 },
      { layout: "U", max: 40, min: 30 },
    ]);
    expect(layoutsBody([row("0", "", "")])).toBeNull();
  });

  it("passes the filled rows through core's rule: each name once, ignoring case, and the cap", () => {
    expect(layoutsListError([row("0", "Classroom", "120"), row("1", "classroom", "60")])).toBe(
      "Give each layout once",
    );
    expect(layoutsListError(rows(VENUE_OTHER_LAYOUTS_MAX + 1))).toBe("Keep to 12 other layouts");
    expect(layoutsError(rows(VENUE_OTHER_LAYOUTS_MAX))).toBeUndefined();
  });

  it("names a row's own problem before the list's", () => {
    const list = [row("0", "Classroom", "abc"), row("1", "Classroom", "60")];
    expect(layoutsError(list)).toBe("The most guests is a whole number from 1 to 100,000");
  });
});
