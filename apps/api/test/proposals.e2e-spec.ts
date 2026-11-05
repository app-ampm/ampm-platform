import type { NestExpressApplication } from "@nestjs/platform-express";
import { STAFF_ROLES } from "@ampm/policy";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const TAG = "E2E-Prop";
const PREFIX = "e2e-prop";

/**
 * Module D feature 10.4 end to end (AC-05.2 / AC-09): the Hotel team drafts and shares a proposal
 * (advancing the enquiry to client_decision), the client sees the client total + client-visible lines
 * only (the internal total + margin + hidden lines never reach a client route), a shared version is
 * immutable (409 on edit), a revision supersedes it, the client decides, and an expired proposal cannot
 * be accepted. Plus authz: SM reads the proposal without the internal total and cannot create one.
 */
describe("Hotel proposals (e2e)", () => {
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

  const money = (minor: number) => ({ minor, currency: "INR" });
  const body = (over: Record<string, unknown> = {}) => ({
    enquiryId: "",
    validUntil: "2027-01-31",
    clientTotal: money(5000000),
    internalTotal: money(4200000),
    lines: [
      {
        itemType: "venue_rental",
        description: "Lawn",
        quantity: 1,
        unitAmount: money(1000000),
        totalAmount: money(1000000),
        clientVisible: true,
      },
      {
        itemType: "service_charge",
        description: "Internal buffer",
        quantity: 1,
        unitAmount: money(200000),
        totalAmount: money(200000),
        clientVisible: false,
      },
    ],
    ...over,
  });

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
    const proposals = await prisma.hotelProposal.findMany({
      where: { enquiryId: { in: enquiryIds } },
      select: { id: true },
    });
    await prisma.hotelProposalLine.deleteMany({
      where: { proposalId: { in: proposals.map((p) => p.id) } },
    });
    await prisma.hotelProposal.deleteMany({ where: { enquiryId: { in: enquiryIds } } });
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

  /** A subscriber with an enquiry driven to proposal_received (ready for a proposal). */
  async function enquiryAtProposalReceived(
    suffix: string,
  ): Promise<{ token: string; enquiryId: string }> {
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
    const created = await http()
      .post("/consultancy/enquiries")
      .set("authorization", auth(token))
      .send({ hotelId, dateFrom: "2027-02-14", dateTo: "2027-02-16", guestEstimate: 120 })
      .expect(201);
    const enquiryId = created.body.data.enquiry.id as string;
    for (const status of ["awaiting_hotel", "response_received", "proposal_received"]) {
      await http()
        .patch(`/consultancy-admin/enquiries/${enquiryId}/status`)
        .set("authorization", await ht())
        .send({ status })
        .expect(200);
    }
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

  /** HT drafts + shares a proposal for an enquiry; returns the proposal id. */
  async function shareProposal(
    enquiryId: string,
    over: Record<string, unknown> = {},
  ): Promise<string> {
    const created = await http()
      .post("/consultancy-admin/proposals")
      .set("authorization", await ht())
      .send(body({ enquiryId, ...over }))
      .expect(201);
    const id = created.body.data.id as string;
    await http()
      .post(`/consultancy-admin/proposals/${id}/share`)
      .set("authorization", await ht())
      .expect(200);
    return id;
  }

  it("shares a proposal: the client sees client amounts + visible lines only; internal total never on a client route (AC-05.2)", async () => {
    const { token, enquiryId } = await enquiryAtProposalReceived("privacy");
    const proposalId = await shareProposal(enquiryId);

    // The staff view (HT holds read_internal_amount) carries the internal total, margin and both lines.
    const staffView = await http()
      .get(`/consultancy-admin/proposals/${proposalId}`)
      .set("authorization", await ht())
      .expect(200);
    expect(staffView.body.data.internalTotal).toEqual(money(4200000));
    expect(staffView.body.data.margin).toEqual(money(800000)); // 50000 − 42000
    expect(staffView.body.data.lines).toHaveLength(2);
    // Sharing advanced the enquiry to client_decision.
    const enquiry = await http()
      .get(`/consultancy/enquiries/${enquiryId}`)
      .set("authorization", auth(token))
      .expect(200);
    expect(enquiry.body.data.status).toBe("client_decision");

    // The client sees the client total + the one client-visible line only — never the internal total/margin.
    const clientView = await http()
      .get(`/consultancy/proposals/${proposalId}`)
      .set("authorization", auth(token))
      .expect(200);
    expect(clientView.body.data.clientTotal).toEqual(money(5000000));
    expect(clientView.body.data).not.toHaveProperty("internalTotal");
    expect(clientView.body.data).not.toHaveProperty("margin");
    expect(clientView.body.data.lines).toHaveLength(1);
    expect(clientView.body.data.lines[0]).not.toHaveProperty("clientVisible");
  });

  it("locks a shared version (409 on edit), supersedes it on revision, then accepts the new version", async () => {
    const { token, enquiryId } = await enquiryAtProposalReceived("version");
    const v1 = await shareProposal(enquiryId);

    // AC-09: a shared version is immutable.
    await http()
      .patch(`/consultancy-admin/proposals/${v1}`)
      .set("authorization", await ht())
      .send({ clientTotal: money(9000000) })
      .expect(409);

    // Client asks for a revision; HT issues v2 (supersedes v1); client accepts v2.
    await http()
      .post(`/consultancy/proposals/${v1}/decision`)
      .set("authorization", auth(token))
      .send({ decision: "revision_requested" })
      .expect(200);
    const revised = await http()
      .post(`/consultancy-admin/proposals/${v1}/revise`)
      .set("authorization", await ht())
      .expect(201);
    const v2 = revised.body.data.id as string;
    expect(revised.body.data.versionNumber).toBe(2);
    expect(revised.body.data.supersedesProposalId).toBe(v1);
    await http()
      .post(`/consultancy-admin/proposals/${v2}/share`)
      .set("authorization", await ht())
      .expect(200);
    await http()
      .post(`/consultancy/proposals/${v2}/decision`)
      .set("authorization", auth(token))
      .send({ decision: "accepted" })
      .expect(200);

    const v1After = await http()
      .get(`/consultancy-admin/proposals/${v1}`)
      .set("authorization", await ht())
      .expect(200);
    expect(v1After.body.data.status).toBe("superseded");
    const v2After = await http()
      .get(`/consultancy-admin/proposals/${v2}`)
      .set("authorization", await ht())
      .expect(200);
    expect(v2After.body.data.status).toBe("accepted");
  });

  it("lets SM read a proposal without the internal total, and refuses SM a create (authz)", async () => {
    const { enquiryId } = await enquiryAtProposalReceived("authz");
    const proposalId = await shareProposal(enquiryId);

    const smView = await http()
      .get(`/consultancy-admin/proposals/${proposalId}`)
      .set("authorization", await sm())
      .expect(200);
    expect(smView.body.data.clientTotal).toEqual(money(5000000));
    expect(smView.body.data).not.toHaveProperty("internalTotal"); // SM lacks read_internal_amount
    expect(smView.body.data.lines).toHaveLength(2); // but sees all lines (staff view)

    await http()
      .post("/consultancy-admin/proposals")
      .set("authorization", await sm())
      .send(body({ enquiryId }))
      .expect(403);
  });

  // (The single-live-version invariant — a second create is 409 — is covered by the service unit spec.)

  it("refuses the client's acceptance of an expired proposal (409)", async () => {
    const { token, enquiryId } = await enquiryAtProposalReceived("expiry");
    const proposalId = await shareProposal(enquiryId, { validUntil: "2020-01-01" });
    await http()
      .post(`/consultancy/proposals/${proposalId}/decision`)
      .set("authorization", auth(token))
      .send({ decision: "accepted" })
      .expect(409);
    // A revision request is still allowed after expiry (the escape hatch).
    await http()
      .post(`/consultancy/proposals/${proposalId}/decision`)
      .set("authorization", auth(token))
      .send({ decision: "revision_requested" })
      .expect(200);
  });
});
