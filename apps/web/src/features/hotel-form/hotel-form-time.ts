import { formatDay } from "@ampm/core";

import { HOTEL_FORM_COPY } from "./hotel-form-copy";

/*
 * When something happened on the form, in the person's own time zone: a colleague's save, a submit. The
 * pages that show these draw them in the browser only (the draft is read there), so the server's time
 * zone never reaches the markup.
 */

const twoDigits = (value: number): string => String(value).padStart(2, "0");

/**
 * The time of day on this device's 24-hour clock.
 *
 * @example
 * timeOfDay("2026-11-26T05:12:00.000Z"); // "10:42" in India
 */
export function timeOfDay(iso: string): string {
  const date = new Date(iso);
  return `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

/**
 * A moment in words, for a sentence: "on 26 Nov 2026 at 10:42".
 *
 * @example
 * `Last saved by Asha Rao ${momentOf(section.lastEditedAt)}`;
 */
export function momentOf(iso: string): string {
  return HOTEL_FORM_COPY.moment(formatDay(iso), timeOfDay(iso));
}
