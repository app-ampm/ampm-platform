import { errors, HOTEL_PHONE_REFUSAL, normaliseHotelPhone } from "@ampm/core";

/**
 * The phone a hotel contact write stores (D-178): E.164 by core `normaliseHotelPhone`, or, when the write
 * repeats the phone the contact already stores, that phone as it is, so a legacy free-text phone never
 * blocks an unrelated edit. Undefined leaves the phone, and null or a blank (the schema trims) clears it. A
 * phone that does not read as one full number is a 400 naming `phone`, worded as the staff sheet words it.
 *
 * @example
 * contactPhone("0141-234 5678", null); // "+911412345678"
 * contactPhone("Front desk ext 12", "Front desk ext 12"); // kept as stored
 * contactPhone("+91 141 234 5678 ext 12", null); // throws validation_failed on phone
 */
export function contactPhone(
  phone: string | null | undefined,
  stored: string | null,
): string | null | undefined {
  if (phone === undefined || phone === null) return phone;
  if (phone === "") return null;
  if (stored !== null && phone === stored.trim()) return stored;
  const e164 = normaliseHotelPhone(phone);
  if (e164 === null) {
    throw errors.validation([{ path: "phone", message: HOTEL_PHONE_REFUSAL }], HOTEL_PHONE_REFUSAL);
  }
  return e164;
}
