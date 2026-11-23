import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { HotelRatesRepository } from "../src/modules/hotels/hotel-rates.repository.js";
import { startApi } from "./start-api.js";

const PREFIX = "e2e-verify-";
const DAY = 24 * 60 * 60 * 1000;

/**
 * Recording a verification through the staff route (Module C; AC-04.3; plan §6.2), as the Hotel team: the
 * server sets its next_due_at from configuration `hotel.verification_policy` (90 days by default), the
 * hotel's last_verified_at follows its newest verification in the same transaction, a backdated record
 * never moves it back, the booking terms' `policies` group is accepted, and a caller cannot set the due
 * date. Every date stays inside the freshness window, so the freshness sweep's suite is unaffected.
 */
describe("Hotel verification dates (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin = "";
  let hotelTeam = "";
  let hotelId = "";

  async function removeFixtures(): Promise<void> {
    const hotels = await prisma.hotel.findMany({ where: { slug: { startsWith: PREFIX } } });
    const ids = hotels.map((hotel) => hotel.id);
    const verifications = await prisma.hotelVerification.findMany({
      where: { hotelId: { in: ids } },
    });
    const destinations = await prisma.destination.findMany({
      where: { slug: { startsWith: PREFIX } },
    });
    const entityIds = [...ids, ...[...verifications, ...destinations].map((row) => row.id)];
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: entityIds } } });
    await prisma.hotelVerification.deleteMany({ where: { hotelId: { in: ids } } });
    await prisma.hotel.deleteMany({ where: { id: { in: ids } } });
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  const http = () => request(app.getHttpServer());
  const record = (body: object) =>
    http()
      .post(`/hotels-admin/hotels/${hotelId}/verifications`)
      .set("Authorization", hotelTeam)
      .send(body);
  const lastVerifiedAt = async () =>
    (
      await prisma.hotel.findUniqueOrThrow({ where: { id: hotelId } })
    ).lastVerifiedAt?.toISOString();

  beforeAll(async () => {
    let mint: (subject: string) => Promise<string>;
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    admin = `Bearer ${await mint("local:admin")}`;
    hotelTeam = `Bearer ${await mint("local:ht")}`;
    const destination = await http()
      .post("/hotels-admin/destinations")
      .set("Authorization", admin)
      .send({ name: "E2E Verify Destination", slug: `${PREFIX}dest` })
      .expect(201);
    const hotel = await http()
      .post("/hotels-admin/hotels")
      .set("Authorization", admin)
      .send({
        destinationId: destination.body.data.id,
        name: "E2E Verify Hotel",
        slug: `${PREFIX}hotel`,
      })
      .expect(201);
    hotelId = hotel.body.data.id;
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("sets next_due_at 90 days on and moves the hotel's last_verified_at to it at once", async () => {
    const res = await record({ fieldGroup: "profile", source: "email" }).expect(201);
    const { verifiedAt, nextDueAt } = res.body.data;
    expect(new Date(nextDueAt).getTime() - new Date(verifiedAt).getTime()).toBe(90 * DAY);
    expect(await lastVerifiedAt()).toBe(verifiedAt);
  });

  it("dates a backdated verification's due date from its own date and never moves the hotel back", async () => {
    const before = await lastVerifiedAt();
    const backdated = new Date(Date.now() - 10 * DAY).toISOString();
    const res = await record({
      fieldGroup: "rooms",
      source: "phone",
      verifiedAt: backdated,
    }).expect(201);
    expect(res.body.data.nextDueAt).toBe(new Date(Date.parse(backdated) + 90 * DAY).toISOString());
    expect(await lastVerifiedAt()).toBe(before);
  });

  it("accepts the booking terms' policies group and refuses a due date sent by the caller", async () => {
    const res = await record({ fieldGroup: "policies", source: "contract" }).expect(201);
    expect(res.body.data.fieldGroup).toBe("policies");
    const dueDate = new Date(Date.now() + 30 * DAY).toISOString();
    await record({ fieldGroup: "profile", source: "email", nextDueAt: dueDate }).expect(400);
  });

  it("records nothing when the hotel's refresh fails: both writes share one transaction", async () => {
    const count = () => prisma.hotelVerification.count({ where: { hotelId } });
    const before = await count();
    const spy = vi
      .spyOn(app.get(HotelRatesRepository), "recomputeLastVerifiedAt")
      .mockRejectedValueOnce(new Error("boom"));
    try {
      await record({ fieldGroup: "media", source: "website" }).expect(500);
    } finally {
      spy.mockRestore();
    }
    expect(await count()).toBe(before);
  });
});
