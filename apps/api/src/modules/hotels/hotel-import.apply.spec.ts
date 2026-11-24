import { describe, expect, it } from "vitest";

import { staffPrincipal } from "../../policy/testing/staff-principal.js";
import { CHANGED_SINCE_PREVIEW, PREVIEW_APPLIED, PREVIEW_EXPIRED } from "./hotel-import.job.js";
import { buildImportService, csv, NEW_ROW_ID } from "./testing/import-service-fixtures.js";
import { HOTEL_ID } from "./testing/staff-hotel-fixtures.js";
import { ROOM_ID, roomRow, VENUE_ID, venueRow } from "./testing/subresource-fixtures.js";

/*
 * Importing a Rooms or Venues preview by its job id (D-181): the file is never sent again; only the
 * uploader imports it, once, within the time limit; each stored row is re-planned against the catalogue as
 * it is then, and a row whose room changed since its preview is refused while the others apply.
 */

const HT = staffPrincipal(["HT"]);
const HEADER = "hotelSlug,name,roomCount";
const KEPT = "synthetic-lake-hotel,Synthetic Lake Suite,14";
const ADDED = "synthetic-lake-hotel,Synthetic Garden Villa,4";

async function preview(built: ReturnType<typeof buildImportService>, ...rows: string[]) {
  return built.service.preview("rooms", csv(HEADER, ...rows), HT);
}

describe("importing a rooms preview", () => {
  it("writes its rows with no file sent again, each audited, and answers with the preview's job id", async () => {
    const built = buildImportService({ rooms: [roomRow()] });
    const { importJobId } = await preview(built, KEPT, ADDED);
    const result = await built.service.apply("rooms", importJobId, HT);
    expect(result).toMatchObject({
      importJobId,
      kind: "rooms",
      dryRun: false,
      applied: true,
      created: 1,
      updated: 1,
    });
    expect(built.subresources.updateRoom).toHaveBeenCalledWith(
      ROOM_ID,
      { roomCount: 14 },
      HT.userId,
      expect.anything(),
    );
    expect(built.subresources.createRoom).toHaveBeenCalledWith(
      HOTEL_ID,
      { name: "Synthetic Garden Villa", roomCount: 4 },
      HT.userId,
      expect.anything(),
    );
    expect(built.audit.record).toHaveBeenCalledWith(
      {
        action: "create",
        entityType: "hotel_room_category",
        entityId: NEW_ROW_ID,
        before: null,
        after: {
          hotelId: HOTEL_ID,
          name: "Synthetic Garden Villa",
          source: "import",
          importJobId,
          changedFields: ["name", "roomCount"],
        },
        maskImages: false,
      },
      expect.anything(),
    );
    expect(built.imports.lockHotelsBySlug).toHaveBeenCalledWith(
      ["synthetic-lake-hotel"],
      expect.anything(),
    );
    expect(built.imports.lockLiveRooms).toHaveBeenCalledWith([HOTEL_ID], expect.anything());
  });

  it("refuses a row whose room changed since the preview, applying the others", async () => {
    const built = buildImportService({ rooms: [roomRow()] });
    const { importJobId } = await preview(built, KEPT, ADDED);
    built.state.rooms = [roomRow({ viewLabel: "Synthetic garden view" })];
    const result = await built.service.apply("rooms", importJobId, HT);
    expect(result).toMatchObject({ created: 1, updated: 0 });
    expect(result.rejected).toEqual([
      { line: 2, errors: [{ field: "row", message: CHANGED_SINCE_PREVIEW }] },
    ]);
    expect(built.subresources.updateRoom).not.toHaveBeenCalled();
  });

  it("refuses a row that created a room now there, and one whose room was retired since", async () => {
    const built = buildImportService({ rooms: [roomRow()] });
    const { importJobId } = await preview(built, KEPT, ADDED);
    built.state.rooms = [roomRow({ id: NEW_ROW_ID, name: "Synthetic Garden Villa", roomCount: 4 })];
    const result = await built.service.apply("rooms", importJobId, HT);
    expect(result.rejected.map(({ line }) => line)).toEqual([2, 3]);
    expect(result).toMatchObject({ applied: false, created: 0, updated: 0 });
  });

  it("does not refuse a row whose room was renamed only in case, which changes nothing it compares", async () => {
    const built = buildImportService({ rooms: [roomRow()] });
    const { importJobId } = await preview(built, KEPT);
    built.state.rooms = [roomRow({ name: "SYNTHETIC LAKE SUITE" })];
    const result = await built.service.apply("rooms", importJobId, HT);
    expect(result).toMatchObject({ updated: 1, rejected: [] });
    expect(result.rows[0]).toMatchObject({ name: "SYNTHETIC LAKE SUITE", outcome: "update" });
  });
});

describe("who may import a preview, and when", () => {
  it("answers 404 to another uploader, and for the preview of another kind", async () => {
    const built = buildImportService({ rooms: [roomRow()] });
    const { importJobId } = await preview(built, KEPT);
    const other = { ...HT, userId: "0192f1a0-0000-7000-8000-0000000000e9" };
    await expect(built.service.apply("rooms", importJobId, other)).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(built.service.apply("venues", importJobId, HT)).rejects.toMatchObject({
      code: "not_found",
    });
    expect(built.subresources.updateRoom).not.toHaveBeenCalled();
  });

  it("answers 409 to a second import of the same preview", async () => {
    const built = buildImportService({ rooms: [roomRow()] });
    const { importJobId } = await preview(built, KEPT);
    await built.service.apply("rooms", importJobId, HT);
    await expect(built.service.apply("rooms", importJobId, HT)).rejects.toMatchObject({
      code: "conflict",
      message: PREVIEW_APPLIED,
    });
    expect(built.subresources.updateRoom).toHaveBeenCalledOnce();
  });

  it("answers 409 to a preview over a day old, which must be validated again", async () => {
    const built = buildImportService({ rooms: [roomRow()] });
    const { importJobId } = await preview(built, KEPT);
    const job = built.imports.jobs.get(importJobId);
    if (job)
      built.imports.jobs.set(importJobId, {
        ...job,
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      });
    await expect(built.service.apply("rooms", importJobId, HT)).rejects.toMatchObject({
      code: "conflict",
      message: PREVIEW_EXPIRED,
    });
  });
});

describe("importing a venues preview (D-178)", () => {
  it("writes is_indoor with a changed setting", async () => {
    const built = buildImportService({ venues: [venueRow()] });
    const file = csv(
      "hotelSlug,name,setting",
      "synthetic-lake-hotel,Synthetic Grand Hall,Semi-open",
    );
    const { importJobId } = await built.service.preview("venues", file, HT);
    const result = await built.service.apply("venues", importJobId, HT);
    expect(result).toMatchObject({ kind: "venues", updated: 1 });
    expect(built.subresources.updateVenue).toHaveBeenCalledWith(
      VENUE_ID,
      { setting: "semi_open", isIndoor: false },
      HT.userId,
      expect.anything(),
    );
  });
});
