import { hotelRateItemType, hotelVerificationFieldGroup } from "@ampm/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CATALOGUE_DESTINATIONS, CATALOGUE_HOTELS } from "../prisma/seed-catalogue.data.js";
import { mapsLink } from "../prisma/seed-catalogue.items.js";
import { seedCatalogue } from "../prisma/seed-catalogue.js";
import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const SLUGS = CATALOGUE_HOTELS.map((hotel) => hotel.slug);
const RAMBAGH = "rambagh-palace-jaipur";
const LEELA = "leela-palace-udaipur";
const GOA = "taj-exotica-goa";
const TAG = "E2E-Catalogue";
const PREFIX = "e2e-catalogue-";
/** Hotel columns a catalogue load leaves empty on purpose: who wrote the row, and the soft delete. */
const UNSET_COLUMNS = new Set(["createdBy", "updatedBy", "deletedAt"]);

/**
 * The starter hotel catalogue (D-159). The global setup ran seed.ts, which loads it: every hotel carries
 * every profile column and every kind of child record, a client sees it with indicative prices (but not
 * the staff-only line), and the load is create-only, so a re-run keeps the Hotel team's edits and
 * deletions and only recreates a hotel that is missing.
 */
describe("Starter hotel catalogue (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  /** Hard-deletes a catalogue hotel and its children in FK order, so the load has something to create. */
  async function removeHotel(slug: string): Promise<void> {
    const { id: hotelId } = await prisma.hotel.findUniqueOrThrow({ where: { slug } });
    await prisma.hotelRateItem.deleteMany({ where: { rateCard: { hotelId } } });
    await prisma.hotelRateCard.deleteMany({ where: { hotelId } });
    await prisma.hotelVerification.deleteMany({ where: { hotelId } });
    await prisma.hotelVenue.deleteMany({ where: { hotelId } });
    await prisma.hotelRoomCategory.deleteMany({ where: { hotelId } });
    await prisma.hotelContact.deleteMany({ where: { hotelId } });
    await prisma.hotel.delete({ where: { id: hotelId } });
  }

  /** The subscriber's account, contact, subscription, payment, sessions and user. */
  async function removeSubscriber(): Promise<void> {
    const accounts = await prisma.clientAccount.findMany({ where: { name: { startsWith: TAG } } });
    const accountId = { in: accounts.map((account) => account.id) };
    const users = await prisma.user.findMany({ where: { email: { startsWith: PREFIX } } });
    const userId = { in: users.map((user) => user.id) };
    await prisma.payment.deleteMany({ where: { accountId } });
    await prisma.subscription.deleteMany({ where: { accountId } });
    await prisma.accountContact.deleteMany({ where: { accountId } });
    await prisma.clientAccount.deleteMany({ where: { id: accountId } });
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }

  /** A client of its own with an active Discovery subscription (all-hotels reach), so no other file's
   *  changes to the seeded client can change what this test sees. */
  async function provisionSubscriber(): Promise<string> {
    const account = await prisma.clientAccount.create({
      data: { name: `${TAG} subscriber`, status: "prospect" },
    });
    const subject = `local:${PREFIX}subscriber`;
    const user = await prisma.user.create({
      data: {
        userType: "client",
        name: `${TAG} subscriber`,
        email: `${PREFIX}subscriber@example.com`,
        status: "active",
        identitySubject: subject,
      },
    });
    await prisma.accountContact.create({
      data: { accountId: account.id, name: user.name, relation: "primary", userId: user.id },
    });
    const auth = `Bearer ${await mint(subject)}`;
    const { id: planId } = await prisma.plan.findUniqueOrThrow({ where: { planKey: "discovery" } });
    const purchase = await http()
      .post("/crm/portal/subscriptions")
      .set("authorization", auth)
      .send({ planId })
      .expect(201);
    await http()
      .post("/crm/portal/complete-payment")
      .set("authorization", auth)
      .send({ subscriptionId: purchase.body.data.subscriptionId })
      .expect(200);
    return auth;
  }

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeSubscriber();
  });

  afterAll(async () => {
    await removeSubscriber();
    await app.close();
  });

  it("uses every venue type, adds up its rooms and keeps every range low-to-high", () => {
    const venueTypes = new Set(
      CATALOGUE_HOTELS.flatMap((hotel) => hotel.venues.map((v) => v.venueType)),
    );
    expect([...venueTypes].sort()).toEqual([
      "ballroom",
      "beach",
      "courtyard",
      "lawn",
      "other",
      "poolside",
      "rooftop",
    ]);
    for (const hotel of CATALOGUE_HOTELS) {
      expect(hotel.rooms.reduce((sum, room) => sum + room.roomCount, 0)).toBe(hotel.totalRooms);
      expect(mapsLink(hotel).length).toBeLessThanOrEqual(255); // the street_view_ref column
      const { serviceChargePercent: _single, minCovers: _covers, ...ranges } = hotel.rates;
      const all = [
        ...Object.values(ranges),
        ...hotel.rooms.flatMap((room) => [room.rate, room.nextRate]),
        ...hotel.venues.map((venue) => venue.rental),
      ];
      for (const [low, high] of all) expect(high, hotel.slug).toBeGreaterThanOrEqual(low);
    }
  });

  it("loads every hotel with every column and every kind of record filled", async () => {
    const hotels = await prisma.hotel.findMany({ where: { slug: { in: SLUGS } } });
    expect(hotels.map((hotel) => hotel.slug).sort()).toEqual([...SLUGS].sort());
    for (const hotel of hotels) {
      for (const [column, value] of Object.entries(hotel)) {
        if (!UNSET_COLUMNS.has(column)) expect(value, `${hotel.slug}.${column}`).not.toBeNull();
      }
      expect(hotel).toMatchObject({ status: "active", demoVisible: false, publicShowcase: false });
      const data = CATALOGUE_HOTELS.find((entry) => entry.slug === hotel.slug);
      const detail = await prisma.hotel.findUniqueOrThrow({
        where: { id: hotel.id },
        include: {
          rooms: true,
          venues: true,
          contacts: true,
          verifications: true,
          rateCards: { include: { items: true } },
        },
      });
      expect(detail.rooms).toHaveLength(data?.rooms.length ?? -1);
      expect(detail.venues).toHaveLength(data?.venues.length ?? -1);
      expect(detail.contacts).toHaveLength(1);
      expect(detail.verifications.map((v) => v.fieldGroup).sort()).toEqual(
        [...hotelVerificationFieldGroup.options].sort(),
      );
      const verified = detail.rateCards.find((card) => card.status === "verified");
      const draft = detail.rateCards.find((card) => card.status === "draft");
      expect(verified?.verificationId).not.toBeNull();
      expect(draft?.items.length).toBeGreaterThan(0);
      const types = new Set(verified?.items.map((line) => line.itemType));
      expect([...types].sort()).toEqual([...hotelRateItemType.options].sort());
      for (const line of verified?.items ?? []) {
        if (line.itemType === "room_rate") expect(line.roomCategoryId).not.toBeNull();
        if (line.itemType === "venue_rental") expect(line.venueId).not.toBeNull();
      }
    }
    const destinations = await prisma.destination.findMany({
      where: { slug: { in: CATALOGUE_DESTINATIONS.map((destination) => destination.slug) } },
    });
    expect(destinations).toHaveLength(CATALOGUE_DESTINATIONS.length);
    for (const destination of destinations) expect(destination.description).not.toBeNull();
  });

  it("shows a client the hotel with indicative prices and never the staff-only line", async () => {
    const { id } = await prisma.hotel.findUniqueOrThrow({ where: { slug: RAMBAGH } });
    const auth = await provisionSubscriber(); // before the request is built, so it binds a live server
    const res = await http().get(`/hotels/${id}`).set("authorization", auth).expect(200);
    const hotel = res.body.data;
    const data = CATALOGUE_HOTELS.find((entry) => entry.slug === RAMBAGH);
    expect(hotel.streetViewRef).toBe(data ? mapsLink(data) : "missing");
    expect(hotel.summary.capacity).not.toBeNull();
    expect(hotel.venues).toHaveLength(3);
    expect(hotel.rooms).toHaveLength(3);
    expect(hotel.facilities.length).toBeGreaterThan(0);
    expect(hotel.rates.status).toBe("verified");
    const types: string[] = hotel.rates.items.map((line: { itemType: string }) => line.itemType);
    expect(types).toContain("tax");
    expect(types).toContain("beverage_package");
    expect(types).not.toContain("service_charge"); // client_visible false on a verified card
    expect(hotel.summary.priceRange).not.toBeNull();
    expect(JSON.stringify(hotel)).not.toContain("Starter catalogue"); // the internal notes stay inside
  });

  it("re-runs without touching an edited or a deleted hotel", async () => {
    const goa = await prisma.hotel.findUniqueOrThrow({ where: { slug: GOA } });
    const leela = await prisma.hotel.findUniqueOrThrow({ where: { slug: LEELA } });
    await prisma.hotel.update({
      where: { id: goa.id },
      data: { name: "Edited by the Hotel team" },
    });
    await prisma.hotel.update({ where: { id: leela.id }, data: { deletedAt: new Date() } });
    try {
      const outcome = await seedCatalogue(prisma);
      expect(outcome).toEqual({ destinationsCreated: [], hotelsCreated: [], hotelsSkipped: SLUGS });
      const after = await prisma.hotel.findUniqueOrThrow({ where: { id: goa.id } });
      expect(after.name).toBe("Edited by the Hotel team");
      expect(
        (await prisma.hotel.findUniqueOrThrow({ where: { id: leela.id } })).deletedAt,
      ).not.toBeNull();
      expect(await prisma.hotelRateCard.count({ where: { hotelId: goa.id } })).toBe(2);
    } finally {
      await prisma.hotel.update({ where: { id: goa.id }, data: { name: goa.name } });
      await prisma.hotel.update({ where: { id: leela.id }, data: { deletedAt: null } });
    }
  });

  it("recreates a missing hotel in full, and a dry run writes nothing", async () => {
    await removeHotel(GOA);
    const dry = await seedCatalogue(prisma, { dryRun: true });
    expect(dry.hotelsCreated).toEqual([GOA]);
    expect(await prisma.hotel.count({ where: { slug: GOA } })).toBe(0);

    const outcome = await seedCatalogue(prisma);
    expect(outcome.hotelsCreated).toEqual([GOA]);
    const hotel = await prisma.hotel.findUniqueOrThrow({
      where: { slug: GOA },
      include: { rooms: true, venues: true, contacts: true, verifications: true, rateCards: true },
    });
    expect([hotel.rooms.length, hotel.venues.length, hotel.contacts.length]).toEqual([3, 4, 1]);
    expect([hotel.verifications.length, hotel.rateCards.length]).toEqual([7, 2]);
    const audit = await prisma.auditEvent.findFirst({
      where: { entityType: "hotel", entityId: hotel.id, action: "create" },
    });
    expect(audit).toMatchObject({ actorType: "system", afterJson: { source: "catalogue_load" } });
  });
});
