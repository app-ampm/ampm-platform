import { describe, expect, it, vi } from "vitest";

import { Prisma } from "../../generated/prisma/client.js";
import type { AuditService } from "../../policy/audit.service.js";
import { staffPrincipal } from "../../policy/testing/staff-principal.js";
import type { ConfigService } from "../admin/config/config.service.js";
import type { MediaService } from "../media/media.service.js";
import type { HotelImportRepository, ImportTargetRow } from "./hotel-import.repository.js";
import { HotelImportService } from "./hotel-import.service.js";
import type { HotelsAdminRepository } from "./hotels-admin.repository.js";
import { staffHotelRow } from "./testing/staff-hotel-fixtures.js";

const HT = staffPrincipal(["HT"]);
const READ = "hotels.hotel_profiles_client_fields.read:all";
const CREATE = "hotels.hotel_profiles_client_fields.create:all";
const UPDATE = "hotels.hotel_profiles_client_fields.update:all";
/** A custom role holding the import's create key and the profile read, nothing else (D-164). */
const CREATE_ONLY = staffPrincipal([], [READ, CREATE]);
const encode = (lines: readonly string[]) => new TextEncoder().encode(lines.join("\n"));
const CSV = (...rows: string[]) =>
  encode(["destinationSlug,name,slug,minNights,imageRef", ...rows]);

/** The fixture hotel as the import's lookup reads it: live, at the synthetic destination. */
function storedHotel(): ImportTargetRow {
  const {
    destination,
    rooms: _rooms,
    venues: _venues,
    contacts: _contacts,
    ...profile
  } = staffHotelRow({
    minNights: 2,
  });
  return { ...profile, deletedAt: null, destination: { slug: destination.slug } };
}

function build(options: { readonly transaction?: () => Promise<never> } = {}) {
  const hotels = {
    createHotel: vi.fn(async () => "0192f1a0-0000-7000-8000-0000000000d1"),
    updateHotel: vi.fn(async () => undefined),
    createDestination: vi.fn(async () => "0192f1a0-0000-7000-8000-0000000000d2"),
    transaction: vi.fn(
      options.transaction ?? (<T>(work: (tx: unknown) => Promise<T>): Promise<T> => work({})),
    ),
  };
  const imports = {
    findHotelsBySlugs: vi.fn(async () => [storedHotel()]),
    findDestinationsBySlugs: vi.fn(async () => [
      {
        id: "0192f1a0-0000-7000-8000-0000000000a2",
        slug: "synthetic-destination",
        country: "India",
        deletedAt: null,
      },
    ]),
    createImportJob: vi.fn(async () => "0192f1a0-0000-7000-8000-0000000000e1"),
    finishImportJob: vi.fn(async () => undefined),
  };
  const audit = { record: vi.fn(async () => undefined) };
  const media = { registerImportedImage: vi.fn(async () => ({ created: true })) };
  const config = { get: vi.fn(async () => ({ options: ["Indian"] })) };
  const service = new HotelImportService(
    hotels as unknown as HotelsAdminRepository,
    imports as unknown as HotelImportRepository,
    audit as unknown as AuditService,
    media as unknown as MediaService,
    config as unknown as ConfigService,
  );
  return { service, hotels, imports, audit, media };
}

const UNCHANGED = "synthetic-destination,Synthetic Lake Hotel,synthetic-lake-hotel,2,";
const UPDATED = "synthetic-destination,Synthetic Lake Hotel,synthetic-lake-hotel,3,";
const CREATED = "synthetic-destination,Synthetic Cove,synthetic-cove,,https://img.example/cove.jpg";

describe("HotelImportService", () => {
  it("dry-runs without writing a hotel, counting what applying would do", async () => {
    const { service, hotels, imports } = build();
    const result = await service.import(CSV(UPDATED, CREATED), { dryRun: true }, HT);
    expect(result).toMatchObject({
      dryRun: true,
      applied: false,
      created: 1,
      updated: 1,
      unchanged: 0,
    });
    expect(result.rows).toEqual([
      { line: 2, slug: "synthetic-lake-hotel", outcome: "update", changedFields: ["minNights"] },
      {
        line: 3,
        slug: "synthetic-cove",
        outcome: "create",
        changedFields: ["destinationSlug", "name"],
      },
    ]);
    expect(hotels.transaction).not.toHaveBeenCalled();
    expect(hotels.createHotel).not.toHaveBeenCalled();
    expect(imports.finishImportJob).toHaveBeenCalledWith(
      "0192f1a0-0000-7000-8000-0000000000e1",
      expect.objectContaining({ status: "validating", rowCount: 2 }),
      expect.any(String),
    );
  });

  it("applies only the changed columns, auditing each written row by field name", async () => {
    const { service, hotels, audit } = build();
    const result = await service.import(CSV(UPDATED, CREATED), { dryRun: false }, HT);
    expect(result).toMatchObject({ applied: true, created: 1, updated: 1, mediaRegistered: 1 });
    expect(hotels.updateHotel).toHaveBeenCalledWith(
      "0192f1a0-0000-7000-8000-0000000000a1",
      { minNights: 3 },
      expect.any(String),
      expect.anything(),
    );
    expect(audit.record).toHaveBeenCalledTimes(2);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update",
        after: expect.objectContaining({ source: "import", changedFields: ["minNights"] }),
      }),
      expect.anything(),
    );
  });

  it("writes and audits nothing for an unchanged row: applied false, though the job is recorded applied", async () => {
    const { service, hotels, audit, imports } = build();
    const result = await service.import(CSV(UNCHANGED), { dryRun: false }, HT);
    expect(result).toMatchObject({ applied: false, unchanged: 1, updated: 0, mediaRegistered: 0 });
    expect(hotels.updateHotel).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
    expect(imports.finishImportJob).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ status: "applied" }),
      expect.any(String),
      expect.anything(),
    );
  });

  it("records the job failed when no row is valid", async () => {
    const { service, imports } = build();
    const result = await service.import(CSV("synthetic-destination,,,,"), { dryRun: false }, HT);
    expect(result).toMatchObject({ applied: false, rejected: [{ line: 2 }] });
    expect(imports.finishImportJob).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ status: "failed" }),
      expect.any(String),
      expect.anything(),
    );
  });

  it("answers 409 when another write takes a web address while the import runs", async () => {
    const taken = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
    });
    const { service } = build({ transaction: async () => Promise.reject(taken) });
    await expect(service.import(CSV(CREATED), { dryRun: false }, HT)).rejects.toMatchObject({
      code: "conflict",
    });
  });

  /**
   * Media is registered through Module N only AFTER the hotel transaction commits (feature 9.3 slice 5b):
   * if the transaction rolls back, no pending media must be left pointing at a hotel never written.
   */
  it("never registers media when the hotel transaction rolls back", async () => {
    const { service, media } = build({
      transaction: async () => Promise.reject(new Error("boom")),
    });
    await expect(service.import(CSV(CREATED), { dryRun: false }, HT)).rejects.toThrow("boom");
    expect(media.registerImportedImage).not.toHaveBeenCalled();
  });

  it("creates a destination the file names with its own audit event, in the import's job", async () => {
    const { service, hotels, audit } = build();
    const row = "synthetic-new-coast,Synthetic Cove,synthetic-cove,,";
    const result = await service.import(CSV(row), { dryRun: false }, HT);
    expect(result).toMatchObject({ applied: true, created: 1, destinationsCreated: 1 });
    expect(hotels.createDestination).toHaveBeenCalledOnce();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "create",
        entityType: "destination",
        entityId: "0192f1a0-0000-7000-8000-0000000000d2",
        after: {
          slug: "synthetic-new-coast",
          source: "import",
          importJobId: "0192f1a0-0000-7000-8000-0000000000e1",
        },
      }),
      expect.anything(),
    );
  });
});

describe("HotelImportService: the uploader's own keys (D-181, D-164)", () => {
  it("refuses a create-only role's row that changes an existing hotel, writing nothing", async () => {
    const { service, hotels, audit } = build();
    const result = await service.import(CSV(UPDATED), { dryRun: false }, CREATE_ONLY);
    expect(result).toMatchObject({
      applied: false,
      rejected: [{ line: 2, errors: [{ field: "slug" }] }],
    });
    expect(hotels.updateHotel).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("lets a create-only role's unchanged row through, and refuses its image without the media key", async () => {
    const { service, media } = build();
    const unchanged = await service.import(CSV(UNCHANGED), { dryRun: true }, CREATE_ONLY);
    expect(unchanged).toMatchObject({ unchanged: 1, rejected: [] });
    const result = await service.import(CSV(CREATED), { dryRun: false }, CREATE_ONLY);
    expect(result).toMatchObject({ created: 0, rejected: [{ errors: [{ field: "imageRef" }] }] });
    expect(media.registerImportedImage).not.toHaveBeenCalled();
  });

  it("compares a cell only with what the uploader reads: an unread rating counts as a change", async () => {
    const { service } = build();
    const rating = encode([
      "destinationSlug,name,slug,internalRating",
      "synthetic-destination,Synthetic Lake Hotel,synthetic-lake-hotel,4",
    ]);
    const reader = await service.import(rating, { dryRun: true }, HT);
    expect(reader.rows[0]).toMatchObject({ outcome: "unchanged" });
    const blindWriter = staffPrincipal(
      [],
      [READ, CREATE, UPDATE, "hotels.hotel_internal_rating_notes.update:all"],
    );
    const blind = await service.import(rating, { dryRun: true }, blindWriter);
    expect(blind.rows[0]).toMatchObject({ outcome: "update", changedFields: ["internalRating"] });
  });

  it("counts every filled cell as a change for a writer who cannot read the profile", async () => {
    const { service } = build();
    const result = await service.import(
      CSV(UNCHANGED),
      { dryRun: true },
      staffPrincipal([], [CREATE, UPDATE]),
    );
    expect(result.rows[0]).toMatchObject({
      outcome: "update",
      changedFields: ["name", "minNights"],
    });
  });
});
