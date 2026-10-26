import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from "@nestjs/common";
import { AppError, errors, isAppError, type ApiFailure, type ErrorCode } from "@ampm/core";
import type { Response } from "express";
import { ZodError } from "zod";

import { AppLogger } from "./logger.service.js";

const STATUS_CODES: Record<number, ErrorCode> = {
  400: "validation_failed",
  401: "unauthenticated",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  429: "rate_limited",
  503: "unavailable",
};

/**
 * Step 8's companion: every failure leaves as the one envelope (api.md). Typed errors keep their
 * code; a schema failure becomes validation_failed with the field paths; anything unexpected is
 * logged with the request id and answered as internal, without its message.
 */
@Catch()
export class AppErrorFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const error = this.toAppError(exception);
    if (error.code === "internal") {
      this.logger.error("request.failed", {
        error: exception instanceof Error ? exception.message : String(exception),
      });
    } else {
      this.logger.info("request.rejected", { code: error.code, status: error.status });
    }
    const body: ApiFailure = error.toEnvelope();
    response.status(error.status).json(body);
  }

  private toAppError(exception: unknown): AppError {
    if (isAppError(exception)) return exception;
    if (exception instanceof ZodError) {
      return errors.validation(
        exception.issues.map((issue) => ({
          path: issue.path.map(String).join("."),
          message: issue.message,
        })),
      );
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = STATUS_CODES[status] ?? (status >= 500 ? "internal" : "validation_failed");
      const message = code === "internal" ? "Something went wrong" : exception.message;
      return new AppError(code, message, undefined, code === "internal" ? 500 : status);
    }
    return errors.internal();
  }
}
