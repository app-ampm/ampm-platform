import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../db/prisma.service.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { type DemoTableRestore, upsertDemoUser } from "./demo-baseline.js";

/**
 * Restores demo data to the baseline (feature 5.5). Two safety rails are baked in here so no caller can
 * omit them: every delete is scoped to demo rows, and the whole reset runs in one transaction. The single
 * biggest risk is a reset that forgets its demo scope and wipes real data (data.md); the scoping-safety
 * test is the third rail.
 */
@Injectable()
export class DemoBaselineRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Wipes every demo-scoped row and re-seeds the baseline in one transaction; returns per-table counts. */
  async restore(): Promise<DemoTableRestore[]> {
    // One entry per demo-scoped table. A future table (projects/guests `is_demo`, hotels `demo_visible`)
    // adds one more line here and one more row to the scoping-safety test, so the guard cannot regress.
    return this.prisma.$transaction(async (tx) => [await this.restoreUsers(tx)]);
  }

  /**
   * The demo account: clear the demo users' transient and membership rows (scoped to demo user ids, so a
   * non-demo user's are never touched), then upsert the canonical demo user. `audit_events` is append-only
   * and left alone; the user is upserted rather than deleted because its foreign keys are ON DELETE RESTRICT.
   */
  private async restoreUsers(tx: Prisma.TransactionClient): Promise<DemoTableRestore> {
    const demo = await tx.user.findMany({ where: { userType: "demo" }, select: { id: true } });
    const ids = demo.map((user) => user.id);
    let deleted = 0;
    if (ids.length > 0) {
      const where = { userId: { in: ids } };
      deleted += (await tx.session.deleteMany({ where })).count;
      deleted += (await tx.authToken.deleteMany({ where })).count;
      deleted += (await tx.userRole.deleteMany({ where })).count;
      deleted += (await tx.projectMember.deleteMany({ where })).count;
      deleted += (await tx.notificationPreference.deleteMany({ where })).count;
    }
    await upsertDemoUser(tx);
    return { table: "users", deleted, inserted: 1 };
  }
}
