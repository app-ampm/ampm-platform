import { randomUUID } from "node:crypto";

import { CONTENT_KINDS, UPLOAD_REFUSAL_MESSAGES } from "@ampm/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  documentCalls,
  fixture,
  newLibraryHotel,
  startLibrarySuite,
  stopLibrarySuite,
  type LibrarySuite,
} from "./hotel-documents-suite.js";

const PREFIX = "e2e-hoteldocs-";
const PPTX = CONTENT_KINDS.pptx.mimeType;
const XLSX = CONTENT_KINDS.xlsx.mimeType;

/**
 * A hotel's documents library end to end (D-187 §6): the Super Admin and the Hotel team file, replace,
 * open and remove a hotel's fact sheets, menus and floor plans; Sales and project managers read and
 * open them; everyone else is answered as if there were none. Every file is checked by content against
 * its type's rules, versioned on replacement, opened only through a 15-minute link, and audited. The
 * caps and the checks before a file is read are in hotel-documents-limits.e2e-spec.ts.
 */
describe("Hotel documents library (e2e)", () => {
  let suite: LibrarySuite;
  const { http, upload, list, mintLink, remove } = documentCalls(() => suite);
  const newHotel = (suffix: string) => newLibraryHotel(suite, suffix);

  beforeAll(async () => {
    suite = await startLibrarySuite(PREFIX);
  });

  afterAll(async () => {
    await stopLibrarySuite(suite);
  });

  it("files a pptx fact sheet, replaces it as version 2, lists version 1 under it, and serves it", async () => {
    const pptx = await fixture("keynote-14.4.pptx");
    const first = await upload(pptx, { type: "fact_sheet" }).expect(201);
    expect(first.body.data).toMatchObject({
      hotelId: suite.hotelId,
      documentType: "fact_sheet",
      title: "Fact sheet",
      mimeType: PPTX,
      sizeBytes: pptx.length,
      versionNumber: 1,
      versions: [],
    });
    const v1 = first.body.data.id as string;

    const query = { type: "fact_sheet", replaces: v1, title: "  Fact sheet 2027  " };
    const second = await upload(pptx, query, "sa").expect(201);
    const v2 = second.body.data.id as string;
    expect(second.body.data).toMatchObject({ title: "Fact sheet 2027", versionNumber: 2 });
    expect(second.body.data.versions).toEqual([
      expect.objectContaining({ id: v1, versionNumber: 1 }),
    ]);

    const listed = await list().expect(200);
    const entry = listed.body.data.items.find((item: { id: string }) => item.id === v2);
    expect(entry.versions.map((version: { id: string }) => version.id)).toEqual([v1]);
    expect(listed.body.data.items.some((item: { id: string }) => item.id === v1)).toBe(false);

    const link = await mintLink(v2).expect(201);
    expect(link.body.data.url).toMatch(/^\/documents\/links\/[0-9a-f-]{36}\/[A-Za-z0-9_-]{43}$/);
    const served = await http()
      .get(link.body.data.url as string)
      .responseType("blob")
      .expect(200);
    expect(served.headers).toMatchObject({
      "content-type": PPTX,
      "content-disposition": 'attachment; filename="fact_sheet-v2.pptx"',
      "content-security-policy": "default-src 'none'",
      "x-content-type-options": "nosniff",
    });
    expect(Buffer.compare(served.body as Buffer, pptx)).toBe(0);
    await mintLink(v1).expect(201); // an earlier version opens too

    const created = await suite.prisma.auditEvent.findFirstOrThrow({
      where: { entityType: "document", entityId: v2, action: "create" },
    });
    expect(created.afterJson).toMatchObject({ ownerType: "hotel", previousVersionId: v1 });
  });

  it.each([
    ["a PDF fact sheet", "reportlab-5.0.0-plain.pdf", "fact_sheet", "application/pdf"],
    ["an xlsx food menu", "numbers-14.4.xlsx", "menu", XLSX],
    ["a JPEG food menu", "pillow-12.2.0.jpg", "menu", "image/jpeg"],
    ["an xlsx beverage menu", "numbers-14.4.xlsx", "beverage_menu", XLSX],
    ["a PNG floor plan", "pillow-12.2.0.png", "floor_plan", "image/png"],
    ["a PDF floor plan", "reportlab-5.0.0-plain.pdf", "floor_plan", "application/pdf"],
    ["another PDF", "reportlab-5.0.0-plain.pdf", "other", "application/pdf"],
  ])("files %s under its detected type", async (_name, file, type, mimeType) => {
    const uploaded = await upload(await fixture(file), { type }).expect(201);
    expect(uploaded.body.data).toMatchObject({ documentType: type, mimeType, versionNumber: 1 });
  });

  it("refuses a Word file with 415 and a workbook as a floor plan, filing nothing", async () => {
    const before = await suite.prisma.document.count({ where: { ownerId: suite.hotelId } });
    const word = await upload(await fixture("pages-14.4.docx"), { type: "fact_sheet" }).expect(415);
    expect(word.body.error).toMatchObject({
      code: "unsupported_media_type",
      message: UPLOAD_REFUSAL_MESSAGES.word_document,
    });
    await upload(await fixture("numbers-14.4.xlsx"), { type: "floor_plan" }).expect(415);
    expect(await suite.prisma.document.count({ where: { ownerId: suite.hotelId } })).toBe(before);
  });

  it("removes a document with every version, audited, and no longer lists or opens it", async () => {
    const pdf = await fixture("reportlab-5.0.0-plain.pdf");
    const v1 = (await upload(pdf, { type: "other", title: "Spa menu" }).expect(201)).body.data.id;
    const replaced = await upload(pdf, { type: "other", replaces: v1 }).expect(201);
    // A replacement sent without a title keeps the document's title, not the type's label.
    expect(replaced.body.data).toMatchObject({ title: "Spa menu", versionNumber: 2 });
    const v2 = replaced.body.data.id as string;

    await remove(v1, "sa").expect(409); // only the latest version names the document
    expect((await remove(v2, "sa").expect(200)).body.data).toEqual({ id: v2 });
    const rows = await suite.prisma.document.findMany({ where: { id: { in: [v1, v2] } } });
    expect(rows.every((row) => row.deletedAt !== null)).toBe(true);
    const audits = await suite.prisma.auditEvent.count({
      where: { entityType: "document", entityId: { in: [v1, v2] }, action: "delete" },
    });
    expect(audits).toBe(2);
    const items = (await list().expect(200)).body.data.items as Array<{ id: string }>;
    expect(items.some((item) => item.id === v2)).toBe(false);
    await mintLink(v2).expect(404);
    await remove(v2).expect(404);
  });

  it("holds a replacement to a live, latest document of the same hotel and type", async () => {
    const pdf = await fixture("reportlab-5.0.0-plain.pdf");
    const otherHotel = await newHotel("other");
    const menu = (await upload(pdf, { type: "menu" }).expect(201)).body.data.id as string;
    const foreign = (await upload(pdf, { type: "menu" }, "ht", otherHotel).expect(201)).body.data
      .id;

    await upload(pdf, { type: "floor_plan", replaces: menu }).expect(400);
    await upload(pdf, { type: "menu", replaces: foreign }).expect(404);
    await upload(pdf, { type: "menu", replaces: randomUUID() }).expect(404);
    await upload(pdf, { type: "menu", replaces: menu }).expect(201);
    await upload(pdf, { type: "menu", replaces: menu }).expect(409); // replaced already
  });

  it.each([
    ["no type", {}],
    ["a type the library does not file", { type: "contract" }],
    ["a title over 120 characters", { type: "other", title: "a".repeat(121) }],
    ["an unknown key", { type: "other", dryRun: "true" }],
  ])("refuses an upload with %s", async (_name, query) => {
    const res = await upload(Buffer.from("%PDF-1.7\n%%EOF\n"), query as Record<string, string>);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_failed");
  });

  it("lets Sales and project managers read and open documents, never change them", async () => {
    const pdf = await fixture("reportlab-5.0.0-plain.pdf");
    const id = (await upload(pdf, { type: "floor_plan" }).expect(201)).body.data.id as string;
    for (const role of ["sm", "pm"] as const) {
      const items = (await list(role).expect(200)).body.data.items as Array<{ id: string }>;
      expect(items.some((item) => item.id === id)).toBe(true);
      await mintLink(id, role).expect(201);
      await upload(pdf, { type: "floor_plan" }, role).expect(403);
      await upload(pdf, { type: "floor_plan", replaces: id }, role).expect(403);
      await remove(id, role).expect(403);
    }
  });

  it("answers every other role as if the hotel had no documents", async () => {
    const pdf = await fixture("reportlab-5.0.0-plain.pdf");
    const id = (await upload(pdf, { type: "other" }).expect(201)).body.data.id as string;
    for (const role of ["cd", "fa", "client"] as const) {
      await list(role).expect(404);
      await mintLink(id, role).expect(404);
      await upload(pdf, { type: "other" }, role).expect(404);
      await remove(id, role).expect(404);
    }
  });

  it("answers 404 for a hotel that does not exist or was removed", async () => {
    const pdf = await fixture("reportlab-5.0.0-plain.pdf");
    await list("ht", randomUUID()).expect(404);
    await upload(pdf, { type: "other" }, "ht", randomUUID()).expect(404);
    const removed = await newHotel("removed");
    await suite.prisma.hotel.update({ where: { id: removed }, data: { deletedAt: new Date() } });
    await list("ht", removed).expect(404);
    await upload(pdf, { type: "other" }, "ht", removed).expect(404);
  });
});
