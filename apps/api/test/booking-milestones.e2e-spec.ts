import type { NestExpressApplication } from "@nestjs/platform-express";
import { STAFF_ROLES } from "@ampm/policy";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ConfigService } from "../src/modules/admin/config/config.service.js";
import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const TAG = "E2E-Milestone";
const PREFIX = "e2e-milestone";
const W14_KEY = "consultancy.milestone_amounts_visible";

/**
 * Module D feature 10.5 end to end: the AC-05.6 confirmed-guard (409 naming each missing item, then
 * success), the W-14 client amount gate (absent by default, present once enabled; staff always see it),
 * authz (SM reads, cannot create; FA updates the amount; `overdue` is not a manual move), and account
 * isolation. The overdue sweep is covered in booking-milestones-sweep.e2e-spec.ts.
 */
describe("Booking milestones (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let mint: (subject: string) => Promise<string>;
  let planId: string;
  let hotelId: string;
  let htSubject: string;
  let faSubject: string;

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;
  const sm = async () => auth(await mint("local:sm"));
  const ht = async () => auth(await mint(htSubject));
  const fa = async () => auth(await mint(faSubject));

  async function removeFixtures(): Promise<void> {
    const accounts = await prisma.clientAccount.findMany({
      where: { name: { startsWith: TAG } },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);
    const enquiries = await prisma.hotelEnquiry.findMany({
      where: { accountId: { in: accountIds } },
      select: { id: true },
    });
    const enquiryIds = enquiries.map((e) => e.id);
    await prisma.bookingMilestone.deleteMany({ where: { enquiryId: { in: enquiryIds } } });
    await prisma.hotelEnquiryEvent.deleteMany({ where: { enquiryId: { in: enquiryIds } } });
    await prisma.hotelEnquiry.deleteMany({ where: { id: { in: enquiryIds } } });
    await prisma.notification.deleteMany({ where: { entityId: { in: enquiryIds } } });
    await prisma.subscription.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.payment.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.accountContact.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.clientAccount.deleteMany({ where: { id: { in: accountIds } } });
    const users = await prisma.user.findMany({
      where: { email: { startsWith: PREFIX } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.notification.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.hotel.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.configuration.deleteMany({ where: { configKey: W14_KEY } });
    app.get(ConfigService).invalidate(W14_KEY);
  }

  async function staffUser(suffix: string, roleKey: string): Promise<string> {
    const subject = `local:${PREFIX}-${suffix}`;
    const user = await prisma.user.create({
      data: {
        userType: "staff",
        name: `${TAG} ${suffix}`,
        email: `${PREFIX}-${suffix}@example.com`,
        status: "active",
        identitySubject: subject,
      },
      select: { id: true },
    });
    const role = await prisma.role.findUniqueOrThrow({ where: { roleKey } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    return subject;
  }

  async function activate(token: string): Promise<void> {
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
  }

  /** A subscriber with a fresh enquiry on the test hotel. Returns the client token and the enquiry id. */
  async function createEnquiry(suffix: string): Promise<{ token: string; enquiryId: string }> {
    const account = await prisma.clientAccount.create({
      data: { name: `${TAG} ${suffix}`, status: "prospect" },
      select: { id: true },
    });
    const subject = `local:${PREFIX}-${suffix}`;
    const user = await prisma.user.create({
      data: {
        userType: "client",
        name: `${TAG} ${suffix}`,
        email: `${PREFIX}-${suffix}@example.com`,
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
    await activate(token);
    const created = await http()
      .post("/consultancy/enquiries")
      .set("authorization", auth(token))
      .send({ hotelId, dateFrom: "2027-02-14", dateTo: "2027-02-16", guestEstimate: 120 })
      .expect(201);
    return { token, enquiryId: created.body.data.enquiry.id as string };
  }

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    planId = (await prisma.plan.findUniqueOrThrow({ where: { planKey: "discovery" } })).id;
    const destination = await prisma.destination.create({
      data: {
        name: `${TAG} Udaipur`,
        slug: `${PREFIX}-udaipur`,
        country: "India",
        status: "active",
      },
      select: { id: true },
    });
    hotelId = (
      await prisma.hotel.create({
        data: {
          destinationId: destination.id,
          name: `${TAG} Lake Palace`,
          slug: `${PREFIX}-lake-palace`,
          descriptionClient: "A synthetic test hotel.",
          status: "active",
        },
        select: { id: true },
      })
    ).id;
    htSubject = await staffUser("ht", STAFF_ROLES.HT.key);
    faSubject = await staffUser("fa", STAFF_ROLES.FA.key);
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("confirmed needs a done 'confirmed' milestone AND a signed contract — 409 naming each (AC-05.6)", async () => {
    const { enquiryId } = await createEnquiry("guard");
    await prisma.hotelEnquiry.update({
      where: { id: enquiryId },
      data: { status: "client_decision" },
    });

    // No milestones → 409 naming the confirmed milestone.
    const noMilestone = await http()
      .patch(`/consultancy-admin/enquiries/${enquiryId}/status`)
      .set("authorization", await ht())
      .send({ status: "confirmed", outcome: null, summary: null })
      .expect(409);
    expect(noMilestone.body.error.message).toMatch(/milestone/i);

    // A done `confirmed` milestone, but no signed contract → 409 naming the contract.
    const confirmedMilestone = await http()
      .post("/consultancy-admin/booking-milestones")
      .set("authorization", await ht())
      .send({ enquiryId, milestoneType: "confirmed" })
      .expect(201);
    await http()
      .patch(`/consultancy-admin/booking-milestones/${confirmedMilestone.body.data.id}/status`)
      .set("authorization", await ht())
      .send({ status: "done" })
      .expect(200);
    const noContract = await http()
      .patch(`/consultancy-admin/enquiries/${enquiryId}/status`)
      .set("authorization", await ht())
      .send({ status: "confirmed", outcome: null, summary: null })
      .expect(409);
    expect(noContract.body.error.message).toMatch(/contract/i);

    // A done `contract_signed` milestone carrying an uploaded document → confirm succeeds.
    const contract = await http()
      .post("/consultancy-admin/booking-milestones")
      .set("authorization", await ht())
      .send({
        enquiryId,
        milestoneType: "contract_signed",
        documentId: "00000000-0000-7000-8000-0000000000dd",
      })
      .expect(201);
    await http()
      .patch(`/consultancy-admin/booking-milestones/${contract.body.data.id}/status`)
      .set("authorization", await ht())
      .send({ status: "done" })
      .expect(200);
    const confirmed = await http()
      .patch(`/consultancy-admin/enquiries/${enquiryId}/status`)
      .set("authorization", await ht())
      .send({ status: "confirmed", outcome: null, summary: null })
      .expect(200);
    expect(confirmed.body.data.status).toBe("confirmed");
  });

  it("hides the milestone amount from the client until W-14 is on; staff always see it", async () => {
    const { token, enquiryId } = await createEnquiry("w14");
    const created = await http()
      .post("/consultancy-admin/booking-milestones")
      .set("authorization", await ht())
      .send({
        enquiryId,
        milestoneType: "advance_paid",
        amount: { minor: 5_000_000, currency: "INR" },
      })
      .expect(201);
    const milestoneId = created.body.data.id as string;
    expect(created.body.data.amount.minor).toBe(5_000_000); // staff see the amount

    // Default: the client view omits the amount entirely (absent, not null).
    const hidden = await http()
      .get(`/consultancy/enquiries/${enquiryId}/milestones`)
      .set("authorization", auth(token))
      .expect(200);
    const clientItem = hidden.body.data.items[0];
    expect(clientItem.milestoneType).toBe("advance_paid");
    expect(clientItem).not.toHaveProperty("amount");
    expect(clientItem).not.toHaveProperty("contractId");
    expect(clientItem).not.toHaveProperty("createdBy");

    // Enable W-14; the client now sees the amount.
    await prisma.configuration.upsert({
      where: { configKey: W14_KEY },
      create: { configKey: W14_KEY, valueJson: { milestoneAmountsVisible: true } },
      update: { valueJson: { milestoneAmountsVisible: true } },
    });
    app.get(ConfigService).invalidate(W14_KEY);
    const shown = await http()
      .get(`/consultancy/milestones/${milestoneId}`)
      .set("authorization", auth(token))
      .expect(200);
    expect(shown.body.data.amount.minor).toBe(5_000_000);
  });

  it("lets SM read the staff list but not create; FA updates the amount; overdue is not manual (authz)", async () => {
    const { enquiryId } = await createEnquiry("authz");
    const created = await http()
      .post("/consultancy-admin/booking-milestones")
      .set("authorization", await ht())
      .send({ enquiryId, milestoneType: "hold_placed" })
      .expect(201);
    const milestoneId = created.body.data.id as string;

    await http()
      .get("/consultancy-admin/booking-milestones")
      .set("authorization", await sm())
      .expect(200);
    await http()
      .post("/consultancy-admin/booking-milestones")
      .set("authorization", await sm())
      .send({ enquiryId, milestoneType: "balance_due" })
      .expect(403);

    // `overdue` is a sweep-only state: a manual status move to it is an undefined transition (409).
    await http()
      .patch(`/consultancy-admin/booking-milestones/${milestoneId}/status`)
      .set("authorization", await ht())
      .send({ status: "overdue" })
      .expect(409);

    const faUpdate = await http()
      .patch(`/consultancy-admin/booking-milestones/${milestoneId}`)
      .set("authorization", await fa())
      .send({ amount: { minor: 2_500_000, currency: "INR" } })
      .expect(200);
    expect(faUpdate.body.data.amount.minor).toBe(2_500_000);
  });

  it("isolates milestones by account — another client cannot read the milestone (404)", async () => {
    const a = await createEnquiry("iso-a");
    const created = await http()
      .post("/consultancy-admin/booking-milestones")
      .set("authorization", await ht())
      .send({ enquiryId: a.enquiryId, milestoneType: "hold_placed" })
      .expect(201);
    const milestoneId = created.body.data.id as string;

    const b = await createEnquiry("iso-b");
    await http()
      .get(`/consultancy/enquiries/${a.enquiryId}/milestones`)
      .set("authorization", auth(b.token))
      .expect(404);
    await http()
      .get(`/consultancy/milestones/${milestoneId}`)
      .set("authorization", auth(b.token))
      .expect(404);
  });
});
