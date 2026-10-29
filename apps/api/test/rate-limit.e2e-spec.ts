import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startApi } from "./start-api.js";

/**
 * Rate limiting end to end (feature 5.4): the public activation endpoint is capped per client IP, so a
 * burst from one client is refused with 429 `rate_limited` + `Retry-After` by the guard before the
 * handler runs, while a different client keeps its own window. The e2e env has no Redis (setup.e2e.ts
 * clears REDIS_URL), so the in-memory store backs it; trust proxy is enabled so a forwarded IP is the
 * caller, the way the API keys the window behind Caddy in production.
 */
describe("Rate limiting (e2e)", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    ({ app } = await startApi());
    app.set("trust proxy", true);
  });

  afterAll(async () => {
    await app.close();
  });

  // @RateLimit is 10/min; a distinct forwarded IP per test avoids sharing the in-memory window.
  const activate = (ip: string) =>
    request(app.getHttpServer())
      .post("/auth/activate")
      .set("X-Forwarded-For", ip)
      .send({ token: "rate-limit-probe" });

  it("refuses a burst from one client with 429 and a Retry-After header", async () => {
    const ip = "203.0.113.10";
    // The first 10 pass the guard (then 401 on the bogus invite token); the 11th is refused.
    for (let i = 0; i < 10; i += 1) {
      expect((await activate(ip)).status).not.toBe(429);
    }
    const limited = await activate(ip);
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("rate_limited");
    expect(limited.headers["retry-after"]).toBeDefined();
  });

  it("keeps a separate window per client IP", async () => {
    const exhausted = "203.0.113.21";
    const fresh = "203.0.113.22";
    for (let i = 0; i < 10; i += 1) await activate(exhausted);
    expect((await activate(exhausted)).status).toBe(429);
    // A different client is untouched by the first one's burst — the window is keyed per IP, not global.
    expect((await activate(fresh)).status).not.toBe(429);
  });
});
