import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { errors } from "@ampm/core";
import type { Response } from "express";

import { AppLogger } from "../logger.service.js";
import { requestContext } from "../request-context.js";
import { clientKey } from "./client-key.js";
import { RATE_LIMIT, type RateLimitOptions } from "./rate-limit.decorator.js";
import { RateLimitStore, type RateLimitHit } from "./rate-limit.store.js";

/** One window a request counts against: its bucket key and its ceiling. */
interface Window {
  readonly key: string;
  readonly limit: number;
}

/**
 * Enforces a route's @RateLimit, after AuthGuard so the caller is known: the window is keyed by the
 * authenticated principal, or by the client network before they authenticate (so a public endpoint like
 * activation is capped per client); for a signed-in caller `perIpLimit` adds a window per network. Over
 * a limit answers 429 `rate_limited` with `Retry-After`. On a store outage a fail-closed route answers
 * 503 `unavailable`, and any other route lets the request through, so a broken limiter never locks
 * everyone out of reading; either way it logs that the store was down (D-046, D-149).
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
    for (const window of this.windows(options)) {
      const hit = await this.count(window.key, options);
      if (!hit) return true; // the store is down, and this route fails open
      if (hit.count > window.limit) {
        const response = context.switchToHttp().getResponse<Response>();
        response.setHeader("Retry-After", Math.ceil(hit.resetMs / 1000));
        throw errors.rateLimited();
      }
    }
    return true;
  }

  /**
   * The windows this request counts against: the signed-in user's (plus their network's, when the route
   * caps networks too), else the client network's. An IPv6 client counts by its /64, so rotating
   * addresses inside one subnet earns no extra tries.
   */
  private windows(options: RateLimitOptions): readonly Window[] {
    const current = requestContext.get();
    const network = {
      key: `rl:${options.name}:ip:${clientKey(current?.ip)}`,
      limit: options.limit,
    };
    const principal = current?.principal;
    if (!principal || !("userId" in principal)) return [network];
    const user = { key: `rl:${options.name}:user:${principal.userId}`, limit: options.limit };
    if (options.perIpLimit === undefined) return [user];
    return [user, { ...network, limit: options.perIpLimit }];
  }

  /** Counts one hit; null when the store is down on a route that fails open, 503 when it fails closed. */
  private async count(key: string, options: RateLimitOptions): Promise<RateLimitHit | null> {
    try {
      return await this.store.hit(key, options.windowMs);
    } catch {
      this.logger.warn("rate_limit.store_unavailable", {
        name: options.name,
        failClosed: options.failClosed,
      });
      if (options.failClosed) throw errors.unavailable();
      return null;
    }
  }
}
