import { Injectable } from "@nestjs/common";
import type { HotelImportRow } from "@ampm/core";

import type { Prisma } from "../../generated/prisma/client.js";
import { AuditService } from "../../policy/audit.service.js";
import { importAuditImages, type HotelAuditImage } from "./hotel-import.audit.js";
import { titleCaseSlug } from "./hotel-import.js";
import type { ImportJobRef } from "./hotel-import.kinds.js";
import type { ImportDestination, RowPlan } from "./hotel-import.plan.js";
import { NEW_DESTINATION_COUNTRY } from "./hotel-profile-rules.js";
import { toHotelWriteData, toImportPatch } from "./hotel-write.js";
import { HotelsAdminRepository } from "./hotels-admin.repository.js";

/*
 * Writes the rows of a Hotels import inside its transaction (D-181): a create, or an update of only the
 * columns its plan found changed, each with an audit event naming the fields it changed, never their
 * values (hotel-import.audit.ts); and the destination a row names, created the first time the file names
 * it, audited as `POST /hotels-admin/destinations` would audit it.
 */

/** The job a write belongs to, who is writing, and the audit images of the hotels the file names. */
export interface HotelWriteJob extends ImportJobRef {
  readonly images: ReadonlyMap<string, HotelAuditImage>;
}

/**
 * The destinations the plan's writing rows name that do not exist yet: what importing them creates.
 *
 * @example
 * newDestinationCount(plans, context.destinations); // 1
 */
export function newDestinationCount(
  plans: readonly RowPlan[],
  destinations: ReadonlyMap<string, ImportDestination>,
): number {
  const slugs = plans.flatMap((plan) =>
    plan.outcome === "create" || (plan.outcome === "update" && plan.movesDestination)
      ? [plan.row.destinationSlug]
      : [],
  );
  return new Set(slugs.filter((slug) => !destinations.has(slug))).size;
}

@Injectable()
export class HotelRowsWriter {
  constructor(
    private readonly hotels: HotelsAdminRepository,
    private readonly audit: AuditService,
  ) {}

  /** Writes one row's plan with its audit event; returns the row's hotel, or null for a refused row. */
  async writeRow(
    plan: RowPlan,
    destinationIds: Map<string, string>,
    job: HotelWriteJob,
    tx: Prisma.TransactionClient,
  ): Promise<string | null> {
    if (plan.outcome === "error") return null;
    if (plan.outcome === "unchanged") return plan.hotelId;
    if (plan.outcome === "create") {
      const destinationId = await this.destinationFor(plan.row, destinationIds, job, tx);
      const data = toHotelWriteData(plan.row, destinationId, plan.slug);
      const hotelId = await this.hotels.createHotel(data, job.actorId, tx);
      await this.auditRow(hotelId, plan, job, tx);
      return hotelId;
    }
    const patch = toImportPatch(plan.row, new Set(plan.changed));
    if (plan.movesDestination) {
      patch.destinationId = await this.destinationFor(plan.row, destinationIds, job, tx);
    }
    await this.hotels.updateHotel(plan.hotelId, patch, job.actorId, tx);
    await this.auditRow(plan.hotelId, plan, job, tx);
    return plan.hotelId;
  }

  /**
   * The row's destination, created (active, unlisted, in India) the first time the file names it, with
   * the audit event `POST /hotels-admin/destinations` would record. The plan has refused such a row for
   * an uploader without the destinations key.
   */
  private async destinationFor(
    row: HotelImportRow,
    ids: Map<string, string>,
    job: HotelWriteJob,
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const known = ids.get(row.destinationSlug);
    if (known) return known;
    const id = await this.hotels.createDestination(
      {
        name: row.destinationName ?? titleCaseSlug(row.destinationSlug),
        slug: row.destinationSlug,
        region: null,
        state: null,
        country: NEW_DESTINATION_COUNTRY,
        description: null,
        status: "active",
        publicVisible: false,
      },
      job.actorId,
      tx,
    );
    const after = { slug: row.destinationSlug, source: "import", importJobId: job.importJobId };
    await this.audit.record(
      {
        action: "create",
        entityType: "destination",
        entityId: id,
        before: null,
        after,
        maskImages: false,
      },
      tx,
    );
    ids.set(row.destinationSlug, id);
    return id;
  }

  /**
   * The audit event of one applied row: the hotel's name, status and flags before and after, and the
   * other fields it changed by name, never their values (hotel-import.audit.ts).
   */
  private auditRow(
    entityId: string,
    plan: Extract<RowPlan, { outcome: "create" | "update" }>,
    job: HotelWriteJob,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const stored = plan.outcome === "update" ? (job.images.get(plan.hotelId) ?? null) : null;
    const { before, after } = importAuditImages(plan, stored, job.importJobId);
    return this.audit.record(
      { action: plan.outcome, entityType: "hotel", entityId, before, after, maskImages: false },
      tx,
    );
  }
}
