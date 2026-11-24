import { vi } from "vitest";

import type { ImportType, Prisma } from "../../../generated/prisma/client.js";
import type { AuditService } from "../../../policy/audit.service.js";
import type { ConfigService } from "../../admin/config/config.service.js";
import type { MediaService } from "../../media/media.service.js";
import { ChildRowsImporter } from "../hotel-import.children.js";
import { HotelRowsImporter } from "../hotel-import.hotels.js";
import { HotelRowsWriter } from "../hotel-import.hotels-write.js";
import type { PreviewJob } from "../hotel-import.job.js";
import type {
  HotelImportRepository,
  ImportTargetRow,
  PreviewOutcome,
} from "../hotel-import.repository.js";
import { HotelImportService } from "../hotel-import.service.js";
import type {
  HotelSubresourcesRepository,
  RoomRow,
  VenueRow,
} from "../hotel-subresources.repository.js";
import type { HotelsAdminRepository, StaffHotelRow } from "../hotels-admin.repository.js";
import { DESTINATION_ID, staffHotelRow } from "./staff-hotel-fixtures.js";
import { roomRow, venueRow } from "./subresource-fixtures.js";

/*
 * The import service over fakes, for its unit specs (data.md: synthetic only): a catalogue the specs may
 * change between a preview and its import, and an in-memory `import_jobs` table that keeps a preview's
 * plan as the database would give it back. Test-only: the build leaves `testing/` folders out.
 */

export const NEW_HOTEL_ID = "0192f1a0-0000-7000-8000-0000000000d1";
export const NEW_DESTINATION_ID = "0192f1a0-0000-7000-8000-0000000000d2";
export const NEW_ROW_ID = "0192f1a0-0000-7000-8000-0000000000d3";

/** What the fakes read: the hotels a file may name, and their rooms and venues. */
export interface ImportCatalogue {
  hotels: ImportTargetRow[];
  rooms: RoomRow[];
  venues: VenueRow[];
}

/**
 * The synthetic hotel as the import's lookup reads it: live, at the synthetic destination.
 *
 * @example
 * storedHotel({ minNights: 2 });
 */
export function storedHotel(overrides: Partial<StaffHotelRow> = {}): ImportTargetRow {
  const {
    destination,
    rooms: _rooms,
    venues: _venues,
    contacts: _contacts,
    ...profile
  } = staffHotelRow(overrides);
  return { ...profile, deletedAt: null, destination: { slug: destination.slug } };
}

/** A JSON value as the database gives it back. */
function asStored(value: Prisma.InputJsonValue | null): Prisma.JsonValue {
  const stored: Prisma.JsonValue = JSON.parse(JSON.stringify(value));
  return stored;
}

/** An in-memory `import_jobs` table holding what each preview recorded. */
function jobStore() {
  const jobs = new Map<string, PreviewJob>();
  return {
    jobs,
    recordPreview: vi.fn(
      async (importType: ImportType, actorId: string, outcome: PreviewOutcome) => {
        const id = `0192f1a0-0000-7000-8000-${String(jobs.size + 1).padStart(12, "0")}`;
        const planJson = asStored(outcome.planJson);
        const createdAt = new Date();
        const job = { importType, status: outcome.status, createdBy: actorId, createdAt, planJson };
        jobs.set(id, { ...job, deletedAt: null });
        return id;
      },
    ),
    supersedePreviews: vi.fn(async (_type: ImportType, _actor: string, _keep: string) => {}),
    claimPreview: vi.fn(async (id: string, _tx: unknown) => jobs.get(id) ?? null),
    finishImport: vi.fn(async (id: string, _outcome: unknown, _actorId: string, _tx: unknown) => {
      const job = jobs.get(id);
      if (job) jobs.set(id, { ...job, status: "applied", planJson: null });
    }),
    clearPlan: vi.fn(async (id: string, _actorId: string, _tx: unknown) => {
      const job = jobs.get(id);
      if (job) jobs.set(id, { ...job, planJson: null });
    }),
  };
}

/** The import repository over the catalogue and the job table. */
function importRepository(state: ImportCatalogue, transaction?: () => Promise<never>) {
  const named = (slugs: readonly string[]) => state.hotels.filter((h) => slugs.includes(h.slug));
  return {
    findHotelsBySlugs: vi.fn(async (slugs: readonly string[], _tx?: unknown) => named(slugs)),
    findHotelRefsBySlugs: vi.fn(async (slugs: readonly string[], _tx?: unknown) =>
      named(slugs).map(({ id, slug, deletedAt }) => ({ id, slug, deletedAt })),
    ),
    findDestinationsBySlugs: vi.fn(async (_slugs: readonly string[], _tx?: unknown) => [
      { id: DESTINATION_ID, slug: "synthetic-destination", country: "India", deletedAt: null },
    ]),
    findLiveRooms: vi.fn(async (ids: readonly string[], _tx?: unknown) =>
      state.rooms.filter((room) => ids.includes(room.hotelId)),
    ),
    findLiveVenues: vi.fn(async (ids: readonly string[], _tx?: unknown) =>
      state.venues.filter((venue) => ids.includes(venue.hotelId)),
    ),
    lockHotelsBySlug: vi.fn(async (_slugs: readonly string[], _tx: unknown) => {}),
    lockLiveRooms: vi.fn(async (_ids: readonly string[], _tx: unknown) => {}),
    lockLiveVenues: vi.fn(async (_ids: readonly string[], _tx: unknown) => {}),
    transaction: vi.fn(
      transaction ?? (<T>(work: (tx: unknown) => Promise<T>): Promise<T> => work({})),
    ),
    ...jobStore(),
  };
}

/** The writes the import makes: hotels and destinations, rooms and venues, each answering a fixed id. */
function writes() {
  const hotelsRepo = {
    createHotel: vi.fn(async (_data: unknown, _actorId: string, _tx?: unknown) => NEW_HOTEL_ID),
    updateHotel: vi.fn(async (_id: string, _patch: unknown, _actorId: string, _tx?: unknown) => {}),
    createDestination: vi.fn(
      async (_data: unknown, _actorId: string, _tx?: unknown) => NEW_DESTINATION_ID,
    ),
  };
  const subresources = {
    createRoom: vi.fn(async (_hotelId: string, _data: unknown, _a: string, _tx?: unknown) =>
      roomRow({ id: NEW_ROW_ID }),
    ),
    updateRoom: vi.fn(async (_id: string, _patch: unknown, _a: string, _tx?: unknown) => roomRow()),
    createVenue: vi.fn(async (_hotelId: string, _data: unknown, _a: string, _tx?: unknown) =>
      venueRow({ id: NEW_ROW_ID }),
    ),
    updateVenue: vi.fn(async (_id: string, _patch: unknown, _a: string, _tx?: unknown) =>
      venueRow(),
    ),
  };
  return { hotelsRepo, subresources };
}

/**
 * The import service over fakes: the synthetic hotel (with any catalogue the spec gives), its destination,
 * one configured cuisine, writes that answer fixed ids, an audit that records nothing and media that
 * always registers and holds no image yet.
 *
 * @example
 * const { service, state, subresources } = buildImportService({ rooms: [roomRow()] });
 */
export function buildImportService(
  catalogue: Partial<ImportCatalogue> = {},
  options: { readonly transaction?: () => Promise<never> } = {},
) {
  const hotelsOf = { hotels: [storedHotel({ minNights: 2 })], rooms: [], venues: [] };
  const state: ImportCatalogue = { ...hotelsOf, ...catalogue };
  const imports = importRepository(state, options.transaction);
  const { hotelsRepo, subresources } = writes();
  const audit = { record: vi.fn(async (_input: unknown, _tx?: unknown) => {}) };
  const media = {
    registerImportedImage: vi.fn(async () => ({ created: true })),
    // None of the existing hotels' images is registered yet, unless a spec says otherwise.
    countUnregisteredImports: vi.fn(
      async (_ownerType: string, refs: readonly { ownerId: string; ref: string }[]) => refs.length,
    ),
  };
  const config = { get: vi.fn(async () => ({ options: ["Indian"] })) };
  const repo = imports as unknown as HotelImportRepository;
  const auditService = audit as unknown as AuditService;
  const writer = new HotelRowsWriter(hotelsRepo as unknown as HotelsAdminRepository, auditService);
  const hotels = new HotelRowsImporter(
    repo,
    writer,
    media as unknown as MediaService,
    config as unknown as ConfigService,
  );
  const children = new ChildRowsImporter(
    repo,
    subresources as unknown as HotelSubresourcesRepository,
    auditService,
  );
  const service = new HotelImportService(hotels, children, repo);
  return { service, state, imports, hotelsRepo, subresources, audit, media };
}

/** A file's bytes from its lines. */
export const csv = (...lines: string[]): Uint8Array => new TextEncoder().encode(lines.join("\n"));
