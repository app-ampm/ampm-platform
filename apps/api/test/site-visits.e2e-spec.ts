import type { NestExpressApplication } from "@nestjs/platform-express";
import { STAFF_ROLES } from "@ampm/policy";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const TAG = "E2E-Visit";
const PREFIX = "e2e-visit";

/**
 * Module D feature 10.3 end to end (AC-05.5): the Hotel team schedules a visit (which advances the
 * enquiry to visit_scheduled), confirms + completes it recording `outcome_internal`, and the client
 * reads date/status and submits their own feedback — with `outcome_internal`/`attendees_text` never on
 * any client route. Plus authz (SM reads, cannot schedule) and account isolation.
 */
describe("Site visits (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let mint: (subject: string) => Promise<string>;
  let planId: string;
  let hotelId: string;
  let htSubject: string;

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;
  const sm = async () => auth(await mint("local:sm"));
  const ht = async () => auth(await mint(htSubject));

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
    await prisma.siteVisit.deleteMany({ where: { enquiryId: { in: enquiryIds } } });
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
  }

  async function provision(suffix: string): Promise<{ subject: string; accountId: string }> {
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
    return { subject, accountId: account.id };
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

  /** A subscriber with an enquiry driven to response_received (ready for a visit). Returns the ids. */
  async function enquiryAtResponseReceived(
    suffix: string,
  ): Promise<{ token: string; enquiryId: string }> {
    const token = await mint((await provision(suffix)).subject);
    await activate(token);
    const created = await http()
      .post("/consultancy/enquiries")
      .set("authorization", auth(token))
      .send({ hotelId, dateFrom: "2027-02-14", dateTo: "2027-02-16", guestEstimate: 120 })
      .expect(201);
    const enquiryId = created.body.data.enquiry.id as string;
    await http()
      .patch(`/consultancy-admin/enquiries/${enquiryId}/status`)
      .set("authorization", await ht())
      .send({ status: "awaiting_hotel" })
      .expect(200);
    await http()
      .patch(`/consultancy-admin/enquiries/${enquiryId}/status`)
      .set("authorization", await ht())
      .send({ status: "response_received" })
      .expect(200);
    return { token, enquiryId };
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
    htSubject = `local:${PREFIX}-ht`;
    const htUser = await prisma.user.create({
      data: {
        userType: "staff",
        name: `${TAG} HT`,
        email: `${PREFIX}-ht@example.com`,
        status: "active",
        identitySubject: htSubject,
      },
      select: { id: true },
    });
    const htRole = await prisma.role.findUniqueOrThrow({ where: { roleKey: STAFF_ROLES.HT.key } });
    await prisma.userRole.create({ data: { userId: htUser.id, roleId: htRole.id } });
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("schedules → completes with outcome_internal → client feedback; internal fields never on a client route", async () => {
    const { token, enquiryId } = await enquiryAtResponseReceived("flow");

    // HT schedules a visit; the staff view carries the internal attendees, and the enquiry advances.
    const scheduled = await http()
      .post("/consultancy-admin/site-visits")
      .set("authorization", await ht())
      .send({
        enquiryId,
        scheduledAt: "2027-02-10T09:30:00.000Z",
        attendeesText: "Bride, groom, HT lead",
      })
      .expect(201);
    const visitId = scheduled.body.data.id as string;
    expect(scheduled.body.data.status).toBe("proposed");
    expect(scheduled.body.data.attendeesText).toBe("Bride, groom, HT lead");
    const enquiryAfter = await http()
      .get(`/consultancy/enquiries/${enquiryId}`)
      .set("authorization", auth(token))
      .expect(200);
    expect(enquiryAfter.body.data.status).toBe("visit_scheduled"); // scheduling advanced the enquiry

    // Confirm, record the internal outcome, then complete.
    await http()
      .patch(`/consultancy-admin/site-visits/${visitId}/status`)
      .set("authorization", await ht())
      .send({ status: "confirmed" })
      .expect(200);
    await http()
      .patch(`/consultancy-admin/site-visits/${visitId}`)
      .set("authorization", await ht())
      .send({ outcomeInternal: "Hotel will hold 40 rooms at a 10% block discount — do not share." })
      .expect(200);
    await http()
      .patch(`/consultancy-admin/site-visits/${visitId}/status`)
      .set("authorization", await ht())
      .send({ status: "completed" })
      .expect(200);

    // The client sees date + status + (no) feedback — never the attendees or the internal outcome.
    const clientList = await http()
      .get(`/consultancy/enquiries/${enquiryId}/visits`)
      .set("authorization", auth(token))
      .expect(200);
    const clientVisit = clientList.body.data.items[0];
    expect(clientVisit.status).toBe("completed");
    expect(clientVisit).not.toHaveProperty("attendeesText");
    expect(clientVisit).not.toHaveProperty("outcomeInternal");
    expect(clientVisit).not.toHaveProperty("createdBy");

    // The client submits feedback on their own visit.
    const feedback = await http()
      .patch(`/consultancy/visits/${visitId}/feedback`)
      .set("authorization", auth(token))
      .send({ clientFeedback: "Loved the lawn for the sangeet." })
      .expect(200);
    expect(feedback.body.data.clientFeedback).toBe("Loved the lawn for the sangeet.");
    expect(feedback.body.data).not.toHaveProperty("outcomeInternal");

    // The staff view still carries the internal fields + the client's feedback.
    const staffView = await http()
      .get(`/consultancy-admin/site-visits/${visitId}`)
      .set("authorization", await ht())
      .expect(200);
    expect(staffView.body.data.outcomeInternal).toContain("do not share");
    expect(staffView.body.data.attendeesText).toBe("Bride, groom, HT lead");
    expect(staffView.body.data.clientFeedback).toBe("Loved the lawn for the sangeet.");
  });

  it("lets SM read the staff list but not schedule a visit (authz)", async () => {
    const { enquiryId } = await enquiryAtResponseReceived("authz");
    await http()
      .post("/consultancy-admin/site-visits")
      .set("authorization", await ht())
      .send({ enquiryId, scheduledAt: "2027-02-11T09:30:00.000Z", attendeesText: null })
      .expect(201);

    await http()
      .get("/consultancy-admin/site-visits")
      .set("authorization", await sm())
      .expect(200);
    await http()
      .post("/consultancy-admin/site-visits")
      .set("authorization", await sm())
      .send({ enquiryId, scheduledAt: "2027-02-12T09:30:00.000Z", attendeesText: null })
      .expect(403);
  });

  it("isolates visits by account — another client can neither read nor feed-back the visit (404)", async () => {
    const a = await enquiryAtResponseReceived("iso-a");
    const scheduled = await http()
      .post("/consultancy-admin/site-visits")
      .set("authorization", await ht())
      .send({
        enquiryId: a.enquiryId,
        scheduledAt: "2027-02-13T09:30:00.000Z",
        attendeesText: null,
      })
      .expect(201);
    const visitId = scheduled.body.data.id as string;

    const b = await enquiryAtResponseReceived("iso-b");
    // B cannot list A's enquiry's visits...
    await http()
      .get(`/consultancy/enquiries/${a.enquiryId}/visits`)
      .set("authorization", auth(b.token))
      .expect(404);
    // ...nor submit feedback on A's visit (the write path scopes through the enquiry too).
    await http()
      .patch(`/consultancy/visits/${visitId}/feedback`)
      .set("authorization", auth(b.token))
      .send({ clientFeedback: "I should not be able to write this." })
      .expect(404);
    // A's own client can.
    await http()
      .patch(`/consultancy/visits/${visitId}/feedback`)
      .set("authorization", auth(a.token))
      .send({ clientFeedback: "Our visit was lovely." })
      .expect(200);
  });
});
