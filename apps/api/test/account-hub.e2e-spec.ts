import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

/** Fixtures use this lead/account-name prefix and this email prefix, so cleanup is self-contained. */
const TAG = "E2E-Hub";
const EMAIL_PREFIX = "e2e-hub";

/**
 * The client hub (TW-13) end to end: Sales edits an account's details and keeps its contacts up to date
 * — add, edit, remove, invite to the portal — each audited; a contact with a portal login keeps its
 * sign-in email and cannot be removed; a demo account invites nobody; a read-only role is refused and
 * a role that cannot see accounts gets the same 404 as a missing one (denial is absence).
 */
describe("Client account hub (e2e)", () => {
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
    await prisma.notification.deleteMany({ where: { recipientId: { in: userIds } } });
    // The demo account's contacts are the seed's, so only this suite's (by name) are removed there.
    await prisma.accountContact.deleteMany({
      where: { OR: [{ accountId: { in: accountIds } }, { name: { startsWith: TAG } }] },
    });
    await prisma.clientAccount.deleteMany({ where: { id: { in: accountIds } } });
    await prisma.leadActivity.deleteMany({ where: { leadId: { in: leadIds } } });
    await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  const http = () => request(app.getHttpServer());
  const as = async (subject: string) => `Bearer ${await mint(subject)}`;
  const contactsUrl = () => `/crm/accounts/${accountId}/contacts`;

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    const lead = await http()
      .post("/crm/leads")
      .set("authorization", await as("local:sm"))
      .send({ name: `${TAG} Sharma`, source: "website", phone: "9876522001" })
      .expect(201);
    const converted = await http()
      .post(`/crm/leads/${lead.body.data.id as string}/convert`)
      .set("authorization", await as("local:sm"))
      .send({
        accountName: `${TAG} Sharma`,
        primaryContact: { name: "Riya Sharma", email: `${EMAIL_PREFIX}-riya@example.com` },
      })
      .expect(201);
    accountId = converted.body.data.account.id as string;
    primaryContactId = converted.body.data.primaryContact.id as string;
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("edits the account's details, clears a field with an emptied box, and audits the change", async () => {
    const res = await http()
      .patch(`/crm/accounts/${accountId}`)
      .set("authorization", await as("local:sm"))
      .send({
        name: `${TAG} Sharma & Kapoor`,
        coupleNames: "Riya & Arjun",
        preferredLocations: "Udaipur, Jaipur",
        internalNotes: "Prefers WhatsApp after 6pm",
      })
      .expect(200);
    expect(res.body.data).toMatchObject({
      name: `${TAG} Sharma & Kapoor`,
      coupleNames: "Riya & Arjun",
      preferredLocations: "Udaipur, Jaipur",
      internalNotes: "Prefers WhatsApp after 6pm",
    });

    const cleared = await http()
      .patch(`/crm/accounts/${accountId}`)
      .set("authorization", await as("local:sm"))
      .send({ preferredLocations: "" })
      .expect(200);
    expect(cleared.body.data.preferredLocations).toBeNull();
    expect(cleared.body.data.coupleNames).toBe("Riya & Arjun");

    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { entityType: "client_account", entityId: accountId, action: "update" },
      orderBy: { occurredAt: "desc" },
    });
    expect(audit.beforeJson).toEqual({ preferredLocations: "Udaipur, Jaipur" });
    expect(audit.afterJson).toEqual({ preferredLocations: null });
  });

  it("names the client after the couple once the bride and groom are given, fathers kept", async () => {
    const patch = (body: object) =>
      as("local:sm").then((auth) =>
        http()
          .patch(`/crm/accounts/${accountId}`)
          .set("authorization", auth)
          .send(body)
          .expect(200),
      );
    const brideOnly = await patch({ brideName: "Riya", brideFatherName: "Anil Sharma" });
    // One of the couple alone does not rename the client.
    expect(brideOnly.body.data).toMatchObject({
      name: `${TAG} Sharma & Kapoor`,
      brideName: "Riya",
      brideFatherName: "Anil Sharma",
      groomName: null,
    });

    const couple = await patch({ groomName: "Arjun", groomFatherName: "Vikram Kapoor" });
    expect(couple.body.data).toMatchObject({
      name: "Riya & Arjun",
      coupleNames: "Riya & Arjun",
      brideName: "Riya",
      brideFatherName: "Anil Sharma",
      groomName: "Arjun",
      groomFatherName: "Vikram Kapoor",
    });
    const listed = await http()
      .get("/crm/accounts")
      .query({ q: "Riya & Arjun" })
      .set("authorization", await as("local:sm"))
      .expect(200);
    expect(listed.body.data.items.map((item: { id: string }) => item.id)).toContain(accountId);

    // The audit holds the rename with the name it replaced.
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { entityType: "client_account", entityId: accountId, action: "update" },
      orderBy: { occurredAt: "desc" },
    });
    expect(audit.beforeJson).toMatchObject({ name: `${TAG} Sharma & Kapoor`, groomName: null });
    expect(audit.afterJson).toMatchObject({ name: "Riya & Arjun", groomName: "Arjun" });
  });

  it("refuses an edit to a read-only role (403) and to a role that cannot see accounts (404)", async () => {
    await http()
      .patch(`/crm/accounts/${accountId}`)
      .set("authorization", await as("local:ht"))
      .send({ coupleNames: "x" })
      .expect(403);
    await http()
      .patch(`/crm/accounts/${accountId}`)
      .set("authorization", await as("local:pm"))
      .send({ coupleNames: "x" })
      .expect(404);
  });

  it("adds a contact without a login, edits it, and removes it (soft delete)", async () => {
    const added = await http()
      .post(contactsUrl())
      .set("authorization", await as("local:sm"))
      .send({ name: `${TAG} Anil`, relation: "father of the bride", phone: "9876522002" })
      .expect(201);
    expect(added.body.data.inviteQueued).toBe(false);
    const contact = added.body.data.contact;
    expect(contact).toMatchObject({ userId: null, phone: "+919876522002", isDecisionMaker: false });

    const edited = await http()
      .patch(`${contactsUrl()}/${contact.id as string}`)
      .set("authorization", await as("local:sm"))
      .send({ email: `${EMAIL_PREFIX}-anil@example.com`, isDecisionMaker: true, phone: null })
      .expect(200);
    expect(edited.body.data).toMatchObject({
      email: `${EMAIL_PREFIX}-anil@example.com`,
      isDecisionMaker: true,
      phone: null,
    });

    await http()
      .delete(`${contactsUrl()}/${contact.id as string}`)
      .set("authorization", await as("local:sm"))
      .expect(200);
    const detail = await http()
      .get(`/crm/accounts/${accountId}`)
      .set("authorization", await as("local:sm"))
      .expect(200);
    expect(detail.body.data.contacts.map((c: { id: string }) => c.id)).not.toContain(contact.id);
    const row = await prisma.accountContact.findUniqueOrThrow({ where: { id: contact.id } });
    expect(row.deletedAt).not.toBeNull();
    expect(
      await prisma.auditEvent.count({
        where: { entityType: "account_contact", entityId: contact.id },
      }),
    ).toBe(3);
  });

  it("keeps a portal user's sign-in email and refuses to remove them", async () => {
    await http()
      .patch(`${contactsUrl()}/${primaryContactId}`)
      .set("authorization", await as("local:sm"))
      .send({ email: `${EMAIL_PREFIX}-other@example.com` })
      .expect(400);
    // The same email, a new phone and relation are fine.
    await http()
      .patch(`${contactsUrl()}/${primaryContactId}`)
      .set("authorization", await as("local:sm"))
      .send({ email: `${EMAIL_PREFIX}-riya@example.com`, relation: "bride" })
      .expect(200);
    await http()
      .delete(`${contactsUrl()}/${primaryContactId}`)
      .set("authorization", await as("local:sm"))
      .expect(409);
  });

  it("adds a contact with a portal invite: an invited login, its token and the invite notice", async () => {
    const res = await http()
      .post(contactsUrl())
      .set("authorization", await as("local:sm"))
      .send({
        name: `${TAG} Arjun`,
        relation: "groom",
        email: `${EMAIL_PREFIX}-arjun@example.com`,
        invite: true,
      })
      .expect(201);
    expect(res.body.data.inviteQueued).toBe(true);
    const userId: string = res.body.data.contact.userId;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user).toMatchObject({ userType: "client", status: "invited" });
    expect(await prisma.authToken.count({ where: { userId, purpose: "invite" } })).toBe(1);
    expect(JSON.stringify(res.body)).not.toContain("activate?token=");
  });

  it("refuses an invite to an email that already signs in, and adds nothing", async () => {
    const before = await prisma.accountContact.count({ where: { accountId, deletedAt: null } });
    await http()
      .post(contactsUrl())
      .set("authorization", await as("local:sm"))
      .send({
        name: `${TAG} Duplicate`,
        relation: "sister",
        email: `${EMAIL_PREFIX}-riya@example.com`,
        invite: true,
      })
      .expect(409);
    expect(await prisma.accountContact.count({ where: { accountId, deletedAt: null } })).toBe(
      before,
    );
  });

  it("invites an existing contact once, and asks for an email first when there is none", async () => {
    const add = async (body: object) =>
      (
        await http()
          .post(contactsUrl())
          .set("authorization", await as("local:sm"))
          .send({ relation: "mother of the groom", ...body })
          .expect(201)
      ).body.data.contact.id as string;
    const withEmail = await add({
      name: `${TAG} Meera`,
      email: `${EMAIL_PREFIX}-meera@example.com`,
    });
    const withoutEmail = await add({ name: `${TAG} Kavita` });

    const invited = await http()
      .post(`${contactsUrl()}/${withEmail}/invite`)
      .set("authorization", await as("local:sm"))
      .expect(200);
    expect(invited.body.data.contact.userId).not.toBeNull();
    expect(invited.body.data.inviteQueued).toBe(true);
    await http()
      .post(`${contactsUrl()}/${withEmail}/invite`)
      .set("authorization", await as("local:sm"))
      .expect(409);
    await http()
      .post(`${contactsUrl()}/${withoutEmail}/invite`)
      .set("authorization", await as("local:sm"))
      .expect(400);
  });

  it("invites nobody on a demo account", async () => {
    const demo = await prisma.clientAccount.findFirstOrThrow({
      where: { isDemo: true, deletedAt: null },
    });
    await http()
      .post(`/crm/accounts/${demo.id}/contacts`)
      .set("authorization", await as("local:sm"))
      .send({
        name: `${TAG} Demo guest`,
        relation: "friend",
        email: `${EMAIL_PREFIX}-demo@example.com`,
        invite: true,
      })
      .expect(409);
    expect(await prisma.user.count({ where: { email: `${EMAIL_PREFIX}-demo@example.com` } })).toBe(
      0,
    );
  });

  it("treats another account's contact as missing (404)", async () => {
    const other = await prisma.clientAccount.create({
      data: { name: `${TAG} Other`, status: "prospect" },
      select: { id: true },
    });
    await http()
      .patch(`/crm/accounts/${other.id}/contacts/${primaryContactId}`)
      .set("authorization", await as("local:sm"))
      .send({ relation: "bride" })
      .expect(404);
  });
});
