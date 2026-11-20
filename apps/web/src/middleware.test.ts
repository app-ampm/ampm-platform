import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { middleware } from "./middleware.js";

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
});
