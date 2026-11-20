import { createHash } from "node:crypto";

import type { NestExpressApplication } from "@nestjs/platform-express";
import { STAFF_ROLES } from "@ampm/policy";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bootstrapSuperAdminIn, type BootstrapAdminOutcome } from "../prisma/bootstrap-admin.js";
import { PrismaService } from "../src/db/prisma.service.js";
import type { Prisma } from "../src/generated/prisma/client.js";
import { startApi } from "./start-api.js";

/**
 * The production first-Super-Admin bootstrap (D-141) against the migrated, seeded test database. The
 * seeded database already has an active Super Admin, so the cases that need an empty one run inside a
 * transaction that disables her first and is always rolled back: nothing here changes the shared data.
 */
describe("First Super Admin bootstrap (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let superAdminRoleId: string;

  class Rollback extends Error {}

  /** Runs `body` in a transaction where no Super Admin is active, then rolls everything back. */
  async function withoutActiveAdmin(
    body: (tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<void> {
    await prisma
      .$transaction(async (tx) => {
        await tx.user.updateMany({
          where: { roles: { some: { roleId: superAdminRoleId } }, status: "active" },
          data: { status: "disabled" },
        });
        await body(tx);
        throw new Rollback();
      })
      .catch((error: unknown) => {
        if (!(error instanceof Rollback)) throw error;
      });
  }

  const invite = (tx: Prisma.TransactionClient, email: string): Promise<BootstrapAdminOutcome> =>
    bootstrapSuperAdminIn(tx, { email, name: "First Admin", superAdminRoleId });

  const liveTokenFor = (tx: Prisma.TransactionClient, raw: string) =>
    tx.authToken.findFirst({
      where: {
        tokenHash: createHash("sha256").update(raw).digest("hex"),
        purpose: "invite",
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

  beforeAll(async () => {
    ({ app } = await startApi());
    prisma = app.get(PrismaService);
    const role = await prisma.role.findUniqueOrThrow({ where: { roleKey: STAFF_ROLES.SA.key } });
    superAdminRoleId = role.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("refuses while a Super Admin is active, so it cannot mint an admin invite on a live system", async () => {
    const outcome = await prisma.$transaction((tx) => invite(tx, "someone@ampmverse.com"));
    expect(outcome.kind).toBe("refused");
    const created = await prisma.user.findFirst({ where: { email: "someone@ampmverse.com" } });
    expect(created).toBeNull();
  });

  it("creates an invited Super Admin with a live single-use invite and a system audit row", async () => {
    await withoutActiveAdmin(async (tx) => {
      const outcome = await invite(tx, "  First.Admin@AMPMverse.com ");
      if (outcome.kind !== "invited") throw new Error(`expected an invite, got ${outcome.reason}`);
      expect(outcome.created).toBe(true);
      const user = await tx.user.findUniqueOrThrow({
        where: { id: outcome.userId },
        include: { roles: true },
      });
      // Stored lower-cased and trimmed: activation compares it with Cognito's verified email.
      expect(user).toMatchObject({
        email: "first.admin@ampmverse.com",
        userType: "staff",
        status: "invited",
        identitySubject: null,
        mfaEnabled: true,
      });
      expect(user.roles.map((r) => r.roleId)).toEqual([superAdminRoleId]);
      expect(await liveTokenFor(tx, outcome.inviteToken)).not.toBeNull();
      const audit = await tx.auditEvent.findFirst({
        where: { entityType: "user", entityId: outcome.userId },
      });
      expect(audit).toMatchObject({ actorType: "system", action: "create", actorUserId: null });
    });
  });

  it("re-invites the same invited account, retiring its earlier link", async () => {
    await withoutActiveAdmin(async (tx) => {
      const first = await invite(tx, "first.admin@ampmverse.com");
      const second = await invite(tx, "first.admin@ampmverse.com");
      if (first.kind !== "invited" || second.kind !== "invited")
        throw new Error("expected invites");
      expect(second.created).toBe(false);
      expect(second.userId).toBe(first.userId);
      expect(await liveTokenFor(tx, first.inviteToken)).toBeNull();
      expect(await liveTokenFor(tx, second.inviteToken)).not.toBeNull();
    });
  });

  it("refuses an email that belongs to an account that is not an invited staff member", async () => {
    await withoutActiveAdmin(async (tx) => {
      // The seeded client representative is an active client account.
      const outcome = await invite(tx, "client@example.com");
      expect(outcome).toEqual({
        kind: "refused",
        reason: "that email already belongs to a client account with status active",
      });
    });
  });
});
