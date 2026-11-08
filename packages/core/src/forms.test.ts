import { describe, expect, it } from "vitest";

import {
  isIsoDate,
  isoDateTimeFromDate,
  moneyFromRupees,
  rupeesFromMinor,
  rupeesToMinor,
} from "./forms";

describe("rupeesToMinor", () => {
  it("parses whole and fractional rupees to paise with no floating point", () => {
    expect(rupeesToMinor("25000")).toBe(2500000);
    expect(rupeesToMinor("1234.50")).toBe(123450);
    expect(rupeesToMinor("12,50,000")).toBe(125000000);
    expect(rupeesToMinor("₹ 25000")).toBe(2500000);
    expect(rupeesToMinor("0.05")).toBe(5);
  });

  it("rejects blanks, negatives and over-two-decimal values", () => {
    expect(rupeesToMinor("")).toBeNull();
    expect(rupeesToMinor("-5")).toBeNull();
    expect(rupeesToMinor("1.234")).toBeNull();
    expect(rupeesToMinor("abc")).toBeNull();
  });
});

describe("moneyFromRupees", () => {
  it("builds an INR Money object, or null when invalid", () => {
    expect(moneyFromRupees("16000")).toEqual({ minor: 1600000, currency: "INR" });
    expect(moneyFromRupees("nope")).toBeNull();
  });
});

describe("rupeesFromMinor", () => {
  it("renders paise back to the rupees text", () => {
    expect(rupeesFromMinor(1600000)).toBe("16000");
    expect(rupeesFromMinor(123450)).toBe("1234.50");
    expect(rupeesFromMinor(5)).toBe("0.05");
    expect(rupeesFromMinor(0)).toBe("0");
  });

  it("round-trips with rupeesToMinor", () => {
    for (const minor of [0, 5, 123450, 1600000, 999999999]) {
      expect(rupeesToMinor(rupeesFromMinor(minor))).toBe(minor);
    }
  });
});

describe("isIsoDate", () => {
  it("accepts real YYYY-MM-DD dates and rejects impossible or misformatted ones", () => {
    expect(isIsoDate("2027-01-01")).toBe(true);
    expect(isIsoDate("2027-02-30")).toBe(false);
    expect(isIsoDate("2027-1-1")).toBe(false);
    expect(isIsoDate("01-01-2027")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });
});

describe("isoDateTimeFromDate", () => {
  it("renders a date as midnight UTC", () => {
    expect(isoDateTimeFromDate("2027-01-01")).toBe("2027-01-01T00:00:00.000Z");
  });
});
