/*
 * Where a hotel is (Module C, D-178): the checks for its Google Maps link and its postal code. Pure, so the
 * API, the staff editor and the public hotel information form apply one rule. A Maps link is stored as
 * given and never fetched by the server: only its scheme, host and path are checked here, with regular
 * expressions rather than URL parsing so the check runs the same in the browser, native and the server.
 */

/** India's six-digit postal code (PIN): six digits, the first one 1 to 9. */
export const INDIA_POSTAL_CODE = /^[1-9][0-9]{5}$/;

/** The longest Maps link a hotel keeps (hotels.maps_url). */
export const MAPS_URL_MAX_LENGTH = 2048;

/**
 * The Google Maps hosts a link may use, each with the paths allowed on it (no open redirects: Google's
 * redirector `/url` is on none of them; maps.google.* takes its root, with a query, or `/maps…`).
 */
const MAPS_ROUTES: readonly { readonly host: RegExp; readonly path: RegExp }[] = [
  { host: /^(?:www\.)?google\.(?:com|co\.in)$/, path: /^\/maps(?:[/?#]|$)/ },
  { host: /^maps\.google\.(?:com|co\.in)$/, path: /^\/(?:maps(?:[/?#]|$)|[?#]|$)/ },
  { host: /^maps\.app\.goo\.gl$/, path: /^\/[A-Za-z0-9_-]+\/?(?:\?[^\s#]*)?$/ },
  { host: /^goo\.gl$/, path: /^\/maps\/[A-Za-z0-9_-]+\/?$/ },
];

/**
 * https, a host with no user info or port, then an optional path; no whitespace and no backslash
 * anywhere (a browser reads a backslash in an https path as a slash).
 */
const HTTPS_LINK = /^https:\/\/([A-Za-z0-9.-]+)(\/[^\s\\]*)?$/;

/** A "." or ".." path segment, percent-encoded or not, which a browser resolves away (WHATWG URL). */
const DOT_SEGMENT = /^(?:\.|%2e){1,2}$/i;

/** Whether the path part (before any query or fragment) has a dot segment, so it could climb out of /maps. */
function hasDotSegment(path: string): boolean {
  const pathname = path.split(/[?#]/, 1)[0] ?? "";
  return pathname.split("/").some((segment) => DOT_SEGMENT.test(segment));
}

/**
 * Whether a link is an https Google Maps link this catalogue accepts: www.google.com/maps…,
 * google.co.in/maps…, maps.google.com/ or /maps…, a maps.app.goo.gl share link or a goo.gl/maps link.
 * The path is matched as written, so one a browser would rewrite (a `..` segment, a backslash) is refused.
 *
 * @example
 * isGoogleMapsUrl("https://maps.app.goo.gl/AbC123xyz"); // true
 * isGoogleMapsUrl("https://www.google.com/url?q=https://example.com"); // false
 * isGoogleMapsUrl("https://www.google.com/maps/../url?q=https://example.com"); // false
 */
export function isGoogleMapsUrl(value: string): boolean {
  if (value.length > MAPS_URL_MAX_LENGTH) return false;
  const match = HTTPS_LINK.exec(value.trim());
  const host = match?.[1]?.toLowerCase();
  if (host === undefined) return false;
  const path = match?.[2] ?? "/";
  if (hasDotSegment(path)) return false;
  return MAPS_ROUTES.some((route) => route.host.test(host) && route.path.test(path));
}

/**
 * A postal code as stored: the spaces people type inside a PIN ("313 001") removed.
 *
 * @example
 * normalisePostalCode(" 313 001 "); // "313001"
 */
export function normalisePostalCode(value: string): string {
  return value.replace(/\s+/g, "");
}

/**
 * Why a postal code does not fit its country, or null when it fits. Only India's rule is known; any
 * other country's code is accepted as typed.
 *
 * @example
 * postalCodeProblem("India", "313001"); // null
 * postalCodeProblem("India", "013001"); // "A PIN code is 6 digits and does not start with 0"
 */
export function postalCodeProblem(
  country: string | null | undefined,
  postalCode: string,
): string | null {
  const isIndia = country?.trim().toLowerCase() === "india";
  if (isIndia && !INDIA_POSTAL_CODE.test(normalisePostalCode(postalCode))) {
    return "A PIN code is 6 digits and does not start with 0";
  }
  return null;
}
