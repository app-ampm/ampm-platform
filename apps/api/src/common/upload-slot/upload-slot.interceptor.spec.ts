import { EventEmitter } from "node:events";

import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { isAppError } from "@ampm/core";
import { Subject, type Subscription } from "rxjs";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Principal } from "../../policy/principal.types.js";
import type { AppLogger } from "../logger.service.js";
import { requestContext } from "../request-context.js";
import {
  UPLOAD_BUSY_MESSAGE,
  UPLOAD_RETRY_AFTER_SECONDS,
  UPLOAD_SLOT_MAX_HOLD_MS,
  UploadSlotInterceptor,
} from "./upload-slot.interceptor.js";
import { UploadSlots } from "./upload-slots.js";

/** An interceptor over its own slots, with a logger the tests read. */
function setup() {
  const slots = new UploadSlots();
  const logger = { error: vi.fn() };
  const interceptor = new UploadSlotInterceptor(slots, logger as unknown as AppLogger);
  return { slots, logger, interceptor };
}

/**
 * One upload reaching the interceptor after the guards, as this caller, with a handler the test ends
 * when it likes: `work.complete()` succeeds, `work.error(…)` fails. The response emits finish and close
 * as Node's would, and takes the busy answer's header.
 */
function upload(interceptor: UploadSlotInterceptor, caller: { userId?: string; ip?: string }) {
  const response = Object.assign(new EventEmitter(), { setHeader: vi.fn() });
  const context = {
    switchToHttp: () => ({ getResponse: () => response }),
    getClass: () => ({ name: "MediaController" }),
    getHandler: () => ({ name: "upload" }),
  } as unknown as ExecutionContext;
  const work = new Subject<unknown>();
  const next: CallHandler = { handle: vi.fn(() => work.asObservable()) };
  const principal = caller.userId
    ? ({ type: "staff", userId: caller.userId } as unknown as Principal)
    : null;
  const current = { requestId: "req-1", ip: caller.ip ?? "203.0.113.7", principal, access: null };
  /** Runs the interceptor and subscribes to the handler's work, as Nest does. */
  const start = (): Subscription =>
    requestContext.run(current, () =>
      interceptor.intercept(context, next).subscribe({ error: () => undefined }),
    );
  return { response, next, work, start };
}

/** The typed error a refused upload throws, or undefined when it went through. */
function refusal(run: () => unknown): unknown {
  try {
    run();
    return undefined;
  } catch (error) {
    return error;
  }
}

describe("UploadSlotInterceptor (D-187)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("holds the slot while the handler works, even after the caller hangs up, until it ends", () => {
    const { slots, interceptor } = setup();
    const call = upload(interceptor, { userId: "u1" });
    call.start();
    expect(call.next.handle).toHaveBeenCalledOnce();
    expect(slots.inUse("user:u1")).toBe(1);
    call.response.emit("close"); // the caller has gone; the scan and the store still hold the body
    call.response.emit("finish");
    expect(slots.inUse()).toBe(1);
    call.work.next("stored");
    call.work.complete();
    expect(slots.inUse()).toBe(0);
  });

  it("gives the slot back when the handler fails", () => {
    const { slots, interceptor } = setup();
    const call = upload(interceptor, { userId: "u1" });
    call.start();
    call.work.error(new Error("the upload was cut off; send it again"));
    expect(slots.inUse()).toBe(0);
  });

  it("gives the slot back when the work is unsubscribed", () => {
    const { slots, interceptor } = setup();
    upload(interceptor, { userId: "u1" }).start().unsubscribe();
    expect(slots.inUse()).toBe(0);
  });

  it("answers 503 with Retry-After, before the handler, when the caller holds two uploads", () => {
    const { interceptor } = setup();
    upload(interceptor, { userId: "u1" }).start();
    upload(interceptor, { userId: "u1" }).start();
    const third = upload(interceptor, { userId: "u1" });
    const error = refusal(third.start);
    expect(isAppError(error) && error.toEnvelope()).toEqual({
      error: { code: "unavailable", message: UPLOAD_BUSY_MESSAGE },
    });
    expect(isAppError(error) && error.status).toBe(503);
    expect(UPLOAD_BUSY_MESSAGE).toBe(
      "The server is busy with other uploads. Try again in 5 seconds.",
    );
    expect(third.response.setHeader).toHaveBeenCalledWith(
      "Retry-After",
      String(UPLOAD_RETRY_AFTER_SECONDS),
    );
    expect(UPLOAD_RETRY_AFTER_SECONDS).toBe(5);
    expect(third.next.handle).not.toHaveBeenCalled(); // no byte of its body is read
  });

  it("answers 503 when the process holds four uploads, whoever asks", () => {
    const { slots, interceptor } = setup();
    for (const userId of ["u1", "u1", "u2", "u3"]) upload(interceptor, { userId }).start();
    const fifth = upload(interceptor, { userId: "u4" });
    expect(refusal(fifth.start)).toMatchObject({ code: "unavailable" });
    expect(slots.inUse()).toBe(4);
  });

  it("counts a caller with no principal by their network", () => {
    const { slots, interceptor } = setup();
    upload(interceptor, { ip: "203.0.113.9" }).start();
    expect(slots.inUse("ip:203.0.113.9")).toBe(1);
  });

  it("takes a slot back after five minutes, logging it, and gives it back only once", () => {
    vi.useFakeTimers();
    const { slots, logger, interceptor } = setup();
    expect(UPLOAD_SLOT_MAX_HOLD_MS).toBe(5 * 60_000);
    const stuck = upload(interceptor, { userId: "u1" });
    stuck.start();
    vi.advanceTimersByTime(UPLOAD_SLOT_MAX_HOLD_MS - 1);
    expect(slots.inUse()).toBe(1);
    vi.advanceTimersByTime(1);
    expect(slots.inUse()).toBe(0);
    expect(logger.error).toHaveBeenCalledExactlyOnceWith("upload_slot.force_released", {
      route: "MediaController.upload",
      owner: "user:u1",
    });
    upload(interceptor, { userId: "u1" }).start(); // the next upload takes the freed slot
    stuck.work.complete(); // the stuck handler ends at last: its finalize gives nothing back twice
    expect(slots.inUse("user:u1")).toBe(1);
  });

  it("never takes back a slot whose handler ended in time", () => {
    vi.useFakeTimers();
    const { slots, logger, interceptor } = setup();
    const call = upload(interceptor, { userId: "u1" });
    call.start();
    call.work.complete();
    vi.advanceTimersByTime(UPLOAD_SLOT_MAX_HOLD_MS);
    expect(logger.error).not.toHaveBeenCalled(); // its timer went with it
    expect(slots.inUse()).toBe(0);
  });

  it("logs no network address when it takes back an anonymous caller's slot", () => {
    vi.useFakeTimers();
    const { logger, interceptor } = setup();
    upload(interceptor, { ip: "203.0.113.9" }).start();
    vi.advanceTimersByTime(UPLOAD_SLOT_MAX_HOLD_MS);
    expect(logger.error).toHaveBeenCalledExactlyOnceWith("upload_slot.force_released", {
      route: "MediaController.upload",
      owner: "network",
    });
  });
});
