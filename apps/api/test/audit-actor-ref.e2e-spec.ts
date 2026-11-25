import { randomUUID } from "node:crypto";

import type { NestExpressApplication } from "@nestjs/platform-express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { requestContext } from "../src/common/request-context.js";
import { PrismaService } from "../src/db/prisma.service.js";
import type { Prisma } from "../src/generated/prisma/client.js";
import { createPartitionSql } from "../src/modules/admin/partitions/partition-months.js";
import { AuditService } from "../src/policy/audit.service.js";
import { startApi } from "./start-api.js";

/**
 * `audit_events.actor_ref` (D-189 §1 and §6, migration 20261129000000_hotel_form_identity) against the
 * migrated test database. The table is partitioned by month, so the column must reach every partition,
 * DEFAULT included, and every partition created later; a hotel-form contributor's events hold it, staff and
 * System events never do. Synthetic rows only; every row this file writes is removed after it.
 */
describe("audit_events.actor_ref (e2e, D-189 §6)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const auditIds: string[] = [];
  const requestId = randomUUID();

  beforeAll(async () => {
    ({ app } = await startApi());
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { id: { in: auditIds } } });
    await app.close();
  });

  async function partitions(): Promise<string[]> {
    const rows = await prisma.$queryRaw<{ name: string }[]>`
      SELECT c.relname::text AS name FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid
      WHERE i.inhparent = to_regclass('audit_events') ORDER BY 1`;
    return rows.map((row) => row.name);
  }

  async function hasActorRef(table: string, client: Prisma.TransactionClient = prisma) {
    const rows = await client.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = ${table} AND column_name = 'actor_ref'
        AND data_type = 'text' AND is_nullable = 'YES'`;
    return rows[0]?.n === 1;
  }

  it("reaches every partition, the DEFAULT one included", async () => {
    const names = await partitions();
    expect(names).toEqual(expect.arrayContaining(["audit_events_default", "audit_events_2026_11"]));
    for (const name of names) expect(await hasActorRef(name), name).toBe(true);
  });

  it("reaches a partition created later, with the guest-only check", async () => {
    // Created with the maintenance job's own statement, in a transaction that is rolled back.
    const rollback = new Error("rolled back on purpose");
    const later = createPartitionSql(
      { table: "audit_events", column: "occurred_at" },
      { year: 2099, month: 1 },
    );
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(later);
        expect(await hasActorRef("audit_events_2099_01", tx)).toBe(true);
        const checks = await tx.$queryRaw<{ name: string }[]>`
          SELECT conname::text AS name FROM pg_constraint
          WHERE conrelid = to_regclass('audit_events_2099_01') AND contype = 'c'`;
        expect(checks.map((check) => check.name)).toContain("audit_events_actor_ref_guest_only");
        throw rollback;
      }),
    ).rejects.toBe(rollback);
    expect(await partitions()).not.toContain("audit_events_2099_01");
  });

  it("was checked against no existing row (NOT VALID), so adding it never scanned the audit", async () => {
    const rows = await prisma.$queryRaw<{ validated: boolean }[]>`
      SELECT convalidated AS validated FROM pg_constraint
      WHERE conrelid = to_regclass('audit_events') AND conname = 'audit_events_actor_ref_guest_only'`;
    expect(rows).toEqual([{ validated: false }]);
  });

  it("is held by a guest_token event only: null for staff and the System", async () => {
    const id = randomUUID();
    const base = { action: "update" as const, entityType: "e2e_actor_ref", entityId: randomUUID() };
    auditIds.push(id);
    const actorRef = `hir:${requestId}/person:${randomUUID()}`;
    const stored = await prisma.auditEvent.create({
      data: { ...base, id, actorType: "guest_token", actorRef },
    });
    expect(stored.actorRef).toBe(actorRef);
    for (const actorType of ["user", "system"] as const) {
      await expect(
        prisma.auditEvent.create({ data: { ...base, actorType, actorRef } }),
        actorType,
      ).rejects.toThrow(/audit_events_actor_ref_guest_only/);
    }
  });

  it("is what AuditService writes for a hotel-form contributor, with an allow-listed image", async () => {
    const audit = app.get(AuditService);
    const entityId = randomUUID();
    const actor = { requestId, challengeId: randomUUID() };
    const context = {
      requestId: "e2e-actor-ref",
      ip: "203.0.113.9",
      principal: null,
      access: null,
    };
    await requestContext.run(context, async () => {
      requestContext.setHotelFormActor(actor);
      await audit.record({
        action: "create",
        entityType: "hotel_info_request_challenge",
        entityId,
        after: { id: entityId, claimedFullName: "Synthetic Claimant", delivery: "screen" },
      });
    });
    const event = await prisma.auditEvent.findFirstOrThrow({ where: { entityId } });
    auditIds.push(event.id);
    expect(event).toMatchObject({
      actorType: "guest_token",
      actorUserId: null,
      actorRef: `hir:${requestId}/challenge:${actor.challengeId}`,
      ipAddress: "203.0.113.9",
      requestId: "e2e-actor-ref",
      afterJson: { id: entityId, claimedFullName: "[redacted]" },
    });
  });
});
