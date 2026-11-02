import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const PREFIX = "e2e-mediaup-";
const OCTET = "application/octet-stream";
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const jpeg = (body: string): Buffer => Buffer.concat([JPEG_HEADER, Buffer.from(body)]);

/**
 * Media upload → scan → signed download end to end (feature 9.3b; AC-20.2/.3/.5). A Super Admin uploads a
 * file: its type is decided by content (a non-image is refused), its bytes are scanned fail-closed (the
 * EICAR test file is quarantined, never downloadable), and a clean file is served only through a
 * signature-verified link (a tampered link is a 404).
 */
describe("Media upload and signed download (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;
  let auth: string;
  let hotelId: string;
  let storageDir: string;

  const http = () => request(app.getHttpServer());

  async function removeFixtures(): Promise<void> {
    const hotels = await prisma.hotel.findMany({
      where: { slug: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = hotels.map((h) => h.id);
    if (ids.length > 0) {
      await prisma.mediaAsset.deleteMany({ where: { ownerType: "hotel", ownerId: { in: ids } } });
      await prisma.hotel.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  async function newImageAsset(): Promise<string> {
    const created = await http()
      .post("/media")
      .set("Authorization", auth)
      .send({
        ownerType: "hotel",
        ownerId: hotelId,
        kind: "image",
        mimeType: "image/jpeg",
        sizeBytes: 4,
      })
      .expect(201);
    return created.body.data.id;
  }

  const uploadBytes = (id: string, bytes: Buffer) =>
    http()
      .post(`/media/${id}/upload`)
      .set("Authorization", auth)
      .set("Content-Type", OCTET)
      .send(bytes);

  beforeAll(async () => {
    // Store uploaded blobs in a throwaway temp dir, never under the repo — set before the app reads env.
    storageDir = await mkdtemp(join(tmpdir(), "ampm-mediaup-"));
    process.env["STORAGE_LOCAL_DIR"] = storageDir;
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    auth = `Bearer ${await mint("local:admin")}`;
    const dest = await http()
      .post("/hotels-admin/destinations")
      .set("Authorization", auth)
      .send({ name: "E2E Media Upload Destination", slug: `${PREFIX}dest` })
      .expect(201);
    const hotel = await http()
      .post("/hotels-admin/hotels")
      .set("Authorization", auth)
      .send({
        destinationId: dest.body.data.id,
        name: "E2E Media Upload Hotel",
        slug: `${PREFIX}hotel`,
      })
      .expect(201);
    hotelId = hotel.body.data.id;
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
  });

  it("stores a clean image by content type and serves it only through a signed link", async () => {
    const id = await newImageAsset();
    const bytes = jpeg("a synthetic clean jpeg body");
    const uploaded = await uploadBytes(id, bytes).expect(200);
    expect(uploaded.body.data).toMatchObject({
      mimeType: "image/jpeg",
      sizeBytes: bytes.length, // the content-verified size, not the declared placeholder
      scanStatus: "clean",
    });

    const minted = await http()
      .get(`/media/${id}/download-url`)
      .set("Authorization", auth)
      .expect(200);
    const url = minted.body.data.url as string;
    expect(url).toContain("/media/blob?");

    const download = await http().get(url).expect(200); // public, signature-verified — no auth header
    expect(download.headers["content-type"]).toContain("image/jpeg");

    // A tampered signature is rejected as absence (AC-20).
    await http()
      .get(url.replace(/sig=.*/, "sig=deadbeef"))
      .expect(404);
  });

  it("refuses a non-image by content, not by its declared type (AC-20.2)", async () => {
    const id = await newImageAsset();
    const exe = Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.from("a renamed executable")]); // "MZ"
    await uploadBytes(id, exe).expect(400);
  });

  it("quarantines an infected file fail-closed — never downloadable (AC-20.3)", async () => {
    const id = await newImageAsset();
    const infected = jpeg("EICAR-STANDARD-ANTIVIRUS-TEST-FILE");
    const uploaded = await uploadBytes(id, infected).expect(200);
    expect(uploaded.body.data.scanStatus).toBe("rejected");

    // A rejected asset yields no download link.
    await http().get(`/media/${id}/download-url`).set("Authorization", auth).expect(409);
  });

  it("re-uploading an infected file revokes an already-minted link, fail-closed (AC-20.3)", async () => {
    const id = await newImageAsset();
    await uploadBytes(id, jpeg("a clean jpeg body")).expect(200);
    const minted = await http()
      .get(`/media/${id}/download-url`)
      .set("Authorization", auth)
      .expect(200);
    const url = minted.body.data.url as string;
    await http().get(url).expect(200); // works while clean

    // Re-upload EICAR over the same asset: it is demoted, scanned rejected and its bytes removed.
    const reuploaded = await uploadBytes(id, jpeg("EICAR-STANDARD-ANTIVIRUS-TEST-FILE")).expect(
      200,
    );
    expect(reuploaded.body.data.scanStatus).toBe("rejected");

    // The link minted while the asset was clean no longer serves anything — the blob re-checks scan status.
    await http().get(url).expect(404);
    await http().get(`/media/${id}/download-url`).set("Authorization", auth).expect(409);
  });

  it("refuses bytes whose content kind differs from the declared kind (AC-20.2)", async () => {
    const id = await newImageAsset(); // declared image
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.from("ftypisom")]); // video magic at offset 4
    await uploadBytes(id, mp4).expect(400);
  });
});
