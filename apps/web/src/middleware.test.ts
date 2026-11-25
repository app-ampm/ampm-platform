import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { HOTEL_FORM_HEADERS, isHotelFormPath, middleware } from "./middleware.js";

/** One directive of a response's CSP, e.g. "frame-src https://…", or "" when it has none. */
function directive(response: Response, name: string): string {
  const csp = response.headers.get("content-security-policy") ?? "";
  return (
    csp
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name} `)) ?? ""
  );
}

describe("web security middleware", () => {
  it("sets a per-request nonce CSP with no inline scripts", () => {
    const response = middleware(new NextRequest("https://app.example/"));
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toMatch(/script-src [^;]*'nonce-[^']+'/);
    expect(csp).toContain("'strict-dynamic'");
    // The whole point: scripts never run from inline source.
    expect(csp).not.toMatch(/script-src [^;]*'unsafe-inline'/);
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("allows the API origin in connect-src so the enquiry form can post (C2)", () => {
    const response = middleware(new NextRequest("https://app.example/"));
    const csp = response.headers.get("content-security-policy") ?? "";
    const connectSrc = csp
      .split(";")
      .find((directive) => directive.trim().startsWith("connect-src"));
    // The default API origin (NEXT_PUBLIC_API_URL) must be present, not just 'self'.
    expect(connectSrc).toContain("http://localhost:3900");
  });

  it("lets the enquiry form's bot check, Cloudflare Turnstile, load and frame its challenge (PUB-06)", () => {
    const response = middleware(new NextRequest("https://app.example/contact"));
    const scriptSrc = directive(response, "script-src");
    // Still nonce-based and strict-dynamic; Turnstile's origin covers browsers without strict-dynamic.
    expect(scriptSrc).toMatch(
      /^script-src 'self' 'nonce-[^']+' 'strict-dynamic' https:\/\/challenges\.cloudflare\.com$/,
    );
    // Its challenge is the only frame the site allows (default-src would otherwise refuse it).
    expect(directive(response, "frame-src")).toBe("frame-src https://challenges.cloudflare.com");
    // Turnstile's requests are its iframe's own: connect-src stays the site and the API.
    expect(directive(response, "connect-src")).toBe("connect-src 'self' http://localhost:3900");
  });

  it("gives each request a different nonce", () => {
    const first = middleware(new NextRequest("https://app.example/")).headers.get(
      "content-security-policy",
    );
    const second = middleware(new NextRequest("https://app.example/")).headers.get(
      "content-security-policy",
    );
    expect(first).not.toBe(second);
  });

  it("forwards the same nonce on the request so Next stamps it on its own scripts", () => {
    // Next reads the CSP from the REQUEST header to nonce its bootstrap scripts; the browser enforces the
    // RESPONSE header. If the two diverge, strict-dynamic blocks every script and the page renders dead —
    // so the forwarded request CSP must carry the exact nonce the response enforces.
    const response = middleware(new NextRequest("https://app.example/"));
    const responseCsp = response.headers.get("content-security-policy") ?? "";
    const forwardedCsp = response.headers.get("x-middleware-request-content-security-policy");
    const forwardedNonce = response.headers.get("x-middleware-request-x-nonce") ?? "";
    expect(forwardedCsp).toBe(responseCsp);
    expect(forwardedNonce).not.toBe("");
    expect(responseCsp).toContain(`'nonce-${forwardedNonce}'`);
  });

  it("keeps the site's pages as they were: no index rule, no cache rule, no API images", () => {
    const response = middleware(new NextRequest("https://app.example/contact"));
    expect(response.headers.get("x-robots-tag")).toBeNull();
    expect(response.headers.get("cache-control")).toBeNull();
    // The site-wide referrer policy is next.config's, not the middleware's.
    expect(response.headers.get("referrer-policy")).toBeNull();
    expect(directive(response, "img-src")).toBe("img-src 'self' data: blob:");
  });
});

describe("/hotel-form's headers (D-189 §8, HF-G10)", () => {
  const response = middleware(new NextRequest("https://site.example/hotel-form"));

  it("enforces the same nonce CSP, letting the page reach the API and show its images", () => {
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(response.headers.get("content-security-policy-report-only")).toBeNull();
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(directive(response, "connect-src")).toBe("connect-src 'self' http://localhost:3900");
    expect(directive(response, "img-src")).toBe("img-src 'self' data: blob: http://localhost:3900");
    expect(directive(response, "frame-ancestors")).toBe("frame-ancestors 'none'");
  });

  it("sends no referrer, asks not to be indexed, followed or archived, and is never stored", () => {
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(Object.keys(HOTEL_FORM_HEADERS).sort()).toEqual([
      "cache-control",
      "referrer-policy",
      "x-robots-tag",
    ]);
  });

  it("covers the form's later pages, and only the form's", () => {
    expect(isHotelFormPath("/hotel-form")).toBe(true);
    expect(isHotelFormPath("/hotel-form/overview")).toBe(true);
    expect(isHotelFormPath("/hotel-forms")).toBe(false);
    expect(isHotelFormPath("/contact")).toBe(false);
    const later = middleware(new NextRequest("https://site.example/hotel-form/sections/rooms"));
    expect(later.headers.get("referrer-policy")).toBe("no-referrer");
  });
});
