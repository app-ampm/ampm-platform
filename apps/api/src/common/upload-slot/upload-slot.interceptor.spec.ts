import { EventEmitter } from "node:events";

import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { isAppError } from "@ampm/core";
import { of } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import type { Principal } from "../../policy/principal.types.js";
import { requestContext } from "../request-context.js";
import {
  UPLOAD_BUSY_MESSAGE,
  UPLOAD_RETRY_AFTER_SECONDS,
  UploadSlotInterceptor,
} from "./upload-slot.interceptor.js";
import { UploadSlots } from "./upload-slots.js";

/** A response as the interceptor sees it: it emits finish and close, and takes headers. */
function fakeResponse() {
  return Object.assign(new EventEmitter(), { setHeader: vi.fn() });
}

/** One upload request reaching the interceptor, after the guards, as this caller. */
function upload(
  interceptor: UploadSlotInterceptor,
  caller: { userId?: string; ip?: string },
  socket = { destroyed: false },
) {
  const response = fakeResponse();
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ socket }), getResponse: () => response }),
  } as unknown as ExecutionContext;
  const next: CallHandler = { handle: vi.fn(() => of("handled")) };
  const principal = caller.userId
    ? ({ type: "staff", userId: caller.userId } as unknown as Principal)
    : null;
  const context$ = { requestId: "req-1", ip: caller.ip ?? "203.0.113.7", principal, access: null };
  const run = () => requestContext.run(context$, () => interceptor.intercept(context, next));
  return { response, next, run };
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
  it("takes a slot before the handler and gives it back when the response finishes", () => {
    const slots = new UploadSlots();
    const call = upload(new UploadSlotInterceptor(slots), { userId: "u1" });
    call.run();
    expect(call.next.handle).toHaveBeenCalledOnce();
    expect(slots.inUse("user:u1")).toBe(1);
    call.response.emit("finish");
    call.response.emit("close"); // Node also closes a finished response: the slot is given back once
    expect(slots.inUse()).toBe(0);
  });

  it("answers 503 with Retry-After, before the handler, when the caller holds two uploads", () => {
    const interceptor = new UploadSlotInterceptor(new UploadSlots());
    upload(interceptor, { userId: "u1" }).run();
    upload(interceptor, { userId: "u1" }).run();
    const third = upload(interceptor, { userId: "u1" });
    const error = refusal(third.run);
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
    const slots = new UploadSlots();
    const interceptor = new UploadSlotInterceptor(slots);
    for (const userId of ["u1", "u1", "u2", "u3"]) upload(interceptor, { userId }).run();
    const fifth = upload(interceptor, { userId: "u4" });
    expect(refusal(fifth.run)).toMatchObject({ code: "unavailable" });
    expect(slots.inUse()).toBe(4);
  });

  it("gives the slot back when the connection closes before the response is sent", () => {
    const slots = new UploadSlots();
    const call = upload(new UploadSlotInterceptor(slots), { userId: "u1" });
    call.run();
    call.response.emit("close");
    expect(slots.inUse()).toBe(0);
  });

  it("gives the slot back at once when the caller left before the guards finished", () => {
    const slots = new UploadSlots();
    upload(new UploadSlotInterceptor(slots), { userId: "u1" }, { destroyed: true }).run();
    expect(slots.inUse()).toBe(0);
  });

  it("counts a caller with no principal by their network", () => {
    const slots = new UploadSlots();
    upload(new UploadSlotInterceptor(slots), { ip: "203.0.113.9" }).run();
    expect(slots.inUse("ip:203.0.113.9")).toBe(1);
  });
});
