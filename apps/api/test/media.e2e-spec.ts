import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const PREFIX = "e2e-media-";
const CONSENT_DOC = "0192f1a0-0000-7000-8000-00000000c011"; // a plain Uuid; documents (Module N) is not built

/**
 * Gallery media management end to end (Module N, feature 9.3). A Super Admin registers a media asset,
 * lists/gets/updates/removes it, and the GP-20 gate refuses client/demo/public visibility until the rights
 * are owned/licensed/consent_obtained (AC-24.3). No response ever carries a SECRET object key.
 */
describe("Media management (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;
  let auth: string;
  let hotelId: string;

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

  const image = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    ownerType: "hotel",
    ownerId: hotelId,
    kind: "image",
    mimeType: "image/jpeg",
    sizeBytes: 1_200_000,
    ...over,
  });

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    auth = `Bearer ${await mint("local:admin")}`;
    const dest = await http()
      .post("/hotels-admin/destinations")
      .set("Authorization", auth)
      .send({ name: "E2E Media Destination", slug: `${PREFIX}dest` })
      .expect(201);
    const hotel = await http()
      .post("/hotels-admin/hotels")
      .set("Authorization", auth)
      .send({ destinationId: dest.body.data.id, name: "E2E Media Hotel", slug: `${PREFIX}hotel` })
      .expect(201);
    hotelId = hotel.body.data.id;
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("registers an internal media asset without ever exposing a SECRET object key", async () => {
    const created = await http()
      .post("/media")
      .set("Authorization", auth)
      .send(image())
      .expect(201);
    const asset = created.body.data;
    expect(asset).toMatchObject({
      ownerType: "hotel",
      ownerId: hotelId,
      kind: "image",
      visibility: "internal",
      rightsStatus: "consent_required",
      scanStatus: "pending", // not downloadable until a scan passes (slice 3b)
    });
    expect(asset).not.toHaveProperty("storageKey");
    expect(asset).not.toHaveProperty("thumbnailKey");
    expect(asset).not.toHaveProperty("webKey");
    expect(JSON.stringify(asset).toLowerCase()).not.toContain("storage");

    const list = await http()
      .get(`/media?ownerType=hotel&ownerId=${hotelId}`)
      .set("Authorization", auth)
      .expect(200);
    expect((list.body.data.items as { id: string }[]).map((m) => m.id)).toContain(asset.id);

    const got = await http().get(`/media/${asset.id}`).set("Authorization", auth).expect(200);
    expect(got.body.data.id).toBe(asset.id);
    // The SECRET object keys must be absent from the list and detail responses too, not only the create echo.
    for (const body of [list.body.data, got.body.data]) {
      expect(JSON.stringify(body)).not.toMatch(/storageKey|thumbnailKey|webKey/);
    }
  });

  it("refuses client/demo/public visibility until the rights allow it (GP-20, AC-24.3)", async () => {
    const created = await http()
      .post("/media")
      .set("Authorization", auth)
      .send(image())
      .expect(201);
    const id = created.body.data.id;

    // consent_required cannot be published.
    await http()
      .patch(`/media/${id}`)
      .set("Authorization", auth)
      .send({ visibility: "client" })
      .expect(409);

    // Record consent, then publishing succeeds.
    await http()
      .patch(`/media/${id}`)
      .set("Authorization", auth)
      .send({ rightsStatus: "consent_obtained", consentDocumentId: CONSENT_DOC })
      .expect(200);
    const published = await http()
      .patch(`/media/${id}`)
      .set("Authorization", auth)
      .send({ visibility: "client" })
      .expect(200);
    expect(published.body.data).toMatchObject({
      visibility: "client",
      rightsStatus: "consent_obtained",
    });

    // A rights downgrade while already client-visible is refused — the resulting state fails GP-20.
    await http()
      .patch(`/media/${id}`)
      .set("Authorization", auth)
      .send({ rightsStatus: "consent_required" })
      .expect(409);
  });

  it("refuses publishing at creation without rights, and removes idempotently", async () => {
    await http()
      .post("/media")
      .set("Authorization", auth)
      .send(image({ visibility: "public" }))
      .expect(409);

    const created = await http()
      .post("/media")
      .set("Authorization", auth)
      .send(image())
      .expect(201);
    const id = created.body.data.id;
    await http().delete(`/media/${id}`).set("Authorization", auth).expect(200);
    await http().get(`/media/${id}`).set("Authorization", auth).expect(404);
  });
});
