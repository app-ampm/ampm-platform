import { describe, expect, it } from "vitest";

import { hotelVersion, roomVersion, venueVersion } from "./hotel-import.version.js";
import { storedHotel } from "./testing/import-service-fixtures.js";
import { decimal, roomRow, venueRow } from "./testing/subresource-fixtures.js";

/*
 * An import target's version token (D-181): what "Changed since preview" compares. It moves with any
 * compared field and nothing else, so recording a verification (which rewrites last_verified_at and
 * updated_at) or writing a value the same way twice never refuses a row.
 */

const WITH_NOTES = { notes: true };
const WITHOUT_NOTES = { notes: false };

describe("version tokens", () => {
  it("are SHA-256 hex, the same for the same compared values", () => {
    expect(roomVersion(roomRow())).toMatch(/^[0-9a-f]{64}$/);
    expect(roomVersion(roomRow())).toBe(roomVersion(roomRow()));
    expect(roomVersion(roomRow({ viewLabel: " Lake  view " }))).toBe(
      roomVersion(roomRow({ viewLabel: "Lake view" })),
    );
  });

  it("move with a compared field but not with the name, which an import never changes", () => {
    expect(roomVersion(roomRow({ roomCount: 13 }))).not.toBe(roomVersion(roomRow()));
    expect(roomVersion(roomRow({ name: "Synthetic Garden Suite" }))).toBe(roomVersion(roomRow()));
  });

  it("read a venue's metres as numbers and its setting as the staff view does", () => {
    const pre = venueRow({ setting: null, isIndoor: true, lengthM: decimal("30.50") });
    const post = venueRow({ setting: "indoor", isIndoor: true, lengthM: decimal("30.5") });
    expect(venueVersion(pre)).toBe(venueVersion(post));
    expect(venueVersion(venueRow({ setting: "semi_open", isIndoor: false }))).not.toBe(
      venueVersion(venueRow({ setting: "outdoor", isIndoor: false })),
    );
  });

  it("ignore a hotel's verification date, but not its notes or its destination", () => {
    const hotel = storedHotel();
    const verified = { ...hotel, lastVerifiedAt: new Date("2026-11-24T00:00:00.000Z") };
    expect(hotelVersion(verified, WITH_NOTES)).toBe(hotelVersion(hotel, WITH_NOTES));
    expect(hotelVersion({ ...hotel, internalNotes: "Synthetic new note" }, WITH_NOTES)).not.toBe(
      hotelVersion(hotel, WITH_NOTES),
    );
    const moved = { ...hotel, destination: { slug: "synthetic-elsewhere" } };
    expect(hotelVersion(moved, WITH_NOTES)).not.toBe(hotelVersion(hotel, WITH_NOTES));
  });

  // The hotels planner compares as Slice 2 does (text trimmed only, lists and links exactly), so its
  // token must see every edit that planner can see: spacing, a link's case, a list entry's spacing.
  it("hash a hotel's fields as stored, so an edit only in spacing or case moves it", () => {
    const hotel = storedHotel({
      descriptionClient: "Lake views. Pool.",
      website: "https://Example.com/x",
      facilities: ["Pool", "Spa"],
    });
    const before = hotelVersion(hotel, WITH_NOTES);
    const edits = [
      { descriptionClient: "Lake views.\n\nPool." },
      { website: "https://example.com/x" },
      { facilities: ["Pool", "Spa  "] },
    ];
    for (const edit of edits) {
      expect(hotelVersion({ ...hotel, ...edit }, WITH_NOTES)).not.toBe(before);
    }
  });

  it("leave a hotel's internal rating and notes out for an uploader who neither reads nor writes them", () => {
    const hotel = storedHotel({ internalRating: 3, internalNotes: "Synthetic note" });
    const edited = { ...hotel, internalRating: 4, internalNotes: "Synthetic other note" };
    expect(hotelVersion(edited, WITHOUT_NOTES)).toBe(hotelVersion(hotel, WITHOUT_NOTES));
    expect(hotelVersion(edited, WITH_NOTES)).not.toBe(hotelVersion(hotel, WITH_NOTES));
    expect(hotelVersion({ ...hotel, city: "Synthetic City" }, WITHOUT_NOTES)).not.toBe(
      hotelVersion(hotel, WITHOUT_NOTES),
    );
  });
});
