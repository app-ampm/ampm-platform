import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { isAppError } from "@ampm/core";

import { createApiClient, isUnwordedFailure, retryAfterSecondsOf } from "./client";

const schema = z.object({ ok: z.boolean() });

function fakeFetch(
  status: number,
  body: unknown,
  capture?: { init?: RequestInit | undefined },
  headers: Record<string, string> = {},
): typeof fetch {
  return (async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (capture) capture.init = init;
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", ...headers },
    });
  }) as typeof fetch;
}

describe("createApiClient", () => {
  it("unwraps the envelope, validates the data and sends the bearer token", async () => {
    const capture: { init?: RequestInit | undefined } = {};
    const api = createApiClient({
      baseUrl: "http://api.test/",
      getAccessToken: () => "t0k3n",
      fetch: fakeFetch(200, { data: { ok: true, extra: 1 } }, capture),
    });
    await expect(api.get("/me", schema)).resolves.toEqual({ ok: true });
    expect((capture.init?.headers as Record<string, string>)["authorization"]).toBe("Bearer t0k3n");
  });

  it("sends no bearer on an anonymous request, even while a (stale) token is held", async () => {
    const capture: { init?: RequestInit | undefined } = {};
    const getAccessToken = vi.fn(() => "stale-t0k3n");
    const api = createApiClient({
      baseUrl: "http://api.test",
      getAccessToken,
      fetch: fakeFetch(200, { data: { ok: true } }, capture),
    });
    await expect(
      api.request("/auth/dev-login", {
        method: "POST",
        body: { email: "admin@example.com" },
        schema,
        anonymous: true,
      }),
    ).resolves.toEqual({ ok: true });
    const headers = capture.init?.headers as Record<string, string>;
    expect(headers["authorization"]).toBeUndefined();
    expect(headers["content-type"]).toBe("application/json");
    // Not even asked for: an anonymous request has no use for the session's token.
    expect(getAccessToken).not.toHaveBeenCalled();
  });

  it("sends a given access token instead of the session's (activation)", async () => {
    const capture: { init?: RequestInit | undefined } = {};
    const getAccessToken = vi.fn(() => "session-t0k3n");
    const api = createApiClient({
      baseUrl: "http://api.test",
      getAccessToken,
      fetch: fakeFetch(200, { data: { ok: true } }, capture),
    });
    await api.request("/auth/activate", {
      method: "POST",
      body: { token: "invite" },
      schema,
      accessToken: "given",
    });
    const headers = capture.init?.headers as Record<string, string>;
    expect(headers["authorization"]).toBe("Bearer given");
    expect(getAccessToken).not.toHaveBeenCalled();
  });

  it("turns a failure envelope into a typed error", async () => {
    const api = createApiClient({
      baseUrl: "http://api.test",
      fetch: fakeFetch(401, { error: { code: "unauthenticated", message: "Sign in" } }),
    });
    await expect(api.get("/me", schema)).rejects.toMatchObject({
      code: "unauthenticated",
      status: 401,
    });
  });

  it("carries the Retry-After seconds of a refusal on the error it raises (D-189 §3)", async () => {
    const limited = { error: { code: "rate_limited", message: "Too many requests" } };
    const api = createApiClient({
      baseUrl: "http://api.test",
      fetch: fakeFetch(429, limited, undefined, { "Retry-After": "27" }),
    });
    await expect(api.get("/hotel-form/codes", schema)).rejects.toMatchObject({
      code: "rate_limited",
      status: 429,
      retryAfterSeconds: 27,
    });
    const busy = createApiClient({
      baseUrl: "http://api.test",
      fetch: fakeFetch(503, { error: { code: "unavailable", message: "Try later" } }, undefined, {
        "retry-after": "3600",
      }),
    });
    await expect(busy.get("/hotel-form/codes", schema)).rejects.toMatchObject({
      code: "unavailable",
      retryAfterSeconds: 3600,
    });
  });

  it("raises an error with no retryAfterSeconds when the refusal names none", async () => {
    const api = createApiClient({
      baseUrl: "http://api.test",
      fetch: fakeFetch(429, { error: { code: "rate_limited", message: "Too many requests" } }),
    });
    const error: unknown = await api.get("/x", schema).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "rate_limited" });
    expect(error).toHaveProperty("retryAfterSeconds", undefined);
  });

  it("marks a failure the API never worded (a proxy's own page), so a page can word it itself", async () => {
    const proxyPage: typeof fetch = async () =>
      new Response("<html><body><h1>403 Forbidden</h1></body></html>", {
        status: 403,
        headers: { "content-type": "text/html" },
      });
    const api = createApiClient({ baseUrl: "http://api.test", fetch: proxyPage });
    const error: unknown = await api
      .get("/hotel-form/open", schema)
      .catch((caught: unknown) => caught);
    expect(isAppError(error) && isUnwordedFailure(error)).toBe(true);
    const worded = createApiClient({
      baseUrl: "http://api.test",
      fetch: fakeFetch(403, { error: { code: "forbidden", message: "You cannot do that" } }),
    });
    const refused: unknown = await worded.get("/x", schema).catch((caught: unknown) => caught);
    expect(isAppError(refused) && isUnwordedFailure(refused)).toBe(false);
  });

  it("reports a network failure as network_error", async () => {
    const failing = (async () => {
      throw new TypeError("offline");
    }) as typeof fetch;
    const api = createApiClient({ baseUrl: "http://api.test", fetch: failing });
    await expect(api.get("/me", schema)).rejects.toMatchObject({ code: "network_error" });
  });

  it("uploads raw bytes at the chosen content type (not JSON), keeping the bearer and envelope", async () => {
    const capture: { init?: RequestInit | undefined } = {};
    const api = createApiClient({
      baseUrl: "http://api.test",
      getAccessToken: () => "t0k3n",
      fetch: fakeFetch(200, { data: { ok: true } }, capture),
    });
    const bytes = new Uint8Array([1, 2, 3]);
    await expect(
      api.upload("/media/abc/upload", {
        body: bytes,
        contentType: "application/octet-stream",
        schema,
      }),
    ).resolves.toEqual({ ok: true });
    expect(capture.init?.method).toBe("POST");
    const headers = capture.init?.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/octet-stream");
    expect(headers["authorization"]).toBe("Bearer t0k3n");
    // The raw bytes go on the wire as-is — never JSON-encoded.
    expect(capture.init?.body).toBe(bytes);
  });

  it("resolves a signed media URL against the API base, passing absolutes and empties through", () => {
    const api = createApiClient({
      baseUrl: "https://app.ampmverse.com/_api/",
      fetch: fakeFetch(200, { data: { ok: true } }),
    });
    // A root-relative /media/blob URL becomes absolute under the API base (so on the box it reaches /_api,
    // not the app's own origin where the SPA shell would answer instead of the picture).
    expect(api.mediaUrl("/media/blob?key=abc&sig=1")).toBe(
      "https://app.ampmverse.com/_api/media/blob?key=abc&sig=1",
    );
    // An absolute URL (a future S3/CDN link, feature 6.4) is left untouched.
    expect(api.mediaUrl("https://cdn.example.com/x.jpg")).toBe("https://cdn.example.com/x.jpg");
    // A protocol-relative URL (//host/…) is already loadable — it must not get the base prepended.
    expect(api.mediaUrl("//cdn.example.com/x.jpg")).toBe("//cdn.example.com/x.jpg");
    // No URL stays null.
    expect(api.mediaUrl(null)).toBeNull();
    expect(api.mediaUrl(undefined)).toBeNull();
  });
});

describe("retryAfterSecondsOf", () => {
  const now = Date.parse("2026-11-25T10:00:00.000Z");

  it("reads delay-seconds and an HTTP date as whole seconds from now", () => {
    expect(retryAfterSecondsOf("30", now)).toBe(30);
    expect(retryAfterSecondsOf(" 0 ", now)).toBe(0);
    expect(retryAfterSecondsOf("Wed, 25 Nov 2026 10:01:30 GMT", now)).toBe(90);
    // A date already past means "now", never a negative wait.
    expect(retryAfterSecondsOf("Wed, 25 Nov 2026 09:00:00 GMT", now)).toBe(0);
  });

  it("never reads a wait longer than a day, however far the header points", () => {
    expect(retryAfterSecondsOf("86400", now)).toBe(86_400);
    expect(retryAfterSecondsOf("86401", now)).toBe(86_400);
    expect(retryAfterSecondsOf("9".repeat(400), now)).toBe(86_400);
    expect(retryAfterSecondsOf("Thu, 25 Nov 2027 10:00:00 GMT", now)).toBe(86_400);
  });

  it("gives none for no header or one it cannot read", () => {
    expect(retryAfterSecondsOf(null, now)).toBeUndefined();
    expect(retryAfterSecondsOf("", now)).toBeUndefined();
    expect(retryAfterSecondsOf("soon", now)).toBeUndefined();
    expect(retryAfterSecondsOf("-5", now)).toBeUndefined();
    expect(retryAfterSecondsOf("1.5", now)).toBeUndefined();
  });
});
