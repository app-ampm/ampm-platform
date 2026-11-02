import { Injectable } from "@nestjs/common";
import {
  errors,
  hotelImportRow,
  type HotelImportRequest,
  type HotelImportResult,
  type HotelImportRow,
  type HotelImportRowError,
} from "@ampm/core";

import { Prisma } from "../../generated/prisma/client.js";
import { AuditService } from "../../policy/audit.service.js";
import { buildCandidate, isBlankRow, parseCsv, slugify, titleCaseSlug } from "./hotel-import.js";
import { HotelsAdminRepository, type HotelWriteData } from "./hotels-admin.repository.js";

interface ValidRow {
  readonly line: number;
  readonly data: HotelImportRow;
}
interface Validation {
  readonly valid: ValidRow[];
  readonly rejected: HotelImportRowError[];
  readonly totalRows: number;
}

const REQUIRED_HEADERS = ["destinationSlug", "name"];

/**
 * The hotel spreadsheet import (TW-25; AC-35.1). Parse the CSV, validate every row against
 * `hotelImportRow`, and — unless this is a dry run — upsert the valid rows by slug inside one
 * transaction, resolving or creating their destination, writing a per-row audit event and an
 * `import_jobs` record with the counts and the error report. Invalid rows are reported, never applied;
 * the valid rows still land (48 of 50 in AC-35.1). Rooms, venues and rate cards extend this in 9.2.
 */
@Injectable()
export class HotelImportService {
  constructor(
    private readonly repo: HotelsAdminRepository,
    private readonly audit: AuditService,
  ) {}

  async import(request: HotelImportRequest, actorId: string): Promise<HotelImportResult> {
    const { valid, rejected, totalRows } = this.validate(request.content);
    const errorReportJson = toErrorReport(rejected);
    if (request.dryRun) {
      const importJobId = await this.repo.createImportJob("hotels", actorId);
      await this.repo.finishImportJob(
        importJobId,
        { status: "validating", rowCount: totalRows, errorReportJson },
        actorId,
      );
      return {
        importJobId,
        dryRun: true,
        applied: false,
        totalRows,
        created: 0,
        updated: 0,
        destinationsCreated: 0,
        rejected,
      };
    }
    const outcome = await this.applyValidRows(valid, totalRows, errorReportJson, actorId);
    return {
      ...outcome,
      dryRun: false,
      applied: outcome.created + outcome.updated > 0,
      totalRows,
      rejected,
    };
  }

  /** Upsert the valid rows in one transaction, each with a per-row audit, then write the import_jobs row. */
  private applyValidRows(
    valid: ValidRow[],
    totalRows: number,
    errorReportJson: Prisma.InputJsonValue,
    actorId: string,
  ): Promise<{
    importJobId: string;
    created: number;
    updated: number;
    destinationsCreated: number;
  }> {
    return this.repo.transaction(async (tx) => {
      const importJobId = await this.repo.createImportJob("hotels", actorId, tx);
      const destinations = new Map<string, string>();
      let created = 0;
      let updated = 0;
      let destinationsCreated = 0;
      for (const { data } of valid) {
        const destination = await this.resolveDestination(data, destinations, actorId, tx);
        if (destination.created) destinationsCreated++;
        const destinationId = destination.id;
        const slug = data.slug ?? slugify(data.name);
        const existingId = await this.repo.hotelIdBySlug(slug, tx);
        if (existingId) {
          await this.repo.updateHotel(
            existingId,
            { destinationId, ...toProfileData(data) },
            actorId,
            tx,
          );
          updated++;
          await this.auditRow("update", existingId, slug, data.name, tx);
        } else {
          const id = await this.repo.insertHotel(
            { destinationId, slug, ...toProfileData(data) },
            actorId,
            tx,
          );
          created++;
          await this.auditRow("create", id, slug, data.name, tx);
        }
      }
      const status = created + updated > 0 ? "applied" : "failed";
      await this.repo.finishImportJob(
        importJobId,
        { status, rowCount: totalRows, errorReportJson },
        actorId,
        tx,
      );
      return { importJobId, created, updated, destinationsCreated };
    });
  }

  private validate(content: string): Validation {
    const rows = parseCsv(content);
    if (rows.length === 0) {
      throw errors.validation([{ path: "content", message: "The file is empty" }]);
    }
    const headers = rows[0]!.map((header) => header.trim());
    const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
    if (missing.length > 0) {
      throw errors.validation([
        { path: "content", message: `Missing column(s): ${missing.join(", ")}` },
      ]);
    }
    const valid: ValidRow[] = [];
    const rejected: HotelImportRowError[] = [];
    let totalRows = 0;
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i]!;
      if (isBlankRow(cells)) continue;
      totalRows++;
      const line = i + 1; // 1-based; the header is line 1
      const parsed = hotelImportRow.safeParse(buildCandidate(headers, cells));
      if (parsed.success) {
        valid.push({ line, data: parsed.data });
      } else {
        rejected.push({
          line,
          errors: parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }
    }
    return { valid, rejected, totalRows };
  }

  /**
   * The row's destination id, resolving by slug and creating it (active) on first sight within the file.
   * `created` is true only when this call inserted the destination, so the caller counts each new one once
   * (a cache hit or an existing row is a resolve, not a create — the idempotency the re-run relies on).
   */
  private async resolveDestination(
    data: HotelImportRow,
    cache: Map<string, string>,
    actorId: string,
    tx: Prisma.TransactionClient,
  ): Promise<{ id: string; created: boolean }> {
    const slug = data.destinationSlug;
    const cached = cache.get(slug);
    if (cached) return { id: cached, created: false };
    const existing = await this.repo.findDestinationBySlug(slug, tx);
    if (existing) {
      cache.set(slug, existing.id);
      return { id: existing.id, created: false };
    }
    const id = await this.repo.createDestination(
      {
        name: data.destinationName ?? titleCaseSlug(slug),
        slug,
        region: null,
        state: null,
        country: "India",
        description: null,
        status: "active",
        publicVisible: false,
      },
      actorId,
      tx,
    );
    cache.set(slug, id);
    return { id, created: true };
  }

  private auditRow(
    action: "create" | "update",
    entityId: string,
    slug: string,
    name: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    return this.audit.record(
      {
        action,
        entityType: "hotel",
        entityId,
        before: null,
        after: { slug, name, source: "import" },
        maskImages: false,
      },
      tx,
    );
  }
}

/** The hotel profile columns an import writes, without the `destinationId`/`slug` that key the upsert. */
function toProfileData(data: HotelImportRow): Omit<HotelWriteData, "destinationId" | "slug"> {
  return {
    name: data.name,
    brand: data.brand ?? null,
    starCategory: data.starCategory ?? null,
    address: data.address ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    descriptionClient: data.descriptionClient ?? null,
    website: data.website ?? null,
    status: data.status ?? "draft",
    demoVisible: data.demoVisible ?? false,
    publicShowcase: false,
    internalRating: data.internalRating ?? null,
    internalNotes: data.internalNotes ?? null,
    totalRooms: data.totalRooms ?? null,
    streetViewRef: data.streetViewRef ?? null,
  };
}

function toErrorReport(rejected: HotelImportRowError[]): Prisma.InputJsonValue {
  return rejected.map((row): Prisma.InputJsonValue => ({
    line: row.line,
    errors: row.errors.map((e): Prisma.InputJsonValue => ({ field: e.field, message: e.message })),
  }));
}
