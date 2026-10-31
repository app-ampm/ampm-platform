import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { LeadReminderService } from "../src/modules/crm/leads/leads.reminder.service.js";
import { startApi } from "./start-api.js";

/** Test leads are named with this prefix so the suite can clean up after itself. */
const TAG = "E2E-Lead";
const BOT = { botToken: "dev-bot-check" };

/**
 * Lead capture end to end (Module B CRM, feature 8.1, AC-01). The public enquiry creates a lead with
 * consent, a matching contact flags a duplicate, Sales is notified, the workspace tracks and merges,
 * the funnel is SA/SM only, a converted lead is read-only, and the follow-up reminder fires once.
 */
describe("Lead capture (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;
  let salesUserId: string;

  async function removeFixtures(): Promise<void> {
    const leads = await prisma.lead.findMany({
      where: { name: { startsWith: TAG } },
      select: { id: true },
    });
    const ids = leads.map((lead) => lead.id);
    if (ids.length === 0) return;
    await prisma.leadActivity.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { entityType: "lead", entityId: { in: ids } } });
    await prisma.lead.updateMany({ where: { id: { in: ids } }, data: { duplicateOfLeadId: null } });
    await prisma.lead.deleteMany({ where: { id: { in: ids } } });
  }

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    const sales = await prisma.user.findFirstOrThrow({ where: { email: "sales@example.com" } });
    salesUserId = sales.id;
    await removeFixtures();
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const sm = async () => `Bearer ${await mint("local:sm")}`;
  const findLead = (name: string) =>
    prisma.lead.findFirstOrThrow({ where: { name }, include: { source: true } });

  it("captures a public enquiry with consent and notifies Sales (AC-01.1)", async () => {
    const name = `${TAG} Alice`;
    const res = await http()
      .post("/crm/enquiries")
      .send({
        ...BOT,
        name,
        email: "Alice@Example.com",
        consentMarketing: true,
        requirements: "A winter wedding",
      })
      .expect(201);
    expect(res.body.data).toEqual({ firstName: name.split(" ")[0] });
    expect(res.body.data).not.toHaveProperty("id");

    const lead = await findLead(name);
    expect(lead.status).toBe("new");
    expect(lead.email).toBe("alice@example.com");
    expect(lead.source.sourceKey).toBe("website");
    expect(lead.consentMarketing).toBe(true);
    expect(lead.consentAt).not.toBeNull();
    expect(lead.consentNoticeVersion).not.toBeNull();
    expect(lead.ownerUserId).toBeNull();

    const notice = await prisma.notification.findFirst({
      where: { recipientId: salesUserId, templateKey: "crm.enquiry_received", entityId: lead.id },
    });
    expect(notice).not.toBeNull();
  });

  it("rejects an enquiry with no bot-check token (AC-01.9) or no contact (AC-01.3)", async () => {
    await http()
      .post("/crm/enquiries")
      .send({ name: `${TAG} NoBot`, email: "nobot@example.com" })
      .expect(400);
    await http()
      .post("/crm/enquiries")
      .send({ ...BOT, name: `${TAG} NoContact` })
      .expect(400);
  });

  it("accepts a phone-only enquiry and normalises the number (AC-01.3)", async () => {
    const name = `${TAG} Phone`;
    await http()
      .post("/crm/enquiries")
      .send({ ...BOT, name, phone: "9876500001" })
      .expect(201);
    const lead = await findLead(name);
    expect(lead.phone).toBe("+919876500001");
  });

  it("flags a duplicate enquiry, never refuses or auto-merges it (AC-01.6)", async () => {
    const first = `${TAG} DupA`;
    const second = `${TAG} DupB`;
    await http()
      .post("/crm/enquiries")
      .send({ ...BOT, name: first, phone: "9876500002" })
      .expect(201);
    await http()
      .post("/crm/enquiries")
      .send({ ...BOT, name: second, phone: "9876500002" })
      .expect(201);
    const original = await findLead(first);
    const duplicate = await findLead(second);
    expect(duplicate.duplicateOfLeadId).toBe(original.id);
  });

  it("keeps leads invisible to a client, and the funnel to SA/SM only (AC-01.7, AC-12)", async () => {
    await http()
      .get("/crm/leads")
      .set("authorization", `Bearer ${await mint("local:client")}`)
      .expect(404);
    await http()
      .get("/crm/reports/lead-funnel")
      .set("authorization", await sm())
      .expect(200);
    // PM may read leads but not run the funnel: denial is absence, so 404 (as HT would get).
    await http()
      .get("/crm/reports/lead-funnel")
      .set("authorization", `Bearer ${await mint("local:pm")}`)
      .expect(404);
  });

  it("creates a manual lead with a source and owner, and lists it (AC-01.4)", async () => {
    const name = `${TAG} Manual`;
    const created = await http()
      .post("/crm/leads")
      .set("authorization", await sm())
      .send({ name, source: "instagram", phone: "9876500003", ownerUserId: salesUserId })
      .expect(201);
    expect(created.body.data.source.sourceKey).toBe("instagram");
    expect(created.body.data.ownerUserId).toBe(salesUserId);

    const list = await http()
      .get("/crm/leads?source=instagram")
      .set("authorization", await sm())
      .expect(200);
    const names: string[] = list.body.data.items.map((lead: { name: string }) => lead.name);
    expect(names).toContain(name);
  });

  it("makes a converted lead read-only (AC-01.8)", async () => {
    const name = `${TAG} Converted`;
    const created = await http()
      .post("/crm/leads")
      .set("authorization", await sm())
      .send({ name, source: "website", phone: "9876500004" })
      .expect(201);
    const leadId: string = created.body.data.id;
    await prisma.lead.update({ where: { id: leadId }, data: { status: "converted" } });
    await http()
      .patch(`/crm/leads/${leadId}`)
      .set("authorization", await sm())
      .send({ requirements: "changed" })
      .expect(409);
  });

  it("merges a duplicate into the survivor, moving activities and auditing it (AC-01.6)", async () => {
    const survivorName = `${TAG} Survivor`;
    const dupName = `${TAG} Merged`;
    const survivor = await http()
      .post("/crm/leads")
      .set("authorization", await sm())
      .send({
        name: survivorName,
        source: "website",
        phone: "9876500005",
        ownerUserId: salesUserId,
      })
      .expect(201);
    const duplicate = await http()
      .post("/crm/leads")
      .set("authorization", await sm())
      .send({ name: dupName, source: "website", phone: "9876500006" })
      .expect(201);
    const survivorId: string = survivor.body.data.id;
    const duplicateId: string = duplicate.body.data.id;
    await http()
      .post(`/crm/leads/${duplicateId}/activities`)
      .set("authorization", await sm())
      .send({ activityType: "call", summary: "Spoke to the couple" })
      .expect(201);

    await http()
      .post(`/crm/leads/${duplicateId}/merge`)
      .set("authorization", await sm())
      .send({ survivorLeadId: survivorId })
      .expect(201);

    const merged = await prisma.lead.findUniqueOrThrow({ where: { id: duplicateId } });
    expect(merged.status).toBe("closed");
    expect(merged.closedReason).toBe("merged");
    const moved = await prisma.leadActivity.count({ where: { leadId: survivorId } });
    expect(moved).toBe(1);
    const audited = await prisma.auditEvent.count({
      where: { entityType: "lead", entityId: duplicateId, action: "update" },
    });
    expect(audited).toBeGreaterThan(0);
  });

  it("sends a follow-up reminder once, idempotently (AC-01.5)", async () => {
    const name = `${TAG} Reminder`;
    const created = await http()
      .post("/crm/leads")
      .set("authorization", await sm())
      .send({ name, source: "website", phone: "9876500007", ownerUserId: salesUserId })
      .expect(201);
    const leadId: string = created.body.data.id;
    const past = new Date(Date.now() - 60_000).toISOString();
    await http()
      .post(`/crm/leads/${leadId}/activities`)
      .set("authorization", await sm())
      .send({ activityType: "note", summary: "Follow up", nextFollowUpAt: past })
      .expect(201);

    const reminder = app.get(LeadReminderService);
    const now = new Date();
    expect(await reminder.runDue(now)).toBe(1);
    expect(await reminder.runDue(now)).toBe(0);

    const notices = await prisma.notification.count({
      where: { recipientId: salesUserId, templateKey: "crm.follow_up_due", entityId: leadId },
    });
    expect(notices).toBe(1);
  });
});
