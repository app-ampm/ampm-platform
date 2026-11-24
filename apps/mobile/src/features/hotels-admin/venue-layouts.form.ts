import {
  VENUE_CAPACITY_MAX,
  VENUE_OTHER_LAYOUT_NAME_MAX,
  VENUE_OTHER_LAYOUTS_MAX,
  venueOtherLayouts,
  type VenueOtherLayout,
} from "@ampm/core";

import { numberRuleError, withoutNul, type NumberRule } from "./hotel-form-fields";

/*
 * A venue's other layouts as the editor holds them (D-178): beside the three capacities, up to
 * {@link VENUE_OTHER_LAYOUTS_MAX} rows of a name, the most guests and, for a range, the fewest. Each row
 * is checked on its own first, so its message names the box to fix; the filled rows then pass core's
 * `venueOtherLayouts` (the cap, each name once ignoring case), the rule the API applies. A name is read
 * without the null character (`withoutNul`), as a save sends it. A row left blank is dropped, never
 * refused. Pure.
 */

/** One row as the editor holds it: text boxes, and a key that keeps the row's identity in the list. */
export interface LayoutDraft {
  readonly key: string;
  readonly layout: string;
  readonly max: string;
  readonly min: string;
}

/** What is wrong with one row, box by box. */
export interface LayoutRowErrors {
  readonly layout: string | undefined;
  readonly max: string | undefined;
  readonly min: string | undefined;
}

const NO_ROW_ERRORS: LayoutRowErrors = { layout: undefined, max: undefined, min: undefined };

/** The venue's stored layouts as rows, in order. */
export function layoutDraftsFrom(layouts: readonly VenueOtherLayout[] | null): LayoutDraft[] {
  return (layouts ?? []).map((entry, index) => ({
    key: String(index),
    layout: entry.layout,
    max: String(entry.max),
    min: entry.min === undefined ? "" : String(entry.min),
  }));
}

/**
 * A new blank row, keyed apart from every row there is.
 *
 * @example
 * newLayoutDraft([{ key: "0", … }, { key: "3", … }]); // { key: "4", layout: "", max: "", min: "" }
 */
export function newLayoutDraft(rows: readonly LayoutDraft[]): LayoutDraft {
  const key = rows.reduce((next, row) => Math.max(next, Number(row.key) + 1), 0);
  return { key: String(key), layout: "", max: "", min: "" };
}

/** Whether the editor may add another row. */
export function canAddLayout(rows: readonly LayoutDraft[]): boolean {
  return rows.length < VENUE_OTHER_LAYOUTS_MAX;
}

/** A row's layout name as a save sends it: trimmed, without the null character. */
const layoutName = (row: LayoutDraft): string => withoutNul(row.layout).trim();

function isBlankRow(row: LayoutDraft): boolean {
  return layoutName(row) === "" && row.max.trim() === "" && row.min.trim() === "";
}

const GUESTS: Omit<NumberRule, "message"> = { min: 1, max: VENUE_CAPACITY_MAX, places: 0 };

function nameError(layout: string): string | undefined {
  if (layout === "") return "Name the layout";
  return layout.length > VENUE_OTHER_LAYOUT_NAME_MAX
    ? `A layout name is at most ${VENUE_OTHER_LAYOUT_NAME_MAX} characters`
    : undefined;
}

/**
 * One row's checks: a name, the most guests as a whole number from 1, and the fewest, when given, no
 * more than the most. A blank row has none.
 */
export function layoutRowErrors(row: LayoutDraft): LayoutRowErrors {
  if (isBlankRow(row)) return NO_ROW_ERRORS;
  const max =
    row.max.trim() === ""
      ? "Give the most guests it takes"
      : numberRuleError(row.max, {
          ...GUESTS,
          message: "The most guests is a whole number from 1 to 100,000",
        });
  const min = numberRuleError(row.min, {
    ...GUESTS,
    message: "The fewest guests is a whole number from 1 to 100,000",
  });
  const fewestAboveMost =
    max === undefined &&
    min === undefined &&
    row.min.trim() !== "" &&
    Number(row.min) > Number(row.max);
  return {
    layout: nameError(layoutName(row)),
    max,
    min: fewestAboveMost ? "The fewest guests is above the most" : min,
  };
}

function toEntry(row: LayoutDraft): VenueOtherLayout {
  const entry = { layout: layoutName(row), max: Number(row.max.trim()) };
  return row.min.trim() === "" ? entry : { ...entry, min: Number(row.min.trim()) };
}

/**
 * The layouts a save sends: the filled rows as core's entries, or null when there are none. Call it on
 * rows that pass their checks.
 *
 * @example
 * layoutsBody([{ key: "0", layout: "U-shape", max: "40", min: "30" }]); // [{ layout: "U-shape", max: 40, min: 30 }]
 */
export function layoutsBody(rows: readonly LayoutDraft[]): VenueOtherLayout[] | null {
  const entries = rows.filter((row) => !isBlankRow(row)).map(toEntry);
  return entries.length === 0 ? null : entries;
}

/** Core's word on the filled rows once each passes its own checks: the cap, and each name once. */
export function layoutsListError(rows: readonly LayoutDraft[]): string | undefined {
  const entries = layoutsBody(rows) ?? [];
  if (entries.length > VENUE_OTHER_LAYOUTS_MAX) {
    return `Keep to ${VENUE_OTHER_LAYOUTS_MAX} other layouts`;
  }
  const checked = venueOtherLayouts.safeParse(entries);
  return checked.success ? undefined : (checked.error.issues[0]?.message ?? "Check the layouts");
}

/**
 * The first problem with the layouts, for the editor's checks: a row's own, top to bottom, then the
 * list's. Undefined when they can be saved.
 */
export function layoutsError(rows: readonly LayoutDraft[]): string | undefined {
  for (const row of rows) {
    const errors = layoutRowErrors(row);
    const first = errors.layout ?? errors.max ?? errors.min;
    if (first !== undefined) return first;
  }
  return layoutsListError(rows);
}
