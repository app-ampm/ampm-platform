import { describe, expect, it } from "vitest";

import { AppError, errors, isApiFailure, MAX_RETRY_AFTER_SECONDS } from "./errors";

describe("errors", () => {
  it("maps each code to its status and envelope", () => {
    const error = errors.validation([{ path: "email", message: "must be an email" }]);
    expect(error).toBeInstanceOf(AppError);
    expect(error.status).toBe(400);
    expect(error.toEnvelope()).toEqual({
      error: {
        code: "validation_failed",
        message: "Validation failed",
        details: [{ path: "email", message: "must be an email" }],
      },
    });
    expect(errors.notFound().status).toBe(404);
    expect(errors.unauthenticated().status).toBe(401);
  });

  it("carries the seconds to wait when the answer gave them, never in the envelope (D-189 §3)", () => {
    const limited = errors.rateLimited("Try again in a minute", 42);
    expect(limited).toMatchObject({ code: "rate_limited", status: 429, retryAfterSeconds: 42 });
    expect(limited.toEnvelope()).toEqual({
      error: { code: "rate_limited", message: "Try again in a minute" },
    });
    expect(errors.unavailable("Try later", 3600).retryAfterSeconds).toBe(3600);
    expect(errors.rateLimited().retryAfterSeconds).toBeUndefined();
    expect(new AppError("not_found", "Not found").retryAfterSeconds).toBeUndefined();
    // Whole seconds from 0: a fraction rounds up, and a negative or non-finite figure means none.
    expect(new AppError("rate_limited", "x", undefined, undefined, 1.2).retryAfterSeconds).toBe(2);
    expect(new AppError("rate_limited", "x", undefined, undefined, -1).retryAfterSeconds).toBe(
      undefined,
    );
    expect(
      new AppError("rate_limited", "x", undefined, undefined, Number.NaN).retryAfterSeconds,
    ).toBeUndefined();
  });

  it("never names a wait longer than a day, the longest window any limit counts", () => {
    expect(MAX_RETRY_AFTER_SECONDS).toBe(86_400);
    expect(errors.rateLimited("x", 86_400).retryAfterSeconds).toBe(86_400);
    expect(errors.rateLimited("x", 86_399.5).retryAfterSeconds).toBe(86_400);
    expect(errors.rateLimited("x", 86_401).retryAfterSeconds).toBe(86_400);
    expect(errors.unavailable("x", 1e12).retryAfterSeconds).toBe(86_400);
    expect(errors.unavailable("x", Number.POSITIVE_INFINITY).retryAfterSeconds).toBeUndefined();
  });

  it("recognises a failure envelope", () => {
    expect(isApiFailure({ error: { code: "not_found", message: "x" } })).toBe(true);
    expect(isApiFailure({ data: 1 })).toBe(false);
  });
});
