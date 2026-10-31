import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

/** Convert fixtures use this lead-name prefix and this contact-email prefix, so cleanup is self-contained. */
const TAG = "E2E-Conv";
const EMAIL_PREFIX = "e2e-conv";

/**
 * Lead conversion to a client account end to end (Module B CRM, feature 8.2, AC-01.8): Convert creates
 * a prospect `client_accounts` row with a primary contact and a portal invite, leaves the lead
 * read-only, refuses a second conversion and a closed lead, is denied to a principal without
 * `crm.accounts.create` (denial is absence), audits the conversion (AC-21), and never serialises the
 * RESTRICTED-BANK billing fields to the staff view (AC-12.3).
 */
describe("Lead conversion (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;

  async function removeFixtures(): Promise<void> {
    const leads = await prisma.lead.findMany({
      where: { name: { startsWith: TAG } },
      select: { id: true },
    });
    const leadIds = leads.map((lead) => lead.id);
    const accounts = await prisma.clientAccount.findMany({
      where: { OR: [{ leadId: { in: leadIds } }, { name: { startsWith: TAG } }] },
      select: { id: true },
    });
    const accountIds = accounts.map((account) => account.id);
    const users = await prisma.user.findMany({
      where: { email: { startsWith: EMAIL_PREFIX } },
      select: { id: true },
    });
    const userIds = users.map((user) => user.id);
    await prisma.authToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.notification.deleteMany({
      where: {
        OR: [{ recipientId: { in: userIds } }, { entityType: "lead", entityId: { in: leadIds } }],
      },
    });
    await prisma.accountContact.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.clientAccount.deleteMany({ where: { id: { in: accountIds } } });
    await prisma.leadActivity.deleteMany({ where: { leadId: { in: leadIds } } });
    await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const sm = async () => `Bearer ${await mint("local:sm")}`;

  async function createLead(suffix: string, phone: string): Promise<string> {
    const res = await http()
      .post("/crm/leads")
      .set("authorization", await sm())
      .send({ name: `${TAG} ${suffix}`, source: "website", phone })
      .expect(201);
    return res.body.data.id as string;
  }

  it("converts a lead into a prospect account with a primary contact and a portal invite (AC-01.8)", async () => {
    const leadId = await createLead("Convert", "9876511001");
    const email = `${EMAIL_PREFIX}-convert@example.com`;
    const res = await http()
      .post(`/crm/leads/${leadId}/convert`)
      .set("authorization", await sm())
      .send({
        accountName: `${TAG} Sharma`,
        primaryContact: { name: "Riya Sharma", relation: "bride", email },
      })
      .expect(201);

    const body = res.body.data;
    expect(body.account.status).toBe("prospect");
    expect(body.account.leadId).toBe(leadId);
    expect(body.primaryContact.email).toBe(email);
    expect(body.primaryContact.isDecisionMaker).toBe(true);
    expect(body.inviteQueued).toBe(true);
    // The raw invite token is never echoed to the caller (it lives only in the server-side notice).
    expect(JSON.stringify(body)).not.toContain("activate?token=");

    const accountId: string = body.account.id;
    const userId: string = body.primaryContact.userId;
    const account = await prisma.clientAccount.findUniqueOrThrow({ where: { id: accountId } });
    expect(account.leadId).toBe(leadId);
    expect(account.primaryContactUserId).toBe(userId);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.userType).toBe("client");
    expect(user.status).toBe("invited");
    expect(user.email).toBe(email);

    const token = await prisma.authToken.findFirstOrThrow({ where: { userId, purpose: "invite" } });
    expect(token.usedAt).toBeNull();
    expect(token.tokenHash).not.toContain("activate");

    const notice = await prisma.notification.findFirst({
      where: { recipientId: userId, templateKey: "client.invite" },
    });
    expect(notice).not.toBeNull();

    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.status).toBe("converted");
    expect(lead.convertedAccountId).toBe(accountId);
    expect(lead.convertedAt).not.toBeNull();
  });

  it("makes the converted lead read-only and refuses a second conversion (AC-01.8)", async () => {
    const leadId = await createLead("ReadOnly", "9876511002");
    await http()
      .post(`/crm/leads/${leadId}/convert`)
      .set("authorization", await sm())
      .send({ primaryContact: { email: `${EMAIL_PREFIX}-readonly@example.com` } })
      .expect(201);
    await http()
      .patch(`/crm/leads/${leadId}`)
      .set("authorization", await sm())
      .send({ requirements: "changed" })
      .expect(409);
    await http()
      .post(`/crm/leads/${leadId}/convert`)
      .set("authorization", await sm())
      .send({ primaryContact: { email: `${EMAIL_PREFIX}-readonly-again@example.com` } })
      .expect(409);
    expect(await prisma.clientAccount.count({ where: { leadId } })).toBe(1);
  });

  it("refuses to convert a closed lead (AC-01.8)", async () => {
    const leadId = await createLead("Closed", "9876511003");
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: "closed", closedReason: "lost" },
    });
    await http()
      .post(`/crm/leads/${leadId}/convert`)
      .set("authorization", await sm())
      .send({ primaryContact: { email: `${EMAIL_PREFIX}-closed@example.com` } })
      .expect(409);
  });

  it("denies conversion to a principal without crm.accounts.create — denial is absence (AC-12)", async () => {
    const leadId = await createLead("Denied", "9876511004");
    await http()
      .post(`/crm/leads/${leadId}/convert`)
      .set("authorization", `Bearer ${await mint("local:pm")}`)
      .send({ primaryContact: { email: `${EMAIL_PREFIX}-denied@example.com` } })
      .expect(404);
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.status).not.toBe("converted");
  });

  it("audits the conversion and keeps RESTRICTED-BANK fields out of the staff view (AC-21, AC-12.3)", async () => {
    const leadId = await createLead("Audit", "9876511005");
    const res = await http()
      .post(`/crm/leads/${leadId}/convert`)
      .set("authorization", await sm())
      .send({ primaryContact: { email: `${EMAIL_PREFIX}-audit@example.com` } })
      .expect(201);
    const accountId: string = res.body.data.account.id;

    expect(
      await prisma.auditEvent.count({
        where: { entityType: "client_account", entityId: accountId, action: "create" },
      }),
    ).toBe(1);
    expect(
      await prisma.auditEvent.count({
        where: { entityType: "lead", entityId: leadId, action: "update" },
      }),
    ).toBeGreaterThan(0);

    // Seed restricted fields, then read the account back as staff: internal_notes (RESTRICTED-NOTES) is
    // staff-visible, but the billing fields (RESTRICTED-BANK) never appear in the response (AC-12.3).
    await prisma.clientAccount.update({
      where: { id: accountId },
      data: {
        internalNotes: "handle with care",
        billingName: "SENTINEL-BANK",
        gstin: "22AAAAA0000A1Z5",
      },
    });
    const detail = await http()
      .get(`/crm/accounts/${accountId}`)
      .set("authorization", await sm())
      .expect(200);
    const account = detail.body.data;
    expect(account.internalNotes).toBe("handle with care");
    expect(JSON.stringify(account)).not.toContain("SENTINEL-BANK");
    expect(account).not.toHaveProperty("billingName");
    expect(account).not.toHaveProperty("gstin");
    expect(account.contacts.length).toBeGreaterThan(0);
  });

  it("rejects a malformed list cursor with 400, not a Postgres 500 (review fix)", async () => {
    await http()
      .get("/crm/accounts?cursor=not-a-uuid")
      .set("authorization", await sm())
      .expect(400);
  });
});
