import { createHash } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { NestExpressApplication } from "@nestjs/platform-express";
import sharp from "sharp";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const PREFIX = "e2e-refconsent-";
const OCTET = "application/octet-stream";
const PDF = Buffer.from("%PDF-1.4\n% E2E couple's consent\n%%EOF\n");
const PDF_V2 = Buffer.from("%PDF-1.7\n% E2E couple's consent, re-signed\n%%EOF\n");

/**
 * A previous-wedding reference's consent end to end (GP-20, AC-24.3): the couple's consent is uploaded as
 * a Module N `consent` document filed on the reference (typed by content, scanned, versioned), which is
 * what lets the reference be shown to clients; uploading never publishes by itself. The file is reached
 * only through a minted link, by a role that may update references (SM and PM read references but never
 * open the couple's consent), and a reference outside the hotel in the path answers 404 (denial equals
 * absence).
 */
describe("Hotel wedding reference consent (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let storageDir: string;
  let hotelId: string;
  let otherHotelId: string;
  const bearer: Record<"ht" | "sm", string> = { ht: "", sm: "" };

  const http = () => request(app.getHttpServer());
  const base = (hotel = hotelId) => `/hotels-admin/hotels/${hotel}/wedding-references`;

  async function removeFixtures(): Promise<void> {
    const hotels = await prisma.hotel.findMany({
      where: { slug: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = hotels.map((h) => h.id);
    const refs = await prisma.hotelWeddingReference.findMany({
      where: { hotelId: { in: ids } },
      select: { id: true },
    });
    const refIds = refs.map((r) => r.id);
    const documentWhere = { ownerType: "hotel_wedding_reference", ownerId: { in: refIds } };
    await prisma.documentAccessLink.deleteMany({ where: { document: documentWhere } });
    await prisma.document.deleteMany({ where: documentWhere });
    await prisma.auditEvent.deleteMany({
      where: { entityType: "hotel_wedding_reference", entityId: { in: refIds } },
    });
    await prisma.hotelWeddingReference.deleteMany({ where: { hotelId: { in: ids } } });
    await prisma.hotel.deleteMany({ where: { id: { in: ids } } });
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  async function newReference(): Promise<string> {
    const created = await http()
      .post(base())
      .set("Authorization", bearer.ht)
      .send({ eventYear: 2025, guestCount: 220 })
      .expect(201);
    return created.body.data.id as string;
  }

  const attach = (refId: string, bytes: Buffer, as: keyof typeof bearer = "ht", hotel = hotelId) =>
    http()
      .post(`${base(hotel)}/${refId}/consent`)
      .set("Authorization", bearer[as])
      .set("content-type", OCTET)
      .send(bytes);

  const mintLink = (refId: string, as: keyof typeof bearer = "ht", hotel = hotelId) =>
    http()
      .post(`${base(hotel)}/${refId}/consent/link`)
      .set("Authorization", bearer[as]);

  async function newHotel(suffix: string, destinationId: string): Promise<string> {
    const hotel = await http()
      .post("/hotels-admin/hotels")
      .set("Authorization", bearer.ht)
      .send({ destinationId, name: `E2E Consent Hotel ${suffix}`, slug: `${PREFIX}${suffix}` })
      .expect(201);
    return hotel.body.data.id as string;
  }

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), "ampm-refconsent-"));
    process.env["STORAGE_LOCAL_DIR"] = storageDir;
    let mint: (subject: string) => Promise<string>;
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    for (const role of ["ht", "sm"] as const)
      bearer[role] = `Bearer ${await mint(`local:${role}`)}`;
    const dest = await http()
      .post("/hotels-admin/destinations")
      .set("Authorization", bearer.ht)
      .send({ name: "E2E Consent Destination", slug: `${PREFIX}dest` })
      .expect(201);
    hotelId = await newHotel("one", dest.body.data.id as string);
    otherHotelId = await newHotel("two", dest.body.data.id as string);
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
  });

  it("files the consent as a consent document on the reference, without publishing it", async () => {
    const refId = await newReference();
    const attached = await attach(refId, PDF).expect(200);
    expect(attached.body.data).toMatchObject({ id: refId, clientVisible: false });
    const documentId = attached.body.data.consentDocumentId as string;
    const document = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });
    expect(document).toMatchObject({
      ownerType: "hotel_wedding_reference",
      ownerId: refId,
      documentType: "consent",
      mimeType: "application/pdf",
      versionNumber: 1,
    });
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { entityType: "hotel_wedding_reference", entityId: refId, action: "update" },
      orderBy: { occurredAt: "desc" },
    });
    expect(audit.afterJson).toMatchObject({ consentDocumentId: documentId });
  });

  it("files a replacement as the next version of the consent", async () => {
    const refId = await newReference();
    const first = (await attach(refId, PDF).expect(200)).body.data.consentDocumentId as string;
    const second = (await attach(refId, PDF_V2).expect(200)).body.data.consentDocumentId as string;
    expect(second).not.toBe(first);
    const replacement = await prisma.document.findUniqueOrThrow({ where: { id: second } });
    expect(replacement).toMatchObject({ versionNumber: 2, previousVersionId: first });
  });

  it("refuses a file by content, refuses an infected one, and keeps nothing of either", async () => {
    const refId = await newReference();
    const exe = Buffer.concat([Buffer.from("MZ"), Buffer.from("a renamed executable.pdf")]);
    await attach(refId, exe).expect(400);
    const eicar = Buffer.concat([PDF, Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE")]);
    const infected = await attach(refId, eicar);
    expect(infected.status).toBe(400);
    expect(infected.body.error.message).toMatch(/antivirus/i);

    expect(await prisma.document.count({ where: { ownerId: refId } })).toBe(0);
    const stored = await readdir(storageDir, { recursive: true }).catch(() => []);
    expect(stored.filter((path) => path.includes(refId))).toEqual([]);
    const row = await prisma.hotelWeddingReference.findUniqueOrThrow({ where: { id: refId } });
    expect(row.consentDocumentId).toBeNull();
  });

  it("takes consent only from a role that may update references", async () => {
    const refId = await newReference();
    await attach(refId, PDF, "sm").expect(403); // SM reads references, never writes them
    await attach(refId, PDF, "ht").expect(200);
  });

  it("serves the consent only through a minted link, to a role that may update references", async () => {
    const refId = await newReference();
    await mintLink(refId).expect(404); // nothing attached yet
    await attach(refId, PDF).expect(200);
    await mintLink(refId, "sm").expect(403); // SM reads references, never the couple's consent
    const minted = await mintLink(refId).expect(201);
    const url = minted.body.data.url as string;
    expect(url).toMatch(/^\/documents\/links\/[^/]+\/[^/]+$/);
    const download = await http().get(url).responseType("blob").expect(200); // the link is the capability
    expect(download.headers["content-type"]).toContain("application/pdf");
    expect(download.headers["content-disposition"]).toBe('inline; filename="consent.pdf"');
    expect(Buffer.from(download.body).equals(PDF)).toBe(true);
  });

  it("keeps a photo of the consent upright and whole, without its metadata (D-187)", async () => {
    const refId = await newReference();
    const photo = await sharp({
      create: { width: 2400, height: 1600, channels: 3, background: { r: 240, g: 236, b: 226 } },
    })
      .withMetadata({ orientation: 6 }) // taken on its side, as phones store it
      .withExif({ IFD0: { Make: "TestCam", Model: "ConsentPhone" } })
      .jpeg()
      .toBuffer();
    expect((await sharp(photo).metadata()).exif).toBeInstanceOf(Buffer); // there is EXIF to strip
    await attach(refId, photo).expect(200);

    const url = (await mintLink(refId).expect(201)).body.data.url as string;
    const download = await http().get(url).responseType("blob").expect(200);
    expect(download.headers["content-type"]).toContain("image/jpeg");
    const served = Buffer.from(download.body);
    const meta = await sharp(served).metadata();
    expect(meta.format).toBe("jpeg");
    expect([meta.width, meta.height]).toEqual([1600, 2400]); // upright, never downscaled
    expect(meta.exif).toBeUndefined();
    expect(served.includes(Buffer.from("TestCam"))).toBe(false);
    // The record describes the bytes kept, not the ones uploaded.
    const row = await prisma.document.findFirstOrThrow({ where: { ownerId: refId } });
    expect(row.sizeBytes).toBe(served.length);
    expect(row.checksum).toBe(createHash("sha256").update(served).digest("hex"));
  });

  it("answers 404 for a reference outside the hotel in the path (denial equals absence)", async () => {
    const refId = await newReference();
    await attach(refId, PDF, "ht", otherHotelId).expect(404);
    await attach(refId, PDF).expect(200);
    await mintLink(refId, "ht", otherHotelId).expect(404);
  });

  it("never reads a binary body on any other reference route: it carries no record (D-187)", async () => {
    const refId = await newReference();
    const before = await prisma.hotelWeddingReference.findUniqueOrThrow({ where: { id: refId } });
    const res = await http()
      .patch(`${base()}/${refId}`)
      .set("Authorization", bearer.ht)
      .set("content-type", OCTET)
      .send(PDF)
      .expect(400);
    expect(res.body.error.code).toBe("validation_failed");
    const after = await prisma.hotelWeddingReference.findUniqueOrThrow({ where: { id: refId } });
    expect(after).toEqual(before);
  });
});
