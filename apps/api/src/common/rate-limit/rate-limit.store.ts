import { Redis } from "ioredis";

export interface RateLimitHit {
  /** How many requests this caller has made in the current window (including this one). */
  readonly count: number;
  /** Milliseconds until the window resets. */
  readonly resetMs: number;
}

/** A fixed-window request counter per caller key. */
export abstract class RateLimitStore {
  abstract hit(key: string, windowMs: number): Promise<RateLimitHit>;
}

/**
 * Redis-backed fixed window for staging/production: INCR the key, set its TTL on the first hit, and read
 * the remaining TTL — in one atomic Lua script, so concurrent requests cannot miss the expiry.
 */
export class RedisRateLimitStore extends RateLimitStore {
  private static readonly SCRIPT =
    "local c = redis.call('INCR', KEYS[1]) " +
    "if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end " +
    "return {c, redis.call('PTTL', KEYS[1])}";

  /** Builds the store on a fail-fast client (staging/production) so a Redis outage surfaces to the
   * guard, which fails open, rather than blocking requests. */
  static fromUrl(redisUrl: string): RedisRateLimitStore {
    return new RedisRateLimitStore(
      new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        commandTimeout: 500,
      }),
    );
  }

  constructor(private readonly redis: Redis) {
    super();
  }

  async hit(key: string, windowMs: number): Promise<RateLimitHit> {
    const result = await this.redis.eval(RedisRateLimitStore.SCRIPT, 1, key, windowMs);
    const pair = Array.isArray(result) ? result : [];
    const count = typeof pair[0] === "number" ? pair[0] : 0;
    const ttl = typeof pair[1] === "number" ? pair[1] : windowMs;
    return { count, resetMs: ttl >= 0 ? ttl : windowMs };
  }
}

/** In-memory fixed window for development and tests, where Redis is absent (D-031). */
export class MemoryRateLimitStore extends RateLimitStore {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  async hit(key: string, windowMs: number): Promise<RateLimitHit> {
    const now = Date.now();
    const current = this.windows.get(key);
    if (!current || now >= current.resetAt) {
      this.windows.set(key, { count: 1, resetAt: now + windowMs });
      return { count: 1, resetMs: windowMs };
    }
    current.count += 1;
    return { count: current.count, resetMs: current.resetAt - now };
  }
}
