import { describe, expect, it } from "vitest";

import { staffPrincipal } from "../../policy/testing/staff-principal.js";
import { CHANGED_SINCE_PREVIEW } from "./hotel-import.job.js";
import { buildImportService, csv } from "./testing/import-service-fixtures.js";
import { roomRow, venueRow } from "./testing/subresource-fixtures.js";

/*
 * What an import says of a rooms or venues row whose target moved after its preview (D-181): "Changed
 * since preview" whenever the row no longer names the row it planned against (renamed, or its hotel
 * deleted), even when the create its name now leads to would be refused for its own reasons; a row that
 * planned a create keeps its own refusal.
 */

const HT = staffPrincipal(["HT"]);
const SLUG = "synthetic-lake-hotel";
const CHANGED = { field: "row", message: CHANGED_SINCE_PREVIEW };

describe("re-planning a rooms or venues row whose target moved after the preview", () => {
  it("refuses a venues row whose venue was renamed as changed, not for what a new venue needs", async () => {
    const built = buildImportService({ venues: [venueRow({ name: "Synthetic Grand Hall" })] });
    const file = csv("hotelSlug,name,capacityBanquet", `${SLUG},Synthetic Grand Hall,320`);
    const preview = await built.service.preview("venues", file, HT);
    expect(preview.rows[0]).toMatchObject({
      outcome: "update",
      changedFields: ["capacityBanquet"],
    });
    built.state.venues = [venueRow({ name: "Synthetic Grand Ballroom" })];
    const result = await built.service.apply("venues", preview.importJobId, HT);
    expect(result.rejected).toEqual([{ line: 2, errors: [CHANGED] }]);
    expect(built.subresources.createVenue).not.toHaveBeenCalled();
    expect(built.subresources.updateVenue).not.toHaveBeenCalled();
  });

  it("refuses a rooms row whose room was renamed as changed", async () => {
    const built = buildImportService({ rooms: [roomRow({ name: "Synthetic Lake Suite" })] });
    const file = csv("hotelSlug,name,roomCount", `${SLUG},Synthetic Lake Suite,14`);
    const preview = await built.service.preview("rooms", file, HT);
    built.state.rooms = [roomRow({ name: "Synthetic Lake Villa" })];
    const result = await built.service.apply("rooms", preview.importJobId, HT);
    expect(result.rejected).toEqual([{ line: 2, errors: [CHANGED] }]);
    expect(built.subresources.createRoom).not.toHaveBeenCalled();
  });

  it("refuses an update row of a hotel deleted since as changed, and its create row as deleted", async () => {
    const built = buildImportService({ rooms: [roomRow({ name: "Synthetic Lake Suite" })] });
    const file = csv(
      "hotelSlug,name,roomCount",
      `${SLUG},Synthetic Lake Suite,14`,
      `${SLUG},Synthetic Garden Villa,4`,
    );
    const preview = await built.service.preview("rooms", file, HT);
    built.state.hotels = built.state.hotels.map((hotel) => ({ ...hotel, deletedAt: new Date() }));
    const result = await built.service.apply("rooms", preview.importJobId, HT);
    expect(result.rejected).toEqual([
      { line: 2, errors: [CHANGED] },
      { line: 3, errors: [{ field: "hotelSlug", message: "This hotel was deleted" }] },
    ]);
  });
});
