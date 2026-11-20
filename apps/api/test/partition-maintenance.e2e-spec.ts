import type { NestExpressApplication } from "@nestjs/platform-express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import {
  PartitionMaintenanceService,
  partitionMaintenanceJob,
} from "../src/modules/admin/partitions/partition-maintenance.service.js";
import { quoteIdent } from "../src/modules/admin/partitions/partition-months.js";
import { startApi } from "./start-api.js";

/** The test runs the job years past the migrations' last month, so it has months to create and drop. */
const TEST_PARTITION = /_(2031|2032|2033)_\d{2}$/;
/** Marks the notifications this file inserts, so cleanup finds them wherever they were routed. */
const TEST_TEMPLATE = "e2e.partition_maintenance";
const RECIPIENT = "0192f3a0-7d3e-7b1a-9c2f-0000000000f1";
const TABLES = ["audit_events", "notifications"] as const;

/** `audit_events_2031_03` … for each table and two-digit month, audit_events first, as the job reports them. */
function names(year: number, months: readonly number[]): string[] {
  return TABLES.flatMap((table) =>
    months.map((month) => `${table}_${year}_${String(month).padStart(2, "0")}`),
  );
}

/**
 * The partition-maintenance job against the migrated test database (data.md partitioning). It creates the
 * months a run must keep exactly as the migrations do (same bounds, indexes and keys), is a no-op the
 * second time, and refuses, loudly and without moving a row, a month whose rows already sit in DEFAULT.
 */
describe("Partition maintenance (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let service: PartitionMaintenanceService;

  beforeAll(async () => {
    ({ app } = await startApi());
    prisma = app.get(PrismaService);
    service = app.get(PartitionMaintenanceService);
    await cleanUp(); // a run that was interrupted may have left its partitions behind
  });

  beforeEach(async () => {
    await prisma.jobRun.deleteMany({ where: { jobName: partitionMaintenanceJob.name } });
  });

  afterAll(async () => {
    await cleanUp();
    await prisma.jobRun.deleteMany({ where: { jobName: partitionMaintenanceJob.name } });
    await app.close();
  });

  async function partitionsOf(table: string): Promise<string[]> {
    const rows = await prisma.$queryRaw<{ name: string }[]>`
      SELECT c.relname::text AS name FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid
      WHERE i.inhparent = to_regclass(${table}) ORDER BY 1`;
    return rows.map((row) => row.name);
  }

  async function cleanUp(): Promise<void> {
    await prisma.notification.deleteMany({ where: { templateKey: TEST_TEMPLATE } });
    for (const table of TABLES) {
      for (const name of (await partitionsOf(table)).filter((n) => TEST_PARTITION.test(n))) {
        await prisma.$executeRawUnsafe(`DROP TABLE ${quoteIdent(name)}`);
      }
    }
  }

  /** A partition's indexes and constraints, its own name replaced, to compare with another partition's. */
  async function definitions(partition: string): Promise<string[]> {
    const rows = await prisma.$queryRaw<{ def: string }[]>`
      SELECT indexdef AS def FROM pg_indexes
      WHERE schemaname = current_schema() AND tablename = ${partition}
      UNION ALL
      SELECT conname::text || ' ' || pg_get_constraintdef(oid) FROM pg_constraint
      WHERE conrelid = to_regclass(${partition})`;
    return rows.map((row) => row.def.replaceAll(partition, "<partition>")).sort();
  }

  /**
   * Inserts a notification at an exact instant. Raw SQL with the offset spelled out, because Prisma's pg
   * adapter sends DateTime values without one: on a database whose TimeZone is not UTC (a developer's
   * Homebrew PostgreSQL in India, say) the stored instant would shift by the zone's offset. CI and
   * production run in UTC (infra/postgres/postgresql.conf), where the two agree.
   */
  async function notifyAt(createdAt: string): Promise<string> {
    const [row] = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO notifications (id, recipient_type, recipient_id, channel, template_key, created_at, updated_at)
      VALUES (gen_random_uuid(), 'user', ${RECIPIENT}::uuid, 'in_app', ${TEST_TEMPLATE}, ${createdAt}::timestamptz, now())
      RETURNING id::text AS id`;
    if (!row) throw new Error("the insert returned no row");
    return row.id;
  }

  /** The partition PostgreSQL routed a notification to. */
  async function partitionHolding(notificationId: string): Promise<string | undefined> {
    const [row] = await prisma.$queryRaw<{ partition: string }[]>`
      SELECT tableoid::regclass::text AS partition FROM notifications WHERE id = ${notificationId}::uuid`;
    return row?.partition;
  }

  async function runsOf(day: string) {
    return prisma.jobRun.findMany({
      where: { idempotencyKey: `${partitionMaintenanceJob.name}.${day}` },
      orderBy: { createdAt: "asc" },
    });
  }

  it("finds every month to December 2027 made by the migrations, so today it creates nothing", async () => {
    const migrated = [
      ...names(2026, [10, 11, 12]),
      ...names(2027, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
    ];
    for (const table of TABLES) {
      expect(await partitionsOf(table)).toEqual(
        expect.arrayContaining([
          `${table}_default`,
          ...migrated.filter((n) => n.startsWith(table)),
        ]),
      );
    }

    const outcome = await service.run(new Date("2026-11-20T09:00:00Z"));

    expect(outcome).toEqual({
      months: { from: "2026-11", to: "2027-05" },
      created: [],
      blocked: [],
    });
    const [run] = await runsOf("2026-11-20");
    expect(run?.status).toBe("succeeded");
  });

  it("creates the coming months like the migrations' partitions, and a second run is a no-op", async () => {
    const now = new Date("2031-03-15T12:00:00Z");

    const first = await service.run(now);

    expect(first.created).toEqual(names(2031, [3, 4, 5, 6, 7, 8, 9]));
    expect(first.blocked).toEqual([]);
    // The same primary key, indexes and foreign key as partitions the first migration made.
    expect(await definitions("audit_events_2031_03")).toEqual(
      await definitions("audit_events_2026_10"),
    );
    expect(await definitions("notifications_2031_09")).toEqual(
      await definitions("notifications_2026_10"),
    );
    // UTC month bounds: the last instant of March lands in March, the first of April in April.
    expect(await partitionHolding(await notifyAt("2031-03-31T23:59:59.999Z"))).toBe(
      "notifications_2031_03",
    );
    expect(await partitionHolding(await notifyAt("2031-04-01T00:00:00.000Z"))).toBe(
      "notifications_2031_04",
    );

    const second = await service.run(now);

    expect(second.created).toEqual([]);
    expect(second.blocked).toEqual([]);
    const runs = await runsOf("2031-03-15");
    expect(runs.map((run) => run.status)).toEqual(["succeeded", "succeeded"]);
    expect(runs[0]?.detailJson).toEqual(expect.objectContaining({ created: first.created }));
  });

  it("refuses a month whose rows already sit in DEFAULT, creates the rest, and records the failure", async () => {
    const stray = await notifyAt("2032-05-10T08:00:00Z");
    expect(await partitionHolding(stray)).toBe("notifications_default");
    const now = new Date("2032-04-10T00:00:00Z");

    await expect(service.run(now)).rejects.toThrow(
      /notifications_2032_05 \(1 in notifications_default\)/,
    );

    expect(await partitionsOf("notifications")).not.toContain("notifications_2032_05");
    const others = names(2032, [4, 5, 6, 7, 8, 9, 10]).filter((n) => n !== "notifications_2032_05");
    expect([
      ...(await partitionsOf("audit_events")),
      ...(await partitionsOf("notifications")),
    ]).toEqual(expect.arrayContaining(others));
    // Nothing was moved or lost: the row is still in DEFAULT for a person to deal with.
    expect(await partitionHolding(stray)).toBe("notifications_default");
    const [failed] = await runsOf("2032-04-10");
    expect(failed?.status).toBe("failed");
    expect(failed?.error).toContain("notifications_2032_05");

    // Once the month's rows are out of DEFAULT, the next run creates its partition.
    await prisma.notification.deleteMany({ where: { id: stray } });
    const retry = await service.run(now);
    expect(retry).toEqual({
      months: { from: "2032-04", to: "2032-10" },
      created: ["notifications_2032_05"],
      blocked: [],
    });
  });

  it("gives up on a busy table after the lock timeout instead of queueing its traffic behind it", async () => {
    const now = new Date("2033-01-15T00:00:00Z");
    let failure: unknown;
    // A reader of notifications holds its lock in an open transaction while the job runs.
    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM notifications LIMIT 1`;
        failure = await service.run(now).catch((error: unknown) => error);
      },
      { timeout: 20_000 },
    );

    expect(failure).toBeInstanceOf(Error);
    expect(String(failure)).toMatch(/lock timeout/);
    // audit_events was free, so its months were created before notifications timed out.
    const auditMonths = names(2033, [1, 2, 3, 4, 5, 6, 7]).filter((n) => n.startsWith("audit_"));
    expect(await partitionsOf("audit_events")).toEqual(expect.arrayContaining(auditMonths));
    expect(await partitionsOf("notifications")).not.toContain("notifications_2033_01");
    const [run] = await runsOf("2033-01-15");
    expect(run?.status).toBe("failed");
    expect(run?.error).toMatch(/lock timeout/);
    expect(run?.detailJson).toEqual(expect.objectContaining({ created: auditMonths }));
  }, 20_000);
});
