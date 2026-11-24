import { HOTEL_IMPORT_PREVIEW_TTL_HOURS } from "@ampm/core";
import { describe, expect, it } from "vitest";

import type { Prisma } from "../../generated/prisma/client.js";
import {
  changedSincePreview,
  PREVIEW_APPLIED,
  PREVIEW_EXPIRED,
  previewRefusal,
  readStoredPlan,
  storedPlanJson,
  type PreviewJob,
} from "./hotel-import.job.js";
import { ROOMS_IMPORT, VENUES_IMPORT } from "./hotel-import.kinds.js";

const ACTOR = "0192f1a0-0000-7000-8000-0000000000e1";
const NOW = new Date("2026-11-24T12:00:00.000Z");
const HOUR_MS = 60 * 60 * 1000;
const TARGET = { id: "0192f1a0-0000-7000-8000-0000000000f1", version: "a".repeat(64) };

const job = (overrides: Partial<PreviewJob> = {}): PreviewJob => ({
  importType: "hotel_rooms",
  status: "validating",
  createdBy: ACTOR,
  createdAt: new Date(NOW.getTime() - HOUR_MS),
  deletedAt: null,
  planJson: { version: 1 },
  ...overrides,
});

const refusalOf = (preview: PreviewJob | null) =>
  previewRefusal(preview, { actorId: ACTOR, importType: "hotel_rooms" }, NOW);

/** A JSON value as the database gives it back. */
function stored(value: Prisma.InputJsonValue): Prisma.JsonValue {
  const json: Prisma.JsonValue = JSON.parse(JSON.stringify(value));
  return json;
}

describe("previewRefusal: who may import a preview, and when (D-181)", () => {
  it("lets the uploader import their own live preview of the kind", () => {
    expect(refusalOf(job())).toBeNull();
  });

  it("answers 404 for no job, another uploader's, another kind's or a deleted one", () => {
    for (const preview of [
      null,
      job({ createdBy: "0192f1a0-0000-7000-8000-0000000000e2" }),
      job({ importType: "hotel_venues" }),
      job({ deletedAt: NOW }),
    ]) {
      expect(refusalOf(preview)).toMatchObject({ code: "not_found", status: 404 });
    }
  });

  it("answers 409 for an imported preview, and for an expired, replaced or failed one", () => {
    expect(refusalOf(job({ status: "applied", planJson: null }))).toMatchObject({
      code: "conflict",
      message: PREVIEW_APPLIED,
    });
    const old = new Date(NOW.getTime() - (HOTEL_IMPORT_PREVIEW_TTL_HOURS * HOUR_MS + 1));
    for (const preview of [
      job({ createdAt: old }),
      job({ planJson: null }),
      job({ status: "failed", planJson: null }),
    ]) {
      expect(refusalOf(preview)).toMatchObject({ code: "conflict", message: PREVIEW_EXPIRED });
    }
  });
});

describe("the stored plan", () => {
  const row = { hotelSlug: "synthetic-lake-hotel", name: "Synthetic Lake Suite", sizeSqft: 850 };
  const refused = [
    { line: 3, slug: null, name: null, errors: [{ field: "name", message: "Required" }] },
  ];

  it("reads back what a preview stored, each row parsed again by its kind's schema", () => {
    const json = storedPlanJson("rooms", {
      totalRows: 3,
      rows: [{ line: 2, row, target: TARGET }],
      refused,
    });
    expect(readStoredPlan(stored(json), ROOMS_IMPORT)).toEqual({
      totalRows: 3,
      rows: [{ line: 2, row, target: TARGET }],
      refused,
    });
  });

  it("answers 409 for a plan of another kind or a row its kind no longer reads", () => {
    const rooms = storedPlanJson("rooms", { totalRows: 1, rows: [], refused: [] });
    expect(() => readStoredPlan(stored(rooms), VENUES_IMPORT)).toThrow(
      expect.objectContaining({ code: "conflict", message: PREVIEW_EXPIRED }),
    );
    const stale = storedPlanJson("rooms", {
      totalRows: 1,
      rows: [{ line: 2, row: { ...row, mystery: true }, target: null }],
      refused: [],
    });
    expect(() => readStoredPlan(stored(stale), ROOMS_IMPORT)).toThrow(
      expect.objectContaining({ code: "conflict" }),
    );
    expect(() => readStoredPlan(null, ROOMS_IMPORT)).toThrow(
      expect.objectContaining({ code: "conflict" }),
    );
  });
});

describe("changedSincePreview", () => {
  const current = (version: string | null) => (_id: string) => version;

  it("keeps a row whose target holds what it held, and a create whose target is still absent", () => {
    const replanned = { outcome: "update" as const, targetId: TARGET.id };
    expect(changedSincePreview(TARGET, replanned, current(TARGET.version))).toBe(false);
    expect(changedSincePreview(null, { outcome: "create" }, current(null))).toBe(false);
  });

  it("refuses a row whose target changed or went, or that now matches another row or none", () => {
    const update = { outcome: "unchanged" as const, targetId: TARGET.id };
    expect(changedSincePreview(TARGET, update, current("b".repeat(64)))).toBe(true);
    expect(changedSincePreview(TARGET, update, current(null))).toBe(true);
    expect(changedSincePreview(TARGET, { outcome: "create" }, current(TARGET.version))).toBe(true);
    const other = { outcome: "update" as const, targetId: "0192f1a0-0000-7000-8000-0000000000f9" };
    expect(changedSincePreview(TARGET, other, current(TARGET.version))).toBe(true);
  });

  it("refuses a create whose target now exists, and keeps a re-plan's own refusal", () => {
    const now = { outcome: "update" as const, targetId: TARGET.id };
    expect(changedSincePreview(null, now, current(TARGET.version))).toBe(true);
    expect(changedSincePreview(null, { outcome: "error" }, current(null))).toBe(false);
    expect(changedSincePreview(TARGET, { outcome: "error" }, current(TARGET.version))).toBe(false);
  });
});
