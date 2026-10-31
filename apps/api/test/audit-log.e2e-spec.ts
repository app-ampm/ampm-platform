import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const ROLE_NAME = "audit-log-e2e-role";

/**
 * The audit-log read/export surface end to end (§9, D-036 slice 6c): a Super Admin reads and filters
 * the append-only log, the export returns the filtered slice, and the export itself is audited. The
 * e2e env sets DYNAMIC_ROLES=true; the audit log is append-only, so events are never deleted.
 */
describe("Audit log (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;

  async function removeFixtures(): Promise<void> {
    const roles = await prisma.role.findMany({
      where: { roleKey: { startsWith: "custom_" }, name: ROLE_NAME },
      select: { id: true },
    });
    for (const role of roles) {
      await prisma.roleGrant.deleteMany({ where: { roleId: role.id } });
      await prisma.role.delete({ where: { id: role.id } });
    }
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
  const sa = async () => `Bearer ${await mint("local:admin")}`;

  it("lists and filters audit events, and the export is itself audited", async () => {
    const admin = await sa();

    // An audited action to find: create a custom role (entityType "role", action "create").
    const role = await http()
      .post("/admin/roles")
      .set("authorization", admin)
      .send({ name: ROLE_NAME, capabilityIds: [] })
      .expect(201);
    const roleId: string = role.body.data.id;

    // It is readable, filtered precisely by entity.
    const list = await http()
      .get(`/admin/audit-events?entityType=role&entityId=${roleId}`)
      .set("authorization", admin)
      .expect(200);
    const items = list.body.data.items as {
      action: string;
      entityType: string;
      entityId: string;
    }[];
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items.every((e) => e.entityType === "role" && e.entityId === roleId)).toBe(true);
    expect(items.some((e) => e.action === "create")).toBe(true);
    expect(list.body.data).toHaveProperty("nextCursor");

    // The export returns that filtered slice.
    const exported = await http()
      .get(`/admin/audit-events/export?entityType=role&entityId=${roleId}`)
      .set("authorization", admin)
      .expect(200);
    expect(exported.body.data.rowCount).toBeGreaterThanOrEqual(1);
    expect(exported.body.data.truncated).toBe(false);
    expect(exported.body.data.filters).toMatchObject({ entityType: "role", entityId: roleId });

    // The export wrote its own audit event (action "export", entityType "audit_log").
    const exports = await http()
      .get("/admin/audit-events?entityType=audit_log&action=export")
      .set("authorization", admin)
      .expect(200);
    // Tie the assertion to THIS run's export (events accumulate across runs): its recorded filters
    // carry the roleId we just exported, so a prior run's export event cannot satisfy it.
    const exportEvents = exports.body.data.items as {
      action: string;
      entityType: string;
      after: { filters?: { entityId?: string }; rowCount?: number } | null;
    }[];
    expect(
      exportEvents.some(
        (e) =>
          e.action === "export" &&
          e.entityType === "audit_log" &&
          e.after?.filters?.entityId === roleId,
      ),
    ).toBe(true);

    // A malformed cursor is rejected at the edge (400), not run into a uuid cast error (500).
    await http()
      .get("/admin/audit-events?cursor=not-a-uuid")
      .set("authorization", admin)
      .expect(400);
  });

  it("denies a non-Super-Admin and a client (denial is absence)", async () => {
    await http()
      .get("/admin/audit-events")
      .set("authorization", `Bearer ${await mint("local:pm")}`)
      .expect(404);
    await http()
      .get("/admin/audit-events")
      .set("authorization", `Bearer ${await mint("local:client")}`)
      .expect(404);
    await http()
      .get("/admin/audit-events/export")
      .set("authorization", `Bearer ${await mint("local:pm")}`)
      .expect(404);
  });
});
