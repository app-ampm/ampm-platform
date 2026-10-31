import type { NestExpressApplication } from "@nestjs/platform-express";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { DEMO_USER, upsertDemoUser } from "../src/modules/demo/demo-baseline.js";
import { DemoRestoreService } from "../src/modules/demo/demo-restore.service.js";
import { startApi } from "./start-api.js";

/** A test project id; project_members.project_id has no FK to a projects table yet (module E). */
const TEST_PROJECT = "0192f3a0-7d3e-7b1a-9c2f-0000000000e1";

/**
 * The nightly demo-restore end to end (feature 5.5). The centerpiece is the scoping-safety test: for
 * EVERY table the reset clears, a non-demo row sits beside a demo row, proving the guard only ever
 * removes demo rows — a reset that forgot its scope would wipe real staff/client data irreversibly.
 * Plus idempotency, the recorded `job_runs` outcome, and atomic rollback. Modelled on sessions.e2e-spec.ts.
 */
describe("Demo restore (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let service: DemoRestoreService;

  beforeAll(async () => {
    ({ app } = await startApi());
    prisma = app.get(PrismaService);
    service = app.get(DemoRestoreService);
  });

  afterEach(async () => {
    // Clear each test user's dependents (and the demo account's), remove the test users, and put the
    // canonical demo account back for the next test and the seed. The demo user is reseeded, not deleted.
    const testUsers = await prisma.user.findMany({
      where: { identitySubject: { in: ["local:scope-staff", "local:squatter", "local:demo2"] } },
      select: { id: true },
    });
    const ids = [...testUsers.map((user) => user.id), DEMO_USER.id];
    const where = { userId: { in: ids } };
    await prisma.session.deleteMany({ where });
    await prisma.authToken.deleteMany({ where });
    await prisma.userRole.deleteMany({ where });
    await prisma.projectMember.deleteMany({ where });
    await prisma.notificationPreference.deleteMany({ where });
    await prisma.user.deleteMany({ where: { id: { in: testUsers.map((user) => user.id) } } });
    await upsertDemoUser(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  /** A row in each of the five tables the reset clears, tagged so assertions and cleanup can find them. */
  async function seedScopedRows(userId: string, roleId: string, tag: string): Promise<void> {
    await prisma.session.create({
      data: { userId, tokenId: tag, idleTimeoutMinutes: 720, lastSeenAt: new Date() },
    });
    await prisma.authToken.create({
      data: {
        userId,
        purpose: "invite",
        tokenHash: `${tag}-hash`,
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    await prisma.userRole.create({ data: { userId, roleId } });
    await prisma.projectMember.create({
      data: { projectId: TEST_PROJECT, userId, projectRole: "staff", status: "active" },
    });
    await prisma.notificationPreference.create({
      data: { userId, eventType: "demo.scope.test", channel: "email", enabled: true },
    });
  }

  it("clears demo rows and spares non-demo rows in every scoped table (scoping safety)", async () => {
    const role = await prisma.role.findFirstOrThrow();
    // A non-demo (staff) user with a row in every table the reset clears; the guard must spare them all.
    const staff = await prisma.user.create({
      data: {
        userType: "staff",
        name: "Scope Staff",
        email: "demo-e2e-staff@example.com",
        identitySubject: "local:scope-staff",
        status: "active",
      },
    });
    await seedScopedRows(staff.id, role.id, "demo-e2e-staff");
    // The canonical demo user with a row in every table; every one must be cleared.
    await seedScopedRows(DEMO_USER.id, role.id, "demo-e2e-demo");

    const outcome = await service.restore("scope-safety");

    // Every non-demo row survives.
    expect(await prisma.user.findUnique({ where: { id: staff.id } })).not.toBeNull();
    expect(
      await prisma.session.findUnique({ where: { tokenId: "demo-e2e-staff" } }),
    ).not.toBeNull();
    expect(await prisma.authToken.count({ where: { userId: staff.id } })).toBe(1);
    expect(await prisma.userRole.count({ where: { userId: staff.id } })).toBe(1);
    expect(await prisma.projectMember.count({ where: { userId: staff.id } })).toBe(1);
    expect(await prisma.notificationPreference.count({ where: { userId: staff.id } })).toBe(1);

    // Every demo row was cleared, and the demo account is back at baseline.
    expect(await prisma.session.findUnique({ where: { tokenId: "demo-e2e-demo" } })).toBeNull();
    expect(await prisma.authToken.count({ where: { userId: DEMO_USER.id } })).toBe(0);
    expect(await prisma.userRole.count({ where: { userId: DEMO_USER.id } })).toBe(0);
    expect(await prisma.projectMember.count({ where: { userId: DEMO_USER.id } })).toBe(0);
    expect(await prisma.notificationPreference.count({ where: { userId: DEMO_USER.id } })).toBe(0);
    const restored = await prisma.user.findUniqueOrThrow({ where: { id: DEMO_USER.id } });
    expect(restored.userType).toBe("demo");
    expect(restored.email).toBe(DEMO_USER.email);
    // The reset cleared the demo user's five rows (one per scoped table).
    expect(outcome.tables[0]?.deleted).toBeGreaterThanOrEqual(5);
  });

  it("is idempotent — a second restore reaches the same state", async () => {
    await service.restore("idem-a");
    const first = await prisma.user.findUniqueOrThrow({ where: { id: DEMO_USER.id } });
    await service.restore("idem-b");
    const second = await prisma.user.findUniqueOrThrow({ where: { id: DEMO_USER.id } });
    expect(second.id).toBe(first.id);
    expect(second.email).toBe(DEMO_USER.email);
    expect(await prisma.user.count({ where: { userType: "demo" } })).toBe(1);
  });

  it("records the run outcome on a job_runs row", async () => {
    await service.restore("outcome-1");
    const run = await prisma.jobRun.findFirst({ where: { idempotencyKey: "outcome-1" } });
    expect(run?.jobName).toBe("demo.restore");
    expect(run?.status).toBe("succeeded");
    expect(run?.finishedAt).not.toBeNull();
    expect(run?.detailJson).toEqual([{ table: "users", deleted: expect.any(Number), inserted: 1 }]);
  });

  it("rolls back the whole reset when the baseline write fails (atomic)", async () => {
    // Free the demo account's unique email and squat it, so the baseline upsert's create path fails.
    await prisma.session.deleteMany({ where: { userId: DEMO_USER.id } });
    await prisma.user.delete({ where: { id: DEMO_USER.id } });
    await prisma.user.create({
      data: {
        userType: "staff",
        name: "Squatter",
        email: DEMO_USER.email,
        identitySubject: "local:squatter",
        status: "active",
      },
    });
    // A demo user with a session, so the reset clears a row before it fails on the upsert.
    const demo2 = await prisma.user.create({
      data: {
        userType: "demo",
        name: "Demo Two",
        email: "demo-e2e-two@example.com",
        identitySubject: "local:demo2",
        status: "active",
      },
    });
    await prisma.session.create({
      data: {
        userId: demo2.id,
        tokenId: "demo-e2e-rollback",
        idleTimeoutMinutes: 43200,
        lastSeenAt: new Date(),
      },
    });

    await expect(service.restore("rollback-1")).rejects.toThrow();

    // The transaction rolled back: the demo session the reset had deleted is back.
    expect(
      await prisma.session.findUnique({ where: { tokenId: "demo-e2e-rollback" } }),
    ).not.toBeNull();
    const run = await prisma.jobRun.findFirst({ where: { idempotencyKey: "rollback-1" } });
    expect(run?.status).toBe("failed");
    expect(run?.error).toBeTruthy();
  });
});
