import { afterEach, describe, expect, it, vi } from "vitest";

import { formatDay, formatDayRange, type DateFormatOptions } from "./dates";

const DATA: DateFormatOptions = { style: "data" };
const WRITTEN: DateFormatOptions = { day: "written" };

/** A moment built from the device's own calendar, so the expected day holds in any time zone. */
const localMoment = (year: number, monthIndex: number, day: number, hour: number): string =>
  new Date(year, monthIndex, day, hour, 30).toISOString();

describe("formatDay", () => {
  it("writes the day, a three-letter month and the year", () => {
    expect(formatDay("2027-02-12")).toBe("12 Feb 2027");
    expect(formatDay("2027-03-02")).toBe("2 Mar 2027");
    expect(formatDay("2026-12-31")).toBe("31 Dec 2026");
  });

  it("uses the same three letters for every month, never a locale's 'Sept'", () => {
    const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
    months.forEach((month, index) => {
      const iso = `2027-${String(index + 1).padStart(2, "0")}-01`;
      expect(formatDay(iso)).toBe(`1 ${month} 2027`);
      expect(formatDay(iso, DATA)).toBe(`1 ${month.toUpperCase()} 2027`);
    });
  });

  it("sets the month in capitals as data, and in a sentence by default", () => {
    expect(formatDay("2027-09-12", DATA)).toBe("12 SEP 2027");
    expect(formatDay("2027-09-12", { style: "text" })).toBe("12 Sep 2027");
    expect(formatDay("2027-09-12", {})).toBe("12 Sep 2027");
  });

  it("reads a date-time as the day it was on the device", () => {
    expect(formatDay(localMoment(2026, 10, 2, 6))).toBe("2 Nov 2026");
    expect(formatDay(localMoment(2026, 10, 2, 23), DATA)).toBe("2 NOV 2026");
    expect(formatDay("2026-11-02T06:30")).toBe("2 Nov 2026");
  });

  it("knows leap years", () => {
    expect(formatDay("2028-02-29")).toBe("29 Feb 2028");
    expect(formatDay("2000-02-29")).toBe("29 Feb 2000");
    expect(formatDay("2027-02-29")).toBe("2027-02-29");
    expect(formatDay("2100-02-29")).toBe("2100-02-29");
    expect(formatDay(localMoment(2028, 1, 29, 12))).toBe("29 Feb 2028");
  });

  it("gives back a value that names no day rather than guessing one", () => {
    for (const value of ["soon", "", "2", "12/02/2027", "2027-02-30", "2027-13-01", "2027-00-10"]) {
      expect(formatDay(value)).toBe(value);
      expect(formatDay(value, DATA)).toBe(value);
    }
    for (const value of ["2027-02-12T25:00:00.000Z", "2027-02-30T10:00:00Z", "2027-02-29T10:00Z"]) {
      expect(formatDay(value)).toBe(value);
      expect(formatDay(value, WRITTEN)).toBe(value);
    }
  });

  it("keeps a date-only value as written whichever reading is asked for", () => {
    expect(formatDay("2027-02-12", WRITTEN)).toBe("12 Feb 2027");
    expect(formatDay("2027-02-12", { day: "local", style: "data" })).toBe("12 FEB 2027");
  });
});

describe("formatDayRange", () => {
  it("never repeats a month or a year", () => {
    expect(formatDayRange("2027-02-12", "2027-02-14")).toBe("12–14 Feb 2027");
    expect(formatDayRange("2027-02-28", "2027-03-02")).toBe("28 Feb – 2 Mar 2027");
    expect(formatDayRange("2026-12-30", "2027-01-02")).toBe("30 Dec 2026 – 2 Jan 2027");
  });

  it("writes one day when both ends fall on it", () => {
    expect(formatDayRange("2027-02-12", "2027-02-12")).toBe("12 Feb 2027");
    expect(formatDayRange("2027-02-12", localMoment(2027, 1, 12, 18))).toBe("12 Feb 2027");
  });

  it("sets the months in capitals as data", () => {
    expect(formatDayRange("2027-02-12", "2027-02-14", DATA)).toBe("12–14 FEB 2027");
    expect(formatDayRange("2027-02-28", "2027-03-02", DATA)).toBe("28 FEB – 2 MAR 2027");
    expect(formatDayRange("2027-12-30", "2028-01-02", DATA)).toBe("30 DEC 2027 – 2 JAN 2028");
    expect(formatDayRange("2027-09-12", "2027-09-14", DATA)).toBe("12–14 SEP 2027");
  });

  it("compacts date-times by the device's days", () => {
    expect(formatDayRange(localMoment(2026, 10, 2, 9), localMoment(2026, 10, 4, 21))).toBe(
      "2–4 Nov 2026",
    );
  });

  it("writes both ends in full when either names no day", () => {
    expect(formatDayRange("soon", "2027-02-14")).toBe("soon – 14 Feb 2027");
    expect(formatDayRange("2027-02-12", "later", DATA)).toBe("12 FEB 2027 – later");
  });
});

describe("time zones", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps a calendar date on its day west and east of Greenwich", () => {
    for (const zone of ["America/Los_Angeles", "Pacific/Pago_Pago", "Pacific/Kiritimati"]) {
      vi.stubEnv("TZ", zone);
      expect(formatDay("2027-02-12")).toBe("12 Feb 2027");
      expect(formatDayRange("2027-02-28", "2027-03-02")).toBe("28 Feb – 2 Mar 2027");
      expect(formatDayRange("2026-12-31", "2027-01-01", DATA)).toBe("31 DEC 2026 – 1 JAN 2027");
    }
  });

  it("dates a moment by the reader's own calendar", () => {
    vi.stubEnv("TZ", "Asia/Kolkata");
    expect(formatDay("2026-11-01T20:00:00.000Z")).toBe("2 Nov 2026");
    vi.stubEnv("TZ", "America/Los_Angeles");
    expect(formatDay("2026-11-02T06:30:00.000Z")).toBe("1 Nov 2026");
  });

  it("keeps a day sent as a date-time on the day it writes, when asked, west and east alike", () => {
    // A due date picked as 31 Jan goes out as midnight UTC, which New York's calendar puts on 30 Jan.
    vi.stubEnv("TZ", "America/New_York");
    expect(formatDay("2027-01-31T00:00:00.000Z")).toBe("30 Jan 2027");
    for (const zone of ["America/New_York", "Asia/Kolkata", "Pacific/Kiritimati"]) {
      vi.stubEnv("TZ", zone);
      expect(formatDay("2027-01-31T00:00:00.000Z", WRITTEN)).toBe("31 Jan 2027");
      expect(formatDay("2027-01-31T23:30:00.000Z", { ...WRITTEN, ...DATA })).toBe("31 JAN 2027");
      expect(formatDay("2027-01-31T21:00:00-05:00", WRITTEN)).toBe("31 Jan 2027");
      expect(formatDayRange("2027-01-31T00:00:00.000Z", "2027-02-02T00:00:00.000Z", WRITTEN)).toBe(
        "31 Jan – 2 Feb 2027",
      );
    }
  });
});
