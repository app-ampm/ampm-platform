import { describe, expect, it } from "vitest";

import { Prisma } from "../../generated/prisma/client.js";
import { staffPrincipal } from "../../policy/testing/staff-principal.js";
import { buildImportService, csv, NEW_DESTINATION_ID } from "./testing/import-service-fixtures.js";
import { HOTEL_ID } from "./testing/staff-hotel-fixtures.js";

const HT = staffPrincipal(["HT"]);
const HEADER = "destinationSlug,name,slug,minNights,imageRef";
const UNCHANGED = "synthetic-destination,Synthetic Lake Hotel,synthetic-lake-hotel,2,";
const UPDATED = "synthetic-destination,Synthetic Lake Hotel,synthetic-lake-hotel,3,";
const CREATED = "synthetic-destination,Synthetic Cove,synthetic-cove,,https://img.example/cove.jpg";

/** Previews a hotels file as the Hotel team, then imports that preview by its job id. */
async function previewThenImport(
  built: ReturnType<typeof buildImportService>,
  file: Uint8Array,
  principal = HT,
) {
  const preview = await built.service.preview("hotels", file, principal);
  return built.service.apply("hotels", preview.importJobId, principal);
}

describe("HotelImportService: a hotels preview", () => {
  it("writes no hotel, counts what importing would do and keeps the plan on a validating job", async () => {
    const built = buildImportService();
    const result = await built.service.preview("hotels", csv(HEADER, UPDATED, CREATED), HT);
    expect(result).toMatchObject({
      kind: "hotels",
      dryRun: true,
      applied: false,
      created: 1,
      updated: 1,
    });
    expect(result.rows).toEqual([
      {
        line: 2,
        slug: "synthetic-lake-hotel",
        name: "Synthetic Lake Hotel",
        outcome: "update",
        changedFields: ["minNights"],
      },
      {
        line: 3,
        slug: "synthetic-cove",
        name: "Synthetic Cove",
        outcome: "create",
        changedFields: ["destinationSlug", "name"],
      },
    ]);
    expect(built.imports.transaction).not.toHaveBeenCalled();
    expect(built.hotelsRepo.createHotel).not.toHaveBeenCalled();
    expect(built.imports.recordPreview).toHaveBeenCalledWith(
      "hotels",
      HT.userId,
      expect.objectContaining({ status: "validating", rowCount: 2, planJson: expect.anything() }),
    );
    expect(built.imports.supersedePreviews).toHaveBeenCalledWith(
      "hotels",
      HT.userId,
      result.importJobId,
    );
  });

  it("records a preview with no valid row as failed, keeping no plan", async () => {
    const built = buildImportService();
    await built.service.preview("hotels", csv(HEADER, "synthetic-destination,,,,"), HT);
    expect(built.imports.recordPreview).toHaveBeenCalledWith(
      "hotels",
      HT.userId,
      expect.objectContaining({ status: "failed", planJson: null }),
    );
  });

  it("derives the total event space's m² from its sq ft, naming both (D-178)", async () => {
    const built = buildImportService();
    const header = "destinationSlug,name,slug,totalEventSpaceSqft";
    const row = "synthetic-destination,Synthetic Lake Hotel,synthetic-lake-hotel,12000";
    const result = await built.service.preview("hotels", csv(header, row), HT);
    expect(result.rows[0]).toMatchObject({
      outcome: "update",
      changedFields: ["totalEventSpaceSqm", "totalEventSpaceSqft"],
    });
  });
});

describe("HotelImportService: importing a hotels preview", () => {
  it("writes only the changed columns, audits each row by field name and registers media after", async () => {
    const built = buildImportService();
    const result = await previewThenImport(built, csv(HEADER, UPDATED, CREATED));
    expect(result).toMatchObject({
      kind: "hotels",
      dryRun: false,
      applied: true,
      created: 1,
      updated: 1,
      mediaRegistered: 1,
    });
    expect(built.hotelsRepo.updateHotel).toHaveBeenCalledWith(
      HOTEL_ID,
      { minNights: 3 },
      HT.userId,
      expect.anything(),
    );
    expect(built.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update",
        after: expect.objectContaining({ source: "import", changedFields: ["minNights"] }),
      }),
      expect.anything(),
    );
    expect(built.imports.finishImport).toHaveBeenCalledWith(
      result.importJobId,
      expect.objectContaining({ rowCount: 2 }),
      HT.userId,
      expect.anything(),
    );
  });

  it("audits an update with the hotel's name, status and flags before and after, other fields by name", async () => {
    const built = buildImportService();
    const header = "destinationSlug,name,slug,status,demoVisible,publicShowcase,minNights";
    const row = "synthetic-destination,Synthetic Lake Hotel,synthetic-lake-hotel,inactive,true,,3";
    const result = await previewThenImport(built, csv(header, row));
    expect(built.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update",
        entityType: "hotel",
        before: {
          name: "Synthetic Lake Hotel",
          status: "active",
          demoVisible: false,
          publicShowcase: false,
        },
        after: {
          slug: "synthetic-lake-hotel",
          name: "Synthetic Lake Hotel",
          status: "inactive",
          demoVisible: true,
          publicShowcase: false,
          source: "import",
          importJobId: result.importJobId,
          changedFields: ["status", "demoVisible", "minNights"],
        },
      }),
      expect.anything(),
    );
  });

  it("writes a created row's list cells as lists and audits its defaults", async () => {
    const built = buildImportService();
    const header = "destinationSlug,name,slug,facilities,cuisines";
    await previewThenImport(
      built,
      csv(header, "synthetic-destination,Synthetic Cove,synthetic-cove,Pool|Spa,indian"),
    );
    expect(built.hotelsRepo.createHotel).toHaveBeenCalledWith(
      expect.objectContaining({
        facilities: ["Pool", "Spa"],
        cuisines: ["Indian"],
        status: "draft",
      }),
      HT.userId,
      expect.anything(),
    );
    expect(built.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "create",
        entityType: "hotel",
        before: null,
        after: expect.objectContaining({
          name: "Synthetic Cove",
          status: "draft",
          demoVisible: false,
        }),
      }),
      expect.anything(),
    );
  });

  it("writes and audits nothing for an unchanged row: applied false, the job still imported", async () => {
    const built = buildImportService();
    const result = await previewThenImport(built, csv(HEADER, UNCHANGED));
    expect(result).toMatchObject({ applied: false, unchanged: 1, updated: 0, mediaRegistered: 0 });
    expect(built.hotelsRepo.updateHotel).not.toHaveBeenCalled();
    expect(built.audit.record).not.toHaveBeenCalled();
    expect(built.imports.finishImport).toHaveBeenCalledOnce();
  });

  it("creates a destination the file names with its own audit event, in the import's job", async () => {
    const built = buildImportService();
    const result = await previewThenImport(
      built,
      csv(HEADER, "synthetic-new-coast,Synthetic Cove,synthetic-cove,,"),
    );
    expect(result).toMatchObject({ applied: true, created: 1, destinationsCreated: 1 });
    expect(built.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "create",
        entityType: "destination",
        entityId: NEW_DESTINATION_ID,
        after: { slug: "synthetic-new-coast", source: "import", importJobId: result.importJobId },
      }),
      expect.anything(),
    );
  });

  it("answers 409 when another write takes a web address while the import runs, registering no media", async () => {
    const taken = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
    });
    const built = buildImportService({}, { transaction: async () => Promise.reject(taken) });
    const preview = await built.service.preview("hotels", csv(HEADER, CREATED), HT);
    await expect(built.service.apply("hotels", preview.importJobId, HT)).rejects.toMatchObject({
      code: "conflict",
    });
    expect(built.media.registerImportedImage).not.toHaveBeenCalled();
  });
});

describe("HotelImportService: the uploader's own keys, at preview and again at import (D-181, D-164)", () => {
  const READ = "hotels.hotel_profiles_client_fields.read:all";
  const CREATE = "hotels.hotel_profiles_client_fields.create:all";
  const UPDATE = "hotels.hotel_profiles_client_fields.update:all";

  it("refuses a create-only role's rows that change a hotel or add an image, importing the rest", async () => {
    const built = buildImportService();
    const dunes = "synthetic-destination,Synthetic Dunes,synthetic-dunes,,";
    const createOnly = staffPrincipal([], [READ, CREATE]);
    const result = await previewThenImport(built, csv(HEADER, UPDATED, CREATED, dunes), createOnly);
    expect(result).toMatchObject({
      applied: true,
      created: 1,
      rejected: [
        { line: 2, errors: [{ field: "slug" }] },
        { line: 3, errors: [{ field: "imageRef" }] },
      ],
    });
    expect(built.hotelsRepo.updateHotel).not.toHaveBeenCalled();
    expect(built.media.registerImportedImage).not.toHaveBeenCalled();
  });

  it("compares a cell only with what the uploader reads: an unread rating counts as a change", async () => {
    const built = buildImportService();
    const rating = csv(
      "destinationSlug,name,slug,internalRating",
      "synthetic-destination,Synthetic Lake Hotel,synthetic-lake-hotel,4",
    );
    expect((await built.service.preview("hotels", rating, HT)).rows[0]).toMatchObject({
      outcome: "unchanged",
    });
    const blindWriter = staffPrincipal(
      [],
      [READ, CREATE, UPDATE, "hotels.hotel_internal_rating_notes.update:all"],
    );
    const blind = await built.service.preview("hotels", rating, blindWriter);
    expect(blind.rows[0]).toMatchObject({ outcome: "update", changedFields: ["internalRating"] });
  });

  it("re-checks the keys at import: a row the uploader may no longer write is refused", async () => {
    const built = buildImportService();
    const preview = await built.service.preview("hotels", csv(HEADER, UPDATED), HT);
    // The same person (every test principal shares one user id), now holding the create key alone.
    const demoted = staffPrincipal([], [READ, CREATE]);
    const result = await built.service.apply("hotels", preview.importJobId, demoted);
    expect(result.rejected).toEqual([
      { line: 2, errors: [expect.objectContaining({ field: "slug" })] },
    ]);
    expect(built.hotelsRepo.updateHotel).not.toHaveBeenCalled();
  });
});
