import { Inject, Injectable, type LoggerService } from "@nestjs/common";
import { createLogger, type LogFields, type Logger } from "@ampm/core";

import { ENV, type Env } from "../env.js";
import { requestContext } from "./request-context.js";

/**
 * The API's logger: core's structured JSON logger, every entry stamped with the request id and the
 * principal from the request context. Also serves as Nest's own LoggerService so framework
 * messages land in the same stream.
 */
@Injectable()
export class AppLogger implements LoggerService {
  private readonly root: Logger;

  constructor(@Inject(ENV) env: Env) {
    this.root = createLogger({ service: "ampm-api" }, { level: env.LOG_LEVEL });
  }

  /** A logger bound to the current request, or the root logger outside a request. */
  get current(): Logger {
    const context = requestContext.get();
    if (!context) return this.root;
    const principal = context.principal;
    return this.root.child({
      requestId: context.requestId,
      ...(principal && principal.type !== "system"
        ? { principalType: principal.type, principalId: principal.userId }
        : {}),
    });
  }

  debug(event: string, fields?: LogFields): void {
    this.current.debug(event, fields);
  }
  info(event: string, fields?: LogFields): void {
    this.current.info(event, fields);
  }
  warn(event: string, fields?: LogFields): void {
    this.current.warn(event, fields);
  }
  error(event: string, fields?: LogFields): void {
    this.current.error(event, fields);
  }

  // Nest's LoggerService shape (message, context) for framework output.
  log(message: unknown, context?: string): void {
    this.current.info("nest", { message: String(message), ...(context ? { context } : {}) });
  }
  verbose(message: unknown, context?: string): void {
    this.current.debug("nest", { message: String(message), ...(context ? { context } : {}) });
  }
  fatal(message: unknown, context?: string): void {
    this.current.error("nest.fatal", { message: String(message), ...(context ? { context } : {}) });
  }
}
