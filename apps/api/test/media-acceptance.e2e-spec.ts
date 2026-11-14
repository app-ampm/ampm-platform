import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { NestExpressApplication } from "@nestjs/platform-express";
import sharp from "sharp";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { STORAGE_ADAPTER, type StorageAdapter } from "../src/storage/storage.types.js";
import { startApi } from "./start-api.js";

const PREFIX = "e2e-mediaac-";
const OCTET = "application/octet-stream";
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
// Sniffs as MP4 (the `ftyp` box sits at offset 4); stored as-is — a video is non-derivable (AC-24.2).
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.from("ftypisomvideo-bytes")]);
const realJpeg = (): Promise<Buffer> =>
  sharp({ create: { width: 16, height: 16, channels: 3, background: { r: 1, g: 2, b: 3 } } })
    .jpeg()
    .toBuffer();

/**
 * The AC-20 / AC-24 media acceptance suite (feature 9.3 slice 5). The upload/scan/derivative paths are
 * proven in media-upload.e2e; this file pins the remaining acceptance criteria: an expired signed link is
 * refused (AC-20), an over-size upload is refused (AC-20), a minted link stops resolving once its owning
 * record is removed (AC-20.5, access follows the record), and a video is delivered as a plain original with
 * no image derivative (AC-24.2, the VideoAdapter boundary — plain uploads now, a streaming provider later).
 */
describe("Media AC-20/AC-24 acceptance (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;
  let storage: StorageAdapter;
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

  async function newAsset(kind: "image" | "video", mimeType: string): Promise<string> {
    const created = await http()
      .post("/media")
      .set("Authorization", auth)
      .send({ ownerType: "hotel", ownerId: hotelId, kind, mimeType, sizeBytes: 4 })
      .expect(201);
    return created.body.data.id;
  }

  const uploadBytes = (id: string, bytes: Buffer) =>
    http()
      .post(`/media/${id}/upload`)
      .set("Authorization", auth)
      .set("Content-Type", OCTET)
      .send(bytes);

  const storageKeyOf = async (id: string): Promise<string> =>
    (await prisma.mediaAsset.findUniqueOrThrow({ where: { id }, select: { storageKey: true } }))
      .storageKey;

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), "ampm-mediaac-"));
    process.env["STORAGE_LOCAL_DIR"] = storageDir;
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    storage = app.get<StorageAdapter>(STORAGE_ADAPTER);
    await removeFixtures();
    auth = `Bearer ${await mint("local:admin")}`;
    const dest = await http()
      .post("/hotels-admin/destinations")
      .set("Authorization", auth)
      .send({ name: "E2E Media AC Destination", slug: `${PREFIX}dest` })
      .expect(201);
    const hotel = await http()
      .post("/hotels-admin/hotels")
      .set("Authorization", auth)
      .send({
        destinationId: dest.body.data.id,
        name: "E2E Media AC Hotel",
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

  it("refuses an expired signed link as absence (AC-20, expiring links)", async () => {
    const id = await newAsset("image", "image/jpeg");
    await uploadBytes(id, await realJpeg()).expect(200);
    const key = await storageKeyOf(id);

    // A freshly minted link serves; one whose expiry is already past is a 404 — the signature is intact,
    // the clock is not (the blob endpoint checks `exp > now`, not just the HMAC).
    await http().get(storage.signDownloadUrl(key, 900).url).expect(200);
    await http().get(storage.signDownloadUrl(key, -10).url).expect(404);
  });

  it("refuses an upload over the size ceiling (AC-20, size refusal)", async () => {
    const id = await newAsset("image", "image/jpeg");
    // 25.5 MiB: within the 26 MiB body-parser limit but over the 25 MiB app ceiling, so the service
    // rejects it (400) rather than the parser (413).
    const tooBig = Buffer.concat([JPEG_HEADER, Buffer.alloc(Math.floor(25.5 * 1024 * 1024))]);
    const res = await uploadBytes(id, tooBig).expect(400);
    // Pin the 400 to the SIZE ceiling, not the decode-reject path. The payload sniffs as JPEG but cannot
    // decode, and both failures are validation_failed/400 — so the message is the only distinguisher.
    // Without this assertion, removing the size guard would still pass here (the bytes would 400 at the
    // sharp decode instead), leaving the AC-20 ceiling untested.
    expect(res.body.error.message).toMatch(/exceeds the \d+ MB limit/i);
  });

  it("stops serving a minted link once the owning asset is removed (AC-20.5, access follows the record)", async () => {
    const id = await newAsset("image", "image/jpeg");
    await uploadBytes(id, await realJpeg()).expect(200);
    const minted = await http()
      .get(`/media/${id}/download-url`)
      .set("Authorization", auth)
      .expect(200);
    const url = minted.body.data.url as string;
    await http().get(url).expect(200); // serves while the asset is live

    await http().delete(`/media/${id}`).set("Authorization", auth).expect(200);

    // The same still-unexpired link no longer resolves — access followed the now soft-deleted record.
    await http().get(url).expect(404);
  });

  it("delivers a video as a plain original with no derivative (AC-24.2, controlled video)", async () => {
    const id = await newAsset("video", "video/mp4");
    const uploaded = await uploadBytes(id, MP4).expect(200);
    expect(uploaded.body.data).toMatchObject({ kind: "video", scanStatus: "clean" });

    // The original serves through a signed link; there is no web/thumbnail derivative to mint for a video.
    const original = await http()
      .get(`/media/${id}/download-url?variant=original`)
      .set("Authorization", auth)
      .expect(200);
    const served = await http()
      .get(original.body.data.url as string)
      .expect(200);
    expect(served.headers["content-type"]).toContain("video/mp4");

    await http()
      .get(`/media/${id}/download-url?variant=web`)
      .set("Authorization", auth)
      .expect(404);
    await http()
      .get(`/media/${id}/download-url?variant=thumbnail`)
      .set("Authorization", auth)
      .expect(404);
  });

  it("releases the upload claim once an upload settles (slice 5c)", async () => {
    const id = await newAsset("image", "image/jpeg");
    await uploadBytes(id, await realJpeg()).expect(200);
    const row = await prisma.mediaAsset.findUniqueOrThrow({
      where: { id },
      select: { uploadStartedAt: true },
    });
    expect(row.uploadStartedAt).toBeNull();
  });

  it("refuses a concurrent upload while one holds the claim (409), leaves the live asset untouched, and steals a stale claim (slice 5c)", async () => {
    const id = await newAsset("image", "image/jpeg");
    await uploadBytes(id, await realJpeg()).expect(200); // now clean, with derivatives, claim released

    // Simulate a second upload in flight by holding the claim; a concurrent upload is refused (409)...
    await prisma.mediaAsset.update({ where: { id }, data: { uploadStartedAt: new Date() } });
    await uploadBytes(id, await realJpeg()).expect(409);

    // ...and the refusal left the committed rendition set intact (fail-closed: the loser never demotes a
    // live asset — the demote is coupled to the winning CAS, so a 409 touches nothing).
    const after = await http().get(`/media/${id}`).set("Authorization", auth).expect(200);
    expect(after.body.data.scanStatus).toBe("clean");
    await http()
      .get(`/media/${id}/download-url?variant=web`)
      .set("Authorization", auth)
      .expect(200);

    // A claim older than the stale-steal TTL is reclaimed, so a stuck (e.g. crashed) upload self-heals.
    await prisma.mediaAsset.update({
      where: { id },
      data: { uploadStartedAt: new Date(Date.now() - 10 * 60 * 1000) },
    });
    await uploadBytes(id, await realJpeg()).expect(200);
  });
});
