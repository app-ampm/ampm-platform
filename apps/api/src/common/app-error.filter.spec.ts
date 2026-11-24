import { HttpException, NotFoundException } from "@nestjs/common";
import { errors, isAppError } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  AppErrorFilter,
  answerParserRefusal,
  isPostGuardUpload,
  refuseBinaryOutsideUpload,
} from "./app-error.filter.js";
import type { AppLogger } from "./logger.service.js";

function run(exception: unknown) {
  const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const host = { switchToHttp: () => ({ getResponse: () => response }) };
  const logger = { info: vi.fn(), error: vi.fn() } as unknown as AppLogger;
  new AppErrorFilter(logger).catch(exception, host as never);
  return {
    status: response.status.mock.calls[0]?.[0],
    body: response.json.mock.calls[0]?.[0],
    logger,
  };
}

/** An error as the express body parser raises it (http-errors): a plain Error with a status. */
function parserError(message: string, status: number, type: string): Error {
  return Object.assign(new Error(message), { status, statusCode: status, type, expose: true });
}

describe("AppErrorFilter", () => {
  it("keeps a typed error's code and status", () => {
    const { status, body } = run(errors.notFound());
    expect(status).toBe(404);
    expect(body).toEqual({ error: { code: "not_found", message: "Not found" } });
  });

  it("keeps the field paths of an edge validation failure", () => {
    const { status, body } = run(errors.validation([{ path: "email", message: "Invalid email" }]));
    expect(status).toBe(400);
    expect(body.error).toEqual({
      code: "validation_failed",
      message: "Validation failed",
      details: [{ path: "email", message: "Invalid email" }],
    });
  });

  it("answers a schema failure in server code as internal, not as the caller's mistake", () => {
    // A ZodError that reaches the filter came from the API parsing its own data (a response model);
    // edge validation leaves the pipe as a typed validation error instead.
    const result = z.object({ email: z.email() }).safeParse({ email: "stored-but-invalid" });
    const { status, body, logger } = run(result.success ? null : result.error);
    expect(status).toBe(500);
    expect(body).toEqual({ error: { code: "internal", message: "Something went wrong" } });
    expect(logger.error).toHaveBeenCalled();
  });

  it("maps the body parser's client errors to their status and a fixed message", () => {
    const tooLarge = run(parserError("request entity too large", 413, "entity.too.large"));
    expect(tooLarge.status).toBe(413);
    expect(tooLarge.body).toEqual({
      error: { code: "payload_too_large", message: "Request body too large" },
    });
    expect(tooLarge.logger.error).not.toHaveBeenCalled();
    expect(tooLarge.logger.info).toHaveBeenCalled();

    const malformed = run(parserError("Unexpected token } in JSON", 400, "entity.parse.failed"));
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe("validation_failed");
    expect(malformed.body.error.message).not.toContain("Unexpected token");

    const charset = run(parserError('unsupported charset "UTF-7"', 415, "charset.unsupported"));
    expect(charset.status).toBe(415);
    expect(charset.body.error.code).toBe("unsupported_media_type");
  });

  it("answers a parser refusal before Nest rewrites it, by its type and never with its text", () => {
    // As body-parser raises invalid JSON: V8's SyntaxError, quoting the body, with the http-errors
    // fields. Nest would turn a SyntaxError into a BadRequestException carrying that message.
    const quoted = Object.assign(new SyntaxError(`Unexpected token '"', ""secret"" is not JSON`), {
      status: 400,
      statusCode: 400,
      type: "entity.parse.failed",
      body: '"secret"',
    });
    const passed: unknown[] = [];
    const answer = (error: unknown) =>
      answerParserRefusal(error, {}, {}, (next?: unknown) => passed.push(next));
    answer(quoted);
    expect(passed).toHaveLength(1);
    expect(isAppError(passed[0]) && passed[0].toEnvelope()).toEqual({
      error: { code: "validation_failed", message: "Malformed request body" },
    });

    answer(parserError("request entity too large", 413, "entity.too.large"));
    expect(isAppError(passed[1]) && passed[1].status).toBe(413);

    // Anything else passes on unchanged: an unexpected error for the filter to log as internal,
    // a typed error with its own answer.
    const unexpected = new Error("stream encoding should not be set");
    const typed = errors.notFound();
    answer(unexpected);
    answer(typed);
    expect(passed.slice(2)).toEqual([unexpected, typed]);
    expect(passed[3]).toBe(typed);
  });

  it("maps framework exceptions by status and hides unexpected errors", () => {
    expect(run(new NotFoundException()).body.error.code).toBe("not_found");
    expect(run(new HttpException("teapot", 418)).status).toBe(418);
    const unexpected = run(new Error("database password is hunter2"));
    expect(unexpected.status).toBe(500);
    expect(unexpected.body.error.message).not.toContain("hunter2");
    expect(unexpected.logger.error).toHaveBeenCalled();
    // A status outside 4xx on a non-framework error is never trusted.
    expect(run(Object.assign(new Error("upstream"), { status: 503 })).status).toBe(500);
  });
});

describe("the binary-body gate (D-176)", () => {
  /** Runs the gate on an octet-stream request; true when it lets the request through. */
  function passes(method: string, url: string): boolean {
    const path = url.split("?")[0] ?? "";
    const req = { method, url, path, headers: { "content-type": "application/octet-stream" } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    refuseBinaryOutsideUpload(req as never, res as never, next);
    return next.mock.calls.length === 1;
  }

  it("lets a binary body through to the import, which reads it after the guards", () => {
    // The path is the URL's before any query (the route itself refuses a query, D-184).
    expect(passes("POST", "/hotels-admin/imports/hotels?source=sheet")).toBe(true);
    expect(
      isPostGuardUpload({ method: "POST", url: "/hotels-admin/imports/hotels?source=sheet" }),
    ).toBe(true);
  });

  it("reads each kind's preview after the guards, and nothing else under imports (D-181, D-183)", () => {
    for (const kind of ["hotels", "rooms", "venues", "rates"]) {
      expect(isPostGuardUpload({ method: "POST", url: `/hotels-admin/imports/${kind}` })).toBe(
        true,
      );
    }
    for (const kind of ["rooms", "rates"]) {
      const apply = `/hotels-admin/imports/${kind}/0192f1a0-0000-7000-8000-0000000000a1/apply`;
      expect(isPostGuardUpload({ method: "POST", url: apply })).toBe(false);
      expect(passes("POST", apply)).toBe(false); // the import takes no file: a binary body is a 415
    }
    expect(isPostGuardUpload({ method: "POST", url: "/hotels-admin/imports/contacts" })).toBe(
      false,
    );
  });

  it("keeps the buffered upload routes off the post-guard list", () => {
    expect(passes("POST", "/media/0192f1a0-0000-7000-8000-0000000000a1/upload")).toBe(true);
    expect(isPostGuardUpload({ method: "POST", url: "/media/x/upload" })).toBe(false);
  });

  it("still refuses a binary body on a record route, or on the import with another method", () => {
    expect(passes("POST", "/hotels-admin/hotels")).toBe(false);
    expect(passes("PATCH", "/hotels-admin/imports/hotels")).toBe(false);
    expect(isPostGuardUpload({ method: "PUT", url: "/hotels-admin/imports/hotels" })).toBe(false);
  });
});
