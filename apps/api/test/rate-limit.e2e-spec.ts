import { randomUUID } from "node:crypto";

import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { RateLimitStore } from "../src/common/rate-limit/rate-limit.store.js";
import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

/**
 * Rate limiting end to end (feature 5.4, D-149): the public activation endpoint is capped per client IP,
 * so a burst from one client is refused with 429 `rate_limited` + `Retry-After` by the guard before the
 * handler runs, while a different client keeps its own window. A signed-in caller is capped per account
 * and, where the route says so, their network across accounts; uploads share one bucket per member of
 * staff. While the store is down, sign-in and the costly routes refuse (503) and reads let requests
 * through. The e2e env has no Redis (setup.e2e.ts clears REDIS_URL), so the in-memory store backs it;
 * trust proxy is enabled so a forwarded IP is the caller, the way the API keys the window behind the
 * proxy in production.
 */
describe("Rate limiting (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;
  const clientIds: string[] = [];

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    app.set("trust proxy", true);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { userId: { in: clientIds } } });
    await prisma.user.deleteMany({ where: { id: { in: clientIds } } });
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  /** A signed-in client of their own, with no account: the routes below count them, then refuse. */
  async function client(): Promise<string> {
    const subject = `local:e2e-rate-${randomUUID()}`;
    const user = await prisma.user.create({
      data: {
        userType: "client",
        name: "Lena Limit",
        email: `e2e-rate-${randomUUID()}@example.com`,
        status: "active",
        identitySubject: subject,
      },
      select: { id: true },
    });
    clientIds.push(user.id);
    return `Bearer ${await mint(subject)}`;
  }

  // @RateLimit is 10/min; a distinct forwarded IP per test avoids sharing the in-memory window.
  const activate = (ip: string) =>
    http().post("/auth/activate").set("X-Forwarded-For", ip).send({ token: "rate-limit-probe" });

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

  it("caps assistance requests per client, and per network across clients", async () => {
    // 20 an hour per client and 60 per network; the guard counts before the body is even read.
    const ask = (bearer: string, ip: string) =>
      http()
        .post("/consultancy/enquiries")
        .set("authorization", bearer)
        .set("X-Forwarded-For", ip)
        .send({});
    const network = "203.0.113.40";
    const first = await client();
    for (let i = 0; i < 20; i += 1) expect((await ask(first, network)).status).not.toBe(429);
    expect((await ask(first, network)).status).toBe(429);
    for (const bearer of [await client(), await client()]) {
      for (let i = 0; i < 20; i += 1) expect((await ask(bearer, network)).status).not.toBe(429);
    }
    // The network has had its 60: a fourth client is refused there at once, but not elsewhere.
    const fourth = await client();
    expect((await ask(fourth, network)).status).toBe(429);
    expect((await ask(fourth, "203.0.113.41")).status).not.toBe(429);
  });

  it("caps uploads per member of staff, whichever upload route they use", async () => {
    const staff = `Bearer ${await mint("local:admin")}`;
    const upload = (path: string) =>
      http()
        .post(path)
        .set("authorization", staff)
        .set("X-Forwarded-For", "203.0.113.50")
        .set("content-type", "application/octet-stream")
        .send(Buffer.from("not a real file"));
    const media = `/media/${randomUUID()}/upload`;
    const contract = `/consultancy-admin/booking-milestones/${randomUUID()}/contract`;
    // Thirty a minute between them (each answers 404 here: neither record exists).
    for (let i = 0; i < 30; i += 1) {
      expect((await upload(i % 2 === 0 ? media : contract)).status).not.toBe(429);
    }
    expect((await upload(media)).status).toBe(429);
  });

  it("refuses sign-in and costly routes while the store is down, and lets reads through", async () => {
    const bearer = await client();
    const down = vi
      .spyOn(app.get(RateLimitStore), "hit")
      .mockRejectedValue(new Error("redis down"));
    try {
      const signIn = await http()
        .post("/auth/sign-in")
        .set("X-Forwarded-For", "203.0.113.60")
        .send({ email: "admin@example.com", password: "any password at all" });
      expect(signIn.status).toBe(503);
      expect(signIn.body.error.code).toBe("unavailable");
      const subscribe = await http()
        .post("/crm/portal/subscriptions")
        .set("authorization", bearer)
        .send({ planId: randomUUID() });
      expect(subscribe.status).toBe(503);
      expect((await http().get("/crm/plans")).status).toBe(200);
      expect((await http().get("/me").set("authorization", bearer)).status).toBe(200);
      expect((await http().post("/auth/sign-out").set("authorization", bearer)).status).toBe(200);
    } finally {
      down.mockRestore();
    }
  });
});
