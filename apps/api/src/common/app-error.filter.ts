import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from "@nestjs/common";
import { AppError, errors, isAppError, type ApiFailure, type ErrorCode } from "@ampm/core";
import type { NextFunction, Request, Response } from "express";

import { AppLogger } from "./logger.service.js";

// The only route that accepts a binary (application/octet-stream) body: the media upload (feature 9.3b).
const UPLOAD_PATH = /^\/media\/[^/]+\/upload\/?$/;

/**
 * Refuse a binary body on any route but the media upload, BEFORE the raw parser buffers it — so a large
 * octet-stream body cannot amplify memory use pre-auth on a record endpoint (security). Registered right
 * after the JSON parser and before the raw one, so only the upload route ever buffers a large body.
 */
export function refuseBinaryOutsideUpload(req: Request, res: Response, next: NextFunction): void {
  const isOctetStream = (req.headers["content-type"] ?? "")
    .toLowerCase()
    .startsWith("application/octet-stream");
  const isUpload = req.method === "POST" && UPLOAD_PATH.test(req.path);
  if (isOctetStream && !isUpload) {
    const error = new AppError(
      "unsupported_media_type",
      "This route does not accept a binary body",
      undefined,
      415,
    );
    res.status(415).json(error.toEnvelope());
    return;
  }
  next();
}

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

// Fixed wording for the body parser's refusals: its own messages describe the parser, not the
// request, and V8's JSON errors quote the body.
const PARSER_MESSAGES: Readonly<Record<number, string>> = {
  400: "Malformed request body",
  413: "Request body too large",
  415: "Unsupported media type",
};

// The body parser's refusals by their http-errors `type`, as the status they answer with.
const PARSER_TYPES: ReadonlyMap<string, number> = new Map([
  ["entity.parse.failed", 400],
  ["entity.too.large", 413],
  ["charset.unsupported", 415],
  ["encoding.unsupported", 415],
]);

/**
 * Step 8's companion: every failure leaves as the one envelope (api.md). Typed errors keep their
 * code, edge validation included (the Zod pipes throw validation_failed with the field paths). A
 * framework exception keeps its 4xx status with the matching code; a body-parser refusal does too,
 * in the fixed wording of PARSER_MESSAGES (answerParserRefusal types it before Nest sees it).
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

/**
 * A refusal raised outside Nest, as the express body parser raises one (http-errors), as the typed
 * error the API answers with: the status its `type` names, else its own 4xx status, with the fixed
 * wording of PARSER_MESSAGES, never the error's text. Undefined for anything else, a typed error
 * or a framework exception among it: those keep their own answer.
 *
 * @example
 * parserRefusal(Object.assign(new SyntaxError("…"), { status: 400, type: "entity.parse.failed" }));
 * // → AppError validation_failed, "Malformed request body"
 */
export function parserRefusal(exception: unknown): AppError | undefined {
  if (isAppError(exception) || exception instanceof HttpException) return undefined;
  const status = PARSER_TYPES.get(errorType(exception) ?? "") ?? clientErrorStatus(exception);
  return status === undefined
    ? undefined
    : fromStatus(status, PARSER_MESSAGES[status] ?? "Bad request");
}

/**
 * Express error middleware for right after the body parser: a refusal leaves as its typed error
 * (parserRefusal), before Nest turns the parser's SyntaxError into a BadRequestException that
 * carries V8's message and with it part of the body. Anything else passes on unchanged.
 *
 * @example
 * app.useBodyParser("json", { limit: JSON_BODY_LIMIT });
 * app.use(answerParserRefusal);
 */
export function answerParserRefusal(
  error: unknown,
  _request: unknown,
  _response: unknown,
  next: NextFunction,
): void {
  next(parserRefusal(error) ?? error);
}

function toAppError(exception: unknown): AppError {
  if (isAppError(exception)) return exception;
  if (exception instanceof HttpException) {
    return fromStatus(exception.getStatus(), exception.message);
  }
  return parserRefusal(exception) ?? errors.internal();
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

/** The http-errors `type` of a body-parser refusal ("entity.parse.failed"), if it has one. */
function errorType(exception: unknown): string | undefined {
  if (typeof exception !== "object" || exception === null) return undefined;
  return "type" in exception && typeof exception.type === "string" ? exception.type : undefined;
}
