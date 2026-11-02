import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { NestExpressApplication } from "@nestjs/platform-express";
import sharp from "sharp";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const PREFIX = "e2e-mediaup-";
const OCTET = "application/octet-stream";
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
// A byte string that sniffs as JPEG but is NOT decodable — for the scan/detection paths that never derive.
const jpeg = (body: string): Buffer => Buffer.concat([JPEG_HEADER, Buffer.from(body)]);
// A real, decodable JPEG — for the clean path, where the upload now generates derivatives (feature 9.3c).
const realJpeg = (): Promise<Buffer> =>
  sharp({ create: { width: 16, height: 16, channels: 3, background: { r: 1, g: 2, b: 3 } } })
    .jpeg()
    .toBuffer();

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
    const bytes = await realJpeg();
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
    await uploadBytes(id, await realJpeg()).expect(200);
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

  it("derives web + thumbnail, keeps the original, strips metadata, serves each (AC-24.1, AC-20.4)", async () => {
    const id = await newImageAsset();
    // A real JPEG carrying device metadata (EXIF), large enough that both derivatives downscale.
    const withExif = await sharp({
      create: { width: 2000, height: 1500, channels: 3, background: { r: 10, g: 120, b: 200 } },
    })
      .withExif({ IFD0: { Make: "TestCam", Model: "ExifStrip" } })
      .jpeg()
      .toBuffer();
    const uploaded = await uploadBytes(id, withExif).expect(200);
    expect(uploaded.body.data.scanStatus).toBe("clean");

    // The derivative keys are recorded server-side (never on the wire) and their objects exist on disk.
    const row = await prisma.mediaAsset.findUniqueOrThrow({
      where: { id },
      select: { storageKey: true, webKey: true, thumbnailKey: true },
    });
    if (!row.webKey || !row.thumbnailKey) throw new Error("expected derivatives to be generated");

    const read = (key: string): Promise<Buffer> => readFile(join(storageDir, key));
    // AC-24.1: the original is kept byte-for-byte — not downscaled or re-encoded in place.
    expect((await read(row.storageKey)).equals(withExif)).toBe(true);
    const webMeta = await sharp(await read(row.webKey)).metadata();
    const thumbMeta = await sharp(await read(row.thumbnailKey)).metadata();

    // Exact dims pin each ceiling (2000x1500 scales to web 1600x1200, thumb 400x300), so a swapped or
    // under-sized web derivative cannot pass a loose "<= 1600" bound.
    expect([webMeta.width, webMeta.height]).toEqual([1600, 1200]);
    expect([thumbMeta.width, thumbMeta.height]).toEqual([400, 300]);
    // AC-20.4: neither stored derivative carries the source's device/location metadata.
    expect(webMeta.exif).toBeUndefined();
    expect(thumbMeta.exif).toBeUndefined();

    // Every rendition is servable through a signed, expiring link (CP-05 serves the derivative).
    for (const variant of ["original", "web", "thumbnail"] as const) {
      const minted = await http()
        .get(`/media/${id}/download-url?variant=${variant}`)
        .set("Authorization", auth)
        .expect(200);
      const served = await http()
        .get(minted.body.data.url as string)
        .expect(200);
      expect(served.headers["content-type"]).toContain("image/jpeg");
    }
  });

  it("rejects a clean-but-undecodable image on first upload, leaving the asset pending (AC-20.2)", async () => {
    const id = await newImageAsset();
    // Sniffs as JPEG and carries no EICAR (the scan passes), but sharp cannot decode it.
    await uploadBytes(id, jpeg("sniffs as a jpeg but is not decodable")).expect(400);

    const after = await http().get(`/media/${id}`).set("Authorization", auth).expect(200);
    expect(after.body.data.scanStatus).toBe("pending"); // nothing stored, not downloadable
    await http().get(`/media/${id}/download-url`).set("Authorization", auth).expect(409);
    // The failed upload left no bytes behind — a subsequent valid upload still succeeds.
    await uploadBytes(id, await realJpeg()).expect(200);
  });

  it("leaves an existing clean image untouched when a re-upload is undecodable (non-destructive 400)", async () => {
    const id = await newImageAsset();
    await uploadBytes(id, await realJpeg()).expect(200);
    const minted = await http()
      .get(`/media/${id}/download-url`)
      .set("Authorization", auth)
      .expect(200);
    const url = minted.body.data.url as string;

    // A corrupt re-upload is rejected BEFORE any stored state changes, so the published image survives.
    await uploadBytes(id, jpeg("a corrupt replacement that will not decode")).expect(400);

    const after = await http().get(`/media/${id}`).set("Authorization", auth).expect(200);
    expect(after.body.data.scanStatus).toBe("clean"); // still clean, still published
    await http().get(url).expect(200); // the link minted before the failed re-upload still serves
  });
});
