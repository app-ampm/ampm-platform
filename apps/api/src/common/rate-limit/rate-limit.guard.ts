import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { errors } from "@ampm/core";
import type { Response } from "express";

import { AppLogger } from "../logger.service.js";
import { requestContext } from "../request-context.js";
import { RATE_LIMIT, type RateLimitOptions } from "./rate-limit.decorator.js";
import { RateLimitStore, type RateLimitHit } from "./rate-limit.store.js";

/**
 * Enforces a route's @RateLimit, after AuthGuard so the caller is known: the window is keyed by the
 * authenticated principal, or by the client IP before they authenticate (so a public endpoint like
 * activation is capped per client). Over the limit answers 429 `rate_limited` with `Retry-After`. It
 * fails OPEN on a store outage — a broken limiter must not lock everyone out — logging that it did.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly store: RateLimitStore,
    private readonly logger: AppLogger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) return true;
    const key = `rl:${options.name}:${this.caller()}`;
    let hit: RateLimitHit;
    try {
      hit = await this.store.hit(key, options.windowMs);
    } catch {
      // Fail open: a broken limiter must not lock everyone out (the trade-off is recorded in D-046).
      this.logger.warn("rate_limit.store_unavailable", { name: options.name });
      return true;
    }
    if (hit.count > options.limit) {
      const response = context.switchToHttp().getResponse<Response>();
      response.setHeader("Retry-After", Math.ceil(hit.resetMs / 1000));
      throw errors.rateLimited();
    }
    return true;
  }

  /** The caller identity for the window: the authenticated user, else the client IP. */
  private caller(): string {
    const principal = requestContext.get()?.principal;
    if (principal && "userId" in principal) return `user:${principal.userId}`;
    return `ip:${requestContext.get()?.ip ?? "unknown"}`;
  }
}
