import { isIsoDate, type HotelEnquiryCreateRequest } from "@ampm/core";

/** What the person has typed into the CP-07 form, before it becomes a request. */
export interface NewRequestDraft {
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly guests: string;
  readonly rooms: string;
  readonly functions: string;
  readonly contactPreference: string;
  readonly notes: string;
  readonly datesFlexible: boolean;
}

export const EMPTY_REQUEST_DRAFT: NewRequestDraft = {
  dateFrom: "",
  dateTo: "",
  guests: "",
  rooms: "",
  functions: "",
  contactPreference: "",
  notes: "",
  datesFlexible: false,
};

export interface DateErrors {
  readonly dateFrom?: string | undefined;
  readonly dateTo?: string | undefined;
}

/** Every inline error the form can show: the two dates and the optional rooms count. */
export interface FormErrors extends DateErrors {
  readonly rooms?: string | undefined;
}

/** The YYYY-MM-DD calendar-date check, now shared in `@ampm/core`; re-exported for this form's callers. */
export { isIsoDate };

/** An optional whole-number count: digits only, so no sign, decimal point or exponent slips through. */
const ROOM_COUNT = /^\d+$/;
const ROOMS_MESSAGE = "Enter rooms as a whole number, or leave it blank.";

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
 * The optional rooms count's inline error: blank is fine, but anything typed must be a whole number
 * (0 or more). Returns undefined when there is nothing to flag.
 */
export function roomsError(rooms: string): string | undefined {
  const value = rooms.trim();
  if (value === "") return undefined;
  return ROOM_COUNT.test(value) ? undefined : ROOMS_MESSAGE;
}

/** Every inline error the form shows, derived from the current draft. */
export function formErrors(draft: NewRequestDraft): FormErrors {
  return { ...dateErrors(draft.dateFrom, draft.dateTo), rooms: roomsError(draft.rooms) };
}

/**
 * The request to send for this hotel, or null while the form is incomplete or invalid (the submit
 * stays disabled): two valid dates in order, at least one guest, and — if a rooms count was typed — a
 * whole number. Rooms, contact preference and notes are optional; blank ones are sent as null.
 */
export function toCreateRequest(
  hotelId: string,
  draft: NewRequestDraft,
): HotelEnquiryCreateRequest | null {
  const dateFrom = draft.dateFrom.trim();
  const dateTo = draft.dateTo.trim();
  const rooms = draft.rooms.trim();
  const guestEstimate = Number.parseInt(draft.guests, 10);
  const datesValid = isIsoDate(dateFrom) && isIsoDate(dateTo) && dateTo >= dateFrom;
  if (!datesValid || !Number.isInteger(guestEstimate) || guestEstimate < 1) return null;
  if (rooms !== "" && !ROOM_COUNT.test(rooms)) return null;
  const functions = draft.functions.trim();
  const contactPreference = draft.contactPreference.trim();
  const notes = draft.notes.trim();
  return {
    hotelId,
    dateFrom,
    dateTo,
    datesFlexible: draft.datesFlexible,
    guestEstimate,
    roomsRequired: rooms === "" ? null : Number.parseInt(rooms, 10),
    functionsSummary: functions.length > 0 ? functions : null,
    contactPreference: contactPreference.length > 0 ? contactPreference : null,
    notesClient: notes.length > 0 ? notes : null,
  };
}
