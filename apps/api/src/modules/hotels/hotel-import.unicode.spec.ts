import { describe, expect, it } from "vitest";

import { staffPrincipal } from "../../policy/testing/staff-principal.js";
import { decodeCsv, slugify } from "./hotel-import.js";
import { buildImportService, csv, storedHotel } from "./testing/import-service-fixtures.js";
import { roomRow } from "./testing/subresource-fixtures.js";

/*
 * Names that look the same but are spelt in different code points (D-181): "Café" as one character (NFC)
 * or as "e" and a combining accent (NFD), as text copied from some PDFs or a macOS file name arrives. The
 * import reads a file and the stored room and venue names in one canonical form (NFC), so a row matches
 * the room it names, two stored rows of one name are the ambiguity the import reports, and one file never
 * names a room twice by spelling it two ways. Every slug is made from the composed name, so a hotel the
 * staff app created from a pasted NFD name is the hotel an import row of that name updates. Core stays
 * free of `normalize` (Hermes), so the API does it.
 */

const HT = staffPrincipal(["HT"]);
const SLUG = "synthetic-lake-hotel";
// Escapes, never the characters themselves: an editor that composes text would make the two one.
const NFC = "Caf\u00e9 Suite";
const NFD = "Cafe\u0301 Suite";
const NFC_HOTEL = "Caf\u00e9 Lake Hotel";
const NFD_HOTEL = "Cafe\u0301 Lake Hotel";
const OTHER_ROOM_ID = "0192f1a0-0000-7000-8000-0000000000f9";

describe("canonically equivalent names in a rooms import", () => {
  it("reads a file's text in NFC", () => {
    const text = decodeCsv(new TextEncoder().encode(`hotelSlug,name\n${SLUG},${NFD}`));
    expect(text).toBe(`hotelSlug,name\n${SLUG},${NFC}`);
  });

  it("updates the stored room an NFD row names, rather than adding a second one", async () => {
    const built = buildImportService({ rooms: [roomRow({ name: NFC })] });
    const preview = await built.service.preview(
      "rooms",
      csv("hotelSlug,name,viewLabel", `${SLUG},${NFD},Lake`),
      HT,
    );
    expect(preview.rows[0]).toMatchObject({ outcome: "update", changedFields: ["viewLabel"] });
    await built.service.apply("rooms", preview.importJobId, HT);
    expect(built.subresources.createRoom).not.toHaveBeenCalled();
    expect(built.subresources.updateRoom).toHaveBeenCalledOnce();
  });

  it("matches an NFC row to a room the staff app stored in NFD", async () => {
    const built = buildImportService({ rooms: [roomRow({ name: NFD })] });
    const preview = await built.service.preview(
      "rooms",
      csv("hotelSlug,name,viewLabel", `${SLUG},${NFC},Lake`),
      HT,
    );
    expect(preview.rows[0]).toMatchObject({ outcome: "update", changedFields: ["viewLabel"] });
  });

  it("reports two stored rooms spelt the two ways as one ambiguous name", async () => {
    const built = buildImportService({
      rooms: [roomRow({ name: NFC }), roomRow({ id: OTHER_ROOM_ID, name: NFD })],
    });
    const preview = await built.service.preview(
      "rooms",
      csv("hotelSlug,name,viewLabel", `${SLUG},${NFC},Lake`),
      HT,
    );
    expect(preview.rejected).toEqual([
      expect.objectContaining({
        line: 2,
        errors: [
          expect.objectContaining({ field: "name", message: expect.stringMatching(/^Two rooms/) }),
        ],
      }),
    ]);
  });

  it("refuses the second line of one file that spells the first line's name the other way", async () => {
    const built = buildImportService();
    const preview = await built.service.preview(
      "rooms",
      csv("hotelSlug,name,viewLabel", `${SLUG},${NFC},Lake`, `${SLUG},${NFD},Garden`),
      HT,
    );
    expect(preview.rows[0]).toMatchObject({ outcome: "create" });
    expect(preview.rejected).toEqual([
      expect.objectContaining({
        line: 3,
        errors: [{ field: "name", message: "Line 2 already names this room for this hotel" }],
      }),
    ]);
  });
});

describe("canonically equivalent names in a hotels import", () => {
  it("makes one slug of a name in either spelling", () => {
    expect(slugify(NFD_HOTEL)).toBe(slugify(NFC_HOTEL));
  });

  it("updates the hotel created from a pasted NFD name, rather than planning a second one", async () => {
    // The staff create sends no slug, so the API made it from the name as pasted.
    const pasted = storedHotel({ name: NFD_HOTEL, slug: slugify(NFD_HOTEL) });
    const built = buildImportService({ hotels: [pasted] });
    const preview = await built.service.preview(
      "hotels",
      csv("destinationSlug,name", `synthetic-destination,${NFD_HOTEL}`),
      HT,
    );
    // The one-off: the stored name is decomposed and the file's is read composed, so it is rewritten once.
    expect(preview.rows[0]).toMatchObject({ outcome: "update", changedFields: ["name"] });
    await built.service.apply("hotels", preview.importJobId, HT);
    expect(built.hotelsRepo.createHotel).not.toHaveBeenCalled();
    expect(built.hotelsRepo.updateHotel).toHaveBeenCalledWith(
      pasted.id,
      { name: NFC_HOTEL },
      HT.userId,
      expect.anything(),
    );
  });
});
