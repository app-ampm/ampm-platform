import { normalisePostalCode, type HotelUpdateRequest } from "@ampm/core";

import { HOTEL_PROFILE_KEYS, type HotelProfileKey } from "./hotel-write.js";

/*
 * Whether a written value changes what a hotel stores (D-178, D-181): one rule for the import's plan and
 * the staff update's audit, so both name a field changed only when it is. Pure. A value is compared as
 * its column keeps it: a fixed-point number at the column's scale, rounded from its decimal digits half
 * away from zero as PostgreSQL rounds a numeric (never the binary double, which rounds 8.1864485 down);
 * a list entry by entry in order; text trimmed; a postal code without its spaces.
 */

/** The decimal places each fixed-point column keeps (latitude and longitude 6, distances 1). */
const SCALE: Partial<Record<HotelProfileKey, number>> = {
  latitude: 6,
  longitude: 6,
  airportDistanceKm: 1,
  railwayDistanceKm: 1,
  cityCentreDistanceKm: 1,
};

/** A number's shortest decimal form, as `String` writes it: sign, digits, fraction and exponent. */
const DECIMAL_FORM = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/;

function roundHalfUp(digits: bigint, divisor: bigint): bigint {
  const quotient = digits / divisor;
  return (digits % divisor) * 2n >= divisor ? quotient + 1n : quotient;
}

/**
 * A number as the whole count of its column's smallest unit (10^-scale), rounded half away from zero
 * from the decimal form the database is sent, as a numeric(p, scale) column stores it; null for a value
 * with no decimal form (NaN, an infinity).
 *
 * @example
 * columnUnits(8.1864485, 6); // 8186449n, where Math.round(8.1864485 * 1e6) gives 8186448
 */
export function columnUnits(value: number, scale: number): bigint | null {
  const match = DECIMAL_FORM.exec(String(value));
  if (match === null) return null;
  const [, sign, whole = "", fraction = "", exponent = "0"] = match;
  const digits = BigInt(whole + fraction);
  const shift = Number(exponent) - fraction.length + scale;
  const units =
    shift >= 0 ? digits * 10n ** BigInt(shift) : roundHalfUp(digits, 10n ** BigInt(-shift));
  return sign === "-" ? -units : units;
}

/**
 * A number as a numeric(p, scale) column stores it: rounded half away from zero from its decimal form
 * (`columnUnits`), so a value carrying a binary double's noise reads as what the column will hold.
 *
 * @example
 * atScale(30.000000000000004, 2); // 30
 * atScale(12.350000001, 2); // 12.35
 */
export function atScale(value: number, scale: number): number {
  const units = columnUnits(value, scale);
  return units === null ? value : Number(units) / 10 ** scale;
}

/**
 * Whether a value holds what is stored, compared as the column keeps it.
 *
 * @example
 * sameValue("latitude", 24.5760001, 24.576); // true: the column keeps 6 places
 */
export function sameValue(key: HotelProfileKey, next: unknown, current: unknown): boolean {
  if (Array.isArray(next)) {
    return (
      Array.isArray(current) &&
      next.length === current.length &&
      next.every((item, i) => item === current[i])
    );
  }
  const scale = SCALE[key];
  if (scale !== undefined && typeof next === "number" && typeof current === "number") {
    const units = columnUnits(next, scale);
    return units !== null && units === columnUnits(current, scale);
  }
  if (typeof next === "string" && typeof current === "string") {
    return next === (key === "postalCode" ? normalisePostalCode(current) : current.trim());
  }
  return next === current;
}

/** A stored hotel as the staff models read it (numbers and string lists), its notes included. */
export type StoredHotelValues = Readonly<
  Partial<Record<HotelProfileKey | "destinationId", unknown>>
>;

/**
 * The fields a staff update changes: those it names whose value differs from what is stored, a cleared
 * one included, in the import template's order after its destination. A field sent with the value it
 * already has is not a change, so an editor that sends its whole form names only what moved.
 *
 * @example
 * changedRequestFields({ minNights: 3, city: "Udaipur" }, { minNights: 2, city: "Udaipur" }); // ["minNights"]
 */
export function changedRequestFields(
  request: HotelUpdateRequest,
  stored: StoredHotelValues,
): string[] {
  const moves =
    request.destinationId !== undefined && request.destinationId !== stored.destinationId;
  const changed = HOTEL_PROFILE_KEYS.filter(
    (key) => request[key] !== undefined && !sameValue(key, request[key], stored[key]),
  );
  return moves ? ["destinationId", ...changed] : changed;
}
