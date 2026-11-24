import { describe, expect, it } from "vitest";

import { staffPrincipal } from "../../policy/testing/staff-principal.js";
import { buildImportService, csv } from "./testing/import-service-fixtures.js";
import { HOTEL_ID } from "./testing/staff-hotel-fixtures.js";

/*
 * The images a hotels preview would register (feature 9.3 slice 5b; D-181). An image never makes a row an
 * update, so a file that only adds images previews its rows as unchanged: the preview's `mediaRegistered`
 * says how many images importing would register (a new hotel's, and an existing hotel's not registered
 * yet), so the staff app can tell that Import writes something.
 */

const HT = staffPrincipal(["HT"]);
const HEADER = "destinationSlug,name,slug,minNights,imageRef";
const LAKE_IMAGE = "https://img.example/lake.jpg";
const SAME_CELLS = `synthetic-destination,Synthetic Lake Hotel,synthetic-lake-hotel,2,${LAKE_IMAGE}`;
const NEW_HOTEL =
  "synthetic-destination,Synthetic Cove,synthetic-cove,,https://img.example/cove.jpg";

describe("a hotels preview's images", () => {
  it("counts an image on a hotel whose cells all match, and importing it registers that image", async () => {
    const built = buildImportService();
    const preview = await built.service.preview("hotels", csv(HEADER, SAME_CELLS), HT);
    expect(preview).toMatchObject({ unchanged: 1, updated: 0, applied: false, mediaRegistered: 1 });
    expect(built.media.registerImportedImage).not.toHaveBeenCalled();
    const result = await built.service.apply("hotels", preview.importJobId, HT);
    expect(result).toMatchObject({ applied: true, unchanged: 1, mediaRegistered: 1 });
    expect(built.media.registerImportedImage).toHaveBeenCalledWith(
      "hotel",
      HOTEL_ID,
      LAKE_IMAGE,
      HT.userId,
    );
  });

  it("counts a new hotel's image, and an existing hotel's only while it is not registered", async () => {
    const built = buildImportService();
    built.media.countUnregisteredImports.mockResolvedValueOnce(0);
    const file = csv(HEADER, SAME_CELLS, NEW_HOTEL);
    const preview = await built.service.preview("hotels", file, HT);
    expect(preview).toMatchObject({ created: 1, unchanged: 1, mediaRegistered: 1 });
    expect(built.media.countUnregisteredImports).toHaveBeenCalledWith("hotel", [
      { ownerId: HOTEL_ID, ref: LAKE_IMAGE },
    ]);
  });

  it("counts no image on a row the uploader may not import", async () => {
    const built = buildImportService();
    const createOnly = staffPrincipal(
      [],
      [
        "hotels.hotel_profiles_client_fields.read:all",
        "hotels.hotel_profiles_client_fields.create:all",
      ],
    );
    const preview = await built.service.preview("hotels", csv(HEADER, SAME_CELLS), createOnly);
    expect(preview).toMatchObject({ unchanged: 0, mediaRegistered: 0 });
    expect(preview.rejected).toEqual([
      { line: 2, errors: [expect.objectContaining({ field: "imageRef" })] },
    ]);
  });

  it("counts none for rooms and venues, which carry no image", async () => {
    const built = buildImportService();
    const rooms = csv("hotelSlug,name,roomCount", "synthetic-lake-hotel,Synthetic Garden Villa,4");
    expect(await built.service.preview("rooms", rooms, HT)).toMatchObject({ mediaRegistered: 0 });
  });
});
