import { describe, expect, it } from "vitest";

import { formatCountdown, secondsLeft, spokenCountdown } from "./countdown";

describe("a countdown's words", () => {
  it("shows minutes and seconds, and says them in words", () => {
    expect([0, 5, 30, 65, 600].map(formatCountdown)).toEqual([
      "0:00",
      "0:05",
      "0:30",
      "1:05",
      "10:00",
    ]);
    expect([1, 30, 60, 61, 125].map(spokenCountdown)).toEqual([
      "1 second",
      "30 seconds",
      "1 minute",
      "1 minute 1 second",
      "2 minutes 5 seconds",
    ]);
  });
});

describe("seconds left", () => {
  it("counts whole seconds up to a deadline, a part second as a whole one, and stops at 0", () => {
    expect(secondsLeft(10_000, 0)).toBe(10);
    expect(secondsLeft(10_000, 9_001)).toBe(1);
    expect(secondsLeft(10_000, 10_000)).toBe(0);
    expect(secondsLeft(10_000, 25_000)).toBe(0);
  });

  it("has nothing to count without a deadline", () => {
    expect(secondsLeft(null, 5_000)).toBe(0);
  });
});
