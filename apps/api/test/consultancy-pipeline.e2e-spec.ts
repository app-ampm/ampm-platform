import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const TAG = "E2E-Pipeline";
const PREFIX = "e2e-pipeline";

/**
 * The staff queue's tracking over HTTP: each enquiry names its client account and hotel and carries its
 * newest proposal version, the queue filters by pipeline stage, and the pipeline endpoint counts every
 * stage. The records are written straight to the database (the client's request flow is covered by
 * consultancy-enquiries.e2e-spec); the reads go through the API as the Super Admin.
 */
describe("Hotel enquiry pipeline (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let mint: (subject: string) => Promise<string>;
  let enquiryId: string;
  let hotelId: string;

  const http = () => request(app.getHttpServer());
  const sa = async () => `Bearer ${await mint("local:admin")}`;

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
    await prisma.hotelProposal.deleteMany({ where: { enquiryId: { in: enquiryIds } } });
    await prisma.hotelEnquiry.deleteMany({ where: { id: { in: enquiryIds } } });
    await prisma.clientAccount.deleteMany({ where: { id: { in: accountIds } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.hotel.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    const destination = await prisma.destination.create({
      data: { name: `${TAG} Jaipur`, slug: `${PREFIX}-jaipur`, country: "India", status: "active" },
      select: { id: true },
    });
    hotelId = (
      await prisma.hotel.create({
        data: {
          destinationId: destination.id,
          name: `${TAG} Rose Fort`,
          slug: `${PREFIX}-rose-fort`,
          descriptionClient: "A synthetic test hotel.",
          status: "active",
        },
        select: { id: true },
      })
    ).id;
    const account = await prisma.clientAccount.create({
      data: { name: `${TAG} Kapoor family`, status: "prospect" },
      select: { id: true },
    });
    const user = await prisma.user.create({
      data: { userType: "client", name: `${TAG} client`, email: `${PREFIX}@example.com` },
      select: { id: true },
    });
    enquiryId = (
      await prisma.hotelEnquiry.create({
        data: {
          accountId: account.id,
          hotelId,
          requestedByUserId: user.id,
          status: "proposal_received",
          dateFrom: new Date("2027-03-24"),
          dateTo: new Date("2027-03-26"),
          guestEstimate: 120,
          submittedAt: new Date(),
        },
        select: { id: true },
      })
    ).id;
    for (const [versionNumber, status] of [
      [1, "superseded"],
      [2, "draft"],
    ] as const) {
      await prisma.hotelProposal.create({
        data: {
          enquiryId,
          hotelId,
          versionNumber,
          status,
          clientTotalAmount: "1850000",
          internalTotalAmount: "1700000",
        },
      });
    }
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("names the client and the hotel and tags the newest proposal, on the queue and the detail", async () => {
    const expected = {
      accountName: `${TAG} Kapoor family`,
      hotelName: `${TAG} Rose Fort`,
      latestProposal: { versionNumber: 2, status: "draft" },
    };
    const detail = await http()
      .get(`/consultancy-admin/enquiries/${enquiryId}`)
      .set("authorization", await sa())
      .expect(200);
    expect(detail.body.data).toMatchObject(expected);

    const queue = await http()
      .get(`/consultancy-admin/enquiries?hotelId=${hotelId}`)
      .set("authorization", await sa())
      .expect(200);
    expect(queue.body.data.items).toHaveLength(1);
    expect(queue.body.data.items[0]).toMatchObject(expected);
  });

  it("filters the queue by pipeline stage", async () => {
    const inStage = await http()
      .get(`/consultancy-admin/enquiries?stage=proposal&hotelId=${hotelId}`)
      .set("authorization", await sa())
      .expect(200);
    expect(inStage.body.data.items.map((e: { id: string }) => e.id)).toEqual([enquiryId]);
    const elsewhere = await http()
      .get(`/consultancy-admin/enquiries?stage=new&hotelId=${hotelId}`)
      .set("authorization", await sa())
      .expect(200);
    expect(elsewhere.body.data.items).toEqual([]);
    await http()
      .get("/consultancy-admin/enquiries?stage=nowhere")
      .set("authorization", await sa())
      .expect(400);
  });

  it("counts every stage, and the open enquiries nobody holds", async () => {
    const pipeline = await http()
      .get("/consultancy-admin/enquiries/pipeline")
      .set("authorization", await sa())
      .expect(200);
    const { stages, unassignedOpen } = pipeline.body.data;
    expect(Object.keys(stages).sort()).toEqual(
      ["client_decision", "closed", "confirmed", "new", "proposal", "with_hotel"].sort(),
    );
    expect(stages.proposal).toBeGreaterThanOrEqual(1);
    expect(unassignedOpen).toBeGreaterThanOrEqual(1);
  });

  it("refuses the counts to a caller who is not signed in", async () => {
    await http().get("/consultancy-admin/enquiries/pipeline").expect(401);
  });
});
