import { NextResponse, type NextRequest } from "next/server";

import { TURNSTILE_ORIGIN } from "./components/bot-check/turnstile";
import { env } from "./env";

/** The API's origin (scheme://host:port) from NEXT_PUBLIC_API_URL, for connect-src and the form's img-src. */
const API_ORIGIN = new URL(env.NEXT_PUBLIC_API_URL).origin;

/** Where the hotel information form lives (D-175): `/hotel-form` and every page under it. */
const HOTEL_FORM_PATH = "/hotel-form";

/**
 * Whether a path is one of the hotel form's pages, which send stricter headers than the site's.
 *
 * @example
 * isHotelFormPath("/hotel-form/overview"); // true
 */
export function isHotelFormPath(pathname: string): boolean {
  return pathname === HOTEL_FORM_PATH || pathname.startsWith(`${HOTEL_FORM_PATH}/`);
}

/**
 * What the hotel form's pages send besides the CSP (D-189 §8, HF-G10): no referrer at all, so no request
 * from the form names it; no index, follow or archive, so no search engine keeps a page reached from a
 * hotel's link; and no store, so no cache keeps a page with a contributor's answers. next.config.ts
 * leaves its site-wide Referrer-Policy off these paths, so no value is sent twice.
 */
export const HOTEL_FORM_HEADERS: Readonly<Record<string, string>> = {
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow, noarchive",
  "cache-control": "no-store",
};

/** The policy for one response: the site's, with the API origin in img-src on the hotel form's pages. */
function contentSecurityPolicy(nonce: string, isHotelForm: boolean): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${TURNSTILE_ORIGIN}`,
    `style-src 'self' 'unsafe-inline'`,
    // The hotel form shows the photos and floor plans contributors upload, served by the API (D-175).
    `img-src 'self' data: blob:${isHotelForm ? ` ${API_ORIGIN}` : ""}`,
    `font-src 'self'`,
    // The enquiry form (PUB-06) and the hotel form post to the API, a different origin than the site in
    // development and under Caddy, so the API origin must be allowed or the browser blocks the fetch (C2).
    `connect-src 'self' ${API_ORIGIN}`,
    `frame-src ${TURNSTILE_ORIGIN}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
  ].join("; ");
}

/**
 * A per-request nonce and a strict Content-Security-Policy with no inline scripts (security.md). Next
 * reads the nonce from the request's CSP header and stamps it on its own bootstrap scripts; the browser
 * enforces the same policy from the response header. `strict-dynamic` lets those nonced scripts load
 * what they need without an allow-list. Styles stay `unsafe-inline` (a style is not a script-XSS vector);
 * HSTS is Caddy's (infra.md).
 *
 * The site's bot check (the enquiry form, PUB-06; the hotel form's code request) is Cloudflare Turnstile:
 * the form's own script adds Turnstile's script, which `strict-dynamic` trusts, and Turnstile's origin in
 * script-src covers browsers that do not know `strict-dynamic` (Cloudflare's CSP guidance). Its challenge
 * runs in an iframe from that origin, the only frame the site allows, and its requests are the iframe's
 * own, so connect-src does not name it. The hotel form's pages add their own headers (HOTEL_FORM_HEADERS).
 */
export function middleware(request: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID());
  const isHotelForm = isHotelFormPath(request.nextUrl.pathname);
  const csp = contentSecurityPolicy(nonce, isHotelForm);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", csp);
  if (isHotelForm)
    for (const [name, value] of Object.entries(HOTEL_FORM_HEADERS))
      response.headers.set(name, value);
  return response;
}

export const config = {
  // Every page and route, but not Next's static assets or the image optimizer (they carry no scripts).
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico).*)" }],
};
