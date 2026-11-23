import type { HotelStatus } from "@ampm/core";

import type { RowPlan } from "./hotel-import.plan.js";
import { NEW_HOTEL_DEFAULTS } from "./hotel-write.js";

/*
 * The audit event of an applied import row (security.md: an update keeps its before and after values).
 * It keeps who the hotel is and whether it is shown, the CLIENT values a staff update's event keeps too
 * (hotels-admin.service.ts): its name, status and demo and website flags. Every other field the row
 * changes is named, never valued, so no internal or restricted value reaches the event. Pure.
 */

/** What a hotel's audit event keeps of its values, for an import row and a staff update alike. */
export interface HotelAuditImage {
  readonly name: string;
  readonly status: HotelStatus;
  readonly demoVisible: boolean;
  readonly publicShowcase: boolean;
}

/**
 * A stored hotel's audit image. The import takes it from its lookup whatever the uploader may read: the
 * audit log is never shown to them.
 *
 * @example
 * const images = new Map(rows.map((row) => [row.id, auditImageOf(row)]));
 */
export function auditImageOf(hotel: HotelAuditImage): HotelAuditImage {
  return {
    name: hotel.name,
    status: hotel.status,
    demoVisible: hotel.demoVisible,
    publicShowcase: hotel.publicShowcase,
  };
}

/**
 * The before and after images of an applied row. A create has no before, and its blank status and flags
 * take a new hotel's defaults; an update's blank cells keep the stored values, since a blank changes
 * nothing.
 *
 * @example
 * const { before, after } = importAuditImages(plan, images.get(plan.hotelId) ?? null, importJobId);
 */
export function importAuditImages(
  plan: Extract<RowPlan, { outcome: "create" | "update" }>,
  stored: HotelAuditImage | null,
  importJobId: string,
): { readonly before: HotelAuditImage | null; readonly after: Record<string, unknown> } {
  const kept = plan.outcome === "create" ? NEW_HOTEL_DEFAULTS : stored;
  const after = {
    slug: plan.slug,
    name: plan.row.name,
    status: plan.row.status ?? kept?.status,
    demoVisible: plan.row.demoVisible ?? kept?.demoVisible,
    publicShowcase: plan.row.publicShowcase ?? kept?.publicShowcase,
    source: "import",
    importJobId,
    changedFields: plan.changedFields,
  };
  return { before: plan.outcome === "create" ? null : stored, after };
}
