import { errors, HOTEL_FORM_ERRORS } from "@ampm/core";

/**
 * A code's refusal (D-189 §2): every case reads the same (wrong, used, replaced, expired, out of tries, or
 * another request's), so the answer never tells which.
 *
 * @example
 * if (!(await challenges.reserveTry(id, now))) throw invalidCode();
 */
export function invalidCode(): Error {
  return errors.unauthenticated(HOTEL_FORM_ERRORS.invalidCode);
}
