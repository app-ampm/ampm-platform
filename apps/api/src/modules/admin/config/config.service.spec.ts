import { CONFIG_REGISTRY } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { ConfigRepository, type ConfigRecord } from "./config.repository.js";
import { ConfigService } from "./config.service.js";

class FakeConfigRepository extends ConfigRepository {
  calls = 0;

  constructor(private readonly rows: ReadonlyMap<string, ConfigRecord> = new Map()) {
    super();
  }

  async findByKey(key: string): Promise<ConfigRecord | null> {
    this.calls += 1;
    return this.rows.get(key) ?? null;
  }
}

describe("ConfigService", () => {
  it("returns the registry baseline when no row exists", async () => {
    const service = new ConfigService(new FakeConfigRepository());
    const value = await service.get("session.idle_timeouts");
    expect(value.staffMinutes).toBe(12 * 60);
    expect(value.clientMinutes).toBe(30 * 24 * 60);
  });

  it("lets a configurations row override the baseline", async () => {
    const rows = new Map<string, ConfigRecord>([
      ["feature.flags", { valueJson: { demoMode: true } }],
    ]);
    const service = new ConfigService(new FakeConfigRepository(rows));
    expect(await service.get("feature.flags")).toEqual({ demoMode: true });
  });

  it("refuses a row that does not match the key's shape (misconfiguration, 500)", async () => {
    const rows = new Map<string, ConfigRecord>([
      ["session.idle_timeouts", { valueJson: { staffMinutes: "soon" } }],
    ]);
    const service = new ConfigService(new FakeConfigRepository(rows));
    await expect(service.get("session.idle_timeouts")).rejects.toMatchObject({ code: "internal" });
  });

  it("caches a read and drops it on invalidate", async () => {
    const repository = new FakeConfigRepository();
    const service = new ConfigService(repository);
    await service.get("notification.default_channels");
    await service.get("notification.default_channels");
    expect(repository.calls).toBe(1);
    service.invalidate("notification.default_channels");
    await service.get("notification.default_channels");
    expect(repository.calls).toBe(2);
  });

  it("has a baseline that satisfies its own schema for every key", () => {
    for (const [key, { schema, default: baseline }] of Object.entries(CONFIG_REGISTRY)) {
      expect(schema.safeParse(baseline).success, key).toBe(true);
    }
  });
});
