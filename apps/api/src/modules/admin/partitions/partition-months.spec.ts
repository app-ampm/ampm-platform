import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  addMonths,
  createPartitionSql,
  defaultRowsSql,
  lockParentSql,
  monthBounds,
  monthLabel,
  monthOf,
  monthsToKeep,
  PARTITIONED_TABLES,
  partitionName,
  quoteIdent,
  type PartitionedTable,
  type PartitionMonth,
} from "./partition-months.js";

const AUDIT: PartitionedTable = { table: "audit_events", column: "occurred_at" };
const NOTIFICATIONS: PartitionedTable = { table: "notifications", column: "created_at" };
const MIGRATIONS = new URL("../../../../prisma/migrations/", import.meta.url);

/** The `CREATE TABLE … PARTITION OF …` statements of a migration, without their semicolons. */
function partitionStatements(folderSuffix: string): string[] {
  const folder = readdirSync(MIGRATIONS).find((name) => name.endsWith(folderSuffix));
  if (!folder) throw new Error(`No migration ending in ${folderSuffix}`);
  const sql = readFileSync(new URL(`${folder}/migration.sql`, MIGRATIONS), "utf8");
  return sql
    .split("\n")
    .filter((line) => / PARTITION OF .* FOR VALUES /.test(line))
    .map((line) => line.replace(/;$/, ""));
}

/** `count` months from `first`, one statement per table and month, audit_events first. */
function expectedStatements(first: PartitionMonth, count: number): string[] {
  const months = Array.from({ length: count }, (_, offset) => addMonths(first, offset));
  return PARTITIONED_TABLES.flatMap((spec) =>
    months.map((month) => createPartitionSql(spec, month)),
  );
}

describe("partition months", () => {
  it("takes the month from UTC, whatever the local time zone says", () => {
    // 23:59 UTC on 31 January is already 1 February in India: still January's partition.
    expect(monthOf(new Date("2027-01-31T23:59:59.999Z"))).toEqual({ year: 2027, month: 1 });
    expect(monthOf(new Date("2027-01-31T20:00:00.000-05:00"))).toEqual({ year: 2027, month: 2 });
    expect(monthOf(new Date("2027-02-01T00:00:00.000Z"))).toEqual({ year: 2027, month: 2 });
    expect(monthOf(new Date("2027-02-01T05:29:59.000+05:30"))).toEqual({ year: 2027, month: 1 });
  });

  it("adds months across year ends, forwards and backwards", () => {
    expect(addMonths({ year: 2027, month: 12 }, 1)).toEqual({ year: 2028, month: 1 });
    expect(addMonths({ year: 2027, month: 11 }, 14)).toEqual({ year: 2029, month: 1 });
    expect(addMonths({ year: 2027, month: 1 }, -1)).toEqual({ year: 2026, month: 12 });
    expect(addMonths({ year: 2027, month: 6 }, 0)).toEqual({ year: 2027, month: 6 });
    expect(addMonths({ year: 2027, month: 1 }, 12)).toEqual({ year: 2028, month: 1 });
  });

  it("keeps the current month and the months ahead, oldest first", () => {
    expect(monthsToKeep(new Date("2027-11-15T10:00:00Z"), 3).map(monthLabel)).toEqual([
      "2027-11",
      "2027-12",
      "2028-01",
      "2028-02",
    ]);
    expect(monthsToKeep(new Date("2026-11-20T00:00:00Z"), 0).map(monthLabel)).toEqual(["2026-11"]);
  });

  it("names and bounds a partition as the migrations do", () => {
    expect(partitionName(AUDIT, { year: 2027, month: 2 })).toBe("audit_events_2027_02");
    expect(partitionName(NOTIFICATIONS, { year: 2027, month: 11 })).toBe("notifications_2027_11");
    expect(monthBounds({ year: 2027, month: 2 })).toEqual({
      from: "2027-02-01 00:00:00+00",
      to: "2027-03-01 00:00:00+00",
    });
    expect(monthBounds({ year: 2027, month: 12 })).toEqual({
      from: "2027-12-01 00:00:00+00",
      to: "2028-01-01 00:00:00+00",
    });
  });
});

describe("partition SQL", () => {
  it("emits the create statement of the partition migrations", () => {
    expect(createPartitionSql(AUDIT, { year: 2028, month: 1 })).toBe(
      `CREATE TABLE "audit_events_2028_01" PARTITION OF "audit_events" FOR VALUES FROM ('2028-01-01 00:00:00+00') TO ('2028-02-01 00:00:00+00')`,
    );
    expect(createPartitionSql(NOTIFICATIONS, { year: 2028, month: 12 })).toBe(
      `CREATE TABLE "notifications_2028_12" PARTITION OF "notifications" FOR VALUES FROM ('2028-12-01 00:00:00+00') TO ('2029-01-01 00:00:00+00')`,
    );
  });

  it("matches the first partition migration statement for statement (October 2026 to January 2027)", () => {
    expect(partitionStatements("_partition_audit_notifications")).toEqual(
      expectedStatements({ year: 2026, month: 10 }, 4),
    );
  });

  it("matches the 2027 migration statement for statement (February to December 2027)", () => {
    expect(partitionStatements("_partition_audit_notifications_2027")).toEqual(
      expectedStatements({ year: 2027, month: 2 }, 11),
    );
  });

  it("locks only the parent, and counts DEFAULT's rows of a month with bound parameters", () => {
    expect(lockParentSql(AUDIT)).toBe(`LOCK TABLE ONLY "audit_events" IN ACCESS EXCLUSIVE MODE`);
    expect(defaultRowsSql(NOTIFICATIONS, "notifications_default")).toBe(
      `SELECT count(*)::int AS n FROM "notifications_default" WHERE "created_at" >= $1::timestamptz AND "created_at" < $2::timestamptz`,
    );
    expect(defaultRowsSql(AUDIT, "audit_events_default")).toContain(`"occurred_at" >= $1`);
  });

  it("refuses any identifier that is not a plain lower-case name", () => {
    expect(quoteIdent("audit_events_2027_02")).toBe('"audit_events_2027_02"');
    for (const name of ['audit"; DROP TABLE users; --', "Audit_Events", "", "1table", "a b"]) {
      expect(() => quoteIdent(name)).toThrow(/unexpected identifier/);
    }
    expect(() =>
      createPartitionSql({ table: "x;", column: "c" }, { year: 2027, month: 1 }),
    ).toThrow();
  });
});
