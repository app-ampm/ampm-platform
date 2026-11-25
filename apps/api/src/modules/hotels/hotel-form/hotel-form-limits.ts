import { Injectable } from "@nestjs/common";
import { errors, HOTEL_FORM_ERRORS } from "@ampm/core";

import { clientKey } from "../../../common/rate-limit/client-key.js";
import { RateLimitStore, type RateLimitHit } from "../../../common/rate-limit/rate-limit.store.js";
import { AppLogger } from "../../../common/logger.service.js";
import { HotelFormSmsCapAlert } from "./hotel-form-sms-cap-alert.js";

/*
 * The hotel form's own limits (D-189 §3; plan §4.3), counted in the limiter's store under `hotel_form:*`
 * keys, never the client sign-in's, and all failing closed: a store that cannot count answers 503, in the
 * words of what it held back (a code, or a write), with no `Retry-After`, and nothing is done uncounted. A
 * 429 carries `Retry-After` (the time left in the window that refused), and so does the SMS cap's 503 (the
 * time to the next day in India). The route's @RateLimit holds the per-network 10 code requests a minute;
 * these hold the rest. A mobile is keyed by its destination hash, so no key holds a number.
 */

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
/** India has one offset all year (UTC+05:30); the SMS budget is a day there, where the hotels are. */
const IST_OFFSET_MS = 5.5 * HOUR_MS;

/** What the code request limits allow (D-189 §3). */
export const HOTEL_FORM_CODE_LIMITS = {
  networkPerDay: 60,
  mobilePauseMs: 30 * SECOND_MS,
  mobilePerHour: 5,
  mobilePerDay: 10,
  requestPerHour: 20,
  requestPerDay: 50,
} as const;

/** The changes one session may make in a minute (D-189 §5's write windows; Slice 8 adds the sections'). */
export const HOTEL_FORM_WRITES_PER_MINUTE = 10;

/** The writes that have a window: a person's own details now. */
export type HotelFormWriteWindow = "me";

/** Who a code request counts against: the caller's network, the mobile's hash and the request. */
export interface CodeRequestScope {
  readonly ip: string | null;
  readonly destinationHash: string;
  readonly requestId: string;
}

/** The day in India at `now`, as YYYY-MM-DD: the SMS budget's day. */
export function istDayOf(now: Date): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The milliseconds from `now` to the next midnight in India. */
export function msUntilNextIstDay(now: Date): number {
  const shifted = now.getTime() + IST_OFFSET_MS;
  return (Math.floor(shifted / DAY_MS) + 1) * DAY_MS - shifted;
}

const seconds = (ms: number): number => Math.ceil(ms / SECOND_MS);

/** One counted window: its key, its length, the most hits it allows, and what it refuses with. */
interface CountedWindow {
  readonly key: string;
  readonly windowMs: number;
  readonly limit: number;
  readonly refusal: string;
}

/**
 * The windows a code request counts against, in order: the network's day, then the mobile's pause, hour
 * and day, then the request's hour and day.
 */
function codeWindows(scope: CodeRequestScope): CountedWindow[] {
  const limits = HOTEL_FORM_CODE_LIMITS;
  const network = `hotel_form:codes:network:day:${clientKey(scope.ip)}`;
  const mobile = `hotel_form:codes:mobile:${scope.destinationHash}`;
  const request = `hotel_form:codes:request:${scope.requestId}`;
  const { networkLimit, tooSoon, mobileLimit, requestLimit } = HOTEL_FORM_ERRORS;
  return [
    { key: network, windowMs: DAY_MS, limit: limits.networkPerDay, refusal: networkLimit },
    { key: `${mobile}:pause`, windowMs: limits.mobilePauseMs, limit: 1, refusal: tooSoon },
    { key: `${mobile}:hour`, windowMs: HOUR_MS, limit: limits.mobilePerHour, refusal: mobileLimit },
    { key: `${mobile}:day`, windowMs: DAY_MS, limit: limits.mobilePerDay, refusal: mobileLimit },
    {
      key: `${request}:hour`,
      windowMs: HOUR_MS,
      limit: limits.requestPerHour,
      refusal: requestLimit,
    },
    { key: `${request}:day`, windowMs: DAY_MS, limit: limits.requestPerDay, refusal: requestLimit },
  ];
}

@Injectable()
export class HotelFormLimits {
  constructor(
    private readonly store: RateLimitStore,
    private readonly alert: HotelFormSmsCapAlert,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Every per-network, per-mobile and per-request limit of a code request, in that order; the first that
   * refuses stops the count, so a refused request spends no later budget.
   */
  async allowCodeRequest(scope: CodeRequestScope): Promise<void> {
    for (const window of codeWindows(scope)) {
      await this.within(window, HOTEL_FORM_ERRORS.codesUnavailable);
    }
  }

  /**
   * The global SMS cap (SMS mode only): at most `cap` codes by SMS in an India day across every request.
   * Past it, 503 until the next day there, and one in-app alert that day to the Super Admin and the
   * Hotel team; an alert that cannot be sent is logged and the refusal stands.
   */
  async allowSms(cap: number, now: Date): Promise<void> {
    const day = istDayOf(now);
    const left = msUntilNextIstDay(now);
    const hit = await this.count(
      `hotel_form:sms:day:${day}`,
      left,
      HOTEL_FORM_ERRORS.codesUnavailable,
    );
    if (hit.count <= cap) return;
    await this.alertOnce(day, cap, left);
    throw errors.unavailable(HOTEL_FORM_ERRORS.smsCapReached, seconds(left));
  }

  /** A session's write window: 10 changes a minute of `window`. */
  async allowWrite(window: HotelFormWriteWindow, sessionId: string): Promise<void> {
    const counted: CountedWindow = {
      key: `hotel_form:write:${window}:${sessionId}`,
      windowMs: MINUTE_MS,
      limit: HOTEL_FORM_WRITES_PER_MINUTE,
      refusal: HOTEL_FORM_ERRORS.writeLimit,
    };
    await this.within(counted, HOTEL_FORM_ERRORS.writesUnavailable);
  }

  /**
   * Counts a hit and refuses past the window's limit, with the time left in it as Retry-After; `outage` is
   * what a store that cannot count answers.
   */
  private async within(window: CountedWindow, outage: string): Promise<void> {
    const hit = await this.count(window.key, window.windowMs, outage);
    if (hit.count > window.limit) {
      throw errors.rateLimited(window.refusal, seconds(hit.resetMs));
    }
  }

  /** One hit; a store that cannot count fails closed (503 with `outage`), logged without the key. */
  private async count(key: string, windowMs: number, outage: string): Promise<RateLimitHit> {
    try {
      return await this.store.hit(key, windowMs);
    } catch {
      this.logger.warn("hotel_form.limits_unavailable", {});
      throw errors.unavailable(outage);
    }
  }

  /** The cap's alert, sent by the first refusal of the day only. */
  private async alertOnce(day: string, cap: number, ttlMs: number): Promise<void> {
    try {
      const first = await this.store.hit(`hotel_form:sms_cap_alert:${day}`, ttlMs);
      if (first.count !== 1) return;
      await this.alert.send(cap, day);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn("hotel_form.sms_cap_alert_failed", { error: reason.slice(0, 200) });
    }
  }
}
