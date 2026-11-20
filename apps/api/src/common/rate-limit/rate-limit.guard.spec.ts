import { createMemoryLogger } from "@ampm/core";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../logger.service.js";
import { requestContext, type RequestContext } from "../request-context.js";
import { RateLimitGuard } from "./rate-limit.guard.js";
import { type RateLimitHit, RateLimitStore } from "./rate-limit.store.js";
import type { RateLimitOptions } from "./rate-limit.decorator.js";

const OPTIONS: RateLimitOptions = { name: "t", limit: 2, windowMs: 1000, failClosed: false };
const PRINCIPAL = { type: "client", userId: "u1" } as unknown as RequestContext["principal"];

function execContext(setHeader = vi.fn()): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getResponse: () => ({ setHeader }), getRequest: () => ({}) }),
  } as unknown as ExecutionContext;
}

function build(
  hit: RateLimitHit | ((key: string) => Promise<RateLimitHit>),
  meta: RateLimitOptions | undefined,
) {
  const reflector = { getAllAndOverride: () => meta } as unknown as Reflector;
  const hitFn = vi.fn(typeof hit === "function" ? hit : async () => hit);
  const store = { hit: hitFn } as unknown as RateLimitStore;
  const { logger, entries } = createMemoryLogger();
  const guard = new RateLimitGuard(reflector, store, logger as unknown as AppLogger);
  return { guard, hitFn, entries };
}

function run<T>(partial: Partial<RequestContext>, fn: () => T): T {
  const base: RequestContext = { requestId: "r", ip: "1.2.3.4", principal: null, access: null };
  return requestContext.run({ ...base, ...partial }, fn);
}

const storeDown = async (): Promise<RateLimitHit> => {
  throw new Error("redis down");
};

describe("RateLimitGuard", () => {
  it("allows a route with no @RateLimit without touching the store", async () => {
    const { guard, hitFn } = build({ count: 99, resetMs: 1000 }, undefined);
    await expect(run({}, () => guard.canActivate(execContext()))).resolves.toBe(true);
    expect(hitFn).not.toHaveBeenCalled();
  });

  it("allows under the limit and rejects over it with a Retry-After header", async () => {
    const under = build({ count: 2, resetMs: 1000 }, OPTIONS);
    await expect(run({}, () => under.guard.canActivate(execContext()))).resolves.toBe(true);
    const setHeader = vi.fn();
    const over = build({ count: 3, resetMs: 1500 }, OPTIONS);
    await expect(
      run({}, () => over.guard.canActivate(execContext(setHeader))),
    ).rejects.toMatchObject({ code: "rate_limited" });
    expect(setHeader).toHaveBeenCalledWith("Retry-After", 2);
  });

  it("keys the window by the authenticated user, else by IP", async () => {
    const authed = build({ count: 1, resetMs: 1000 }, OPTIONS);
    await run({ principal: PRINCIPAL }, () => authed.guard.canActivate(execContext()));
    expect(authed.hitFn).toHaveBeenCalledExactlyOnceWith("rl:t:user:u1", 1000);

    const anon = build({ count: 1, resetMs: 1000 }, OPTIONS);
    await run({ ip: "9.9.9.9" }, () => anon.guard.canActivate(execContext()));
    expect(anon.hitFn).toHaveBeenCalledExactlyOnceWith("rl:t:ip:9.9.9.9", 1000);
  });

  it("also counts a signed-in caller's network when the route caps networks", async () => {
    const capped = { ...OPTIONS, perIpLimit: 5 };
    const both = build({ count: 1, resetMs: 1000 }, capped);
    await run({ principal: PRINCIPAL, ip: "9.9.9.9" }, () => both.guard.canActivate(execContext()));
    expect(both.hitFn.mock.calls).toEqual([
      ["rl:t:user:u1", 1000],
      ["rl:t:ip:9.9.9.9", 1000],
    ]);

    // Under the user's own limit, but the network has had more than its five: refused.
    const busy = build(
      async (key) => ({ count: key.includes(":ip:") ? 6 : 1, resetMs: 1000 }),
      capped,
    );
    await expect(
      run({ principal: PRINCIPAL }, () => busy.guard.canActivate(execContext())),
    ).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("counts an anonymous caller once, by network, whatever the network cap", async () => {
    const { guard, hitFn } = build({ count: 1, resetMs: 1000 }, { ...OPTIONS, perIpLimit: 5 });
    await run({ ip: "9.9.9.9" }, () => guard.canActivate(execContext()));
    expect(hitFn).toHaveBeenCalledExactlyOnceWith("rl:t:ip:9.9.9.9", 1000);
  });

  it("fails open when the store throws on a route that allows it, and says so in the log", async () => {
    const { guard, entries } = build(storeDown, OPTIONS);
    await expect(run({}, () => guard.canActivate(execContext()))).resolves.toBe(true);
    expect(entries).toContainEqual(
      expect.objectContaining({
        event: "rate_limit.store_unavailable",
        fields: { name: "t", failClosed: false },
      }),
    );
  });

  it("fails closed with 503 when the store throws on a route that must not run uncounted", async () => {
    const { guard } = build(storeDown, { ...OPTIONS, failClosed: true });
    await expect(run({}, () => guard.canActivate(execContext()))).rejects.toMatchObject({
      code: "unavailable",
    });
  });
});
