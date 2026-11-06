import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const TAG = "E2E-AgreeOwn";
const PREFIX = "e2e-agree-own";

/**
 * Module B/D feature 10.2 — server-side ownership defence on service-agreement create (D-064). Staff may
 * not pair an agreement's account with another account's hotel enquiry: create() resolves the enquiry and
 * rejects a cross-account reference, so the AC-05.7 gate (keyed on the enquiry) cannot advance a foreign
 * enquiry on this agreement and that enquiry id cannot leak into the wrong account's CLIENT view. (This
 * lives in its own spec because service-agreements.e2e-spec.ts is at the file-length limit.)
 */
describe("Service-agreement create: enquiry ownership (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let mint: (subject: string) => Promise<string>;
  let planId: string;
  let negotiationTypeId: string;
  let hotelId: string;

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;
  const sm = async () => auth(await mint("local:sm"));

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
    await prisma.serviceAgreement.deleteMany({ where: { accountId: { in: accountIds } } });
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

  async function activateSubscription(token: string): Promise<void> {
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

  function agreementBody(accountId: string, hotelEnquiryId: string | null, scopeText: string) {
    return {
      accountId,
      serviceTypeId: negotiationTypeId,
      hotelEnquiryId,
      scopeText,
      fee: { minor: 2500000, currency: "INR" },
      feeStructure: "fixed",
      termsVersion: "v1",
    };
  }

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    planId = (await prisma.plan.findUniqueOrThrow({ where: { planKey: "discovery" } })).id;
    negotiationTypeId = (
      await prisma.serviceType.findUniqueOrThrow({ where: { serviceKey: "negotiation" } })
    ).id;
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
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("rejects an enquiry that belongs to another account, and allows the matched pair", async () => {
    const a = await provision("a");
    const b = await provision("b");
    const bToken = await mint(b.subject);
    await activateSubscription(bToken); // B can open the hotel-assistance pipeline and raise an enquiry.
    const enquiry = await http()
      .post("/consultancy/enquiries")
      .set("authorization", auth(bToken))
      .send({ hotelId, dateFrom: "2027-03-10", dateTo: "2027-03-12", guestEstimate: 80 })
      .expect(201);
    const bEnquiryId = enquiry.body.data.enquiry.id as string;
    const smAuth = await sm();
    const draftFor = (accountId: string) =>
      http()
        .post("/crm/service-agreements")
        .set("authorization", smAuth)
        .send(agreementBody(accountId, bEnquiryId, "Cross-account defence."));

    // A points at B's enquiry: the cross-account reference is rejected and never stored. B's matched pair is OK.
    await draftFor(a.accountId).expect(400);
    await draftFor(b.accountId).expect(201);
  });
});
