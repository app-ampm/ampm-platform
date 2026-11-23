import { describe, expect, it } from "vitest";

import {
  areaWrite,
  hasAtMostDecimals,
  SQM_PER_SQFT_DENOMINATOR,
  SQM_PER_SQFT_NUMERATOR,
  sqmFromSqft,
} from "./hotel-units";

/**
 * round(sq ft × 0.09290304), half up, worked out exactly in decimal: sq ft × 9,290,304 hundred-millionths,
 * the reference the converter must match without the binary double's error.
 */
function exactSqm(sqft: number): number {
  const hundredMillionths = BigInt(sqft) * 9_290_304n;
  const whole = hundredMillionths / 100_000_000n;
  const remainder = hundredMillionths % 100_000_000n;
  return Number(remainder * 2n >= 100_000_000n ? whole + 1n : whole);
}

describe("sqmFromSqft", () => {
  it("uses 0.3048² exactly", () => {
    expect(SQM_PER_SQFT_NUMERATOR / SQM_PER_SQFT_DENOMINATOR).toBe(0.09290304);
    expect(SQM_PER_SQFT_NUMERATOR).toBe(381 ** 2);
    expect(SQM_PER_SQFT_DENOMINATOR).toBe(1_250 ** 2);
  });

  it.each([
    0, 1, 5, 6, 10, 538, 1_000, 4_000, 10_764, 35_000, 40_000, 99_999, 1_000_000, 10_000_000,
  ])("rounds %i sq ft as round(sq ft × 0.09290304)", (sqft) => {
    expect(sqmFromSqft(sqft)).toBe(exactSqm(sqft));
    expect(sqmFromSqft(sqft)).toBe(Math.round(sqft * 0.09290304));
  });

  it("rounds an exact half up, at every odd multiple of 781,250 sq ft the bounds allow", () => {
    for (const sqft of [781_250, 2_343_750, 3_906_250, 5_468_750, 7_031_250, 8_593_750]) {
      expect((sqft * SQM_PER_SQFT_NUMERATOR) % SQM_PER_SQFT_DENOMINATOR).toBe(
        SQM_PER_SQFT_DENOMINATOR / 2,
      );
      expect(sqmFromSqft(sqft)).toBe(exactSqm(sqft));
    }
    expect(sqmFromSqft(781_250)).toBe(72_581);
  });

  it("matches the exact rounding across a run of areas", () => {
    for (let sqft = 0; sqft <= 20_000; sqft += 7) expect(sqmFromSqft(sqft)).toBe(exactSqm(sqft));
  });
});

describe("areaWrite (the units write rule, D-178)", () => {
  it("derives the m² from a filled sq ft and ignores an m² sent with it", () => {
    expect(areaWrite({ sqft: 1_000, sqm: 95 }, null)).toEqual({ sqm: 93, sqft: 1_000 });
    expect(areaWrite({ sqft: 1_000 }, 400)).toEqual({ sqm: 93, sqft: 1_000 });
  });

  it("makes an m² set alone the published figure and clears a stored sq ft", () => {
    expect(areaWrite({ sqm: 80 }, 1_000)).toEqual({ sqm: 80, sqft: null });
    expect(areaWrite({ sqm: null }, 1_000)).toEqual({ sqm: null, sqft: null });
  });

  it("leaves the sq ft alone when none is stored", () => {
    expect(areaWrite({ sqm: 80 }, null)).toEqual({ sqm: 80 });
  });

  it("keeps the stored m² when the sq ft alone is cleared", () => {
    expect(areaWrite({ sqft: null }, 1_000)).toEqual({ sqft: null });
    expect(areaWrite({ sqft: null, sqm: 50 }, 1_000)).toEqual({ sqm: 50, sqft: null });
  });

  it("writes nothing when neither figure is set", () => {
    expect(areaWrite({}, 1_000)).toEqual({});
  });
});

describe("hasAtMostDecimals", () => {
  it.each([
    [12, 2, true],
    [12.5, 2, true],
    [12.75, 2, true],
    [0.1 + 0.2, 2, true],
    [1_999.99, 2, true],
    [12.755, 2, false],
    [0.001, 2, false],
    [22.5, 1, true],
    [22.55, 1, false],
  ])("%d to %i places is %s", (value, places, expected) => {
    expect(hasAtMostDecimals(value, places)).toBe(expected);
  });
});
