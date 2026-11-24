import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const PREFIX = "e2e-sub-";
const MISSING = "0192f1a0-0000-7000-8000-0000000000ff"; // a well-formed uuid that is not a hotel

/**
 * A hotel's room categories, venues and contacts end to end (Module C, feature 9.1). A Super Admin adds
 * each child, sees it on the staff detail, edits and removes it, and a write aimed at the wrong, a
 * missing or a deleted hotel is a 404 (denial equals absence).
 */
describe("Hotel sub-resources (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;
  let destinationId: string;
  let hotelId: string;

  async function removeFixtures(): Promise<void> {
    const hotels = await prisma.hotel.findMany({
      where: { slug: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = hotels.map((hotel) => hotel.id);
    if (ids.length > 0) {
      await prisma.hotelRoomCategory.deleteMany({ where: { hotelId: { in: ids } } });
      await prisma.hotelVenue.deleteMany({ where: { hotelId: { in: ids } } });
      await prisma.hotelContact.deleteMany({ where: { hotelId: { in: ids } } });
      await prisma.hotel.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  const http = () => request(app.getHttpServer());
  let auth: string;

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    auth = `Bearer ${await mint("local:admin")}`;
    const dest = await http()
      .post("/hotels-admin/destinations")
      .set("Authorization", auth)
      .send({ name: "E2E Sub Destination", slug: `${PREFIX}dest` })
      .expect(201);
    destinationId = dest.body.data.id;
    const hotel = await http()
      .post("/hotels-admin/hotels")
      .set("Authorization", auth)
      .send({ destinationId, name: "E2E Sub Hotel", slug: `${PREFIX}hotel` })
      .expect(201);
    hotelId = hotel.body.data.id;
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("adds a room, a venue and a contact, and they appear on the staff detail", async () => {
    await http()
      .post(`/hotels-admin/hotels/${hotelId}/rooms`)
      .set("Authorization", auth)
      .send({ name: "Deluxe", roomCount: 40, facilities: ["wifi", "pool"] })
      .expect(201);
    await http()
      .post(`/hotels-admin/hotels/${hotelId}/venues`)
      .set("Authorization", auth)
      .send({
        name: "Grand Ballroom",
        venueType: "ballroom",
        setting: "indoor",
        capacityBanquet: 300,
      })
      .expect(201);
    await http()
      .post(`/hotels-admin/hotels/${hotelId}/contacts`)
      .set("Authorization", auth)
      .send({ name: "Sales Desk", phone: "+911234567890", isPrimary: true })
      .expect(201);

    const detail = await http()
      .get(`/hotels-admin/hotels/${hotelId}`)
      .set("Authorization", auth)
      .expect(200);
    expect(detail.body.data.rooms).toHaveLength(1);
    expect(detail.body.data.rooms[0]).toMatchObject({
      name: "Deluxe",
      roomCount: 40,
      facilities: ["wifi", "pool"],
    });
    expect(detail.body.data.venues[0]).toMatchObject({
      venueType: "ballroom",
      setting: "indoor",
      isIndoor: true,
      capacityBanquet: 300,
    });
    expect(detail.body.data.contacts[0]).toMatchObject({ name: "Sales Desk", isPrimary: true });
  });

  it("updates a room and removes a venue", async () => {
    const detail = await http()
      .get(`/hotels-admin/hotels/${hotelId}`)
      .set("Authorization", auth)
      .expect(200);
    const roomId = detail.body.data.rooms[0].id;
    const venueId = detail.body.data.venues[0].id;

    const updated = await http()
      .patch(`/hotels-admin/hotels/${hotelId}/rooms/${roomId}`)
      .set("Authorization", auth)
      .send({ roomCount: 50 })
      .expect(200);
    expect(updated.body.data.roomCount).toBe(50);

    await http()
      .delete(`/hotels-admin/hotels/${hotelId}/venues/${venueId}`)
      .set("Authorization", auth)
      .expect(200);
    const after = await http()
      .get(`/hotels-admin/hotels/${hotelId}`)
      .set("Authorization", auth)
      .expect(200);
    expect(after.body.data.venues).toEqual([]);
  });

  it("404s on a write to a missing hotel or a child of the wrong hotel", async () => {
    await http()
      .post(`/hotels-admin/hotels/${MISSING}/rooms`)
      .set("Authorization", auth)
      .send({ name: "Orphan" })
      .expect(404);

    const detail = await http()
      .get(`/hotels-admin/hotels/${hotelId}`)
      .set("Authorization", auth)
      .expect(200);
    const roomId = detail.body.data.rooms[0].id;
    await http()
      .patch(`/hotels-admin/hotels/${MISSING}/rooms/${roomId}`)
      .set("Authorization", auth)
      .send({ roomCount: 99 })
      .expect(404);
  });

  // A deleted hotel answers 404 (soft delete keeps its children live), so its rooms, venues and contacts
  // must too: an edit through a stale sheet or a known id writes nothing, as the import refuses it.
  it("404s on an edit or a removal of a child of a deleted hotel, writing nothing", async () => {
    const gone = await http()
      .post("/hotels-admin/hotels")
      .set("Authorization", auth)
      .send({ destinationId, name: "E2E Sub Gone Hotel", slug: `${PREFIX}gone` })
      .expect(201);
    const goneId: string = gone.body.data.id;
    const base = `/hotels-admin/hotels/${goneId}`;
    const add = (path: string, body: object) =>
      http().post(`${base}/${path}`).set("Authorization", auth).send(body).expect(201);
    const room = await add("rooms", { name: "Synthetic Gone Suite", roomCount: 4 });
    const venue = await add("venues", {
      name: "Synthetic Gone Hall",
      venueType: "ballroom",
      setting: "indoor",
    });
    const contact = await add("contacts", { name: "Synthetic Gone Desk", isPrimary: true });
    await http().delete(base).set("Authorization", auth).expect(200);

    const children: readonly (readonly [string, object])[] = [
      [`rooms/${room.body.data.id}`, { roomCount: 5 }],
      [`venues/${venue.body.data.id}`, { capacityBanquet: 120 }],
      [`contacts/${contact.body.data.id}`, { roleTitle: "Synthetic Sales" }],
    ];
    for (const [path, body] of children) {
      await http().patch(`${base}/${path}`).set("Authorization", auth).send(body).expect(404);
      await http().delete(`${base}/${path}`).set("Authorization", auth).expect(404);
    }
    const stored = await prisma.hotelRoomCategory.findUniqueOrThrow({
      where: { id: room.body.data.id },
      select: { roomCount: true, deletedAt: true },
    });
    expect(stored).toEqual({ roomCount: 4, deletedAt: null });
  });
});
