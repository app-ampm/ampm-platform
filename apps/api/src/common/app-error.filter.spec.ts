import { HttpException, NotFoundException } from "@nestjs/common";
import { errors } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AppErrorFilter } from "./app-error.filter.js";
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

describe("AppErrorFilter", () => {
  it("keeps a typed error's code and status", () => {
    const { status, body } = run(errors.notFound());
    expect(status).toBe(404);
    expect(body).toEqual({ error: { code: "not_found", message: "Not found" } });
  });

  it("turns a schema failure into validation_failed with field paths", () => {
    const result = z.object({ email: z.string().email() }).safeParse({ email: "nope" });
    const { status, body } = run(result.success ? null : result.error);
    expect(status).toBe(400);
    expect(body.error.code).toBe("validation_failed");
    expect(body.error.details[0].path).toBe("email");
  });

  it("maps framework exceptions by status and hides unexpected errors", () => {
    expect(run(new NotFoundException()).body.error.code).toBe("not_found");
    expect(run(new HttpException("teapot", 418)).status).toBe(418);
    const unexpected = run(new Error("database password is hunter2"));
    expect(unexpected.status).toBe(500);
    expect(unexpected.body.error.message).not.toContain("hunter2");
    expect(unexpected.logger.error).toHaveBeenCalled();
  });
});
