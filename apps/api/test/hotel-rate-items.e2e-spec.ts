import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

/** Every fixture's web address and destination carries this prefix, so the suite cleans up after itself. */
const PREFIX = "e2e-rateitem-";
const MISSING = "0192f1a0-0000-7000-8000-0000000000ee";
const NOT_BOTH = "An item is for a room category or a venue, not both";
const inr = (minor: number) => ({ minor, currency: "INR" });

/**
 * A staff rate item belongs to its card's hotel (Module C; D-184, §5; AC-04.10): its room category or
 * venue must be a live one of that hotel, refused on its own field in the same words for another hotel's
 * and for an id that exists nowhere; and an item is for a room category or a venue, not both, an update
 * checked against the stored item merged with its patch. All fixtures are synthetic.
 */
describe("Rate items belong to their card's hotel (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;
  let admin = "";
  let hotelId = "";
  let cardPath = "";
  let roomId = "";
  let venueId = "";
  let otherRoomId = "";

  async function removeFixtures(): Promise<void> {
    const hotels = await prisma.hotel.findMany({ where: { slug: { startsWith: PREFIX } } });
    const ids = hotels.map((hotel) => hotel.id);
    const cards = await prisma.hotelRateCard.findMany({ where: { hotelId: { in: ids } } });
    const cardIds = cards.map(({ id }) => id);
    const items = await prisma.hotelRateItem.findMany({ where: { rateCardId: { in: cardIds } } });
    const rooms = await prisma.hotelRoomCategory.findMany({ where: { hotelId: { in: ids } } });
    const venues = await prisma.hotelVenue.findMany({ where: { hotelId: { in: ids } } });
    const children = [...cards, ...items, ...rooms, ...venues].map(({ id }) => id);
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: [...ids, ...children] } } });
    await prisma.hotelRateItem.deleteMany({ where: { rateCardId: { in: cardIds } } });
    await prisma.hotelRateCard.deleteMany({ where: { hotelId: { in: ids } } });
    await prisma.hotelRoomCategory.deleteMany({ where: { hotelId: { in: ids } } });
    await prisma.hotelVenue.deleteMany({ where: { hotelId: { in: ids } } });
    await prisma.hotel.deleteMany({ where: { id: { in: ids } } });
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  const http = () => request(app.getHttpServer());
  const post = async (path: string, body: object): Promise<string> => {
    const res = await http().post(path).set("Authorization", admin).send(body).expect(201);
    return res.body.data.id;
  };
  const addItem = (fields: object) =>
    http()
      .post(`${cardPath}/items`)
      .set("Authorization", admin)
      .send({ itemType: "room_rate", unit: "per_night", amount: inr(1_250_000), ...fields });

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    admin = `Bearer ${await mint("local:admin")}`;
    const destinationId = await post("/hotels-admin/destinations", {
      name: "E2E Rateitem Bay",
      slug: `${PREFIX}bay`,
    });
    const hotel = (slug: string) =>
      post("/hotels-admin/hotels", { destinationId, name: `E2E Rateitem ${slug}`, slug });
    hotelId = await hotel(`${PREFIX}hotel`);
    const otherId = await hotel(`${PREFIX}other`);
    roomId = await post(`/hotels-admin/hotels/${hotelId}/rooms`, { name: "E2E Rateitem Suite" });
    venueId = await post(`/hotels-admin/hotels/${hotelId}/venues`, {
      name: "E2E Rateitem Lawn",
      venueType: "lawn",
      setting: "outdoor",
    });
    otherRoomId = await post(`/hotels-admin/hotels/${otherId}/rooms`, { name: "E2E Rateitem Far" });
    const cardId = await post(`/hotels-admin/hotels/${hotelId}/rate-cards`, { name: "E2E 2027" });
    cardPath = `/hotels-admin/hotels/${hotelId}/rate-cards/${cardId}`;
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("refuses a second hotel's room and an id that exists nowhere, in the same words", async () => {
    for (const roomCategoryId of [otherRoomId, MISSING]) {
      const res = await addItem({ roomCategoryId }).expect(400);
      expect(res.body.error).toMatchObject({
        code: "validation_failed",
        details: [{ path: "roomCategoryId", message: "Choose a room category of this hotel" }],
      });
    }
    const venue = await addItem({ itemType: "venue_rental", venueId: MISSING }).expect(400);
    expect(venue.body.error.details).toEqual([
      { path: "venueId", message: "Choose a venue of this hotel" },
    ]);
  });

  it("refuses an item for a room category and a venue at once", async () => {
    const res = await addItem({ roomCategoryId: roomId, venueId }).expect(400);
    expect(res.body.error.details).toEqual([
      { path: "roomCategoryId", message: NOT_BOTH },
      { path: "venueId", message: NOT_BOTH },
    ]);
  });

  it("adds an item for the hotel's room, and holds its updates to the same rules", async () => {
    const item = await addItem({ roomCategoryId: roomId }).expect(201);
    const itemPath = `${cardPath}/items/${item.body.data.id}`;
    const patch = (body: object) => http().patch(itemPath).set("Authorization", admin).send(body);
    const both = await patch({ venueId }).expect(400);
    expect(both.body.error.details).toEqual([{ path: "venueId", message: NOT_BOTH }]);
    const far = await patch({ roomCategoryId: otherRoomId }).expect(400);
    expect(far.body.error.details).toEqual([
      { path: "roomCategoryId", message: "Choose a room category of this hotel" },
    ]);
    const moved = await patch({ roomCategoryId: null, venueId, itemType: "venue_rental" }).expect(
      200,
    );
    expect(moved.body.data).toMatchObject({ roomCategoryId: null, venueId });
  });
});
