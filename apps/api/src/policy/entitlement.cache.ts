import type { Entitlements } from "@ampm/policy";

/** Entitlements are computed per request and cached for at most five minutes (permission-matrix §1). */
export class EntitlementCache {
  private readonly entries = new Map<string, { value: Entitlements; expiresAt: number }>();

  constructor(
    private readonly ttlMs = 5 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  get(userId: string): Entitlements | undefined {
    const entry = this.entries.get(userId);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(userId);
      return undefined;
    }
    return entry.value;
  }

  set(userId: string, value: Entitlements): void {
    this.entries.set(userId, { value, expiresAt: this.now() + this.ttlMs });
  }

  invalidate(userId: string): void {
    this.entries.delete(userId);
  }
}
