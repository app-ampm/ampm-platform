import { describe, expect, it } from "vitest";

import { AppError, errors, isApiFailure } from "./errors";

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

  it("recognises a failure envelope", () => {
    expect(isApiFailure({ error: { code: "not_found", message: "x" } })).toBe(true);
    expect(isApiFailure({ data: 1 })).toBe(false);
  });
});
