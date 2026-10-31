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
  });
});
