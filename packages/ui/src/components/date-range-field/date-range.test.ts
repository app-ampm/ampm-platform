import {
  DATE_RANGE_PRESET_KEYS,
  isRangeOrdered,
  matchPreset,
  rangeForPreset,
  rangeLabel,
  type DateRangePreset,
} from "./date-range";

// A fixed "now": 2026-11-09T12:00:00Z, so the preset ranges are deterministic.
const NOW = Date.UTC(2026, 10, 9, 12, 0, 0);
const PRESETS: readonly DateRangePreset[] = DATE_RANGE_PRESET_KEYS.map((key) => ({
  key,
  label: key,
}));

describe("date-range", () => {
  it("maps each preset to its range at a fixed now", () => {
    expect(rangeForPreset("all", NOW)).toEqual({});
    expect(rangeForPreset("last_7", NOW)).toEqual({ from: "2026-11-02", to: "2026-11-09" });
    expect(rangeForPreset("last_30", NOW)).toEqual({ from: "2026-10-10", to: "2026-11-09" });
    expect(rangeForPreset("last_90", NOW)).toEqual({ from: "2026-08-11", to: "2026-11-09" });
    expect(rangeForPreset("this_month", NOW)).toEqual({ from: "2026-11-01", to: "2026-11-09" });
    expect(rangeForPreset("this_year", NOW)).toEqual({ from: "2026-01-01", to: "2026-11-09" });
  });

  it("zero-pads a single-digit month for this_month", () => {
    const march = Date.UTC(2026, 2, 15, 9, 0, 0);
    expect(rangeForPreset("this_month", march)).toEqual({ from: "2026-03-01", to: "2026-03-15" });
  });

  it("finds the preset a range matches, or null for a custom one", () => {
    expect(matchPreset({}, NOW)).toBe("all");
    expect(matchPreset({ from: "2026-11-02", to: "2026-11-09" }, NOW)).toBe("last_7");
    expect(matchPreset({ from: "2020-01-01", to: "2020-02-01" }, NOW)).toBeNull();
  });

  it("labels a range by its preset, or as from → to", () => {
    expect(rangeLabel({}, NOW, PRESETS)).toBe("all");
    expect(rangeLabel({ from: "2026-11-01", to: "2026-11-09" }, NOW, PRESETS)).toBe("this_month");
    expect(rangeLabel({ from: "2020-01-01", to: "2020-02-01" }, NOW, PRESETS)).toBe(
      "2020-01-01 → 2020-02-01",
    );
  });

  it("treats an open-ended range as ordered and catches an inverted one", () => {
    expect(isRangeOrdered({ from: "2026-01-01", to: "2026-02-01" })).toBe(true);
    expect(isRangeOrdered({ from: "2026-02-01", to: "2026-01-01" })).toBe(false);
    expect(isRangeOrdered({ from: "2026-01-01" })).toBe(true);
    expect(isRangeOrdered({})).toBe(true);
  });
});
