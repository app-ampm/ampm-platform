import { CONFIG_REGISTRY } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { PrismaService } from "../../../db/prisma.service.js";
import { AuditService, type AuditInput } from "../../../policy/audit.service.js";
import { ConfigRepository, type ConfigRecord } from "./config.repository.js";
import { ConfigService } from "./config.service.js";

class FakeConfigRepository extends ConfigRepository {
  calls = 0;
  readonly upserts: { key: string; valueJson: unknown }[] = [];

  constructor(private readonly rows: Map<string, ConfigRecord> = new Map()) {
    super();
  }

  async findByKey(key: string): Promise<ConfigRecord | null> {
    this.calls += 1;
    return this.rows.get(key) ?? null;
  }

  async upsert(key: string, valueJson: unknown): Promise<{ id: string }> {
    this.upserts.push({ key, valueJson });
    this.rows.set(key, { valueJson });
    return { id: `cfg-${this.upserts.length}` };
  }
}

/** Captures audit calls; `super(...)` is given a dummy because `record` is overridden (test-only). */
class FakeAudit extends AuditService {
  readonly records: AuditInput[] = [];
  constructor() {
    super(null as unknown as PrismaService);
  }
  override async record(input: AuditInput): Promise<void> {
    this.records.push(input);
  }
}

function build(rows?: Map<string, ConfigRecord>) {
  const repository = new FakeConfigRepository(rows);
  const audit = new FakeAudit();
  return { service: new ConfigService(repository, audit), repository, audit };
}

describe("ConfigService", () => {
  it("returns the registry baseline when no row exists", async () => {
    const value = await build().service.get("session.idle_timeouts");
    expect(value.staffMinutes).toBe(12 * 60);
    expect(value.clientMinutes).toBe(30 * 24 * 60);
  });

  it("lets a configurations row override the baseline", async () => {
    const rows = new Map<string, ConfigRecord>([
      ["feature.flags", { valueJson: { demoMode: true } }],
    ]);
    expect(await build(rows).service.get("feature.flags")).toEqual({ demoMode: true });
  });

  it("refuses a row that does not match the key's shape (misconfiguration, 500)", async () => {
    const rows = new Map<string, ConfigRecord>([
      ["session.idle_timeouts", { valueJson: { staffMinutes: "soon" } }],
    ]);
    await expect(build(rows).service.get("session.idle_timeouts")).rejects.toMatchObject({
      code: "internal",
    });
  });

  it("caches a read and drops it on invalidate", async () => {
    const { service, repository } = build();
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

  it("writes a valid value, audits it as a create, and returns it", async () => {
    const { service, repository, audit } = build();
    const result = await service.set("feature.flags", { beta: true });
    expect(result).toEqual({ key: "feature.flags", value: { beta: true } });
    expect(repository.upserts).toEqual([{ key: "feature.flags", valueJson: { beta: true } }]);
    expect(audit.records[0]).toMatchObject({
      action: "create",
      entityType: "configuration",
      entityId: "cfg-1",
      after: { beta: true },
      maskImages: false,
    });
    // A create has no before image (undefined), so the audit omits it rather than writing a null.
    expect(audit.records[0]?.before).toBeUndefined();
  });

  it("audits a write over an existing value as an update with before and after", async () => {
    const rows = new Map<string, ConfigRecord>([["feature.flags", { valueJson: { beta: false } }]]);
    const { service, audit } = build(rows);
    await service.set("feature.flags", { beta: true });
    expect(audit.records[0]).toMatchObject({
      action: "update",
      entityType: "configuration",
      before: { beta: false },
      after: { beta: true },
    });
  });

  it("invalidates the cache so the next read sees the written value", async () => {
    const { service } = build();
    expect(await service.get("feature.flags")).toEqual({}); // baseline
    await service.set("feature.flags", { beta: true });
    expect(await service.get("feature.flags")).toEqual({ beta: true });
  });

  it("rejects a value that does not match the key's schema, writing and auditing nothing", async () => {
    const { service, repository, audit } = build();
    await expect(
      service.set("session.idle_timeouts", { staffMinutes: "soon" }),
    ).rejects.toMatchObject({
      code: "validation_failed",
    });
    expect(repository.upserts).toHaveLength(0);
    expect(audit.records).toHaveLength(0);
  });

  it("rejects an unknown configuration key", async () => {
    await expect(build().service.set("nope.not_a_key", {})).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
