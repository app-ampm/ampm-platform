import type { RateLimitOptions } from "../../../common/rate-limit/rate-limit.decorator.js";

/*
 * The per-network limits of the hotel form's public routes (D-189 §4; plan §7.1), counted by the route's
 * @RateLimit before the handler (a hotel office shares one network, so they are generous where the work
 * is cheap). Every one fails closed but sign-out's, which D-149 keeps open: the open reads D-149 lets fail
 * open are made fail-closed here, as the plan records. The code routes add their own limits per mobile,
 * per request and per day (HotelFormLimits), and the session routes their write windows.
 */

const MINUTE = 60_000;

/** Opening a link: what state it is in. */
export const HOTEL_FORM_OPEN: RateLimitOptions = {
  name: "hotel_form.open",
  limit: 30,
  windowMs: MINUTE,
  failClosed: true,
};

/** Asking for a code: each costs a bot check, a challenge and, in SMS mode, a text message. */
export const HOTEL_FORM_CODES: RateLimitOptions = {
  name: "hotel_form.codes",
  limit: 10,
  windowMs: MINUTE,
  failClosed: true,
};

/** Trying a code: each spends one of the challenge's five tries. */
export const HOTEL_FORM_VERIFY: RateLimitOptions = {
  name: "hotel_form.verify",
  limit: 20,
  windowMs: MINUTE,
  failClosed: true,
};

/** A signed-in page's reads (me now; the draft in Slice 8). */
export const HOTEL_FORM_READS: RateLimitOptions = {
  name: "hotel_form.reads",
  limit: 120,
  windowMs: MINUTE,
  failClosed: true,
};

/** A signed-in page's writes, beyond each session's own write window. */
export const HOTEL_FORM_WRITES: RateLimitOptions = {
  name: "hotel_form.writes",
  limit: 120,
  windowMs: MINUTE,
  failClosed: true,
};

/** Signing out: fails open, so a broken limiter never keeps a session alive (D-149). */
export const HOTEL_FORM_SIGN_OUT: RateLimitOptions = {
  name: "hotel_form.sign_out",
  limit: 30,
  windowMs: MINUTE,
  failClosed: false,
};
