import type { RoomImportRow, VenueImportRow } from "@ampm/core";
import { describe, expect, it } from "vitest";

import type { ChildImportGrants } from "./hotel-audience.js";
import { ROOM_KIND, VENUE_KIND } from "./hotel-import.child-kinds.js";
import { planChildRows, type ChildPlanContext } from "./hotel-import.child-plan.js";
import { toRoomCategoryView, toVenueView } from "./hotels-admin.view.js";
import { HOTEL_ID } from "./testing/staff-hotel-fixtures.js";
import { ROOM_ID, roomRow, VENUE_ID, venueRow } from "./testing/subresource-fixtures.js";

const LAKE = "synthetic-lake-hotel";
const GONE_ID = "0192f1a0-0000-7000-8000-0000000000b9";
const ALL: ChildImportGrants = { canCreate: true, canUpdate: true, readsRows: true };
const STORED_ROOM = roomRow({ sizeSqft: 500, sizeSqm: 46, maxOccupancy: 3 });

function context<K extends string>(
  values: ChildPlanContext<K>["rows"],
  grants: Partial<ChildImportGrants> = {},
): ChildPlanContext<K> {
  return {
    hotels: new Map([
      [LAKE, { id: HOTEL_ID, deletedAt: null }],
      ["synthetic-gone", { id: GONE_ID, deletedAt: new Date("2026-11-01T00:00:00.000Z") }],
    ]),
    rows: values,
    grants: { ...ALL, ...grants },
  };
}

const rooms = (grants: Partial<ChildImportGrants> = {}, stored = [STORED_ROOM]) =>
  context(
    new Map([
      [
        HOTEL_ID,
        stored.map((row) => ({ id: row.id, name: row.name, values: toRoomCategoryView(row) })),
      ],
    ]),
    grants,
  );

const planRooms = (cells: readonly Partial<RoomImportRow>[], ctx = rooms()) =>
  planChildRows(
    cells.map((cell, index) => ({
      line: index + 2,
      row: { hotelSlug: LAKE, name: "Synthetic Lake Suite", ...cell },
    })),
    ctx,
    ROOM_KIND,
  );

describe("planChildRows: matching a hotel's live rooms by name (D-181)", () => {
  it("matches a name once normalised, keeps the stored name and changes only what differs", () => {
    const [plan] = planRooms([
      { name: "  synthetic LAKE   suite ", roomCount: 14, maxOccupancy: 3 },
    ]);
    expect(plan).toMatchObject({
      outcome: "update",
      name: "Synthetic Lake Suite",
      targetId: ROOM_ID,
      patch: { roomCount: 14 },
      changedFields: ["roomCount"],
    });
  });

  it("leaves a row of blank and equal cells unchanged: a blank never clears", () => {
    expect(planRooms([{ roomCount: 12 }])[0]).toMatchObject({
      outcome: "unchanged",
      targetId: ROOM_ID,
    });
  });

  it("publishes an m² filled alone on a room that stores sq ft, clearing the sq ft (D-178)", () => {
    expect(planRooms([{ sizeSqm: 40 }])[0]).toMatchObject({
      outcome: "update",
      patch: { sizeSqm: 40, sizeSqft: null },
      changedFields: ["sizeSqm", "sizeSqft"],
    });
    expect(planRooms([{ sizeSqft: 1_000 }])[0]).toMatchObject({
      patch: { sizeSqm: 93, sizeSqft: 1_000 },
      changedFields: ["sizeSqm", "sizeSqft"],
    });
  });

  it("creates a room no live row matches, naming its filled columns with the derived m²", () => {
    const [plan] = planRooms([
      { name: "Synthetic Garden Villa", unitType: "villa", sizeSqft: 850 },
    ]);
    expect(plan).toMatchObject({
      outcome: "create",
      hotelId: HOTEL_ID,
      data: { name: "Synthetic Garden Villa", unitType: "villa", sizeSqft: 850, sizeSqm: 79 },
      changedFields: ["name", "unitType", "sizeSqm", "sizeSqft"],
    });
  });

  it("refuses a repeated name for the same hotel on its later line, and two live rows of one name", () => {
    const plans = planRooms([{ roomCount: 14 }, { name: "synthetic lake suite" }]);
    expect(plans[1]).toMatchObject({
      outcome: "error",
      errors: [{ field: "name", message: "Line 2 already names this room for this hotel" }],
    });
    const twins = rooms({}, [STORED_ROOM, roomRow({ id: "0192f1a0-0000-7000-8000-0000000000fa" })]);
    expect(planRooms([{ roomCount: 14 }], twins)[0]).toMatchObject({
      outcome: "error",
      errors: [{ field: "name", message: expect.stringMatching(/^Two rooms are named/) }],
    });
  });

  it("refuses a row naming no hotel, or a deleted one", () => {
    const plans = planChildRows(
      [
        { line: 2, row: { hotelSlug: "synthetic-nowhere", name: "Synthetic Room" } },
        { line: 3, row: { hotelSlug: "synthetic-gone", name: "Synthetic Room" } },
      ],
      rooms(),
      ROOM_KIND,
    );
    expect(plans.map((plan) => plan.outcome === "error" && plan.errors)).toEqual([
      [{ field: "hotelSlug", message: "No hotel has this web address" }],
      [{ field: "hotelSlug", message: "This hotel was deleted" }],
    ]);
  });
});

describe("planChildRows: the uploader's own keys (D-181, D-164)", () => {
  it("needs the create key to add, and the update key to change, but not to leave a row alone", () => {
    expect(
      planRooms([{ name: "Synthetic Garden Villa" }], rooms({ canCreate: false }))[0],
    ).toMatchObject({
      outcome: "error",
      errors: [{ field: "name", message: "You cannot add rooms" }],
    });
    const viewer = rooms({ canUpdate: false });
    expect(planRooms([{ roomCount: 14 }], viewer)[0]).toMatchObject({ outcome: "error" });
    expect(planRooms([{ roomCount: 12 }], viewer)[0]).toMatchObject({ outcome: "unchanged" });
  });

  it("refuses a row naming a stored room to an uploader who cannot read rooms, by one reason", () => {
    const blind = rooms({ readsRows: false });
    for (const cells of [{ roomCount: 12 }, { roomCount: 14 }]) {
      expect(planRooms([cells], blind)[0]).toMatchObject({
        outcome: "error",
        errors: [
          { field: "name", message: "A room already has this name, and you cannot read rooms" },
        ],
      });
    }
  });
});

describe("planChildRows: venues (D-178)", () => {
  const venues = context(
    new Map([
      [HOTEL_ID, [{ id: VENUE_ID, name: "Synthetic Grand Hall", values: toVenueView(venueRow()) }]],
    ]),
  );
  const planVenue = (cells: Partial<VenueImportRow>) =>
    planChildRows(
      [{ line: 2, row: { hotelSlug: LAKE, name: "Synthetic Grand Hall", ...cells } }],
      venues,
      VENUE_KIND,
    )[0];

  it("refuses a new venue without its type or setting, on those fields", () => {
    expect(planVenue({ name: "Synthetic Terrace" })).toMatchObject({
      outcome: "error",
      errors: [{ field: "venueType" }, { field: "setting" }],
    });
  });

  it("creates a venue with is_indoor from its setting, and moves it with a changed setting", () => {
    expect(
      planVenue({
        name: "Synthetic Terrace",
        venueType: "terrace",
        setting: "semi_open",
        areaSqft: 5_000,
      }),
    ).toMatchObject({
      outcome: "create",
      data: { venueType: "terrace", setting: "semi_open", isIndoor: false, areaSqm: 465 },
    });
    expect(planVenue({ setting: "indoor" })).toMatchObject({ outcome: "unchanged" });
    expect(planVenue({ setting: "outdoor" })).toMatchObject({
      outcome: "update",
      patch: { setting: "outdoor", isIndoor: false },
      changedFields: ["setting"],
    });
  });
});
