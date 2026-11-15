import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const TAG = "E2E-Assign";
const PREFIX = "e2e-assign";

// The seeded staff (prisma/seed.ts SEED; importing it would run the seed again).
const SEED = {
  superAdmin: { email: "admin@example.com", name: "Asha Admin", subject: "local:admin" },
  projectManager: { name: "Priya Manager" },
  sales: { name: "Sameer Sales" },
  hotelTeam: { email: "hotel@example.com", name: "Hema Hotels", subject: "local:ht" },
  finance: { email: "finance@example.com", name: "Farah Finance", subject: "local:fa" },
  disabled: { name: "Dev Disabled" },
} as const;

/**
 * Who holds a hotel enquiry, over HTTP: the owner picker's list (the Super Admin and the hotel team, not
 * a project manager, Sales or Finance), the server refusing an owner who cannot work the enquiry, the
 * holder's name on the queue, and the queue's Mine / Unassigned filters with their pipeline counts. The
 * enquiries are written straight to the database; the reads and writes go through the API.
 */
describe("Hotel enquiry owner (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let mint: (subject: string) => Promise<string>;
  let hotelId: string;
  let enquiryId: string;
  let closedId: string;
  let hemaId: string;
  let ashaId: string;
  let farahId: string;
  let clientUserId: string;

  const http = () => request(app.getHttpServer());
  const as = async (subject: string) => `Bearer ${await mint(subject)}`;
  const userId = async (email: string) =>
    (await prisma.user.findFirstOrThrow({ where: { email }, select: { id: true } })).id;

  async function removeFixtures(): Promise<void> {
    const accounts = await prisma.clientAccount.findMany({
      where: { name: { startsWith: TAG } },
      select: { id: true },
    });
    const accountIds = accounts.map((account) => account.id);
    const enquiries = await prisma.hotelEnquiry.findMany({
      where: { accountId: { in: accountIds } },
      select: { id: true },
    });
    const enquiryIds = enquiries.map((enquiry) => enquiry.id);
    await prisma.hotelEnquiryEvent.deleteMany({ where: { enquiryId: { in: enquiryIds } } });
    await prisma.hotelEnquiry.deleteMany({ where: { id: { in: enquiryIds } } });
    await prisma.clientAccount.deleteMany({ where: { id: { in: accountIds } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.hotel.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  async function makeEnquiry(status: "submitted" | "closed"): Promise<string> {
    const account = await prisma.clientAccount.create({
      data: { name: `${TAG} ${status} family`, status: "prospect" },
      select: { id: true },
    });
    const enquiry = await prisma.hotelEnquiry.create({
      data: {
        accountId: account.id,
        hotelId,
        requestedByUserId: clientUserId,
        status,
        dateFrom: new Date("2027-05-10"),
        dateTo: new Date("2027-05-12"),
        guestEstimate: 90,
        submittedAt: new Date(),
        ...(status === "closed" ? { outcome: "declined" as const, closedAt: new Date() } : {}),
      },
      select: { id: true },
    });
    return enquiry.id;
  }

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    hemaId = await userId(SEED.hotelTeam.email);
    ashaId = await userId(SEED.superAdmin.email);
    farahId = await userId(SEED.finance.email);
    const destination = await prisma.destination.create({
      data: { name: `${TAG} Goa`, slug: `${PREFIX}-goa`, country: "India", status: "active" },
      select: { id: true },
    });
    hotelId = (
      await prisma.hotel.create({
        data: {
          destinationId: destination.id,
          name: `${TAG} Sands`,
          slug: `${PREFIX}-sands`,
          descriptionClient: "A synthetic test hotel.",
          status: "active",
        },
        select: { id: true },
      })
    ).id;
    clientUserId = (
      await prisma.user.create({
        data: { userType: "client", name: `${TAG} client`, email: `${PREFIX}@example.com` },
        select: { id: true },
      })
    ).id;
    enquiryId = await makeEnquiry("submitted");
    closedId = await makeEnquiry("closed");
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("lists who can hold an enquiry: the Super Admin and the hotel team only", async () => {
    const res = await http()
      .get("/consultancy-admin/enquiries/assignees")
      .set("authorization", await as(SEED.hotelTeam.subject))
      .expect(200);
    const names = res.body.data.map((person: { name: string }) => person.name);
    expect(names).toEqual(expect.arrayContaining([SEED.superAdmin.name, SEED.hotelTeam.name]));
    for (const outsider of [SEED.projectManager, SEED.sales, SEED.finance, SEED.disabled]) {
      expect(names).not.toContain(outsider.name);
    }
    expect(Object.keys(res.body.data[0] ?? {}).sort()).toEqual(["id", "name"]);
  });

  it("keeps the list to those who may reassign: Finance reads enquiries but is refused it", async () => {
    await http()
      .get("/consultancy-admin/enquiries/assignees")
      .set("authorization", await as(SEED.finance.subject))
      .expect(403);
  });

  it("refuses an owner who cannot work the enquiry, and leaves it unassigned", async () => {
    for (const assignedUserId of [farahId, clientUserId]) {
      const res = await http()
        .patch(`/consultancy-admin/enquiries/${enquiryId}`)
        .set("authorization", await as(SEED.hotelTeam.subject))
        .send({ assignedUserId })
        .expect(400);
      expect(res.body.error.details[0].path).toBe("assignedUserId");
    }
    const row = await prisma.hotelEnquiry.findUniqueOrThrow({ where: { id: enquiryId } });
    expect(row.assignedUserId).toBeNull();
  });

  it("hands the enquiry to the hotel team, names the holder, and audits the change", async () => {
    const res = await http()
      .patch(`/consultancy-admin/enquiries/${enquiryId}`)
      .set("authorization", await as(SEED.superAdmin.subject))
      .send({ assignedUserId: hemaId })
      .expect(200);
    expect(res.body.data).toMatchObject({
      assignedUserId: hemaId,
      assignedUserName: SEED.hotelTeam.name,
    });
    const queue = await http()
      .get(`/consultancy-admin/enquiries?hotelId=${hotelId}`)
      .set("authorization", await as(SEED.hotelTeam.subject))
      .expect(200);
    const held = queue.body.data.items.find((e: { id: string }) => e.id === enquiryId);
    expect(held).toMatchObject({ assignedUserName: SEED.hotelTeam.name });
    const audit = await prisma.auditEvent.findFirst({
      where: { entityType: "hotel_enquiry", entityId: enquiryId, action: "update" },
      orderBy: { occurredAt: "desc" },
    });
    expect(audit?.actorUserId).toBe(ashaId);
  });

  it("filters the queue to the reader's open enquiries, or the open ones nobody holds", async () => {
    const ids = async (subject: string, assignee: string): Promise<string[]> => {
      const res = await http()
        .get(`/consultancy-admin/enquiries?hotelId=${hotelId}&assignee=${assignee}`)
        .set("authorization", await as(subject))
        .expect(200);
      return res.body.data.items.map((e: { id: string }) => e.id);
    };
    expect(await ids(SEED.hotelTeam.subject, "me")).toEqual([enquiryId]);
    expect(await ids(SEED.superAdmin.subject, "me")).toEqual([]);
    // The closed one has no owner either, but it is not open work.
    expect(await ids(SEED.superAdmin.subject, "unassigned")).not.toContain(closedId);
    await http()
      .get("/consultancy-admin/enquiries?assignee=someone")
      .set("authorization", await as(SEED.superAdmin.subject))
      .expect(400);
  });

  it("counts the reader's open enquiries beside the unassigned ones", async () => {
    const pipeline = await http()
      .get("/consultancy-admin/enquiries/pipeline")
      .set("authorization", await as(SEED.hotelTeam.subject))
      .expect(200);
    expect(pipeline.body.data.mineOpen).toBeGreaterThanOrEqual(1);
    expect(typeof pipeline.body.data.unassignedOpen).toBe("number");
  });

  it("clears the owner back to nobody", async () => {
    const res = await http()
      .patch(`/consultancy-admin/enquiries/${enquiryId}`)
      .set("authorization", await as(SEED.hotelTeam.subject))
      .send({ assignedUserId: null })
      .expect(200);
    expect(res.body.data).toMatchObject({ assignedUserId: null, assignedUserName: null });
  });
});
