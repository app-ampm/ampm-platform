/**
 * Month arithmetic and SQL for the monthly partitions of the two log tables (data.md: `audit_events` and
 * `notifications` are range-partitioned by month, migration 20261028050928_partition_audit_notifications).
 * Pure, with no I/O, so the unit tests pin each partition's name, bounds and DDL to the migrations' own.
 */

/** A range-partitioned log table and the time column its partitions split on. */
export interface PartitionedTable {
  readonly table: string;
  readonly column: string;
}

/** The monthly-partitioned tables (data.md), in the order the maintenance job keeps them. */
export const PARTITIONED_TABLES: readonly PartitionedTable[] = [
  { table: "audit_events", column: "occurred_at" },
  { table: "notifications", column: "created_at" },
];

/** A calendar month. Partitions run from midnight UTC on its first day to midnight UTC on the next month's. */
export interface PartitionMonth {
  readonly year: number;
  /** 1 (January) to 12 (December). */
  readonly month: number;
}

/** The UTC month an instant falls in: the bounds are UTC whatever the server's or the database's time zone. */
export function monthOf(instant: Date): PartitionMonth {
  return { year: instant.getUTCFullYear(), month: instant.getUTCMonth() + 1 };
}

/** The month `count` months after `start`, or before it when `count` is negative. */
export function addMonths(start: PartitionMonth, count: number): PartitionMonth {
  const index = start.year * 12 + (start.month - 1) + count;
  const year = Math.floor(index / 12);
  return { year, month: index - year * 12 + 1 };
}

/**
 * The months that must have a partition at `now`: its own month and the `ahead` months after it, oldest first.
 *
 * @example
 * monthsToKeep(new Date("2027-11-15T00:00:00Z"), 2); // 2027-11, 2027-12, 2028-01
 */
export function monthsToKeep(now: Date, ahead: number): PartitionMonth[] {
  const current = monthOf(now);
  return Array.from({ length: ahead + 1 }, (_, offset) => addMonths(current, offset));
}

/** `2027-02`: a month as the job's records and logs show it. */
export function monthLabel(month: PartitionMonth): string {
  return `${month.year}-${String(month.month).padStart(2, "0")}`;
}

/** `audit_events_2027_02`: the partition naming of the migrations. */
export function partitionName(spec: PartitionedTable, month: PartitionMonth): string {
  return `${spec.table}_${month.year}_${String(month.month).padStart(2, "0")}`;
}

/** A month's bounds as the migrations write them: `from` is inclusive, `to` (the next month's start) exclusive. */
export function monthBounds(month: PartitionMonth): { readonly from: string; readonly to: string } {
  return { from: boundLiteral(month), to: boundLiteral(addMonths(month, 1)) };
}

/**
 * The DDL that creates one month's partition, as the migrations write it. The partition inherits the
 * parent's primary key, indexes and foreign keys. PostgreSQL refuses it while the DEFAULT partition holds
 * rows of that month, so it can fail but never misfile a row.
 */
export function createPartitionSql(spec: PartitionedTable, month: PartitionMonth): string {
  const { from, to } = monthBounds(month);
  const name = quoteIdent(partitionName(spec, month));
  return `CREATE TABLE ${name} PARTITION OF ${quoteIdent(spec.table)} FOR VALUES FROM ('${from}') TO ('${to}')`;
}

/**
 * Takes the lock CREATE ... PARTITION OF needs on the parent before the job checks anything, so no row can
 * reach DEFAULT between its check and the create, and a concurrent run waits rather than racing. `ONLY`
 * leaves the existing partitions unlocked.
 */
export function lockParentSql(spec: PartitionedTable): string {
  return `LOCK TABLE ONLY ${quoteIdent(spec.table)} IN ACCESS EXCLUSIVE MODE`;
}

/** Counts the DEFAULT partition's rows of one month: `$1` and `$2` are the month's bounds (monthBounds). */
export function defaultRowsSql(spec: PartitionedTable, defaultPartition: string): string {
  const column = quoteIdent(spec.column);
  return `SELECT count(*)::int AS n FROM ${quoteIdent(defaultPartition)} WHERE ${column} >= $1::timestamptz AND ${column} < $2::timestamptz`;
}

/**
 * Double-quotes an identifier for statements that take no bind parameters (DDL). Every name here comes from
 * the fixed table list above with an integer month, or from the system catalog, and must look like one of
 * ours: anything else throws before it reaches the database.
 */
export function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(name)) {
    throw new Error(`Refusing an unexpected identifier: ${JSON.stringify(name)}`);
  }
  return `"${name}"`;
}

function boundLiteral(month: PartitionMonth): string {
  return `${monthLabel(month)}-01 00:00:00+00`;
}
