import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createApiClient } from "./client";

const schema = z.object({ ok: z.boolean() });

function fakeFetch(
  status: number,
  body: unknown,
  capture?: { init?: RequestInit | undefined },
): typeof fetch {
  return (async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (capture) capture.init = init;
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
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
});
