import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from "@nestjs/common";
import { AppError, errors, isAppError, type ApiFailure, type ErrorCode } from "@ampm/core";
import type { Response } from "express";

import { AppLogger } from "./logger.service.js";

const STATUS_CODES: Readonly<Record<number, ErrorCode>> = {
  400: "validation_failed",
  401: "unauthenticated",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  413: "payload_too_large",
  415: "unsupported_media_type",
  429: "rate_limited",
  503: "unavailable",
};

// Fixed wording for the body parser's refusals: its own messages describe the parser, not the request.
const PARSER_MESSAGES: Readonly<Record<number, string>> = {
  400: "Malformed request body",
  413: "Request body too large",
  415: "Unsupported media type",
};

/**
 * Step 8's companion: every failure leaves as the one envelope (api.md). Typed errors keep their
 * code, edge validation included (the Zod pipes throw validation_failed with the field paths). A
 * framework exception or a body-parser refusal keeps its 4xx status with the matching code.
 * Anything else, a ZodError from the API's own response models among it, is logged with the
 * request id and answered as internal, without its message.
 */
@Catch()
export class AppErrorFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const error = toAppError(exception);
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
}

function toAppError(exception: unknown): AppError {
  if (isAppError(exception)) return exception;
  if (exception instanceof HttpException) {
    return fromStatus(exception.getStatus(), exception.message);
  }
  const status = clientErrorStatus(exception);
  if (status !== undefined) {
    return fromStatus(status, PARSER_MESSAGES[status] ?? "Bad request");
  }
  return errors.internal();
}

function fromStatus(status: number, message: string): AppError {
  const code = STATUS_CODES[status] ?? (status >= 500 ? "internal" : "validation_failed");
  if (code === "internal") return errors.internal();
  return new AppError(code, message, undefined, status);
}

/** The 4xx status of an error raised outside Nest, as the express body parser (http-errors) does. */
function clientErrorStatus(exception: unknown): number | undefined {
  if (typeof exception !== "object" || exception === null) return undefined;
  const status =
    "statusCode" in exception
      ? exception.statusCode
      : "status" in exception
        ? exception.status
        : undefined;
  return typeof status === "number" && status >= 400 && status < 500 ? status : undefined;
}
