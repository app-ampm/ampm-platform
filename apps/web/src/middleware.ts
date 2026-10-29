import { NextResponse, type NextRequest } from "next/server";

/**
 * A per-request nonce and a strict Content-Security-Policy with no inline scripts (security.md). Next
 * reads the nonce from the request's CSP header and stamps it on its own bootstrap scripts; the browser
 * enforces the same policy from the response header. `strict-dynamic` lets those nonced scripts load
 * what they need without an allow-list. Styles stay `unsafe-inline` (a style is not a script-XSS vector);
 * HSTS is Caddy's (infra.md).
 */
export function middleware(request: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID());
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  // Every page and route, but not Next's static assets or the image optimizer (they carry no scripts).
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico).*)" }],
};
