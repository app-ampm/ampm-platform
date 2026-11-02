import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const TAG = "E2E-RateRender";
const PREFIX = "e2e-rate-render-";
const inr = (minor: number) => ({ minor, currency: "INR" });

/**
 * Client rate rendering end to end (Module C, feature 9.2; AC-04.1/.2/.7). A subscriber opens a hotel and
 * sees its verified, client-visible rate items as indicative ranges with a freshness date; a stale card
 * still shows amounts; a hotel with no verified/stale client-visible items reports "rates on request" with
 * no amounts. A draft card and a non-client-visible item never reach the client, the response never
 * carries the word "confirmed" or a RESTRICTED field, and a rate item is pricing only — never availability.
 */
describe("Client rate rendering (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;
  let adminAuth: string;
  let destinationId: string;
  let clientToken: string;

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;

  async function removeFixtures(): Promise<void> {
    const accounts = await prisma.clientAccount.findMany({
      where: { name: { startsWith: TAG } },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);
    const users = await prisma.user.findMany({
      where: { email: { startsWith: PREFIX } },
      select: { id: true },
    });
    const hotels = await prisma.hotel.findMany({
      where: { slug: { startsWith: PREFIX } },
      select: { id: true },
    });
    const hotelIds = hotels.map((h) => h.id);
    const cards = await prisma.hotelRateCard.findMany({
      where: { hotelId: { in: hotelIds } },
      select: { id: true },
    });
    await prisma.savedHotel.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.payment.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.subscription.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.accountContact.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.clientAccount.deleteMany({ where: { id: { in: accountIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    await prisma.hotelRateItem.deleteMany({
      where: { rateCardId: { in: cards.map((c) => c.id) } },
    });
    await prisma.hotelRateCard.deleteMany({ where: { hotelId: { in: hotelIds } } });
    await prisma.hotelVerification.deleteMany({ where: { hotelId: { in: hotelIds } } });
    await prisma.hotel.deleteMany({ where: { id: { in: hotelIds } } });
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  /** An active hotel the all_hotels subscriber can open (admin create defaults to draft, hidden). */
  async function makeHotel(slug: string): Promise<string> {
    const hotel = await http()
      .post("/hotels-admin/hotels")
      .set("Authorization", adminAuth)
      .send({ destinationId, name: `${TAG} ${slug}`, slug: `${PREFIX}${slug}`, status: "active" })
      .expect(201);
    return hotel.body.data.id;
  }

  async function recordVerification(hotelId: string): Promise<string> {
    const verification = await http()
      .post(`/hotels-admin/hotels/${hotelId}/verifications`)
      .set("Authorization", adminAuth)
      .send({ fieldGroup: "rates", source: "email" })
      .expect(201);
    return verification.body.data.id;
  }

  async function makeCard(hotelId: string, name: string): Promise<string> {
    const card = await http()
      .post(`/hotels-admin/hotels/${hotelId}/rate-cards`)
      .set("Authorization", adminAuth)
      .send({ name })
      .expect(201);
    return card.body.data.id;
  }

  async function addItem(hotelId: string, cardId: string, body: object): Promise<void> {
    await http()
      .post(`/hotels-admin/hotels/${hotelId}/rate-cards/${cardId}/items`)
      .set("Authorization", adminAuth)
      .send(body)
      .expect(201);
  }

  async function verifyCard(
    hotelId: string,
    cardId: string,
    verificationId: string,
  ): Promise<void> {
    await http()
      .post(`/hotels-admin/hotels/${hotelId}/rate-cards/${cardId}/verify`)
      .set("Authorization", adminAuth)
      .send({ verificationId })
      .expect(200);
  }

  /** A client with a prospect account and an active Discovery subscription (all_hotels reach). */
  async function provisionSubscriber(suffix: string): Promise<string> {
    const account = await prisma.clientAccount.create({
      data: { name: `${TAG} ${suffix}`, status: "prospect" },
      select: { id: true },
    });
    const subject = `local:${PREFIX}${suffix}`;
    const user = await prisma.user.create({
      data: {
        userType: "client",
        name: `${TAG} ${suffix}`,
        email: `${PREFIX}${suffix}@example.com`,
        status: "active",
        identitySubject: subject,
      },
      select: { id: true },
    });
    await prisma.accountContact.create({
      data: {
        accountId: account.id,
        name: `${TAG} ${suffix}`,
        relation: "primary",
        userId: user.id,
      },
    });
    const token = await mint(subject);
    const planId = (await prisma.plan.findUniqueOrThrow({ where: { planKey: "discovery" } })).id;
    const purchase = await http()
      .post("/crm/portal/subscriptions")
      .set("authorization", auth(token))
      .send({ planId })
      .expect(201);
    await http()
      .post("/crm/portal/complete-payment")
      .set("authorization", auth(token))
      .send({ subscriptionId: purchase.body.data.subscriptionId })
      .expect(200);
    return token;
  }

  const getRates = async (hotelId: string): Promise<request.Response> =>
    http().get(`/hotels/${hotelId}`).set("authorization", auth(clientToken)).expect(200);

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    adminAuth = `Bearer ${await mint("local:admin")}`;
    const dest = await http()
      .post("/hotels-admin/destinations")
      .set("Authorization", adminAuth)
      .send({ name: "E2E Rate Render Destination", slug: `${PREFIX}dest`, status: "active" })
      .expect(201);
    destinationId = dest.body.data.id;
    clientToken = await provisionSubscriber("buyer");
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("renders a verified card's client-visible items as an indicative range with a freshness date", async () => {
    const hotelId = await makeHotel("verified");
    const verificationId = await recordVerification(hotelId);
    const cardId = await makeCard(hotelId, "Wedding season 2027");
    await addItem(hotelId, cardId, {
      itemType: "per_plate_veg",
      unit: "per_plate",
      amount: inr(180000),
      amountMax: inr(250000),
      inclusionsText: "Dinner buffet",
      clientVisible: true,
    });
    // A non-client-visible item on the same card must never reach the client (security.md).
    await addItem(hotelId, cardId, {
      itemType: "room_rate",
      unit: "per_night",
      amount: inr(1500000),
      clientVisible: false,
    });
    await verifyCard(hotelId, cardId, verificationId);

    const { rates } = (await getRates(hotelId)).body.data;
    expect(rates.status).toBe("verified");
    expect(rates.asOf).not.toBeNull();
    expect(Number.isNaN(Date.parse(rates.asOf))).toBe(false);
    expect(rates.items).toHaveLength(1); // only the client-visible item
    expect(rates.items[0]).toEqual({
      itemType: "per_plate_veg",
      amount: inr(180000),
      amountMax: inr(250000), // the indicative upper bound round-trips as money
      unit: "per_plate",
      inclusions: "Dinner buffet",
    });
    // AC-04.7: a rate item is pricing only — never an availability field or flag.
    expect(Object.keys(rates.items[0]).sort()).toEqual([
      "amount",
      "amountMax",
      "inclusions",
      "itemType",
      "unit",
    ]);
  });

  it("never leaks the word 'confirmed' or a RESTRICTED field on the detail", async () => {
    const hotelId = await makeHotel("no-leak");
    const verificationId = await recordVerification(hotelId);
    const cardId = await makeCard(hotelId, "Season card");
    await addItem(hotelId, cardId, {
      itemType: "wedding_package",
      unit: "per_event",
      amount: inr(5000000),
      clientVisible: true,
    });
    await verifyCard(hotelId, cardId, verificationId);

    const body = (await getRates(hotelId)).body.data;
    expect(JSON.stringify(body).toLowerCase()).not.toContain("confirmed");
    expect(body).not.toHaveProperty("internalRating"); // RESTRICTED-NOTES
    expect(body).not.toHaveProperty("internalNotes");
    expect(JSON.stringify(body)).not.toContain("internal only");
  });

  it("shows a stale card's amounts, flagged stale (AC-04.2)", async () => {
    const hotelId = await makeHotel("stale");
    const verificationId = await recordVerification(hotelId);
    const cardId = await makeCard(hotelId, "Last year's card");
    await addItem(hotelId, cardId, {
      itemType: "per_plate_non_veg",
      unit: "per_plate",
      amount: inr(220000),
      clientVisible: true,
    });
    await verifyCard(hotelId, cardId, verificationId);
    // The freshness sweep turns a card backed by an out-of-date verification `stale` (AC-04.3); drive the
    // end state directly so this test owns only the rendering.
    await prisma.hotelRateCard.update({ where: { id: cardId }, data: { status: "stale" } });

    const { rates } = (await getRates(hotelId)).body.data;
    expect(rates.status).toBe("stale");
    expect(rates.items).toHaveLength(1);
    expect(rates.items[0].amount).toEqual(inr(220000)); // amounts still shown when stale
  });

  it("reports 'rates on request' when nothing verified and client-visible exists (AC-04.1)", async () => {
    const hotelId = await makeHotel("on-request");
    // A draft card with a client-visible item — a draft never reaches the client.
    const draft = await makeCard(hotelId, "Unverified draft");
    await addItem(hotelId, draft, {
      itemType: "room_rate",
      unit: "per_night",
      amount: inr(999999),
      clientVisible: true,
    });
    // A verified card whose only item is internal — nothing client-visible to show.
    const verificationId = await recordVerification(hotelId);
    const verified = await makeCard(hotelId, "Internal-only card");
    await addItem(hotelId, verified, {
      itemType: "room_rate",
      unit: "per_night",
      amount: inr(1200000),
      clientVisible: false,
    });
    await verifyCard(hotelId, verified, verificationId);

    const { rates } = (await getRates(hotelId)).body.data;
    expect(rates.status).toBe("on_request");
    expect(rates.asOf).toBeNull();
    expect(rates.items).toEqual([]);
  });
});
