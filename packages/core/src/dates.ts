/**
 * Days as AMPM writes them (docs/design/peacock-night.md §4): the day, a three-letter English month
 * and the year, "12 Feb 2027", and ranges that never repeat a month or year, "12–14 Feb 2027". The
 * months are a fixed list rather than Intl: a locale's short month can be "Sept", and a phone's
 * JavaScript engine need not carry the locale data at all. Data text sets the month in capitals
 * ("12–14 FEB 2027"); a sentence keeps it as a word ("Valid until 12 Feb 2027").
 */
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** `text` for a date inside a sentence; `data` for a date set as data, with the month in capitals. */
export type DateStyle = "text" | "data";

/**
 * Which day a date-time names. `local`: the day it was on the device, as a timeline reads a moment.
 * `written`: the day its text writes, for a day picked on a calendar and sent as a date-time (a site
 * visit, a milestone's due date: midnight UTC), which a device west of Greenwich would otherwise show
 * as the day before.
 */
export type DayReading = "local" | "written";

export interface DateFormatOptions {
  /** `text` (the default): "12 Feb 2027"; `data`, for the `data` text variant: "12 FEB 2027". */
  readonly style?: DateStyle | undefined;
  /** `local` (the default) or `written`: which day a date-time names. A date is always as written. */
  readonly day?: DayReading | undefined;
}

/** A day on the calendar, `month` 1 for January. */
interface CalendarDay {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** The wire's `isoDate`: a day with no time and no zone. */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
/** The wire's `isoDateTime`: a moment, to the minute or finer, in UTC or with an offset. */
const DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/;

function daysInMonth(year: number, month: number): number {
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  if (month === 2) return isLeapYear ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** The year, month and day a match's first three groups write, if that day exists. */
function writtenDay(match: RegExpExecArray): CalendarDay | null {
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/** A moment is the day it was where the reader is: the device's calendar, as a timeline reads. */
function localDay(iso: string): CalendarDay | null {
  const moment = new Date(iso);
  if (Number.isNaN(moment.getTime())) return null;
  return { year: moment.getFullYear(), month: moment.getMonth() + 1, day: moment.getDate() };
}

/**
 * The day an ISO date or date-time names; null for anything else, rather than a guess. A date-only
 * value is the day as written and never becomes a Date: `new Date("2027-02-12")` is midnight UTC,
 * which a time zone west of Greenwich shows as the day before. A date-time must name a day that
 * exists, since engines roll "2027-02-30T10:00Z" over into March, and a moment that parses (no hour
 * 25), whichever way it is then read.
 */
function calendarDay(iso: string, reading: DayReading): CalendarDay | null {
  const dateOnly = DATE_ONLY.exec(iso);
  if (dateOnly) return writtenDay(dateOnly);
  const dateTime = DATE_TIME.exec(iso);
  const written = dateTime ? writtenDay(dateTime) : null;
  const local = written ? localDay(iso) : null;
  if (!local) return null;
  return reading === "written" ? written : local;
}

function dayAndMonth({ day, month }: CalendarDay, style: DateStyle): string {
  const name = MONTHS[month - 1] ?? "";
  return `${day} ${style === "data" ? name.toUpperCase() : name}`;
}

function fullDay(day: CalendarDay, style: DateStyle): string {
  return `${dayAndMonth(day, style)} ${day.year}`;
}

/**
 * A day: "12 Feb 2027", or "12 FEB 2027" as data. A date-only value ("2027-02-12") is the calendar
 * date it names in every time zone; a date-time ("2026-11-02T06:30:00.000Z") is the day it was on
 * the device, or with `day: "written"` the day its text writes, in every time zone. Anything else
 * comes back as given, so a bad value shows rather than a wrong day.
 *
 *   formatDay("2027-02-12")                           // "12 Feb 2027"
 *   formatDay(event.occurredAt, { style: "data" })    // "3 NOV 2026"
 *   formatDay(visit.scheduledAt, { day: "written" })  // "20 Jan 2027", from "2027-01-20T00:00:00.000Z"
 */
export function formatDay(iso: string, options: DateFormatOptions = {}): string {
  const day = calendarDay(iso, options.day ?? "local");
  return day ? fullDay(day, options.style ?? "text") : iso;
}

/**
 * A span of days with nothing repeated, joined by an en dash: "12–14 Feb 2027", "28 Feb – 2 Mar
 * 2027", "30 Dec 2026 – 2 Jan 2027", one day when both ends fall on it ("12 Feb 2027"), and the
 * month in capitals as data ("12–14 FEB 2027"). The ends are read as `formatDay` reads them (with the
 * same `day` reading) and kept in the order given; when either cannot be read, both ends are written
 * out in full.
 *
 *   formatDayRange("2027-02-12", "2027-02-14")                    // "12–14 Feb 2027"
 *   formatDayRange("2027-02-28", "2027-03-02", { style: "data" }) // "28 FEB – 2 MAR 2027"
 */
export function formatDayRange(
  fromIso: string,
  toIso: string,
  options: DateFormatOptions = {},
): string {
  const style = options.style ?? "text";
  const reading = options.day ?? "local";
  const from = calendarDay(fromIso, reading);
  const to = calendarDay(toIso, reading);
  if (!from || !to) return `${formatDay(fromIso, options)} – ${formatDay(toIso, options)}`;
  if (from.year !== to.year) return `${fullDay(from, style)} – ${fullDay(to, style)}`;
  if (from.month !== to.month) return `${dayAndMonth(from, style)} – ${fullDay(to, style)}`;
  if (from.day !== to.day) return `${from.day}–${fullDay(to, style)}`;
  return fullDay(to, style);
}
