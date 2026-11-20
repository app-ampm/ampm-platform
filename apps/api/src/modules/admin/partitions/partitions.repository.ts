import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../db/prisma.service.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import {
  createPartitionSql,
  defaultRowsSql,
  lockParentSql,
  monthBounds,
  partitionName,
  type PartitionedTable,
  type PartitionMonth,
} from "./partition-months.js";

/**
 * How long a create waits for the parent's lock. While it waits, every new read and write of the table
 * queues behind it, so it gives up soon and the run fails, to be retried; the months ahead leave time.
 */
const LOCK_TIMEOUT = "5s";

/** What the system catalog says about a partitioned table. */
export interface PartitionCatalog {
  /** The names of its attached partitions, the DEFAULT one included. */
  readonly partitions: ReadonlySet<string>;
  /** Its DEFAULT partition, or null when it has none. */
  readonly defaultPartition: string | null;
}

/** One month's result: created now, found attached, or refused because DEFAULT already holds its rows. */
export type MonthOutcome =
  | { readonly kind: "created" }
  | { readonly kind: "exists" }
  | { readonly kind: "blocked"; readonly defaultPartition: string; readonly rows: number };

/**
 * The partition queries of the maintenance job: the catalog read and the create, raw SQL because Prisma
 * models neither partitions nor DDL. Queries only; which months to keep is the service's rule.
 */
@Injectable()
export class PartitionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The table's attached partitions and its DEFAULT partition, from the system catalog (no table lock). */
  async catalog(
    spec: PartitionedTable,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<PartitionCatalog> {
    const rows = await client.$queryRaw<{ name: string; isDefault: boolean }[]>`
      SELECT c.relname::text AS name, c.oid = pt.partdefid AS "isDefault"
      FROM pg_partitioned_table pt
      JOIN pg_inherits i ON i.inhparent = pt.partrelid
      JOIN pg_class c ON c.oid = i.inhrelid
      WHERE pt.partrelid = to_regclass(${spec.table})`;
    return {
      partitions: new Set(rows.map((row) => row.name)),
      defaultPartition: rows.find((row) => row.isDefault)?.name ?? null,
    };
  }

  /**
   * Creates one month's partition unless it is already attached, in one short transaction that first takes
   * the parent's lock (lockParentSql) and then reads the catalog again, so a concurrent run finds the
   * partition in place. When DEFAULT already holds rows of the month it creates nothing and says so:
   * PostgreSQL would refuse the create anyway, and those rows must be moved by hand (data-model.md §3).
   */
  async createMonth(spec: PartitionedTable, month: PartitionMonth): Promise<MonthOutcome> {
    return this.prisma.$transaction(
      async (tx): Promise<MonthOutcome> => {
        await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT}'`);
        await tx.$executeRawUnsafe(lockParentSql(spec));
        const { partitions, defaultPartition } = await this.catalog(spec, tx);
        if (partitions.has(partitionName(spec, month))) return { kind: "exists" };
        if (defaultPartition) {
          const rows = await this.defaultRows(tx, spec, defaultPartition, month);
          if (rows > 0) return { kind: "blocked", defaultPartition, rows };
        }
        await tx.$executeRawUnsafe(createPartitionSql(spec, month));
        return { kind: "created" };
      },
      { timeout: 30_000 },
    );
  }

  /** How many rows of the month sit in the DEFAULT partition (bounds bound as parameters, cast to timestamptz). */
  private async defaultRows(
    tx: Prisma.TransactionClient,
    spec: PartitionedTable,
    defaultPartition: string,
    month: PartitionMonth,
  ): Promise<number> {
    const { from, to } = monthBounds(month);
    const [row] = await tx.$queryRawUnsafe<{ n: number }[]>(
      defaultRowsSql(spec, defaultPartition),
      from,
      to,
    );
    return row?.n ?? 0;
  }
}
