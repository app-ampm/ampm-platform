import { Injectable } from "@nestjs/common";
import type { HotelImportChangedField } from "@ampm/core";

import type { Prisma } from "../../generated/prisma/client.js";
import { AuditService } from "../../policy/audit.service.js";
import type { Principal } from "../../policy/principal.types.js";
import { childImportGrantsOf } from "./hotel-audience.js";
import type { ChildKindRules } from "./hotel-import.child-kinds.js";
import {
  planChildRows,
  type ChildPlanContext,
  type ChildRowPlan,
  type PlannedRow as ChildRow,
  type StoredChild,
} from "./hotel-import.child-plan.js";
import type { ImportRow } from "./hotel-import.file.js";
import {
  CHANGED_ERROR,
  changedSincePreview,
  type PlanMatch,
  type StoredRow,
} from "./hotel-import.job.js";
import type { AppliedRows, ImportJobRef, KindImporter, PlannedRows } from "./hotel-import.kinds.js";
import { refusedReport, type RowReport } from "./hotel-import.report.js";
import { HotelImportRepository } from "./hotel-import.repository.js";
import { HotelSubresourcesRepository } from "./hotel-subresources.repository.js";

/*
 * The Rooms and Venues imports (D-178, D-181; plan §4.8), one importer per kind over the shared plan
 * (hotel-import.child-plan.ts). A preview reads the hotels its rows name and their live rows, and stores
 * each planned row with the version token of the row it matched. An import locks those hotels and their
 * live rows (in id order), re-plans each stored row against them, refuses a row whose target changed since
 * its preview, and writes the rest, each audited in the transaction. It never deletes a row.
 */

/** What the plan reads, and each stored row's version token by id. */
interface ChildLookup<K extends string> {
  readonly context: ChildPlanContext<K>;
  readonly versions: ReadonlyMap<string, string>;
}

const unique = (values: readonly string[]): string[] => [...new Set(values)];

@Injectable()
export class ChildRowsImporter {
  constructor(
    private readonly imports: HotelImportRepository,
    private readonly subresources: HotelSubresourcesRepository,
    private readonly audit: AuditService,
  ) {}

  /**
   * The importer of one child kind.
   *
   * @example
   * const rooms = children.importerFor(ROOM_KIND);
   */
  importerFor<Row extends ChildRow<K>, K extends HotelImportChangedField, Create, Patch, Stored>(
    kind: ChildKindRules<Row, K, Create, Patch, Stored>,
  ): KindImporter<Row> {
    return {
      spec: kind.spec,
      plan: (rows, principal) => this.plan(kind, rows, principal),
      apply: (rows, principal, job, tx) => this.apply(kind, rows, principal, job, tx),
      afterCommit: () => Promise.resolve(0),
    };
  }

  private async plan<
    Row extends ChildRow<K>,
    K extends HotelImportChangedField,
    Create,
    Patch,
    Stored,
  >(
    kind: ChildKindRules<Row, K, Create, Patch, Stored>,
    rows: readonly ImportRow<Row>[],
    principal: Principal,
  ): Promise<PlannedRows> {
    const { context, versions } = await this.lookUp(kind, rows, principal);
    const plans = planChildRows(rows, context, kind);
    const stored = plans.flatMap((plan, index) => {
      const row = rows[index];
      if (plan.outcome === "error" || row === undefined) return [];
      const target =
        "targetId" in plan
          ? { id: plan.targetId, version: versions.get(plan.targetId) ?? "" }
          : null;
      return [{ line: row.line, row: kind.spec.toJson(row.row), target }];
    });
    return { reports: plans.map(reportOf), stored, newDestinations: 0, newImages: 0 };
  }

  private async apply<
    Row extends ChildRow<K>,
    K extends HotelImportChangedField,
    Create,
    Patch,
    Stored,
  >(
    kind: ChildKindRules<Row, K, Create, Patch, Stored>,
    stored: readonly StoredRow<Row>[],
    principal: Principal,
    job: ImportJobRef,
    tx: Prisma.TransactionClient,
  ): Promise<AppliedRows> {
    const rows = stored.map(({ line, row }) => ({ line, row }));
    await this.imports.lockHotelsBySlug(unique(rows.map(({ row }) => row.hotelSlug)), tx);
    const { context, versions } = await this.lookUp(kind, rows, principal, tx);
    const plans = planChildRows(rows, context, kind).map((plan, index) =>
      recheck(plan, stored[index]?.target ?? null, versions),
    );
    for (const plan of plans) await this.write(kind, plan, job, tx);
    return { reports: plans.map(reportOf), newDestinations: 0, imageRefs: [] };
  }

  /**
   * The hotels the rows name (deleted ones included) and their live rows with each one's version token,
   * each row's name in NFC as the file's text is (`decodeCsv`), so two spellings of one name match each
   * other and two stored rows spelt the two ways are the ambiguity the plan reports. Inside an import's
   * transaction the rows are locked before they are read.
   */
  private async lookUp<
    Row extends ChildRow<K>,
    K extends HotelImportChangedField,
    Create,
    Patch,
    Stored,
  >(
    kind: ChildKindRules<Row, K, Create, Patch, Stored>,
    rows: readonly ImportRow<Row>[],
    principal: Principal,
    tx?: Prisma.TransactionClient,
  ): Promise<ChildLookup<K>> {
    const hotels = await this.imports.findHotelRefsBySlugs(
      unique(rows.map(({ row }) => row.hotelSlug)),
      tx,
    );
    const live = hotels.filter((hotel) => hotel.deletedAt === null).map((hotel) => hotel.id);
    if (tx) await kind.lockLive(this.imports, live, tx);
    const storedRows = await kind.findLive(this.imports, live, tx);
    const byHotel = new Map<string, StoredChild<K>[]>();
    const versions = new Map<string, string>();
    for (const row of storedRows) {
      const { id, hotelId, name } = kind.keyOf(row);
      const child = { id, name: name.normalize("NFC"), values: kind.valuesOf(row) };
      const children = byHotel.get(hotelId);
      if (children) children.push(child);
      else byHotel.set(hotelId, [child]);
      versions.set(id, kind.versionOf(row));
    }
    const context: ChildPlanContext<K> = {
      hotels: new Map(hotels.map((hotel) => [hotel.slug, hotel])),
      rows: byHotel,
      grants: childImportGrantsOf(principal),
    };
    return { context, versions };
  }

  /** Writes one planned row with its audit event; an unchanged or refused row writes nothing. */
  private async write<Row, K extends HotelImportChangedField, Create, Patch, Stored>(
    kind: ChildKindRules<Row, K, Create, Patch, Stored>,
    plan: ChildRowPlan<K, Create, Patch>,
    job: ImportJobRef,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (plan.outcome === "error" || plan.outcome === "unchanged") return;
    const entityId =
      plan.outcome === "create"
        ? (await kind.create(this.subresources, plan.hotelId, plan.data, job.actorId, tx)).id
        : plan.targetId;
    if (plan.outcome === "update") {
      await kind.update(this.subresources, plan.targetId, plan.patch, job.actorId, tx);
    }
    const after = {
      hotelId: plan.hotelId,
      name: plan.name,
      source: "import",
      importJobId: job.importJobId,
      changedFields: plan.changedFields,
    };
    await this.audit.record(
      {
        action: plan.outcome,
        entityType: kind.entityType,
        entityId,
        before: null,
        after,
        maskImages: false,
      },
      tx,
    );
  }
}

/** What a plan matched among the hotel's live rows, a refused plan's included. */
function matchOf<K extends string, Create, Patch>(plan: ChildRowPlan<K, Create, Patch>): PlanMatch {
  if (plan.outcome === "error") return plan.match;
  if (plan.outcome === "create") return { matches: "none" };
  return { matches: "row", targetId: plan.targetId };
}

/**
 * A re-planned row, refused when its target changed since the preview: decided from what the re-plan
 * matched, so a row whose venue was renamed is refused as changed, not for what a new venue would need.
 */
function recheck<K extends string, Create, Patch>(
  plan: ChildRowPlan<K, Create, Patch>,
  target: StoredRow<unknown>["target"],
  versions: ReadonlyMap<string, string>,
): ChildRowPlan<K, Create, Patch> {
  const match = matchOf(plan);
  if (!changedSincePreview(target, match, (id) => versions.get(id) ?? null)) return plan;
  return {
    line: plan.line,
    slug: plan.slug,
    name: plan.name,
    outcome: "error",
    errors: [CHANGED_ERROR],
    match,
  };
}

/** One plan as the report shows it. */
function reportOf<K extends HotelImportChangedField, Create, Patch>(
  plan: ChildRowPlan<K, Create, Patch>,
): RowReport {
  // The key alone: a refused plan's match names a row the uploader may not read, which no report carries.
  if (plan.outcome === "error") {
    return refusedReport({ line: plan.line, slug: plan.slug, name: plan.name }, plan.errors);
  }
  const changedFields = plan.outcome === "unchanged" ? [] : plan.changedFields;
  return {
    line: plan.line,
    slug: plan.slug,
    name: plan.name,
    outcome: plan.outcome,
    changedFields,
    errors: [],
  };
}
