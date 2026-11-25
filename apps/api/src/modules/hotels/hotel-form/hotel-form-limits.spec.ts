import { AppError, createMemoryLogger, HOTEL_FORM_ERRORS } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../../../common/logger.service.js";
import { RateLimitStore, type RateLimitHit } from "../../../common/rate-limit/rate-limit.store.js";
import { HotelFormLimits, istDayOf, msUntilNextIstDay } from "./hotel-form-limits.js";
import type { HotelFormSmsCapAlert } from "./hotel-form-sms-cap-alert.js";

/*
 * Every limit of a hotel form code request (D-189 §3), counted in the limiter's store under hotel_form:*
 * keys and failing closed: per network 60 a day (the route's own limit holds 10 a minute); per mobile, by
 * its destination hash, a 30-second pause, then 5 an hour and 10 a day; per request 20 an hour and 50 a
 * day; the global SMS cap with one alert a day; and the write window of a session. A fake store with a
 * controllable clock stands in for Redis.
 */

/** A fixed-window store on a clock the test moves, as Redis's INCR and PEXPIRE behave. */
class ClockStore extends RateLimitStore {
  now = new Date("2026-11-25T10:00:00.000Z").getTime();
  readonly keys: string[] = [];
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  async hit(key: string, windowMs: number): Promise<RateLimitHit> {
    this.keys.push(key);
    const current = this.windows.get(key);
    if (!current || this.now >= current.resetAt) {
      this.windows.set(key, { count: 1, resetAt: this.now + windowMs });
      return { count: 1, resetMs: windowMs };
    }
    current.count += 1;
    return { count: current.count, resetMs: current.resetAt - this.now };
  }

  advance(ms: number): void {
    this.now += ms;
  }
}

class BrokenStore extends RateLimitStore {
  hit(): Promise<RateLimitHit> {
    return Promise.reject(new Error("connect ECONNREFUSED"));
  }
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const scope = (overrides: Partial<Parameters<HotelFormLimits["allowCodeRequest"]>[0]> = {}) => ({
  ip: "203.0.113.7",
  destinationHash: "d".repeat(64),
  requestId: "0192f1a0-0000-7000-8000-0000000000b1",
  ...overrides,
});

function build(store: RateLimitStore = new ClockStore()) {
  const send = vi.fn(async () => 2);
  const { logger, entries } = createMemoryLogger("debug");
  const limits = new HotelFormLimits(
    store,
    { send } as unknown as HotelFormSmsCapAlert,
    logger as unknown as AppLogger,
  );
  return { limits, send, entries, store };
}

/** The refusal an attempt raised, or null when it was allowed. */
async function refusal(attempt: Promise<void>): Promise<AppError | null> {
  try {
    await attempt;
    return null;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
}

describe("HotelFormLimits.allowCodeRequest", () => {
  it("keys every count under hotel_form:, by network, mobile hash and request", async () => {
    const store = new ClockStore();
    await build(store).limits.allowCodeRequest(scope());
    expect(store.keys.every((key) => key.startsWith("hotel_form:"))).toBe(true);
    expect(store.keys.some((key) => key.includes("203.0.113.7"))).toBe(true);
    expect(store.keys.some((key) => key.includes("d".repeat(64)))).toBe(true);
    expect(store.keys.some((key) => key.includes(scope().requestId))).toBe(true);
    expect(store.keys.join(" ")).not.toMatch(/\+91|7000001234/);
  });

  it("pauses a mobile for 30 seconds after a code, then allows another", async () => {
    const store = new ClockStore();
    const { limits } = build(store);
    await limits.allowCodeRequest(scope());
    store.advance(10 * SECOND);
    const tooSoon = await refusal(limits.allowCodeRequest(scope()));
    expect(tooSoon?.status).toBe(429);
    expect(tooSoon?.message).toBe(HOTEL_FORM_ERRORS.tooSoon);
    expect(tooSoon?.retryAfterSeconds).toBe(20);
    store.advance(20 * SECOND);
    expect(await refusal(limits.allowCodeRequest(scope()))).toBeNull();
  });

  it("allows a mobile 5 codes an hour, then refuses until the hour is over", async () => {
    const store = new ClockStore();
    const { limits } = build(store);
    for (let code = 0; code < 5; code += 1) {
      expect(await refusal(limits.allowCodeRequest(scope()))).toBeNull();
      store.advance(31 * SECOND);
    }
    const sixth = await refusal(limits.allowCodeRequest(scope()));
    expect(sixth?.status).toBe(429);
    expect(sixth?.message).toBe(HOTEL_FORM_ERRORS.mobileLimit);
    expect(sixth?.retryAfterSeconds).toBeGreaterThan(55 * 60);
    expect(sixth?.retryAfterSeconds).toBeLessThanOrEqual(60 * 60);
    store.advance(HOUR);
    expect(await refusal(limits.allowCodeRequest(scope()))).toBeNull();
  });

  it("allows a mobile 10 codes a day across its hours", async () => {
    const store = new ClockStore();
    const { limits } = build(store);
    for (let code = 0; code < 10; code += 1) {
      expect(await refusal(limits.allowCodeRequest(scope({ requestId: `r${code}` })))).toBeNull();
      store.advance(code % 5 === 4 ? HOUR : 31 * SECOND);
    }
    const eleventh = await refusal(limits.allowCodeRequest(scope({ requestId: "r-next" })));
    expect(eleventh?.message).toBe(HOTEL_FORM_ERRORS.mobileLimit);
  });

  it("allows a request 20 codes an hour across its mobiles", async () => {
    const store = new ClockStore();
    const { limits } = build(store);
    for (let code = 0; code < 20; code += 1) {
      const mobile = scope({ destinationHash: `m${code}`, ip: `198.51.100.${code}` });
      expect(await refusal(limits.allowCodeRequest(mobile))).toBeNull();
    }
    const next = await refusal(limits.allowCodeRequest(scope({ destinationHash: "m-next" })));
    expect(next?.status).toBe(429);
    expect(next?.message).toBe(HOTEL_FORM_ERRORS.requestLimit);
    expect(next?.retryAfterSeconds).toBe(60 * 60);
  });

  it("allows a request 50 codes a day", async () => {
    const store = new ClockStore();
    const { limits } = build(store);
    for (let code = 0; code < 50; code += 1) {
      const mobile = scope({ destinationHash: `m${code}`, ip: `198.51.100.${code}` });
      expect(await refusal(limits.allowCodeRequest(mobile)), `code ${code}`).toBeNull();
      if (code % 20 === 19) store.advance(HOUR);
    }
    const next = await refusal(limits.allowCodeRequest(scope({ destinationHash: "m-next" })));
    expect(next?.message).toBe(HOTEL_FORM_ERRORS.requestLimit);
  });

  it("allows a network 60 code requests a day", async () => {
    const store = new ClockStore();
    const { limits } = build(store);
    for (let code = 0; code < 60; code += 1) {
      const mobile = scope({ destinationHash: `m${code}`, requestId: `r${code}` });
      expect(await refusal(limits.allowCodeRequest(mobile)), `code ${code}`).toBeNull();
    }
    const next = await refusal(
      limits.allowCodeRequest(scope({ destinationHash: "m-next", requestId: "r-next" })),
    );
    expect(next?.status).toBe(429);
    expect(next?.message).toBe(HOTEL_FORM_ERRORS.networkLimit);
  });

  it("counts an IPv6 network by its /64", async () => {
    const store = new ClockStore();
    const { limits } = build(store);
    await limits.allowCodeRequest(scope({ ip: "2001:db8:1:2:aaaa::1" }));
    expect(store.keys.some((key) => key.includes("2001:db8:1:2::/64"))).toBe(true);
  });

  it("fails closed with 503 when the store cannot count", async () => {
    const { limits, entries } = build(new BrokenStore());
    const outage = await refusal(limits.allowCodeRequest(scope()));
    expect(outage?.status).toBe(503);
    expect(outage?.message).toBe(HOTEL_FORM_ERRORS.codesUnavailable);
    expect(entries.map((entry) => entry.event)).toContain("hotel_form.limits_unavailable");
  });
});

describe("HotelFormLimits.allowSms: the global SMS cap", () => {
  it("allows up to the cap in an India day, then answers 503 until the next one", async () => {
    const store = new ClockStore();
    const { limits } = build(store);
    const now = new Date(store.now);
    for (let sms = 0; sms < 3; sms += 1) expect(await refusal(limits.allowSms(3, now))).toBeNull();
    const over = await refusal(limits.allowSms(3, now));
    expect(over?.status).toBe(503);
    expect(over?.message).toBe(HOTEL_FORM_ERRORS.smsCapReached);
    // 10:00 UTC is 15:30 in India: 8 hours 30 minutes to midnight there.
    expect(over?.retryAfterSeconds).toBe(8.5 * 60 * 60);
    expect(
      store.keys.filter((key) => key.startsWith("hotel_form:sms:day:2026-11-25")),
    ).toHaveLength(4);
  });

  it("alerts once a day when it trips, however often it is hit after", async () => {
    const store = new ClockStore();
    const { limits, send } = build(store);
    const now = new Date(store.now);
    await limits.allowSms(1, now);
    await refusal(limits.allowSms(1, now));
    await refusal(limits.allowSms(1, now));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(1, "2026-11-25");
    store.advance(msUntilNextIstDay(now));
    const tomorrow = new Date(store.now);
    await limits.allowSms(1, tomorrow);
    await refusal(limits.allowSms(1, tomorrow));
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith(1, "2026-11-26");
  });

  it("still refuses when the alert cannot be sent", async () => {
    const store = new ClockStore();
    const { limits, send, entries } = build(store);
    send.mockRejectedValueOnce(new Error("queue down"));
    const now = new Date(store.now);
    await limits.allowSms(1, now);
    expect((await refusal(limits.allowSms(1, now)))?.status).toBe(503);
    expect(entries.map((entry) => entry.event)).toContain("hotel_form.sms_cap_alert_failed");
  });

  it("fails closed when the store cannot count", async () => {
    const outage = await refusal(build(new BrokenStore()).limits.allowSms(300, new Date()));
    expect(outage?.status).toBe(503);
    expect(outage?.message).toBe(HOTEL_FORM_ERRORS.codesUnavailable);
  });
});

describe("HotelFormLimits.allowWrite: a session's write window", () => {
  it("allows a session 10 changes of its details a minute", async () => {
    const store = new ClockStore();
    const { limits } = build(store);
    for (let write = 0; write < 10; write += 1) {
      expect(await refusal(limits.allowWrite("me", "session-a"))).toBeNull();
    }
    const over = await refusal(limits.allowWrite("me", "session-a"));
    expect(over?.status).toBe(429);
    expect(over?.message).toBe(HOTEL_FORM_ERRORS.writeLimit);
    expect(over?.retryAfterSeconds).toBe(60);
    expect(await refusal(limits.allowWrite("me", "session-b"))).toBeNull();
    expect(store.keys.at(-1)).toBe("hotel_form:write:me:session-b");
  });

  it("fails closed when the store cannot count", async () => {
    const outage = await refusal(build(new BrokenStore()).limits.allowWrite("me", "s"));
    expect(outage?.status).toBe(503);
  });
});

describe("the India day", () => {
  it("names the day in India and the time left in it", () => {
    expect(istDayOf(new Date("2026-11-25T18:29:59.000Z"))).toBe("2026-11-25");
    expect(istDayOf(new Date("2026-11-25T18:30:00.000Z"))).toBe("2026-11-26");
    expect(msUntilNextIstDay(new Date("2026-11-25T18:29:59.000Z"))).toBe(SECOND);
    expect(msUntilNextIstDay(new Date("2026-11-25T18:30:00.000Z"))).toBe(24 * HOUR);
  });
});
