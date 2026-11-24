import { HOTEL_PHONE_REFUSAL } from "@ampm/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

/** Every fixture's web address and destination carries this prefix, so the suite cleans up after itself. */
const PREFIX = "e2e-phonerule-";

/**
 * A hotel's contacts (Module C; RESTRICTED-CONTACT; D-178): a hotel has one live primary contact, so naming
 * a new one demotes the current one in the same write, audited; a phone is stored in E.164 and one that
 * does not read as a full number (an extension) is refused naming `phone`; a legacy free-text phone is
 * left as it is when an edit repeats it. All fixtures are synthetic (the +9112345678xx range).
 */
describe("Hotel contacts: one primary, phones in E.164 (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin = "";
  let hotelId = "";

  async function removeFixtures(): Promise<void> {
    const hotels = await prisma.hotel.findMany({ where: { slug: { startsWith: PREFIX } } });
    const ids = hotels.map((hotel) => hotel.id);
    const contacts = await prisma.hotelContact.findMany({ where: { hotelId: { in: ids } } });
    const entityIds = [...ids, ...contacts.map(({ id }) => id)];
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: entityIds } } });
    await prisma.hotelContact.deleteMany({ where: { hotelId: { in: ids } } });
    await prisma.hotel.deleteMany({ where: { id: { in: ids } } });
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  const http = () => request(app.getHttpServer());
  const addContact = (body: object) =>
    http().post(`/hotels-admin/hotels/${hotelId}/contacts`).set("Authorization", admin).send(body);
  const editContact = (contactId: string, body: object) =>
    http()
      .patch(`/hotels-admin/hotels/${hotelId}/contacts/${contactId}`)
      .set("Authorization", admin)
      .send(body);

  beforeAll(async () => {
    let mint: (subject: string) => Promise<string>;
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    admin = `Bearer ${await mint("local:admin")}`;
    const destination = await http()
      .post("/hotels-admin/destinations")
      .set("Authorization", admin)
      .send({ name: "E2E Phonerule Coast", slug: `${PREFIX}coast` })
      .expect(201);
    const hotel = await http()
      .post("/hotels-admin/hotels")
      .set("Authorization", admin)
      .send({
        destinationId: destination.body.data.id,
        name: "E2E Phonerule Hotel",
        slug: `${PREFIX}hotel`,
      })
      .expect(201);
    hotelId = hotel.body.data.id;
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("keeps one primary contact: naming a new one demotes the current one, audited", async () => {
    const first = await addContact({ name: "E2E Sales Desk", isPrimary: true }).expect(201);
    const second = await addContact({ name: "E2E Events Desk", isPrimary: true }).expect(201);
    expect(second.body.data).toMatchObject({ name: "E2E Events Desk", isPrimary: true });
    const detail = await http()
      .get(`/hotels-admin/hotels/${hotelId}`)
      .set("Authorization", admin)
      .expect(200);
    const contacts: { id: string; isPrimary: boolean }[] = detail.body.data.contacts;
    expect(contacts.filter((contact) => contact.isPrimary).map(({ id }) => id)).toEqual([
      second.body.data.id,
    ]);
    const demotion = await prisma.auditEvent.findFirstOrThrow({
      where: { entityType: "hotel_contact", entityId: first.body.data.id, action: "update" },
    });
    expect(demotion.beforeJson).toEqual({ isPrimary: true });
    expect(demotion.afterJson).toEqual({ isPrimary: false, changedFields: ["isPrimary"] });
    const created = await prisma.auditEvent.count({
      where: { entityType: "hotel_contact", entityId: second.body.data.id, action: "create" },
    });
    expect(created).toBe(1);
  });

  it("makes an existing contact primary by an edit, demoting the current one", async () => {
    const third = await addContact({ name: "E2E Front Office" }).expect(201);
    expect(third.body.data.isPrimary).toBe(false);
    await editContact(third.body.data.id, { isPrimary: true }).expect(200);
    const primaries = await prisma.hotelContact.findMany({
      where: { hotelId, isPrimary: true, deletedAt: null },
    });
    expect(primaries.map(({ id }) => id)).toEqual([third.body.data.id]);
  });

  it("stores a phone in E.164 and refuses one with an extension, naming phone", async () => {
    const res = await addContact({ name: "E2E Reservations", phone: "0123 456 7802" }).expect(201);
    expect(res.body.data.phone).toBe("+911234567802");
    const refused = await addContact({
      name: "E2E Reservations Desk",
      phone: "+91 12345 67802 ext 4",
    }).expect(400);
    expect(refused.body.error).toMatchObject({
      code: "validation_failed",
      details: [{ path: "phone", message: HOTEL_PHONE_REFUSAL }],
    });
    expect(
      await prisma.hotelContact.count({ where: { hotelId, name: "E2E Reservations Desk" } }),
    ).toBe(0);
  });

  it("leaves a legacy free-text phone as it is when an edit repeats it", async () => {
    const legacy = await prisma.hotelContact.create({
      data: { hotelId, name: "E2E Legacy Desk", phone: "Front desk line 2" },
    });
    const res = await editContact(legacy.id, {
      phone: "Front desk line 2",
      roleTitle: "Events",
    }).expect(200);
    expect(res.body.data).toMatchObject({ phone: "Front desk line 2", roleTitle: "Events" });
    await editContact(legacy.id, { phone: "Front desk line 3" }).expect(400);
    const fixed = await editContact(legacy.id, { phone: "+91 12345 67803" }).expect(200);
    expect(fixed.body.data.phone).toBe("+911234567803");
  });
});
