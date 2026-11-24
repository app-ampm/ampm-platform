import { HOTEL_IMPORT_PREVIEW_TTL_HOURS } from "@ampm/core";
import { describe, expect, it } from "vitest";

import type { Prisma } from "../../generated/prisma/client.js";
import type { RejectedRow } from "./hotel-import.file.js";
import {
  changedSincePreview,
  PREVIEW_APPLIED,
  PREVIEW_EXPIRED,
  previewRefusal,
  readStoredPlan,
  refusalError,
  storedPlanJson,
  type PlanMatch,
  type PreviewJob,
} from "./hotel-import.job.js";
import { RATES_IMPORT, ROOMS_IMPORT, VENUES_IMPORT } from "./hotel-import.kinds.js";

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

  it("refuses as not found no job, another uploader's, another kind's or a deleted one", () => {
    for (const preview of [
      null,
      job({ createdBy: "0192f1a0-0000-7000-8000-0000000000e2", createdAt: new Date(0) }),
      job({ importType: "hotel_venues" }),
      job({ deletedAt: NOW }),
    ]) {
      expect(refusalOf(preview)).toBe("not_found");
    }
  });

  it("refuses an imported preview, and as expired one that is old, replaced or failed", () => {
    expect(refusalOf(job({ status: "applied", planJson: null }))).toBe("applied");
    const old = new Date(NOW.getTime() - (HOTEL_IMPORT_PREVIEW_TTL_HOURS * HOUR_MS + 1));
    for (const preview of [
      job({ createdAt: old }),
      job({ planJson: null }),
      job({ status: "failed", planJson: null }),
    ]) {
      expect(refusalOf(preview)).toBe("expired");
    }
  });

  it("answers 404 for a preview that is not the caller's, and 409 for one imported or expired", () => {
    expect(refusalError("not_found")).toMatchObject({ code: "not_found", status: 404 });
    expect(refusalError("applied")).toMatchObject({ code: "conflict", message: PREVIEW_APPLIED });
    expect(refusalError("expired")).toMatchObject({ code: "conflict", message: PREVIEW_EXPIRED });
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

  it("keeps a refused rates row's item, so the import reports it as the preview did (D-184)", () => {
    const rate = { hotelSlug: "synthetic-lake-hotel", cardName: "Synthetic 2027", itemType: "tax" };
    const refusedRate: RejectedRow = {
      line: 3,
      slug: "synthetic-lake-hotel",
      name: "Synthetic 2027",
      item: { itemType: "room_rate", roomName: "Synthetic Lake Suite", venueName: null },
      errors: [{ field: "amount", message: "A new item needs its amount" }],
    };
    const json = storedPlanJson("rates", {
      totalRows: 2,
      rows: [{ line: 2, row: rate, target: null }],
      refused: [refusedRate],
    });
    expect(readStoredPlan(stored(json), RATES_IMPORT)).toEqual({
      totalRows: 2,
      rows: [{ line: 2, row: rate, target: null }],
      refused: [refusedRate],
    });
  });

  it("reads nothing back from a plan of another kind, or with a row its kind no longer reads", () => {
    const rooms = storedPlanJson("rooms", { totalRows: 1, rows: [], refused: [] });
    expect(readStoredPlan(stored(rooms), VENUES_IMPORT)).toBeNull();
    const stale = storedPlanJson("rooms", {
      totalRows: 1,
      rows: [{ line: 2, row: { ...row, mystery: true }, target: null }],
      refused: [],
    });
    expect(readStoredPlan(stored(stale), ROOMS_IMPORT)).toBeNull();
    expect(readStoredPlan(null, ROOMS_IMPORT)).toBeNull();
  });
});

describe("changedSincePreview", () => {
  const current = (version: string | null) => (_id: string) => version;
  const row = (targetId: string): PlanMatch => ({ matches: "row", targetId });
  const NONE: PlanMatch = { matches: "none" };
  const UNMATCHED: PlanMatch = { matches: "unmatched" };
  const OTHER_ID = "0192f1a0-0000-7000-8000-0000000000f9";

  it("keeps a row whose target holds what it held, and a create whose target is still absent", () => {
    expect(changedSincePreview(TARGET, row(TARGET.id), current(TARGET.version))).toBe(false);
    expect(changedSincePreview(null, NONE, current(null))).toBe(false);
  });

  it("refuses a row whose target changed or went, or that now matches another row or none", () => {
    expect(changedSincePreview(TARGET, row(TARGET.id), current("b".repeat(64)))).toBe(true);
    expect(changedSincePreview(TARGET, row(TARGET.id), current(null))).toBe(true);
    expect(changedSincePreview(TARGET, NONE, current(TARGET.version))).toBe(true);
    expect(changedSincePreview(TARGET, row(OTHER_ID), current(TARGET.version))).toBe(true);
  });

  it("refuses a create whose target now exists, whatever the re-plan then decided", () => {
    expect(changedSincePreview(null, row(TARGET.id), current(TARGET.version))).toBe(true);
  });

  it("keeps the own refusal of a re-plan that matched nothing, or a create, unless its target moved", () => {
    expect(changedSincePreview(null, UNMATCHED, current(null))).toBe(false);
    expect(changedSincePreview(TARGET, UNMATCHED, current(TARGET.version))).toBe(false);
    expect(changedSincePreview(TARGET, UNMATCHED, current(null))).toBe(true);
  });
});

describe("changedSincePreview: a target inside a container (a rates row's card, D-184)", () => {
  const current = (versions: Record<string, string>) => (id: string) => versions[id] ?? null;
  const CARD = { id: "0192f1a0-0000-7000-8000-0000000000c1", version: "c".repeat(64) };
  const OTHER_CARD = "0192f1a0-0000-7000-8000-0000000000c2";
  const ITEM = { id: "0192f1a0-0000-7000-8000-0000000000c3", version: "d".repeat(64) };
  const live = current({ [CARD.id]: CARD.version, [ITEM.id]: ITEM.version });
  const inCard = (parentId: string): PlanMatch => ({ matches: "none", parentId });
  const item = (targetId: string): PlanMatch => ({ matches: "row", targetId });

  it("keeps a row adding an item to the card it planned against, while the card holds", () => {
    expect(changedSincePreview(CARD, inCard(CARD.id), live)).toBe(false);
    expect(changedSincePreview(ITEM, item(ITEM.id), live)).toBe(false);
  });

  it("refuses a row adding an item when its card moved, went, or is no longer the one named", () => {
    expect(changedSincePreview(CARD, inCard(CARD.id), current({}))).toBe(true);
    const verified = current({ [CARD.id]: "e".repeat(64) });
    expect(changedSincePreview(CARD, inCard(CARD.id), verified)).toBe(true);
    expect(changedSincePreview(CARD, inCard(OTHER_CARD), live)).toBe(true);
    expect(changedSincePreview(CARD, { matches: "none" }, live)).toBe(true);
  });

  it("refuses a row adding an item that now matches one, added since", () => {
    expect(changedSincePreview(CARD, item(ITEM.id), live)).toBe(true);
  });

  it("refuses a row of a new card that now finds a card of its name, whatever it matched in it", () => {
    expect(changedSincePreview(null, inCard(CARD.id), live)).toBe(true);
    expect(changedSincePreview(null, item(ITEM.id), live)).toBe(true);
    expect(changedSincePreview(null, { matches: "none" }, live)).toBe(false);
  });

  it("refuses a row of an item that now matches none in its card", () => {
    expect(changedSincePreview(ITEM, inCard(CARD.id), live)).toBe(true);
  });
});
