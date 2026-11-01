import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { LeadReminderService } from "../src/modules/crm/leads/leads.reminder.service.js";
import { startApi } from "./start-api.js";

/** These leads use their own prefix so cleanup never touches the capture suite's leads. */
const TAG = "E2E-Wf";

/**
 * Lead workspace workflows end to end (Module B CRM, feature 8.1): a converted lead is read-only
 * (AC-01.8); a duplicate merges into a survivor with its history and an audit, and only open leads may
 * merge (AC-01.6); a due follow-up fires exactly one reminder (AC-01.5).
 */
describe("Lead workspace workflows (e2e)", () => {
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

  it("makes a converted lead read-only (AC-01.8)", async () => {
    const name = `${TAG} Converted`;
    const created = await http()
      .post("/crm/leads")
      .set("authorization", await sm())
      .send({ name, source: "website", phone: "9876500104" })
      .expect(201);
    const leadId: string = created.body.data.id;
    await prisma.lead.update({ where: { id: leadId }, data: { status: "converted" } });
    await http()
      .patch(`/crm/leads/${leadId}`)
      .set("authorization", await sm())
      .send({ requirements: "changed" })
      .expect(409);
  });

  it("merges an open duplicate into the survivor, and refuses a closed one (AC-01.6)", async () => {
    const survivor = await http()
      .post("/crm/leads")
      .set("authorization", await sm())
      .send({
        name: `${TAG} Survivor`,
        source: "website",
        phone: "9876500105",
        ownerUserId: salesUserId,
      })
      .expect(201);
    const duplicate = await http()
      .post("/crm/leads")
      .set("authorization", await sm())
      .send({ name: `${TAG} Merged`, source: "website", phone: "9876500106" })
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
    expect(await prisma.leadActivity.count({ where: { leadId: survivorId } })).toBe(1);
    expect(
      await prisma.auditEvent.count({
        where: { entityType: "lead", entityId: duplicateId, action: "update" },
      }),
    ).toBeGreaterThan(0);

    // Re-merging the now-closed duplicate is refused, so its pointer cannot be corrupted (review fix).
    await http()
      .post(`/crm/leads/${duplicateId}/merge`)
      .set("authorization", await sm())
      .send({ survivorLeadId: survivorId })
      .expect(409);
  });

  it("enforces the lead status machine and records before/after images (C3, C6)", async () => {
    const created = await http()
      .post("/crm/leads")
      .set("authorization", await sm())
      .send({
        name: `${TAG} Transition`,
        source: "website",
        phone: "9876500110",
        ownerUserId: salesUserId,
      })
      .expect(201);
    const leadId: string = created.body.data.id;
    // Forward through the funnel is allowed...
    await http()
      .patch(`/crm/leads/${leadId}`)
      .set("authorization", await sm())
      .send({ status: "contacted" })
      .expect(200);
    // ...but moving back to `new` is refused with a 409 (no silent any-to-any jump).
    await http()
      .patch(`/crm/leads/${leadId}`)
      .set("authorization", await sm())
      .send({ status: "new" })
      .expect(409);
    // The allowed move left a before/after status image on the audit (A4, C6).
    const images = await prisma.auditEvent.findMany({
      where: { entityType: "lead", entityId: leadId, action: "update" },
      select: { beforeJson: true, afterJson: true },
    });
    expect(images.some((e) => e.beforeJson !== null && e.afterJson !== null)).toBe(true);
  });

  it("makes a closed lead read-only (C3)", async () => {
    const created = await http()
      .post("/crm/leads")
      .set("authorization", await sm())
      .send({ name: `${TAG} Closed`, source: "website", phone: "9876500111" })
      .expect(201);
    const leadId: string = created.body.data.id;
    await http()
      .patch(`/crm/leads/${leadId}`)
      .set("authorization", await sm())
      .send({ status: "closed", closedReason: "lost" })
      .expect(200);
    // No further edits and no reopening.
    await http()
      .patch(`/crm/leads/${leadId}`)
      .set("authorization", await sm())
      .send({ requirements: "changed" })
      .expect(409);
    await http()
      .patch(`/crm/leads/${leadId}`)
      .set("authorization", await sm())
      .send({ status: "new" })
      .expect(409);
  });

  it("refuses an unknown or non-staff lead owner (C4)", async () => {
    const created = await http()
      .post("/crm/leads")
      .set("authorization", await sm())
      .send({ name: `${TAG} Owner`, source: "website", phone: "9876500112" })
      .expect(201);
    const leadId: string = created.body.data.id;
    // An id that belongs to no user — before the fix this was an unmapped 500.
    await http()
      .patch(`/crm/leads/${leadId}/owner`)
      .set("authorization", await sm())
      .send({ ownerUserId: "00000000-0000-7000-8000-0000000000ff" })
      .expect(400);
    // A real account that is not active staff (the client login) cannot own an INTERNAL lead.
    const client = await prisma.user.findFirstOrThrow({ where: { email: "client@example.com" } });
    await http()
      .patch(`/crm/leads/${leadId}/owner`)
      .set("authorization", await sm())
      .send({ ownerUserId: client.id })
      .expect(400);
  });

  it("keeps a lead reachable and its dates in order on update (C7)", async () => {
    const created = await http()
      .post("/crm/leads")
      .set("authorization", await sm())
      .send({ name: `${TAG} Contact`, source: "website", phone: "9876500113" })
      .expect(201);
    const leadId: string = created.body.data.id;
    // Clearing the only contact (a phone-only lead) is refused.
    await http()
      .patch(`/crm/leads/${leadId}`)
      .set("authorization", await sm())
      .send({ phone: null })
      .expect(400);
    // A reversed tentative range is refused, as at create.
    await http()
      .patch(`/crm/leads/${leadId}`)
      .set("authorization", await sm())
      .send({ tentativeDateFrom: "2027-03-10", tentativeDateTo: "2027-03-01" })
      .expect(400);
  });

  it("rejects a malformed list cursor with 400, not 500 (L6)", async () => {
    await http()
      .get("/crm/leads?cursor=not-a-uuid")
      .set("authorization", await sm())
      .expect(400);
  });

  it("sends a follow-up reminder once, idempotently (AC-01.5)", async () => {
    const created = await http()
      .post("/crm/leads")
      .set("authorization", await sm())
      .send({
        name: `${TAG} Reminder`,
        source: "website",
        phone: "9876500107",
        ownerUserId: salesUserId,
      })
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
    expect(
      await prisma.notification.count({
        where: { recipientId: salesUserId, templateKey: "crm.follow_up_due", entityId: leadId },
      }),
    ).toBe(1);
    // The sweep records its outcome on a job_runs row (C5, D-057).
    expect(
      await prisma.jobRun.count({ where: { jobName: "crm.lead.follow_up_reminder" } }),
    ).toBeGreaterThan(0);
  });
});
