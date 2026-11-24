import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { HotelsService } from "../src/modules/hotels/hotels.service.js";
import { fakeEntitlements, fakePrincipal } from "./discovery-principals.js";
import { startApi } from "./start-api.js";

/** Every fixture's web address and destination carries this prefix, so the suite cleans up after itself. */
const PREFIX = "e2e-unitcheck-";
/** The D-178 room and venue fields that reach only the staff views until Slice 12. */
const ROOM_STAFF_ONLY = ["unitType", "viewLabel", "bedConfiguration", "sizeSqft"];
const VENUE_STAFF_ONLY = [
  "setting",
  "areaSqft",
  "lengthM",
  "widthM",
  "ceilingHeightM",
  "prefunctionAreaSqm",
  "prefunctionAreaSqft",
  "otherLayouts",
  "capacityNotes",
];
const LAYOUTS = [
  { layout: "Classroom", max: 120 },
  { layout: "U-shape", max: 40, min: 30 },
];

/**
 * A hotel's rooms and venues with the D-178 fields, end to end (Module C; plan §6.2, Slice 3): a room keeps
 * the size the hotel published in sq ft with its m² derived (round(sq ft × 0.09290304)), and an m² alone
 * republishes it; a venue's setting decides is_indoor (semi-open is not indoor); metres and other layouts
 * round-trip; the hotel's total event space follows the same rule. The client and demo hotel detail show a
 * new venue type but none of the new room or venue fields. All fixtures are synthetic.
 */
describe("Hotel rooms, venues and units (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin = "";
  let hotelId = "";

  async function removeFixtures(): Promise<void> {
    const hotels = await prisma.hotel.findMany({ where: { slug: { startsWith: PREFIX } } });
    const ids = hotels.map((hotel) => hotel.id);
    const rooms = await prisma.hotelRoomCategory.findMany({ where: { hotelId: { in: ids } } });
    const venues = await prisma.hotelVenue.findMany({ where: { hotelId: { in: ids } } });
    const entityIds = [...ids, ...rooms.map(({ id }) => id), ...venues.map(({ id }) => id)];
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: entityIds } } });
    await prisma.hotelRoomCategory.deleteMany({ where: { hotelId: { in: ids } } });
    await prisma.hotelVenue.deleteMany({ where: { hotelId: { in: ids } } });
    await prisma.hotel.deleteMany({ where: { id: { in: ids } } });
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  const http = () => request(app.getHttpServer());
  const post = (path: string, body: object) =>
    http().post(`/hotels-admin/hotels/${hotelId}/${path}`).set("Authorization", admin).send(body);
  const patch = (path: string, body: object) =>
    http().patch(`/hotels-admin/hotels/${hotelId}/${path}`).set("Authorization", admin).send(body);

  beforeAll(async () => {
    let mint: (subject: string) => Promise<string>;
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    admin = `Bearer ${await mint("local:admin")}`;
    const destination = await http()
      .post("/hotels-admin/destinations")
      .set("Authorization", admin)
      .send({ name: "E2E Unitcheck Lakes", slug: `${PREFIX}lakes`, status: "active" })
      .expect(201);
    const hotel = await http()
      .post("/hotels-admin/hotels")
      .set("Authorization", admin)
      .send({
        destinationId: destination.body.data.id,
        name: "E2E Unitcheck Hotel",
        slug: `${PREFIX}hotel`,
        status: "active",
        demoVisible: true,
      })
      .expect(201);
    hotelId = hotel.body.data.id;
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("keeps a room's published sq ft with its m² derived, and republishes an m² written alone", async () => {
    const created = await post("rooms", {
      name: "E2E Unitcheck Villa",
      unitType: "villa",
      viewLabel: "Lake view",
      bedConfiguration: "One king bed",
      sizeSqft: 850,
      sizeSqm: 99,
      maxOccupancy: 3,
    }).expect(201);
    expect(created.body.data).toMatchObject({
      unitType: "villa",
      viewLabel: "Lake view",
      bedConfiguration: "One king bed",
      sizeSqft: 850,
      sizeSqm: 79,
    });
    const updated = await patch(`rooms/${created.body.data.id}`, { sizeSqm: 80 }).expect(200);
    expect(updated.body.data).toMatchObject({ sizeSqm: 80, sizeSqft: null });
    const zero = await post("rooms", { name: "E2E Unitcheck Empty", maxOccupancy: 0 }).expect(400);
    expect(zero.body.error.details).toEqual([expect.objectContaining({ path: "maxOccupancy" })]);
  });

  it("writes is_indoor from a venue's setting, derives its areas and round-trips metres and layouts", async () => {
    const created = await post("venues", {
      name: "E2E Unitcheck Terrace",
      venueType: "terrace",
      setting: "semi_open",
      areaSqft: 5000,
      lengthM: 30.5,
      widthM: 15.25,
      ceilingHeightM: 6,
      prefunctionAreaSqft: 1000,
      capacityBanquet: 300,
      capacityReception: 450,
      capacityNotes: "400 to 450 standing",
      otherLayouts: LAYOUTS,
    }).expect(201);
    expect(created.body.data).toMatchObject({
      venueType: "terrace",
      setting: "semi_open",
      isIndoor: false,
      areaSqm: 465,
      lengthM: 30.5,
      widthM: 15.25,
      ceilingHeightM: 6,
      prefunctionAreaSqm: 93,
      otherLayouts: LAYOUTS,
    });
    const venueId: string = created.body.data.id;
    const stored = () => prisma.hotelVenue.findUniqueOrThrow({ where: { id: venueId } });
    expect(await stored()).toMatchObject({ setting: "semi_open", isIndoor: false });
    const indoor = await patch(`venues/${venueId}`, { setting: "indoor" }).expect(200);
    expect(indoor.body.data).toMatchObject({ setting: "indoor", isIndoor: true, areaSqm: 465 });
    expect(await stored()).toMatchObject({ setting: "indoor", isIndoor: true });
  });

  it("refuses a venue that sends is_indoor, or thirteen layouts, naming the field", async () => {
    const base = { name: "E2E Unitcheck Lawn", venueType: "garden", setting: "outdoor" };
    await post("venues", { ...base, isIndoor: false }).expect(400);
    const thirteen = Array.from({ length: 13 }, (_, i) => ({ layout: `Layout ${i}`, max: 10 }));
    const many = await post("venues", { ...base, otherLayouts: thirteen }).expect(400);
    expect(many.body.error.details).toEqual([expect.objectContaining({ path: "otherLayouts" })]);
  });

  it("derives the hotel's total event space m² from its sq ft, and clears the sq ft for an m² alone", async () => {
    const hotel = () => http().patch(`/hotels-admin/hotels/${hotelId}`).set("Authorization", admin);
    const sqft = await hotel().send({ totalEventSpaceSqft: 25833 }).expect(200);
    expect(sqft.body.data).toMatchObject({ totalEventSpaceSqft: 25833, totalEventSpaceSqm: 2400 });
    const sqm = await hotel().send({ totalEventSpaceSqm: 2500 }).expect(200);
    expect(sqm.body.data).toMatchObject({ totalEventSpaceSqft: null, totalEventSpaceSqm: 2500 });
  });

  it("shows a client and a demo a new venue type, and none of the new room or venue fields", async () => {
    const hotels = app.get(HotelsService);
    for (const principal of [
      fakePrincipal("client", fakeEntitlements("all_hotels", false)),
      fakePrincipal("demo", fakeEntitlements("demo_hotels", true)),
    ]) {
      const detail = await hotels.get(principal, hotelId);
      expect(detail.venues.map((venue) => venue.venueType)).toEqual(["terrace"]);
      expect(detail.venues[0]).toMatchObject({ isIndoor: true, areaSqm: 465 });
      expect(detail.rooms).toHaveLength(1);
      for (const field of VENUE_STAFF_ONLY) expect(detail.venues[0]).not.toHaveProperty(field);
      for (const field of ROOM_STAFF_ONLY) expect(detail.rooms[0]).not.toHaveProperty(field);
    }
  });
});
