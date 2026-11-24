/*
 * A hotel contact's phone, stored in E.164 (D-178; docs/planning/hotel-information-form-plan.md §6.2).
 * Pure, so the staff sheet previews the saved form and the API stores it by one rule. Unlike client
 * sign-in's `indianPhone`, it takes what a hotel's switchboard lists: a landline with its area code, a
 * mobile, or a 1800 toll-free number, India (+91) by default. An extension is refused, because a stored
 * number must be diallable as it stands; the extension goes in the contact's role title.
 */

/** Why a phone is refused, in the words the staff sheet and the API both use. */
export const HOTEL_PHONE_REFUSAL =
  "Enter a full phone number such as +91 141 234 5678. Put an extension in the role title.";

/**
 * What people type between digits: whitespace (a non-breaking space included), hyphens (with the
 * typographic hyphens and dashes a PDF or a word processor puts in their place: U+2010 to U+2014 and the
 * minus sign U+2212), dots and brackets.
 */
const SEPARATORS = /[\s.()‐-—−-]/g;

/** A plus, then 8 to 15 digits, the first not a zero: what E.164 allows. */
const E164 = /^\+[1-9]\d{7,14}$/;

const DIGITS_ONLY = /^\d+$/;

/** India's country code followed by the trunk 0, as in "+91 (0)141 …": the 0 is never dialled after it. */
const INDIA_WITH_TRUNK_ZERO = /^910/;

/** A number written with its country code, after the + or 00. */
function international(digits: string): string | null {
  if (!DIGITS_ONLY.test(digits)) return null;
  return `+${digits.replace(INDIA_WITH_TRUNK_ZERO, "91")}`;
}

/**
 * A number written with digits only, read as Indian: one trunk 0 dropped, then ten digits, twelve
 * starting 91, or an eleven-digit 1800 toll-free number (a ten-digit one is already ten digits).
 */
function national(digits: string): string | null {
  const number = digits.startsWith("0") ? digits.slice(1) : digits;
  if (number.length === 10) return `+91${number}`;
  if (number.length === 12 && number.startsWith("91")) return `+${number}`;
  if (number.length === 11 && number.startsWith("1800")) return `+91${number}`;
  return null;
}

/**
 * A hotel contact's phone in E.164, or null when it does not read as one full number (an extension, two
 * numbers, letters, too few digits): the caller then refuses it with {@link HOTEL_PHONE_REFUSAL}. Spaces,
 * hyphens, dots and brackets are dropped; a leading + must carry 8 to 15 digits, and a leading 00 reads
 * as +; digits alone are Indian.
 *
 * @example
 * normaliseHotelPhone("0141-234 5678"); // "+911412345678"
 * normaliseHotelPhone("1800 123 4567"); // "+9118001234567"
 * normaliseHotelPhone("+91 141 234 5678 ext 12"); // null
 */
export function normaliseHotelPhone(input: string): string | null {
  const compact = input.replace(SEPARATORS, "");
  let e164: string | null;
  if (compact.startsWith("+")) e164 = international(compact.slice(1));
  else if (compact.startsWith("00")) e164 = international(compact.slice(2));
  else e164 = DIGITS_ONLY.test(compact) ? national(compact) : null;
  return e164 !== null && E164.test(e164) ? e164 : null;
}
