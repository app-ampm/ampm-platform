import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const TAG = "E2E-Consult";
const PREFIX = "e2e-consult";

/**
 * Module D feature 10.1 end to end: a subscriber opens + tracks an enquiry (CLIENT fields only), the
 * Hotel team (Super Admin here) drives the status machine (403/409/notify), and a demo prospect is
 * routed to Sales — a lead activity, never an enquiry (P-7).
 */
describe("Hotel consultancy enquiries (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let mint: (subject: string) => Promise<string>;
  let planId: string;
  let sourceId: string;
  let saUserId: string;
  let hotelId: string;
  let hotelInactiveId: string;
  let destinationId: string;

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;
  const sa = async () => auth(await mint("local:admin"));

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
    await prisma.hotelEnquiryEvent.deleteMany({ where: { enquiryId: { in: enquiryIds } } });
    await prisma.hotelEnquiry.deleteMany({ where: { id: { in: enquiryIds } } });
    const leads = await prisma.lead.findMany({
      where: { name: { startsWith: TAG } },
      select: { id: true },
    });
    const leadIds = leads.map((l) => l.id);
    await prisma.leadActivity.deleteMany({ where: { leadId: { in: leadIds } } });
    // Clean notices by entityId (enquiry or lead) — the demo owner may be an untagged seeded user.
    await prisma.notification.deleteMany({
      where: { entityId: { in: [...enquiryIds, ...leadIds] } },
    });
    await prisma.subscription.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.payment.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.accountContact.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.clientAccount.deleteMany({ where: { id: { in: accountIds } } });
    await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
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

  /** A client with a prospect account + contact; optionally a demo user tied to an owned lead (P-7). */
  async function provision(
    suffix: string,
    opts: { userType?: "client" | "demo"; demoLead?: boolean } = {},
  ): Promise<{ subject: string; userId: string; accountId: string; leadId: string | null }> {
    let leadId: string | null = null;
    if (opts.demoLead) {
      const lead = await prisma.lead.create({
        data: { sourceId, name: `${TAG} ${suffix} lead`, ownerUserId: saUserId },
        select: { id: true },
      });
      leadId = lead.id;
    }
    const account = await prisma.clientAccount.create({
      data: {
        name: `${TAG} ${suffix}`,
        status: "prospect",
        isDemo: opts.userType === "demo",
        leadId,
      },
      select: { id: true },
    });
    const subject = `local:${PREFIX}-${suffix}`;
    const user = await prisma.user.create({
      data: {
        userType: opts.userType ?? "client",
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
    return { subject, userId: user.id, accountId: account.id, leadId };
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

  const body = (targetHotelId: string = hotelId) => ({
    hotelId: targetHotelId,
    dateFrom: "2027-02-14",
    dateTo: "2027-02-16",
    guestEstimate: 120,
    roomsRequired: 40,
    functionsSummary: "Sangeet and reception",
    notesClient: "Looking for a lakeview venue",
  });

  async function createEnquiry(token: string): Promise<Record<string, unknown>> {
    const res = await http()
      .post("/consultancy/enquiries")
      .set("authorization", auth(token))
      .send(body())
      .expect(201);
    expect(res.body.data.kind).toBe("enquiry");
    return res.body.data.enquiry as Record<string, unknown>;
  }

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    planId = (await prisma.plan.findUniqueOrThrow({ where: { planKey: "discovery" } })).id;
    sourceId = (await prisma.leadSource.findFirstOrThrow({ select: { id: true } })).id;
    saUserId = (await prisma.user.findUniqueOrThrow({ where: { identitySubject: "local:admin" } }))
      .id;
    const destination = await prisma.destination.create({
      data: {
        name: `${TAG} Udaipur`,
        slug: `${PREFIX}-udaipur`,
        country: "India",
        status: "active",
      },
      select: { id: true },
    });
    destinationId = destination.id;
    hotelId = (
      await prisma.hotel.create({
        data: {
          destinationId,
          name: `${TAG} Lake Palace`,
          slug: `${PREFIX}-lake-palace`,
          descriptionClient: "A synthetic test hotel.",
          internalNotes: "internal only",
          status: "active",
        },
        select: { id: true },
      })
    ).id;
    hotelInactiveId = (
      await prisma.hotel.create({
        data: {
          destinationId,
          name: `${TAG} Closed Hotel`,
          slug: `${PREFIX}-closed-hotel`,
          descriptionClient: "A synthetic inactive hotel (never in reach).",
          status: "inactive",
        },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("opens an enquiry for a subscriber, idempotent per hotel, with no internal fields on the wire", async () => {
    const token = await mint((await provision("buyer")).subject);
    await activate(token);

    const enquiry = await createEnquiry(token);
    expect(enquiry.status).toBe("submitted");
    expect(enquiry).not.toHaveProperty("notesInternal");
    expect(enquiry).not.toHaveProperty("accountId");
    expect(enquiry).not.toHaveProperty("assignedUserId");
    expect(enquiry).not.toHaveProperty("serviceAgreementId");
    expect(enquiry).not.toHaveProperty("requestedByUserId");

    // AC-26: a re-submit for the same hotel returns the same enquiry, not a duplicate.
    const again = await createEnquiry(token);
    expect(again.id).toBe(enquiry.id);
  });

  it("keeps internal notes and internal-only events off the client timeline (AC-05.1/.2)", async () => {
    const token = await mint((await provision("privacy")).subject);
    await activate(token);
    const enquiryId = (await createEnquiry(token)).id as string;

    await http()
      .post(`/consultancy-admin/enquiries/${enquiryId}/events`)
      .set("authorization", await sa())
      .send({ eventType: "negotiation_note", summary: "margin 18%", internalOnly: true })
      .expect(201);
    await http()
      .patch(`/consultancy-admin/enquiries/${enquiryId}`)
      .set("authorization", await sa())
      .send({ notesInternal: "hotel net is lower than the quote" })
      .expect(200);

    const staffView = await http()
      .get(`/consultancy-admin/enquiries/${enquiryId}`)
      .set("authorization", await sa())
      .expect(200);
    expect(staffView.body.data.notesInternal).toBe("hotel net is lower than the quote");
    expect(staffView.body.data.events.some((e: { internalOnly: boolean }) => e.internalOnly)).toBe(
      true,
    );

    const clientView = await http()
      .get(`/consultancy/enquiries/${enquiryId}`)
      .set("authorization", auth(token))
      .expect(200);
    expect(clientView.body.data).not.toHaveProperty("notesInternal");
    const types = clientView.body.data.events.map((e: { eventType: string }) => e.eventType);
    expect(types).toContain("submitted");
    expect(types).not.toContain("negotiation_note");

    // AC-05.4: the staff "preview as client" is byte-identical to the client's own detail.
    const preview = await http()
      .get(`/consultancy-admin/enquiries/${enquiryId}/preview`)
      .set("authorization", await sa())
      .expect(200);
    expect(preview.body.data).toEqual(clientView.body.data);
  });

  it("enforces the transition machine over HTTP (403 unlisted, 409 illegal / missing outcome, AC-31.1)", async () => {
    const token = await mint((await provision("machine")).subject);
    await activate(token);
    const enquiryId = (await createEnquiry(token)).id as string;

    // submitted -> awaiting_hotel is HT-only; Super Admin is not a listed mover -> 403.
    await http()
      .patch(`/consultancy-admin/enquiries/${enquiryId}/status`)
      .set("authorization", await sa())
      .send({ status: "awaiting_hotel" })
      .expect(403);
    // submitted -> visit_scheduled is not a defined transition -> 409.
    await http()
      .patch(`/consultancy-admin/enquiries/${enquiryId}/status`)
      .set("authorization", await sa())
      .send({ status: "visit_scheduled" })
      .expect(409);
    // Closing without an outcome -> 409.
    await http()
      .patch(`/consultancy-admin/enquiries/${enquiryId}/status`)
      .set("authorization", await sa())
      .send({ status: "closed" })
      .expect(409);

    // Closing with an outcome succeeds (SA is a listed mover for any -> closed) and notifies the client.
    await http()
      .patch(`/consultancy-admin/enquiries/${enquiryId}/status`)
      .set("authorization", await sa())
      .send({ status: "closed", outcome: "declined" })
      .expect(200);
    const notices = await prisma.notification.count({
      where: { entityType: "hotel_enquiry", entityId: enquiryId },
    });
    expect(notices).toBeGreaterThanOrEqual(1); // AC-05.3
    const after = await http()
      .get(`/consultancy/enquiries/${enquiryId}`)
      .set("authorization", auth(token))
      .expect(200);
    expect(after.body.data.status).toBe("closed");
    expect(after.body.data.outcome).toBe("declined");
  });

  it("isolates enquiries by account and refuses an out-of-reach hotel (404 = absence)", async () => {
    const a = await mint((await provision("iso-a")).subject);
    await activate(a);
    const enquiryId = (await createEnquiry(a)).id as string;

    const b = await mint((await provision("iso-b")).subject);
    await activate(b);
    // A second subscriber cannot see the first's enquiry; an inactive hotel is out of reach (both 404).
    await http()
      .get(`/consultancy/enquiries/${enquiryId}`)
      .set("authorization", auth(b))
      .expect(404);
    await http()
      .post("/consultancy/enquiries")
      .set("authorization", auth(b))
      .send(body(hotelInactiveId))
      .expect(404);
  });

  it("routes a demo prospect to Sales — a lead activity, never an enquiry (P-7, AC-03.4)", async () => {
    const demo = await provision("demo", { userType: "demo", demoLead: true });
    const token = await mint(demo.subject);
    const result = await http()
      .post("/consultancy/enquiries")
      .set("authorization", auth(token))
      .send(body())
      .expect(201);
    expect(result.body.data).toEqual({ kind: "routed_to_sales" });

    const enquiries = await prisma.hotelEnquiry.count({ where: { accountId: demo.accountId } });
    expect(enquiries).toBe(0);
    const activities = await prisma.leadActivity.count({
      where: { leadId: demo.leadId ?? "", activityType: "demo" },
    });
    expect(activities).toBe(1);
    const ownerNotices = await prisma.notification.count({
      where: { recipientId: saUserId, entityType: "lead", entityId: demo.leadId ?? "" },
    });
    expect(ownerNotices).toBe(1); // AC-03.4: the lead owner is notified
  });
});
