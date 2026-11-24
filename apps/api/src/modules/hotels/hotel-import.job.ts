import {
  errors,
  HOTEL_IMPORT_PREVIEW_TTL_HOURS,
  hotelImportKind,
  uuid,
  type HotelImportKind,
} from "@ampm/core";
import { z } from "zod";

import type { ImportStatus, ImportType, Prisma } from "../../generated/prisma/client.js";
import type { RejectedRow } from "./hotel-import.file.js";
import type { ImportKindSpec } from "./hotel-import.kinds.js";
import type { FieldError } from "./hotel-import.plan.js";

/*
 * A preview's job and the plan it keeps until it is imported (D-181; plan §4.8). Pure. Every upload is a
 * preview: its `import_jobs` row keeps the value-free report in `error_report_json` and, while it has rows
 * to import, the plan in `plan_json` (RESTRICTED-NOTES: it holds the file's values, notes cells included):
 * the rows as read, each with the version token of the target it planned against, and the refused rows by
 * line. Only the uploader imports it, once, within HOTEL_IMPORT_PREVIEW_TTL_HOURS hours, and only their
 * newest preview of the kind (a newer one clears the older plans). The import re-plans each stored row
 * against the catalogue as it is then, and refuses a row whose target changed since.
 */

export const PREVIEW_NOT_FOUND = "No such import preview";
export const PREVIEW_APPLIED = "This preview was already imported";
export const PREVIEW_EXPIRED = "This preview has expired; validate the file again";
export const CHANGED_SINCE_PREVIEW = "Changed since preview; validate the file again";

/** The refusal of a row whose hotel, room or venue changed since its preview. */
export const CHANGED_ERROR: FieldError = { field: "row", message: CHANGED_SINCE_PREVIEW };

const HOUR_MS = 60 * 60 * 1000;

/** The target a previewed row planned against: its id and version token. A row that creates has none. */
export interface StoredTarget {
  readonly id: string;
  readonly version: string;
}

/** One row a preview planned, as its import re-plans it: its line, its cells as read, and its target. */
export interface StoredRow<Row> {
  readonly line: number;
  readonly row: Row;
  readonly target: StoredTarget | null;
}

/** A preview's plan as its job keeps it. */
export interface StoredPlan<Row> {
  readonly totalRows: number;
  readonly rows: readonly StoredRow<Row>[];
  readonly refused: readonly RejectedRow[];
}

const fieldError = z.object({ field: z.string(), message: z.string() }).strict();

const storedPlan = z
  .object({
    version: z.literal(1),
    kind: hotelImportKind,
    totalRows: z.number().int().min(0),
    rows: z.array(
      z
        .object({
          line: z.number().int().min(1),
          row: z.unknown(),
          target: z.object({ id: uuid, version: z.string() }).strict().nullable(),
        })
        .strict(),
    ),
    refused: z.array(
      z
        .object({
          line: z.number().int().min(1),
          slug: z.string().nullable(),
          name: z.string().nullable(),
          errors: z.array(fieldError),
        })
        .strict(),
    ),
  })
  .strict();

/**
 * The plan a preview keeps in `import_jobs.plan_json`.
 *
 * @example
 * const planJson = storedPlanJson("rooms", { totalRows, rows, refused });
 */
export function storedPlanJson(
  kind: HotelImportKind,
  plan: StoredPlan<Prisma.InputJsonValue>,
): Prisma.InputJsonValue {
  return {
    version: 1,
    kind,
    totalRows: plan.totalRows,
    rows: plan.rows.map(({ line, row, target }) => ({
      line,
      row,
      target: target === null ? null : { id: target.id, version: target.version },
    })),
    refused: plan.refused.map(({ line, slug, name, errors: rowErrors }) => ({
      line,
      slug,
      name,
      errors: rowErrors.map(({ field, message }) => ({ field, message })),
    })),
  };
}

/**
 * A stored plan read back, each row parsed again by its kind's schema. A plan that no longer reads (a
 * release changed the template in between) cannot be imported: 409, validate the file again.
 *
 * @example
 * const plan = readStoredPlan(job.planJson, ROOMS_IMPORT);
 */
export function readStoredPlan<Row>(
  json: Prisma.JsonValue | null,
  spec: ImportKindSpec<Row>,
): StoredPlan<Row> {
  const parsed = storedPlan.safeParse(json);
  if (!parsed.success || parsed.data.kind !== spec.kind) throw errors.conflict(PREVIEW_EXPIRED);
  const rows: StoredRow<Row>[] = [];
  for (const { line, row, target } of parsed.data.rows) {
    const read = spec.schema.safeParse(row);
    if (!read.success) throw errors.conflict(PREVIEW_EXPIRED);
    rows.push({ line, row: read.data, target });
  }
  return { totalRows: parsed.data.totalRows, rows, refused: parsed.data.refused };
}

/** A preview's job as its import checks it. */
export interface PreviewJob {
  readonly importType: ImportType;
  readonly status: ImportStatus;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly deletedAt: Date | null;
  readonly planJson: Prisma.JsonValue | null;
}

/**
 * Why this caller cannot import this preview now, or null when they can: 404 for a job that is not
 * theirs or not of this kind (denial equals absence), 409 for one already imported, and 409 for one that
 * expired, was replaced by their newer preview, or had no row to import.
 *
 * @example
 * const refusal = previewRefusal(job, { actorId, importType: "hotel_rooms" }, new Date());
 * if (refusal) throw refusal;
 */
export function previewRefusal(
  job: PreviewJob | null,
  caller: { readonly actorId: string; readonly importType: ImportType },
  now: Date,
): Error | null {
  if (
    job === null ||
    job.deletedAt !== null ||
    job.createdBy !== caller.actorId ||
    job.importType !== caller.importType
  ) {
    return errors.notFound(PREVIEW_NOT_FOUND);
  }
  if (job.status === "applied") return errors.conflict(PREVIEW_APPLIED);
  const expiresAt = job.createdAt.getTime() + HOTEL_IMPORT_PREVIEW_TTL_HOURS * HOUR_MS;
  if (job.status !== "validating" || job.planJson === null || now.getTime() > expiresAt) {
    return errors.conflict(PREVIEW_EXPIRED);
  }
  return null;
}

/**
 * What a re-plan at import decided about a stored row's target: the row it updates or leaves, none (it
 * creates), or nothing to compare (it is refused for another reason).
 */
export type ReplannedTarget =
  | { readonly outcome: "create" }
  | { readonly outcome: "update" | "unchanged"; readonly targetId: string }
  | { readonly outcome: "error" };

/**
 * Whether a stored row's target changed since its preview: a row that created now finds its target there;
 * a row that planned against a target finds it gone or holding other values, or now matches another row
 * or none. A re-plan refused for another reason (a key lost, a hotel removed) keeps its own reason.
 *
 * @example
 * changedSincePreview(stored.target, { outcome: "update", targetId }, (id) => versions.get(id) ?? null);
 */
export function changedSincePreview(
  stored: StoredTarget | null,
  replanned: ReplannedTarget,
  currentVersion: (id: string) => string | null,
): boolean {
  if (stored === null) return replanned.outcome === "update" || replanned.outcome === "unchanged";
  if (currentVersion(stored.id) !== stored.version) return true;
  if (replanned.outcome === "error") return false;
  return replanned.outcome === "create" || replanned.targetId !== stored.id;
}
