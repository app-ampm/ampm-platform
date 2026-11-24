import {
  errors,
  HOTEL_IMPORT_PREVIEW_TTL_HOURS,
  hotelImportKind,
  hotelImportRowItem,
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
 * against the catalogue as it is then, and refuses a row whose target changed since. A plan is kept no
 * longer than it can be used: the import that finds it expired clears it, and so does the daily sweep
 * (hotel-import-plan-sweep.service.ts).
 */

export const PREVIEW_NOT_FOUND = "No such import preview";
export const PREVIEW_APPLIED = "This preview was already imported";
export const PREVIEW_EXPIRED = "This preview has expired; validate the file again";
export const CHANGED_SINCE_PREVIEW = "Changed since preview; validate the file again";

/** The refusal of a row whose hotel, room, venue, rate card or rate item changed since its preview. */
export const CHANGED_ERROR: FieldError = { field: "row", message: CHANGED_SINCE_PREVIEW };

const HOUR_MS = 60 * 60 * 1000;

/**
 * The target a previewed row planned against: its id and version token. A row that creates has none,
 * except a rates row adding an item to a stored card, whose target is that card.
 */
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
          item: hotelImportRowItem.optional(),
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
    refused: plan.refused.map(({ line, slug, name, item, errors: rowErrors }) => ({
      line,
      slug,
      name,
      ...(item === undefined ? {} : { item: { ...item } }),
      errors: rowErrors.map(({ field, message }) => ({ field, message })),
    })),
  };
}

/**
 * A stored plan read back, each row parsed again by its kind's schema, or null for a plan that no longer
 * reads (a release changed the template in between): it cannot be imported, so it is refused as expired
 * (409, validate the file again) and cleared.
 *
 * @example
 * const plan = readStoredPlan(job.planJson, ROOMS_IMPORT);
 * if (plan === null) return refuse("expired");
 */
export function readStoredPlan<Row>(
  json: Prisma.JsonValue | null,
  spec: ImportKindSpec<Row>,
): StoredPlan<Row> | null {
  const parsed = storedPlan.safeParse(json);
  if (!parsed.success || parsed.data.kind !== spec.kind) return null;
  const rows: StoredRow<Row>[] = [];
  for (const { line, row, target } of parsed.data.rows) {
    const read = spec.schema.safeParse(row);
    if (!read.success) return null;
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
 * Why a caller cannot import a preview: it is not theirs or not of this kind (`not_found`), it was
 * imported already (`applied`), or it can no longer be imported (`expired`: past the time limit, replaced
 * by their newer preview, with no row to import, or no longer read by this release).
 */
export type PreviewRefusal = "not_found" | "applied" | "expired";

/**
 * Why this caller cannot import this preview now, or null when they can. A job that is not theirs or not
 * of this kind is `not_found` whatever else holds (denial equals absence).
 *
 * @example
 * const refusal = previewRefusal(job, { actorId, importType: "hotel_rooms" }, new Date());
 * if (refusal) throw refusalError(refusal);
 */
export function previewRefusal(
  job: PreviewJob | null,
  caller: { readonly actorId: string; readonly importType: ImportType },
  now: Date,
): PreviewRefusal | null {
  if (
    job === null ||
    job.deletedAt !== null ||
    job.createdBy !== caller.actorId ||
    job.importType !== caller.importType
  ) {
    return "not_found";
  }
  if (job.status === "applied") return "applied";
  const expiresAt = job.createdAt.getTime() + HOTEL_IMPORT_PREVIEW_TTL_HOURS * HOUR_MS;
  if (job.status !== "validating" || job.planJson === null || now.getTime() > expiresAt) {
    return "expired";
  }
  return null;
}

/**
 * A refusal's answer: 404 for a preview that is not the caller's (as for one that does not exist), 409
 * for one imported already or one that expired, whose next step is to validate the file again.
 *
 * @example
 * refusalError("expired"); // 409 "This preview has expired; validate the file again"
 */
export function refusalError(refusal: PreviewRefusal): Error {
  if (refusal === "not_found") return errors.notFound(PREVIEW_NOT_FOUND);
  return errors.conflict(refusal === "applied" ? PREVIEW_APPLIED : PREVIEW_EXPIRED);
}

/**
 * What a plan matched for a row, whatever it then decided: one live row (which it updates or leaves, or
 * is refused on, a lost key say), none (it creates, or is refused creating: a new venue without its type),
 * or nothing it got as far as matching (`unmatched`: refused first, its hotel gone or its name repeated or
 * shared by two live rows). A kind whose rows live in a stored container says which one a row matched
 * no row in (`parentId`: a rates row's rate card, D-184); without it, `none` matched no container either
 * (a new card).
 */
export type PlanMatch =
  | { readonly matches: "row"; readonly targetId: string }
  | { readonly matches: "none"; readonly parentId?: string }
  | { readonly matches: "unmatched" };

/**
 * Whether a stored row's target changed since its preview, decided from what its re-plan matched, not
 * from what it then decided: a row that created now finds a live row of its own (or, for a new rate card,
 * a stored card of its name); a row that planned against a target finds it gone (its hotel deleted, too)
 * or holding other values, or now matches another row, another container or none, even when the create
 * that would follow is refused. A row adding to a stored container (a rate card) planned against the
 * container, so the re-plan must match no row in that same one. A re-plan refused on the very row it
 * planned against (a key lost since) keeps its own reason, as does one that matched nothing
 * (`unmatched`) while its target stayed as it was, and a create row of a hotel deleted since ("This hotel
 * was deleted"). Ids are UUIDs, so a row's id never names a container.
 *
 * @example
 * changedSincePreview(stored.target, { matches: "row", targetId }, (id) => versions.get(id) ?? null);
 * changedSincePreview(cardTarget, { matches: "none", parentId: cardId }, versionOf); // false while the card holds
 */
export function changedSincePreview(
  stored: StoredTarget | null,
  replanned: PlanMatch,
  currentVersion: (id: string) => string | null,
): boolean {
  if (stored === null) {
    return replanned.matches === "row" || (replanned.matches === "none" && !!replanned.parentId);
  }
  if (currentVersion(stored.id) !== stored.version) return true;
  if (replanned.matches === "unmatched") return false;
  const matched = replanned.matches === "row" ? replanned.targetId : replanned.parentId;
  return matched !== stored.id;
}
