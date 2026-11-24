import { describe, expect, it } from "vitest";

import { corsOptions, HTTP_APP_OPTIONS } from "./http.setup.js";

describe("the HTTP settings main.ts and the e2e suite share", () => {
  it("keeps the raw request bytes for the webhook, and registers no parser but JSON (D-187)", () => {
    expect(HTTP_APP_OPTIONS).toEqual({ rawBody: true, bodyParser: false });
  });

  it("lets the web portals read the request id and a busy answer's Retry-After (D-187)", () => {
    const options = corsOptions({
      CORS_ORIGINS: ["https://app.example.test"],
      NODE_ENV: "production",
    });
    expect(options.origin).toEqual(["https://app.example.test"]);
    expect(options.exposedHeaders).toEqual(["x-request-id", "retry-after"]);
  });

  it("allows the local Metro and Next origins in development when none are configured", () => {
    expect(corsOptions({ CORS_ORIGINS: [], NODE_ENV: "development" }).origin).toEqual([
      "http://localhost:8082",
      "http://localhost:3417",
    ]);
    expect(corsOptions({ CORS_ORIGINS: [], NODE_ENV: "production" }).origin).toEqual([]);
  });
});
