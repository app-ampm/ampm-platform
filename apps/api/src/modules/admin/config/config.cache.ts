/**
 * A configuration value cached by key for at most five minutes; a write invalidates the key.
 * Mirrors EntitlementCache: configuration changes rarely, so the TTL is only a safety net behind
 * explicit invalidation.
 */
export class ConfigCache {
  private readonly entries = new Map<string, { value: unknown; expiresAt: number }>();

  constructor(
    private readonly ttlMs = 5 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  /** The cached value, or `undefined` for a miss; configuration values are never `undefined`. */
  get(key: string): unknown {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: unknown): void {
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
  }

  invalidate(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}
