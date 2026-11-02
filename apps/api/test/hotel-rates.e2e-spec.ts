import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const PREFIX = "e2e-rates-";
const MISSING = "0192f1a0-0000-7000-8000-0000000000ee";
const inr = (minor: number) => ({ minor, currency: "INR" });

/**
 * Verified pricing end to end (Module C, feature 9.2; AC-04). A Super Admin records a verification,
 * builds a rate card with an indicative range (money round-trips through the Decimal column), verifies
 * the card against the verification, and cannot verify it against a bogus one (AC-04.4).
 */
describe("Hotel rates (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;
  let auth: string;
  let hotelId: string;

  async function removeFixtures(): Promise<void> {
    const hotels = await prisma.hotel.findMany({
      where: { slug: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = hotels.map((h) => h.id);
    if (ids.length > 0) {
      const cards = await prisma.hotelRateCard.findMany({
        where: { hotelId: { in: ids } },
        select: { id: true },
      });
      await prisma.hotelRateItem.deleteMany({
        where: { rateCardId: { in: cards.map((c) => c.id) } },
      });
      await prisma.hotelRateCard.deleteMany({ where: { hotelId: { in: ids } } });
      await prisma.hotelVerification.deleteMany({ where: { hotelId: { in: ids } } });
      await prisma.hotel.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    auth = `Bearer ${await mint("local:admin")}`;
    const dest = await http()
      .post("/hotels-admin/destinations")
      .set("Authorization", auth)
      .send({ name: "E2E Rates Destination", slug: `${PREFIX}dest` })
      .expect(201);
    const hotel = await http()
      .post("/hotels-admin/hotels")
      .set("Authorization", auth)
      .send({ destinationId: dest.body.data.id, name: "E2E Rates Hotel", slug: `${PREFIX}hotel` })
      .expect(201);
    hotelId = hotel.body.data.id;
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("builds a rate card with an indicative range that round-trips as money, then verifies it", async () => {
    const verification = await http()
      .post(`/hotels-admin/hotels/${hotelId}/verifications`)
      .set("Authorization", auth)
      .send({ fieldGroup: "rates", source: "email" })
      .expect(201);
    expect(verification.body.data).toMatchObject({ status: "verified", fieldGroup: "rates" });
    expect(verification.body.data.verifiedAt).not.toBeNull();

    const card = await http()
      .post(`/hotels-admin/hotels/${hotelId}/rate-cards`)
      .set("Authorization", auth)
      .send({ name: "Wedding season 2027" })
      .expect(201);
    expect(card.body.data).toMatchObject({ status: "draft", currency: "INR", items: [] });
    const cardId = card.body.data.id;

    const item = await http()
      .post(`/hotels-admin/hotels/${hotelId}/rate-cards/${cardId}/items`)
      .set("Authorization", auth)
      .send({
        itemType: "per_plate_veg",
        unit: "per_plate",
        amount: inr(180000),
        amountMax: inr(250000),
        clientVisible: true,
      })
      .expect(201);
    expect(item.body.data.amount).toEqual(inr(180000));
    expect(item.body.data.amountMax).toEqual(inr(250000));
    expect(item.body.data.isIndicative).toBe(true);

    const detail = await http()
      .get(`/hotels-admin/hotels/${hotelId}/rate-cards/${cardId}`)
      .set("Authorization", auth)
      .expect(200);
    expect(detail.body.data.items).toHaveLength(1);
    expect(detail.body.data.items[0].amount).toEqual(inr(180000));

    const verified = await http()
      .post(`/hotels-admin/hotels/${hotelId}/rate-cards/${cardId}/verify`)
      .set("Authorization", auth)
      .send({ verificationId: verification.body.data.id })
      .expect(200);
    expect(verified.body.data).toMatchObject({
      status: "verified",
      verificationId: verification.body.data.id,
    });
  });

  it("cannot verify a card without a real verification of this hotel (AC-04.4)", async () => {
    const card = await http()
      .post(`/hotels-admin/hotels/${hotelId}/rate-cards`)
      .set("Authorization", auth)
      .send({ name: "Unverifiable card" })
      .expect(201);
    await http()
      .post(`/hotels-admin/hotels/${hotelId}/rate-cards/${card.body.data.id}/verify`)
      .set("Authorization", auth)
      .send({ verificationId: MISSING })
      .expect(409);
  });

  it("updates and removes a rate item", async () => {
    const card = await http()
      .post(`/hotels-admin/hotels/${hotelId}/rate-cards`)
      .set("Authorization", auth)
      .send({ name: "Editable card" })
      .expect(201);
    const cardId = card.body.data.id;
    const item = await http()
      .post(`/hotels-admin/hotels/${hotelId}/rate-cards/${cardId}/items`)
      .set("Authorization", auth)
      .send({ itemType: "room_rate", unit: "per_night", amount: inr(1500000) })
      .expect(201);
    const itemId = item.body.data.id;

    const updated = await http()
      .patch(`/hotels-admin/hotels/${hotelId}/rate-cards/${cardId}/items/${itemId}`)
      .set("Authorization", auth)
      .send({ amount: inr(1800000) })
      .expect(200);
    expect(updated.body.data.amount).toEqual(inr(1800000));

    await http()
      .delete(`/hotels-admin/hotels/${hotelId}/rate-cards/${cardId}/items/${itemId}`)
      .set("Authorization", auth)
      .expect(200);
    const after = await http()
      .get(`/hotels-admin/hotels/${hotelId}/rate-cards/${cardId}`)
      .set("Authorization", auth)
      .expect(200);
    expect(after.body.data.items).toEqual([]);
  });
});
