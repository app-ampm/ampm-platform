import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CONTENT_KINDS, UPLOAD_REFUSAL_MESSAGES } from "@ampm/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const PREFIX = "e2e-hoteldocs-";
const OCTET = "application/octet-stream";
const PPTX = CONTENT_KINDS.pptx.mimeType;
const XLSX = CONTENT_KINDS.xlsx.mimeType;
const fixture = (name: string) => readFile(join(import.meta.dirname, "fixtures", "content", name));

type Role = "sa" | "ht" | "sm" | "pm" | "cd" | "fa" | "client";
const SUBJECTS: Record<Role, string> = {
  sa: "local:admin",
  ht: "local:ht",
  sm: "local:sm",
  pm: "local:pm",
  cd: "local:cd",
  fa: "local:fa",
  client: "local:client",
};

/**
 * A hotel's documents library end to end (D-187 §6): the Super Admin and the Hotel team file, replace,
 * open and remove a hotel's fact sheets, menus and floor plans; Sales and project managers read and
 * open them; everyone else is answered as if there were none. Every file is checked by content against
 * its type's rules, versioned on replacement, opened only through a 15-minute link, and audited.
 */
describe("Hotel documents library (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let storageDir: string;
  let destinationId: string;
  let hotelId: string;
  const bearer = {} as Record<Role, string>;

  const http = () => request(app.getHttpServer());
  const base = (hotel = hotelId) => `/hotels-admin/hotels/${hotel}/documents`;

  const upload = (bytes: Buffer, query: Record<string, string>, as: Role = "ht", hotel = hotelId) =>
    http()
      .post(base(hotel))
      .query(query)
      .set("Authorization", bearer[as])
      .set("Content-Type", OCTET)
      .send(bytes);
  const list = (as: Role = "ht", hotel = hotelId) =>
    http().get(base(hotel)).set("Authorization", bearer[as]);
  const mintLink = (documentId: string, as: Role = "ht", hotel = hotelId) =>
    http()
      .post(`${base(hotel)}/${documentId}/link`)
      .set("Authorization", bearer[as]);
  const remove = (documentId: string, as: Role = "ht", hotel = hotelId) =>
    http()
      .delete(`${base(hotel)}/${documentId}`)
      .set("Authorization", bearer[as]);
  /**
   * An upload whose body the reader refuses with 415, so the answer tells which check ran first. Sent
   * by the Super Admin: the Hotel team's uploads in this file come close to the 30 a minute the upload
   * limit allows one member of staff (route-limits.ts UPLOADS).
   */
  const notAFile = (query: Record<string, string>, hotel = hotelId) =>
    http()
      .post(base(hotel))
      .query(query)
      .set("Authorization", bearer.sa)
      .set("Content-Type", "text/plain")
      .send("not a file");

  async function newHotel(suffix: string): Promise<string> {
    const created = await http()
      .post("/hotels-admin/hotels")
      .set("Authorization", bearer.ht)
      .send({ destinationId, name: `E2E Documents Hotel ${suffix}`, slug: `${PREFIX}${suffix}` })
      .expect(201);
    return created.body.data.id as string;
  }

  async function removeFixtures(): Promise<void> {
    const hotels = await prisma.hotel.findMany({
      where: { slug: { startsWith: PREFIX } },
      select: { id: true },
    });
    const where = { ownerType: "hotel", ownerId: { in: hotels.map((hotel) => hotel.id) } };
    const documents = await prisma.document.findMany({ where, select: { id: true } });
    const ids = documents.map((document) => document.id);
    const links = await prisma.documentAccessLink.findMany({
      where: { documentId: { in: ids } },
      select: { id: true },
    });
    await prisma.auditEvent.deleteMany({
      where: {
        OR: [
          { entityType: "document", entityId: { in: ids } },
          { entityType: "document_access_link", entityId: { in: links.map((link) => link.id) } },
        ],
      },
    });
    await prisma.documentAccessLink.deleteMany({ where: { documentId: { in: ids } } });
    await prisma.document.deleteMany({ where });
    await prisma.hotel.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), "ampm-hoteldocs-"));
    process.env["STORAGE_LOCAL_DIR"] = storageDir;
    let mint: (subject: string) => Promise<string>;
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    for (const [role, subject] of Object.entries(SUBJECTS)) {
      bearer[role as Role] = `Bearer ${await mint(subject)}`;
    }
    const destination = await http()
      .post("/hotels-admin/destinations")
      .set("Authorization", bearer.ht)
      .send({ name: "E2E Documents Destination", slug: `${PREFIX}dest` })
      .expect(201);
    destinationId = destination.body.data.id as string;
    hotelId = await newHotel("main");
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
  });

  it("files a pptx fact sheet, replaces it as version 2, lists version 1 under it, and serves it", async () => {
    const pptx = await fixture("keynote-14.4.pptx");
    const first = await upload(pptx, { type: "fact_sheet" }).expect(201);
    expect(first.body.data).toMatchObject({
      hotelId,
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

    const created = await prisma.auditEvent.findFirstOrThrow({
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
    const before = await prisma.document.count({ where: { ownerId: hotelId } });
    const word = await upload(await fixture("pages-14.4.docx"), { type: "fact_sheet" }).expect(415);
    expect(word.body.error).toMatchObject({
      code: "unsupported_media_type",
      message: UPLOAD_REFUSAL_MESSAGES.word_document,
    });
    await upload(await fixture("numbers-14.4.xlsx"), { type: "floor_plan" }).expect(415);
    expect(await prisma.document.count({ where: { ownerId: hotelId } })).toBe(before);
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
    const rows = await prisma.document.findMany({ where: { id: { in: [v1, v2] } } });
    expect(rows.every((row) => row.deletedAt !== null)).toBe(true);
    const audits = await prisma.auditEvent.count({
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

  it("answers a refused upload before reading its body (D-187 §1)", async () => {
    await notAFile({ type: "other" }, randomUUID()).expect(404);
    await notAFile({ type: "other", replaces: randomUUID() }).expect(404);
    // An upload every check lets through reaches the reader, which refuses the body.
    await notAFile({ type: "other" }).expect(415);
  });

  it("answers 404 for a hotel that does not exist or was removed", async () => {
    const pdf = await fixture("reportlab-5.0.0-plain.pdf");
    await list("ht", randomUUID()).expect(404);
    await upload(pdf, { type: "other" }, "ht", randomUUID()).expect(404);
    const removed = await newHotel("removed");
    await prisma.hotel.update({ where: { id: removed }, data: { deletedAt: new Date() } });
    await list("ht", removed).expect(404);
    await upload(pdf, { type: "other" }, "ht", removed).expect(404);
  });

  it("refuses a 101st live document with 409, and still takes a replacement", async () => {
    const full = await newHotel("full");
    const uploadedBy = (
      await prisma.user.findFirstOrThrow({ where: { email: "hotel@example.com" } })
    ).id;
    await prisma.document.createMany({
      data: Array.from({ length: 100 }, (_unused, index) => ({
        ownerType: "hotel",
        ownerId: full,
        title: `Seeded document ${index + 1}`,
        documentType: "other" as const,
        storageKey: `documents/hotel/${full}/seeded-${index + 1}`,
        mimeType: "application/pdf",
        sizeBytes: 15,
        uploadedBy,
      })),
    });
    const pdf = await fixture("reportlab-5.0.0-plain.pdf");
    const refused = await upload(pdf, { type: "other" }, "ht", full).expect(409);
    expect(refused.body.error.code).toBe("conflict");
    // Counted before the body is read: a body the reader would refuse gets the same 409.
    await notAFile({ type: "other" }, full).expect(409);
    const seeded = await prisma.document.findFirstOrThrow({ where: { ownerId: full } });
    await upload(pdf, { type: "other", replaces: seeded.id }, "ht", full).expect(201);
    expect((await list("ht", full).expect(200)).body.data.items).toHaveLength(100);
  });
});
