/*
 * Pure date-range logic for the DateRangeField: the preset keys, the { from, to } each covers at a
 * given `now` (ms), the preset that matches a range, a label for the trigger, and the order check.
 * Dates are YYYY-MM-DD (inclusive); ISO strings compare lexicographically. No React, no I/O.
 */

export interface DateRange {
  /** Inclusive start, YYYY-MM-DD; absent means open-ended (whole history before `to`). */
  readonly from?: string | undefined;
  /** Inclusive end, YYYY-MM-DD; absent means open-ended. */
  readonly to?: string | undefined;
}

export type DateRangePresetKey =
  "all" | "last_7" | "last_30" | "last_90" | "this_month" | "this_year";

export const DATE_RANGE_PRESET_KEYS: readonly DateRangePresetKey[] = [
  "all",
  "last_7",
  "last_30",
  "last_90",
  "this_month",
  "this_year",
];

/** A preset the field offers: its key and the (overridable) label shown for it. */
export interface DateRangePreset {
  readonly key: DateRangePresetKey;
  readonly label: string;
}

const DAY_MS = 86_400_000;

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The `{ from, to }` a preset covers from `now` (ms). "all" is unbounded (the whole history). */
export function rangeForPreset(key: DateRangePresetKey, now: number): DateRange {
  if (key === "all") return {};
  const to = isoDate(now);
  const at = new Date(now);
  if (key === "this_month") {
    const month = String(at.getUTCMonth() + 1).padStart(2, "0");
    return { from: `${at.getUTCFullYear()}-${month}-01`, to };
  }
  if (key === "this_year") {
    return { from: `${at.getUTCFullYear()}-01-01`, to };
  }
  const days = key === "last_7" ? 7 : key === "last_30" ? 30 : 90;
  return { from: isoDate(now - days * DAY_MS), to };
}

function sameRange(a: DateRange, b: DateRange): boolean {
  return (a.from ?? "") === (b.from ?? "") && (a.to ?? "") === (b.to ?? "");
}

/** The preset key whose range equals this one at `now`, or null when it is a custom range. */
export function matchPreset(range: DateRange, now: number): DateRangePresetKey | null {
  return DATE_RANGE_PRESET_KEYS.find((key) => sameRange(rangeForPreset(key, now), range)) ?? null;
}

/**
 * The trigger label: the matched preset's label, or the two bounds joined by `separator` for a custom
 * range. The visible label uses "→"; pass " to " for the spoken (accessibility) label, since screen
 * readers announce the arrow glyph inconsistently (as MoneyText does for its en dash).
 */
export function rangeLabel(
  range: DateRange,
  now: number,
  presets: readonly DateRangePreset[],
  separator = "→",
): string {
  const key = matchPreset(range, now);
  if (key) return presets.find((preset) => preset.key === key)?.label ?? key;
  return `${range.from ?? "…"} ${separator} ${range.to ?? "…"}`;
}

/** Whether `from` is on or before `to`; an open-ended bound is always ordered. */
export function isRangeOrdered(range: DateRange): boolean {
  if (!range.from || !range.to) return true;
  return range.from <= range.to;
}
