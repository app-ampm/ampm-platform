import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const TAG = "E2E-AcctEnq";
const PREFIX = "e2e-acctenq";
const DAY_MS = 86_400_000;

/**
 * One client's enquiries on the account hub (TW-13 Hotels): the staff queue filters by `accountId`, and
 * the same parameter cannot widen a client's own list — the client path is always the caller's account.
 * Records are written straight to the database; the reads go through the API.
 */
describe("Enquiries of one client account (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let mint: (subject: string) => Promise<string>;
  const accounts: Record<"a" | "b", string> = { a: "", b: "" };
  const enquiries: Record<"a" | "b", string> = { a: "", b: "" };
  const clientSubject = `local:${PREFIX}-client`;

  const http = () => request(app.getHttpServer());
  const as = async (subject: string) => `Bearer ${await mint(subject)}`;

  async function removeFixtures(): Promise<void> {
    const rows = await prisma.clientAccount.findMany({
      where: { name: { startsWith: TAG } },
      select: { id: true },
    });
    const accountIds = rows.map((row) => row.id);
    await prisma.hotelEnquiry.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.subscription.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.accountContact.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.clientAccount.deleteMany({ where: { id: { in: accountIds } } });
    // Signing in as the client opens a session, which holds its user.
    await prisma.session.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.hotel.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  async function seedAccount(key: "a" | "b", hotelId: string, userId: string): Promise<void> {
    accounts[key] = (
      await prisma.clientAccount.create({
        data: { name: `${TAG} ${key}`, status: "active" },
        select: { id: true },
      })
    ).id;
    enquiries[key] = (
      await prisma.hotelEnquiry.create({
        data: {
          accountId: accounts[key],
          hotelId,
          requestedByUserId: userId,
          status: "submitted",
          dateFrom: new Date("2027-03-24"),
          dateTo: new Date("2027-03-26"),
          guestEstimate: 120,
          submittedAt: new Date(),
        },
        select: { id: true },
      })
    ).id;
  }

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    const destination = await prisma.destination.create({
      data: { name: `${TAG} Jaipur`, slug: `${PREFIX}-jaipur`, country: "India", status: "active" },
      select: { id: true },
    });
    const hotel = await prisma.hotel.create({
      data: {
        destinationId: destination.id,
        name: `${TAG} Rose Fort`,
        slug: `${PREFIX}-rose-fort`,
        descriptionClient: "A synthetic test hotel.",
        status: "active",
      },
      select: { id: true },
    });
    const client = await prisma.user.create({
      data: {
        userType: "client",
        name: `${TAG} client`,
        email: `${PREFIX}-client@example.com`,
        status: "active",
        identitySubject: clientSubject,
      },
      select: { id: true },
    });
    await seedAccount("a", hotel.id, client.id);
    await seedAccount("b", hotel.id, client.id);
    // The client belongs to account A, with a live discovery subscription so its list is open.
    await prisma.accountContact.create({
      data: { accountId: accounts.a, name: `${TAG} client`, relation: "bride", userId: client.id },
    });
    const plan = await prisma.plan.findUniqueOrThrow({ where: { planKey: "discovery" } });
    await prisma.subscription.create({
      data: {
        accountId: accounts.a,
        planId: plan.id,
        status: "active",
        startsAt: new Date(Date.now() - DAY_MS),
        endsAt: new Date(Date.now() + 30 * DAY_MS),
      },
    });
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("lists only the named account's enquiries on the staff queue", async () => {
    for (const key of ["a", "b"] as const) {
      const res = await http()
        .get(`/consultancy-admin/enquiries?accountId=${accounts[key]}`)
        .set("authorization", await as("local:sm"))
        .expect(200);
      expect(res.body.data.items.map((e: { id: string }) => e.id)).toEqual([enquiries[key]]);
    }
  });

  it("cannot widen a client's own list to another account", async () => {
    const res = await http()
      .get(`/consultancy/enquiries?accountId=${accounts.b}`)
      .set("authorization", await as(clientSubject))
      .expect(200);
    expect(res.body.data.items.map((e: { id: string }) => e.id)).toEqual([enquiries.a]);
  });

  it("rejects a malformed account id at the edge (400)", async () => {
    await http()
      .get("/consultancy-admin/enquiries?accountId=not-a-uuid")
      .set("authorization", await as("local:sm"))
      .expect(400);
  });
});
