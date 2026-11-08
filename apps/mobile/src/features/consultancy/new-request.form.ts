import { isIsoDate, type HotelEnquiryCreateRequest } from "@ampm/core";

/** What the person has typed into the CP-07 form, before it becomes a request. */
export interface NewRequestDraft {
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly guests: string;
  readonly functions: string;
  readonly datesFlexible: boolean;
}

export const EMPTY_REQUEST_DRAFT: NewRequestDraft = {
  dateFrom: "",
  dateTo: "",
  guests: "",
  functions: "",
  datesFlexible: false,
};

export interface DateErrors {
  readonly dateFrom?: string | undefined;
  readonly dateTo?: string | undefined;
}

/** The YYYY-MM-DD calendar-date check, now shared in `@ampm/core`; re-exported for this form's callers. */
export { isIsoDate };

/**
 * The inline errors for the two dates, each naming its field. They appear once both dates are entered
 * (nothing shows while the first is still being typed); check-out before check-in is check-out's error.
 * String comparison is chronological for valid YYYY-MM-DD values.
 */
export function dateErrors(dateFrom: string, dateTo: string): DateErrors {
  const from = dateFrom.trim();
  const to = dateTo.trim();
  if (from === "" || to === "") return {};
  const fromValid = isIsoDate(from);
  if (!isIsoDate(to)) {
    return {
      dateFrom: fromValid ? undefined : "Enter check-in as a real date, YYYY-MM-DD.",
      dateTo: "Enter check-out as a real date, YYYY-MM-DD.",
    };
  }
  if (!fromValid) return { dateFrom: "Enter check-in as a real date, YYYY-MM-DD." };
  return to < from ? { dateTo: "Check-out must be on or after check-in." } : {};
}

/**
 * The request to send for this hotel, or null while the form is incomplete or invalid (the submit
 * stays disabled): two valid dates in order and at least one guest. Rooms, contact preference and
 * notes are not asked for here.
 */
export function toCreateRequest(
  hotelId: string,
  draft: NewRequestDraft,
): HotelEnquiryCreateRequest | null {
  const dateFrom = draft.dateFrom.trim();
  const dateTo = draft.dateTo.trim();
  const guestEstimate = Number.parseInt(draft.guests, 10);
  const datesValid = isIsoDate(dateFrom) && isIsoDate(dateTo) && dateTo >= dateFrom;
  if (!datesValid || !Number.isInteger(guestEstimate) || guestEstimate < 1) return null;
  const functions = draft.functions.trim();
  return {
    hotelId,
    dateFrom,
    dateTo,
    datesFlexible: draft.datesFlexible,
    guestEstimate,
    roomsRequired: null,
    functionsSummary: functions.length > 0 ? functions : null,
    contactPreference: null,
    notesClient: null,
  };
}
