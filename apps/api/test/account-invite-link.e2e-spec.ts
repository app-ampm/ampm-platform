import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const TAG = "E2E-InviteLink";
const EMAIL_PREFIX = "e2e-invite-link";

/**
 * A test build's stand-in for the invitation email: Sales converts a lead, gets the primary contact's
 * activation link from the client hub, and the client opens it — the dev invite sign-in, then
 * activation — and is signed in as that client. Each link retires the one before it; an activated
 * contact or one with no login gets no link; a read-only role is refused. The production 404 is the
 * gate's unit test (dev-gate.spec.ts), since this suite runs the test build.
 */
describe("A contact's invite link on a test build (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;
  let accountId: string;
  let primaryContactId: string;

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
    // The client this suite activates has signed in, so it holds a session.
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.notification.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.accountContact.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.clientAccount.deleteMany({ where: { id: { in: accountIds } } });
    await prisma.leadActivity.deleteMany({ where: { leadId: { in: leadIds } } });
    await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  const http = () => request(app.getHttpServer());
  const as = async (subject: string) => `Bearer ${await mint(subject)}`;
  const linkUrl = (contactId: string) =>
    `/crm/accounts/${accountId}/contacts/${contactId}/invite-link`;
  const tokenOf = (activationUrl: string) => new URL(activationUrl).searchParams.get("token") ?? "";

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    const lead = await http()
      .post("/crm/leads")
      .set("authorization", await as("local:sm"))
      .send({ name: `${TAG} Mehta`, source: "website", phone: "9876522101" })
      .expect(201);
    const converted = await http()
      .post(`/crm/leads/${lead.body.data.id as string}/convert`)
      .set("authorization", await as("local:sm"))
      .send({ primaryContact: { name: "Asha Mehta", email: `${EMAIL_PREFIX}-asha@example.com` } })
      .expect(201);
    accountId = converted.body.data.account.id as string;
    primaryContactId = converted.body.data.primaryContact.id as string;
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("refuses a read-only role (403) and a contact with no login (409)", async () => {
    await http()
      .post(linkUrl(primaryContactId))
      .set("authorization", await as("local:ht"))
      .expect(403);
    const added = await http()
      .post(`/crm/accounts/${accountId}/contacts`)
      .set("authorization", await as("local:sm"))
      .send({ name: `${TAG} Ravi`, relation: "brother" })
      .expect(201);
    await http()
      .post(linkUrl(added.body.data.contact.id as string))
      .set("authorization", await as("local:sm"))
      .expect(409);
  });

  it("treats a missing account or another account's contact as missing (404)", async () => {
    await http()
      .post(
        `/crm/accounts/018f0000-0000-7000-8000-00000000dead/contacts/${primaryContactId}/invite-link`,
      )
      .set("authorization", await as("local:sm"))
      .expect(404);
    const other = await prisma.clientAccount.create({
      data: { name: `${TAG} Other`, status: "prospect" },
      select: { id: true },
    });
    await http()
      .post(`/crm/accounts/${other.id}/contacts/${primaryContactId}/invite-link`)
      .set("authorization", await as("local:sm"))
      .expect(404);
  });

  it("gives no link on a demo or a suspended account (409)", async () => {
    const demo = await prisma.clientAccount.findFirstOrThrow({
      where: { isDemo: true, deletedAt: null },
      select: { id: true, contacts: { select: { id: true }, take: 1 } },
    });
    const suspended = await prisma.clientAccount.create({
      data: { name: `${TAG} Suspended`, status: "suspended" },
      select: { id: true },
    });
    for (const [account, contact] of [
      [demo.id, demo.contacts[0]?.id ?? primaryContactId],
      [suspended.id, primaryContactId],
    ]) {
      await http()
        .post(`/crm/accounts/${account}/contacts/${contact}/invite-link`)
        .set("authorization", await as("local:sm"))
        .expect(409);
    }
  });

  it("hands Sales a link the client activates with, retiring the earlier one, and audits it", async () => {
    const first = await http()
      .post(linkUrl(primaryContactId))
      .set("authorization", await as("local:sm"))
      .expect(200);
    const second = await http()
      .post(linkUrl(primaryContactId))
      .set("authorization", await as("local:sm"))
      .expect(200);
    const activationUrl = second.body.data.activationUrl as string;
    expect(activationUrl).toMatch(/\/activate\?token=/);

    // Only the newest link works: the earlier one was retired when this one was issued.
    await http()
      .post("/auth/dev-login/invite")
      .send({ token: tokenOf(first.body.data.activationUrl as string) })
      .expect(401);
    const token = tokenOf(activationUrl);
    const signIn = await http().post("/auth/dev-login/invite").send({ token }).expect(200);
    const bearer = `Bearer ${signIn.body.data.accessToken as string}`;
    await http().post("/auth/activate").set("authorization", bearer).send({ token }).expect(200);

    const me = await http().get("/me").set("authorization", bearer).expect(200);
    expect(me.body.data.principal).toMatchObject({
      type: "client",
      status: "active",
      email: `${EMAIL_PREFIX}-asha@example.com`,
    });

    const audits = await prisma.auditEvent.count({
      where: {
        entityType: "account_contact",
        entityId: primaryContactId,
        afterJson: { equals: { inviteLinkIssued: true } },
      },
    });
    expect(audits).toBe(2);

    // An activated contact signs in on their own; there is no link to hand over.
    await http()
      .post(linkUrl(primaryContactId))
      .set("authorization", await as("local:sm"))
      .expect(409);
  });
});
