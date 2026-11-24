import { hotelDocumentUploadQuery, type HotelDocumentUploadQueryInput } from "@ampm/core";
import type { RoleGrant } from "@ampm/policy";
import { describe, expect, it, vi } from "vitest";

import type { AuditService } from "../../policy/audit.service.js";
import type { StaffPrincipal } from "../../policy/principal.types.js";
import { DocumentVersionsService } from "../documents/document-versions.service.js";
import type { DocumentRow, DocumentsRepository } from "../documents/documents.repository.js";
import type { DocumentsService, StoreDocumentInput } from "../documents/documents.service.js";
import type { HotelDocumentsRepository } from "./hotel-documents.repository.js";
import { HotelDocumentsService } from "./hotel-documents.service.js";

const HOTEL = "0192f1a0-0000-7000-8000-0000000000a1";
const V1 = "0192f1a0-0000-7000-8000-0000000000b1";
const NEW_ROW = "0192f1a0-0000-7000-8000-0000000000c1";
const STAFF = "0192f1a0-0000-7000-8000-0000000000d1";
const CREATE = "hotels.hotel_documents.create";
const UPDATE = "hotels.hotel_documents.update";
const BYTES = Buffer.from("%PDF-1.7\n%%EOF\n");

/** The upload's transaction as the mocks see it: one object, so a spec can tell it was handed on. */
const TX = { transaction: "the upload's" };

function documentRow(
  id: string,
  previousVersionId: string | null,
  overrides: Partial<DocumentRow> = {},
): DocumentRow {
  return {
    id,
    ownerType: "hotel",
    ownerId: HOTEL,
    title: "Spa menu",
    documentType: "other",
    mimeType: "application/pdf",
    sizeBytes: BYTES.length,
    versionNumber: previousVersionId ? 2 : 1,
    previousVersionId,
    visibility: "internal",
    uploadedBy: STAFF,
    createdAt: new Date(Date.UTC(2026, 10, 24, 10, previousVersionId ? 2 : 1)),
    ...overrides,
  };
}

/** A staff member holding exactly these keys, as a custom role grants them (D-036). */
function staff(...keys: string[]): StaffPrincipal {
  return {
    type: "staff",
    userId: STAFF,
    name: "Test Person",
    email: null,
    phone: null,
    status: "active",
    lastLoginAt: null,
    memberships: [],
    roles: [],
    resolvedGrants: new Map(
      keys.map((key): [string, readonly RoleGrant[]] => [key, [{ scope: "all", conditions: [] }]]),
    ),
  };
}

interface HarnessOptions {
  /** Whether the hotel is live when the upload starts. */
  readonly hotelLive?: boolean;
  /** The hotel's live rows before the upload (every version). */
  readonly rows?: readonly DocumentRow[];
  /** Live documents counted before the file is read, and inside the transaction once it is added. */
  readonly live?: number;
  readonly liveInTransaction?: number;
  /** Whether the hotel is still live when the transaction locks it. */
  readonly hotelLiveInTransaction?: boolean;
  /** Whether the replaced document can still be locked, and whether another version followed it. */
  readonly replacedLockable?: boolean;
  readonly replacedFollowed?: boolean;
}

/**
 * The library's service over its real versions service, the repositories mocked: `calls` records what
 * reached the database or the store, in order, so a spec can tell where a refusal stopped the upload.
 */
function harness(options: HarnessOptions = {}) {
  const calls: string[] = [];
  const hotels = {
    hotelExists: vi.fn(async () => options.hotelLive ?? true),
    lockLiveHotel: vi.fn(async (_hotelId: string, tx: unknown) => {
      calls.push(`lock hotel${tx === TX ? " in the transaction" : ""}`);
      return options.hotelLiveInTransaction ?? true;
    }),
  } as unknown as HotelDocumentsRepository;
  const repo = {
    listByOwner: vi.fn(async () => options.rows ?? []),
    countLive: vi.fn(async (_owner: unknown, tx?: unknown) => {
      calls.push(tx === TX ? "count in the transaction" : "count");
      return tx === TX ? (options.liveInTransaction ?? 1) : (options.live ?? 0);
    }),
    lockOwned: vi.fn(async (id: string) => {
      calls.push(`lock ${id}`);
      return options.replacedLockable ?? true;
    }),
    hasSuccessor: vi.fn(async (id: string, except: string | null) => {
      calls.push(`successor of ${id} other than ${except}`);
      return options.replacedFollowed ?? false;
    }),
  } as unknown as DocumentsRepository;
  const versions = new DocumentVersionsService(repo, {
    record: vi.fn(),
  } as unknown as AuditService);
  const stored: StoreDocumentInput[] = [];
  const documents = {
    store: vi.fn(
      async (
        input: StoreDocumentInput,
        _actorId: string,
        attach: (document: DocumentRow, tx: unknown) => Promise<void>,
      ) => {
        calls.push("store");
        stored.push(input);
        const created = documentRow(NEW_ROW, input.previousVersionId, { title: input.title });
        await attach(created, TX);
        return created;
      },
    ),
  } as unknown as DocumentsService;
  const readFile = vi.fn(async () => {
    calls.push("read file");
    return BYTES;
  });
  const service = new HotelDocumentsService(hotels, documents, versions);
  return { service, calls, stored, readFile };
}

/** An upload as the controller hands it over: the query parsed by its core schema, and the reader. */
function upload(
  { service, readFile }: ReturnType<typeof harness>,
  query: HotelDocumentUploadQueryInput,
  principal = staff(CREATE, UPDATE),
) {
  return service.upload(HOTEL, hotelDocumentUploadQuery.parse(query), principal, readFile);
}

describe("HotelDocumentsService.upload: inside its transaction (D-187 §6)", () => {
  it("refuses with 404 when the hotel was removed while the file was checked", async () => {
    const run = harness({ hotelLiveInTransaction: false });
    await expect(upload(run, { type: "other" })).rejects.toMatchObject({ status: 404 });
    expect(run.calls).toEqual(["count", "read file", "store", "lock hotel in the transaction"]);
  });

  it("refuses a new document with 409 when it would be the hotel's 101st", async () => {
    const run = harness({ live: 99, liveInTransaction: 101 });
    await expect(upload(run, { type: "other" })).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/at most 100 documents/),
    });
    expect(run.calls.slice(-2)).toEqual([
      "lock hotel in the transaction",
      "count in the transaction",
    ]);
  });

  it("takes the 100th document", async () => {
    const run = harness({ live: 99, liveInTransaction: 100 });
    await expect(upload(run, { type: "other" })).resolves.toMatchObject({ id: NEW_ROW });
  });

  it("refuses a replacement with 404 when the replaced document is gone by then", async () => {
    const run = harness({ rows: [documentRow(V1, null)], replacedLockable: false });
    await expect(upload(run, { type: "other", replaces: V1 })).rejects.toMatchObject({
      status: 404,
    });
    expect(run.calls.slice(-1)).toEqual([`lock ${V1}`]);
  });

  it("refuses a replacement with 409 when another version followed the replaced one meanwhile", async () => {
    const run = harness({ rows: [documentRow(V1, null)], replacedFollowed: true });
    await expect(upload(run, { type: "other", replaces: V1 })).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/newer version/),
    });
    // The new row itself follows V1: only another one is a successor.
    expect(run.calls.slice(-3)).toEqual([
      "lock hotel in the transaction",
      `lock ${V1}`,
      `successor of ${V1} other than ${NEW_ROW}`,
    ]);
  });

  it("files a replacement as the next version of the latest one, under its document's title", async () => {
    const run = harness({ rows: [documentRow(V1, null)] });
    const view = await upload(run, { type: "other", replaces: V1 });
    expect(view).toMatchObject({ id: NEW_ROW, title: "Spa menu", hotelId: HOTEL });
    expect(view.versions.map((version) => version.id)).toEqual([V1]);
    expect(run.stored).toEqual([
      expect.objectContaining({ previousVersionId: V1, title: "Spa menu", documentType: "other" }),
    ]);
  });

  it("names a new document sent without a title after its type", async () => {
    const run = harness();
    await upload(run, { type: "floor_plan" });
    expect(run.stored).toEqual([expect.objectContaining({ title: "Floor plan" })]);
  });
});

describe("HotelDocumentsService.upload: the update key (D-164)", () => {
  it("refuses a replacement with 403 to a caller with the create key but not the update key", async () => {
    const run = harness({ rows: [documentRow(V1, null)] });
    await expect(upload(run, { type: "other", replaces: V1 }, staff(CREATE))).rejects.toMatchObject(
      {
        status: 403,
      },
    );
    expect(run.calls).toEqual([]);
  });

  it("still lets that caller file a new document", async () => {
    const run = harness();
    await expect(upload(run, { type: "other" }, staff(CREATE))).resolves.toMatchObject({
      id: NEW_ROW,
    });
  });
});

describe("HotelDocumentsService.upload: the checks before the file is read (D-187 §1)", () => {
  const V2 = "0192f1a0-0000-7000-8000-0000000000b2";
  it.each<[string, HarnessOptions, HotelDocumentUploadQueryInput, string[], number, number]>([
    ["a hotel that is gone", { hotelLive: false }, { type: "other" }, [CREATE], 404, 0],
    ["a 101st document", { live: 100 }, { type: "other" }, [CREATE], 409, 1],
    ["a replacement without the update key", {}, { type: "other", replaces: V1 }, [CREATE], 403, 0],
    ["a replacement of no document", {}, { type: "other", replaces: V1 }, [CREATE, UPDATE], 404, 0],
    [
      "a replacement of an earlier version",
      { rows: [documentRow(V2, V1), documentRow(V1, null)] },
      { type: "other", replaces: V1 },
      [CREATE, UPDATE],
      409,
      0,
    ],
    [
      "a replacement of another type",
      { rows: [documentRow(V1, null)] },
      { type: "menu", replaces: V1 },
      [CREATE, UPDATE],
      400,
      0,
    ],
  ])("refuses %s without reading the file", async (_case, options, query, keys, status, counts) => {
    const run = harness(options);
    await expect(upload(run, query, staff(...keys))).rejects.toMatchObject({ status });
    expect(run.readFile).not.toHaveBeenCalled();
    expect(run.calls).toEqual(Array.from({ length: counts }, () => "count"));
  });

  it("reads the file once, after those checks and before it is stored", async () => {
    const run = harness();
    await upload(run, { type: "other" });
    expect(run.readFile).toHaveBeenCalledTimes(1);
    expect(run.calls.slice(0, 3)).toEqual(["count", "read file", "store"]);
  });
});

describe("HotelDocumentsService.upload: at most 50 versions of a document", () => {
  const versionId = (n: number) => `0192f1a0-0000-7000-8000-${String(n).padStart(12, "0")}`;
  /** A document with `count` versions, the newest last filed. */
  const versionsOf = (count: number) =>
    Array.from({ length: count }, (_unused, index) =>
      documentRow(versionId(index + 1), index ? versionId(index) : null, {
        versionNumber: index + 1,
        createdAt: new Date(Date.UTC(2026, 10, 24, 10, 0, index)),
      }),
    );

  it("refuses a 51st version with 409, without reading the file", async () => {
    const run = harness({ rows: versionsOf(50) });
    await expect(upload(run, { type: "other", replaces: versionId(50) })).rejects.toMatchObject({
      status: 409,
      message:
        "A document can keep at most 50 versions: upload this file as a new document instead",
    });
    expect(run.readFile).not.toHaveBeenCalled();
  });

  it("takes the 50th version", async () => {
    const run = harness({ rows: versionsOf(49) });
    const view = await upload(run, { type: "other", replaces: versionId(49) });
    expect(view.versions).toHaveLength(49);
  });
});
