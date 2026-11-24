import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  documentCalls,
  fixture,
  newLibraryHotel,
  seedLibraryDocuments,
  startLibrarySuite,
  stopLibrarySuite,
  type LibrarySuite,
  type SeededDocument,
} from "./hotel-documents-suite.js";

const PREFIX = "e2e-hoteldocs-limits-";

/**
 * The library's limits end to end (D-187 §1 and §6): every check that needs no file runs before the
 * upload's body is read; a hotel holds at most 100 live documents and a document at most 50 versions.
 */
describe("Hotel documents library: limits (e2e)", () => {
  let suite: LibrarySuite;
  const { http, upload, list } = documentCalls(() => suite);
  const newHotel = (suffix: string) => newLibraryHotel(suite, suffix);

  /** An upload whose body the reader refuses with 415, so the answer tells which check ran first. */
  const notAFile = (query: Record<string, string>, hotel = suite.hotelId) =>
    http()
      .post(`/hotels-admin/hotels/${hotel}/documents`)
      .query(query)
      .set("Authorization", suite.bearer.sa)
      .set("Content-Type", "text/plain")
      .send("not a file");

  const seed = (hotelId: string, documents: readonly SeededDocument[]) =>
    seedLibraryDocuments(suite, hotelId, documents);

  beforeAll(async () => {
    suite = await startLibrarySuite(PREFIX);
  });

  afterAll(async () => {
    await stopLibrarySuite(suite);
  });

  it("answers a refused upload before reading its body (D-187 §1)", async () => {
    await notAFile({ type: "other" }, randomUUID()).expect(404);
    await notAFile({ type: "other", replaces: randomUUID() }).expect(404);
    // An upload every check lets through reaches the reader, which refuses the body.
    await notAFile({ type: "other" }).expect(415);
  });

  it("refuses a 101st live document with 409, and still takes a replacement", async () => {
    const full = await newHotel("full");
    await seed(
      full,
      Array.from({ length: 100 }, (_unused, index) => ({
        title: `Seeded document ${index + 1}`,
        documentType: "other" as const,
      })),
    );
    const pdf = await fixture("reportlab-5.0.0-plain.pdf");
    const refused = await upload(pdf, { type: "other" }, "ht", full).expect(409);
    expect(refused.body.error.code).toBe("conflict");
    // Counted before the body is read: a body the reader would refuse gets the same 409.
    await notAFile({ type: "other" }, full).expect(409);
    const seeded = await suite.prisma.document.findFirstOrThrow({ where: { ownerId: full } });
    await upload(pdf, { type: "other", replaces: seeded.id }, "ht", full).expect(201);
    expect((await list("ht", full).expect(200)).body.data.items).toHaveLength(100);
  });

  it("keeps at most 50 versions of a document: a 51st is a 409", async () => {
    const versioned = await newHotel("versions");
    const ids = Array.from({ length: 50 }, () => randomUUID());
    await seed(
      versioned,
      ids.map((id, index) => ({
        id,
        title: "Seeded menu",
        documentType: "menu" as const,
        versionNumber: index + 1,
        previousVersionId: index ? (ids[index - 1] ?? null) : null,
        createdAt: new Date(Date.UTC(2026, 10, 1, 9, index)),
      })),
    );
    const pdf = await fixture("reportlab-5.0.0-plain.pdf");
    const refused = await upload(pdf, { type: "menu", replaces: ids[49] ?? "" }, "sa", versioned);
    expect(refused.status).toBe(409);
    expect(refused.body.error.message).toBe(
      "A document can keep at most 50 versions: upload this file as a new document instead",
    );
    expect(await suite.prisma.document.count({ where: { ownerId: versioned } })).toBe(50);
  });
});
