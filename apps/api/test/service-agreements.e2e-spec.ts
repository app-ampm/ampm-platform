import type { NestExpressApplication } from "@nestjs/platform-express";
import { STAFF_ROLES } from "@ampm/policy";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const TAG = "E2E-Agree";
const PREFIX = "e2e-agree";

/**
 * Module B/D feature 10.2 end to end: the chargeable-services gate (AC-05.7, R8) and the agreement
 * lifecycle. A subscriber's enquiry cannot move into negotiation (a paid service) until Sales has an
 * active service agreement for it — created, sent, accepted by the client, activated. Separately, an
 * active hotel-assistance agreement grants the `hotel_assistance` entitlement on its own (the cache is
 * busted on activation). The client only ever sees CLIENT fields of the agreement.
 */
describe("Service agreements and the chargeable gate (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let mint: (subject: string) => Promise<string>;
  let planId: string;
  let negotiationTypeId: string;
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
    await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.notification.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.hotel.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  async function provision(
    suffix: string,
  ): Promise<{ subject: string; userId: string; accountId: string }> {
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
    return { subject, userId: user.id, accountId: account.id };
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

  /** Draft → sent → (client accept) → active, driven by Sales (SM) and the client. Returns the id. */
  async function sellAndActivate(accountId: string, clientToken: string, enquiryId: string | null) {
    const created = await http()
      .post("/crm/service-agreements")
      .set("authorization", await sm())
      .send(agreementBody(accountId, enquiryId, "Negotiate rates."))
      .expect(201);
    const agreementId = created.body.data.id as string;
    expect(created.body.data.accountId).toBe(accountId); // staff view carries internal fields
    await http()
      .patch(`/crm/service-agreements/${agreementId}/status`)
      .set("authorization", await sm())
      .send({ status: "sent" })
      .expect(200);

    // The client sees only CLIENT fields of the agreement they were sent, and accepts it.
    const clientView = await http()
      .get(`/crm/portal/service-agreements/${agreementId}`)
      .set("authorization", auth(clientToken))
      .expect(200);
    for (const internal of [
      "accountId",
      "serviceTypeId",
      "acceptedByUserId",
      "documentId",
      "createdBy",
    ]) {
      expect(clientView.body.data).not.toHaveProperty(internal);
    }
    expect(clientView.body.data.fee).toEqual({ minor: 2500000, currency: "INR" });
    await http()
      .post(`/crm/portal/service-agreements/${agreementId}/accept`)
      .set("authorization", auth(clientToken))
      .send({ termsAccepted: true })
      .expect(200);

    await http()
      .patch(`/crm/service-agreements/${agreementId}/status`)
      .set("authorization", await sm())
      .send({ status: "active" })
      .expect(200);
    return agreementId;
  }

  async function driveTo(enquiryId: string, status: string): Promise<request.Response> {
    return http()
      .patch(`/consultancy-admin/enquiries/${enquiryId}/status`)
      .set("authorization", await ht())
      .send({ status });
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
    // A Hotel-team user drives the enquiry pipeline (the seed ships no HT account).
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

  it("blocks negotiation until an active agreement exists, then allows it (AC-05.7, R8)", async () => {
    const client = await provision("gate");
    const token = await mint(client.subject);
    await activateSubscription(token);

    const enquiry = await http()
      .post("/consultancy/enquiries")
      .set("authorization", auth(token))
      .send({ hotelId, dateFrom: "2027-02-14", dateTo: "2027-02-16", guestEstimate: 120 })
      .expect(201);
    const enquiryId = enquiry.body.data.enquiry.id as string;

    // Availability checking is free: HT advances the pipeline to response_received.
    await driveTo(enquiryId, "awaiting_hotel").then((r) => expect(r.status).toBe(200));
    await driveTo(enquiryId, "response_received").then((r) => expect(r.status).toBe(200));

    // Negotiation is a chargeable service: without an active agreement the move is a 409 (AC-05.7).
    await driveTo(enquiryId, "negotiating").then((r) => expect(r.status).toBe(409));

    // Sell + activate the agreement for this enquiry, then the same move succeeds.
    await sellAndActivate(client.accountId, token, enquiryId);
    await driveTo(enquiryId, "negotiating").then((r) => expect(r.status).toBe(200));
  });

  it("grants hotel_assistance from an active agreement alone (entitlement wiring + cache bust)", async () => {
    const client = await provision("ent");
    const token = await mint(client.subject);

    // No subscription and no agreement yet: the hotel-assistance pipeline is absence (404).
    await http().get("/consultancy/enquiries").set("authorization", auth(token)).expect(404);

    // An active agreement (no subscription) grants the module; activation busts the entitlement cache.
    await sellAndActivate(client.accountId, token, null);
    await http().get("/consultancy/enquiries").set("authorization", auth(token)).expect(200);
  });

  it("refuses to accept an agreement that is not the caller's own (404 = absence)", async () => {
    const owner = await provision("own");
    const ownerToken = await mint(owner.subject);
    const agreementId = await sellInDraftSent(owner.accountId);

    const stranger = await provision("stranger");
    const strangerToken = await mint(stranger.subject);
    await http()
      .post(`/crm/portal/service-agreements/${agreementId}/accept`)
      .set("authorization", auth(strangerToken))
      .send({ termsAccepted: true })
      .expect(404);
    // The owner can still accept it.
    await http()
      .post(`/crm/portal/service-agreements/${agreementId}/accept`)
      .set("authorization", auth(ownerToken))
      .send({ termsAccepted: true })
      .expect(200);
  });

  it("ignores a client-supplied ?accountId and never returns another account's agreements", async () => {
    const a = await provision("scope-a");
    const aToken = await mint(a.subject);
    const b = await provision("scope-b");
    const bAgreementId = await sellInDraftSent(b.accountId); // B has a (sent, client-visible) agreement

    // A, with their own valid token, tries to widen the scope to B's account.
    const res = await http()
      .get(`/crm/portal/service-agreements?accountId=${b.accountId}`)
      .set("authorization", auth(aToken))
      .expect(200);
    const ids = (res.body.data.items as Array<{ id: string }>).map((i) => i.id);
    expect(ids).not.toContain(bAgreementId); // the server-resolved account scope is not overridable
  });

  it("hides draft agreements from the client portal (denial = absence)", async () => {
    const c = await provision("draft");
    const token = await mint(c.subject);
    const draftId = await createDraft(c.accountId); // created, never sent

    const list = await http()
      .get("/crm/portal/service-agreements?status=draft")
      .set("authorization", auth(token))
      .expect(200);
    expect(list.body.data.items).toHaveLength(0);
    await http()
      .get(`/crm/portal/service-agreements/${draftId}`)
      .set("authorization", auth(token))
      .expect(404);
  });

  it("refuses an agreement whose enquiry belongs to another account, and allows the matched pair", async () => {
    const a = await provision("xacct-a");
    const b = await provision("xacct-b");
    const bToken = await mint(b.subject);
    await activateSubscription(bToken); // B opens the hotel-assistance pipeline and raises an enquiry.
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

    // A points at B's enquiry: rejected (never stored), so the AC-05.7 gate (keyed on the enquiry) cannot
    // advance B's enquiry on A's agreement and B's enquiry id cannot leak into A's CLIENT view. B's own
    // matched account+enquiry pair is accepted.
    await draftFor(a.accountId).expect(400);
    await draftFor(b.accountId).expect(201);
  });

  /** The draft-agreement body Sales posts; the only differences are the account, the enquiry and the scope. */
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

  /** Create a draft agreement (never sent), returning its id. */
  async function createDraft(accountId: string): Promise<string> {
    const created = await http()
      .post("/crm/service-agreements")
      .set("authorization", await sm())
      .send(agreementBody(accountId, null, "Draft — internal, not yet sent."))
      .expect(201);
    return created.body.data.id as string;
  }

  /** Create + send an agreement (no accept), returning its id — for the isolation test. */
  async function sellInDraftSent(accountId: string): Promise<string> {
    const agreementId = await createDraft(accountId);
    await http()
      .patch(`/crm/service-agreements/${agreementId}/status`)
      .set("authorization", await sm())
      .send({ status: "sent" })
      .expect(200);
    return agreementId;
  }
});
