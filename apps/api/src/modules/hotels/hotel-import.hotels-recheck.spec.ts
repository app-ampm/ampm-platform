import { describe, expect, it } from "vitest";

import { staffPrincipal } from "../../policy/testing/staff-principal.js";
import { CHANGED_SINCE_PREVIEW } from "./hotel-import.job.js";
import type { StaffHotelRow } from "./hotels-admin.repository.js";
import { buildImportService, csv, storedHotel } from "./testing/import-service-fixtures.js";

/*
 * Importing a hotels preview after its hotel changed (D-181): the import refuses a row whose hotel holds
 * anything the hotels planner would now compare differently, so it never writes a field its preview did
 * not show; and an edit to what the uploader may not read, and the row does not write, never refuses
 * their row, so the outcome tells them nothing about it (D-171).
 */

const HT = staffPrincipal(["HT"]);
const READ = "hotels.hotel_profiles_client_fields.read:all";
const CREATE = "hotels.hotel_profiles_client_fields.create:all";
const UPDATE = "hotels.hotel_profiles_client_fields.update:all";
const NOTES_UPDATE = "hotels.hotel_internal_rating_notes.update:all";
const HEADER = "destinationSlug,slug,name,city,descriptionClient";
const ROW =
  "synthetic-destination,synthetic-lake-hotel,Synthetic Lake Hotel,Udaipur,Lake views. Pool.";
const CHANGED = [{ line: 2, errors: [{ field: "row", message: CHANGED_SINCE_PREVIEW }] }];

const lakeHotel = (overrides: Partial<StaffHotelRow> = {}) =>
  storedHotel({ city: "Udaipur City", descriptionClient: "Lake views. Pool.", ...overrides });

describe("importing a hotels preview after its hotel changed", () => {
  it("refuses a row whose hotel was edited only in its spacing, writing nothing the preview did not show", async () => {
    const built = buildImportService({ hotels: [lakeHotel()] });
    const preview = await built.service.preview("hotels", csv(HEADER, ROW), HT);
    expect(preview.rows[0]).toMatchObject({ outcome: "update", changedFields: ["city"] });
    built.state.hotels = [lakeHotel({ descriptionClient: "Lake views.\n\nPool." })];
    const result = await built.service.apply("hotels", preview.importJobId, HT);
    expect(result.rejected).toEqual(CHANGED);
    expect(built.hotelsRepo.updateHotel).not.toHaveBeenCalled();
  });

  it("refuses a row whose hotel's link changed only in case", async () => {
    const built = buildImportService({ hotels: [lakeHotel({ website: "https://Example.com/x" })] });
    const preview = await built.service.preview("hotels", csv(HEADER, ROW), HT);
    built.state.hotels = [lakeHotel({ website: "https://example.com/x" })];
    const result = await built.service.apply("hotels", preview.importJobId, HT);
    expect(result.rejected).toEqual(CHANGED);
  });

  it("refuses a notes reader's row when the notes changed, since they could write over them", async () => {
    const built = buildImportService({ hotels: [lakeHotel()] });
    const preview = await built.service.preview("hotels", csv(HEADER, ROW), HT);
    built.state.hotels = [lakeHotel({ internalNotes: "Synthetic new note" })];
    const result = await built.service.apply("hotels", preview.importJobId, HT);
    expect(result.rejected).toEqual(CHANGED);
  });

  it("imports the row of an uploader who neither reads nor writes notes, whatever the notes became", async () => {
    const profileEditor = staffPrincipal([], [READ, CREATE, UPDATE]);
    const built = buildImportService({ hotels: [lakeHotel()] });
    const preview = await built.service.preview("hotels", csv(HEADER, ROW), profileEditor);
    built.state.hotels = [lakeHotel({ internalRating: 2, internalNotes: "Synthetic new note" })];
    const result = await built.service.apply("hotels", preview.importJobId, profileEditor);
    expect(result).toMatchObject({ updated: 1, rejected: [] });
    expect(built.hotelsRepo.updateHotel).toHaveBeenCalledOnce();
  });
});

// A custom role may hold the notes update key without the read key: its rows that leave the notes alone
// cannot write over them, so a notes edit must not refuse them (a refusal would tell the uploader the
// hidden notes changed); a row that fills a notes cell could, so it is still refused.
describe("importing a notes writer's preview after the notes changed, when they cannot read them", () => {
  const blindWriter = staffPrincipal([], [READ, CREATE, UPDATE, NOTES_UPDATE]);
  const notesEdited = () => [lakeHotel({ internalRating: 2, internalNotes: "Synthetic new note" })];

  it("imports a row that leaves the notes alone", async () => {
    const built = buildImportService({ hotels: [lakeHotel()] });
    const preview = await built.service.preview("hotels", csv(HEADER, ROW), blindWriter);
    built.state.hotels = notesEdited();
    const result = await built.service.apply("hotels", preview.importJobId, blindWriter);
    expect(result).toMatchObject({ updated: 1, rejected: [] });
  });

  it("leaves a row that changes nothing unrefused, so it probes nothing", async () => {
    const built = buildImportService({ hotels: [lakeHotel()] });
    const row = "synthetic-destination,synthetic-lake-hotel,Synthetic Lake Hotel,Udaipur City,";
    const preview = await built.service.preview("hotels", csv(HEADER, row), blindWriter);
    expect(preview).toMatchObject({ unchanged: 1, updated: 0 });
    built.state.hotels = notesEdited();
    const result = await built.service.apply("hotels", preview.importJobId, blindWriter);
    expect(result).toMatchObject({ unchanged: 1, rejected: [] });
  });

  it("refuses a row that fills a notes cell, since it would write over the new notes", async () => {
    const built = buildImportService({ hotels: [lakeHotel()] });
    const file = csv(`${HEADER},internalNotes`, `${ROW},Synthetic file note`);
    const preview = await built.service.preview("hotels", file, blindWriter);
    expect(preview.rows[0]).toMatchObject({ outcome: "update" });
    built.state.hotels = notesEdited();
    const result = await built.service.apply("hotels", preview.importJobId, blindWriter);
    expect(result.rejected).toEqual(CHANGED);
  });

  // A later line naming the same hotel is refused and never stored, so the line planned decides the
  // token at preview and at import alike: its own cells, not a refused repeat's.
  it("keys the token on the first line to name a hotel, not a refused repeat that fills the notes", async () => {
    const built = buildImportService({ hotels: [lakeHotel()] });
    const file = csv(`${HEADER},internalNotes`, `${ROW},`, `${ROW},Synthetic file note`);
    const preview = await built.service.preview("hotels", file, blindWriter);
    expect(preview.rejected).toHaveLength(1);
    const result = await built.service.apply("hotels", preview.importJobId, blindWriter);
    expect(result).toMatchObject({ updated: 1, rejected: [expect.objectContaining({ line: 3 })] });
  });
});
