import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../db/prisma.service.js";
import { PrismaAuditLogRepository } from "./audit-log.repository.js";

/** The subset of an audit_events row the repository reads (Prisma field names). */
interface Row {
  id: string;
  actorUserId: string | null;
  actorType: "user";
  action: "create";
  entityType: string;
  entityId: string;
  projectId: string | null;
  beforeJson: unknown;
  afterJson: unknown;
  ipAddress: string | null;
  requestId: string | null;
  occurredAt: Date;
}

function makeRows(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `0192f3a0-7d3e-7b1a-9c2f-00000000000${i}`,
    actorUserId: null,
    actorType: "user",
    action: "create",
    entityType: "role",
    entityId: "0192f3a0-7d3e-7b1a-9c2f-0000000000ee",
    projectId: null,
    beforeJson: null,
    afterJson: null,
    ipAddress: null,
    requestId: null,
    occurredAt: new Date("2026-10-28T10:00:00.000Z"),
  }));
}

function repoWith(rows: Row[]) {
  const findMany = vi.fn(async () => rows);
  const prisma = { auditEvent: { findMany } } as unknown as PrismaService;
  return { repo: new PrismaAuditLogRepository(prisma), findMany };
}

describe("PrismaAuditLogRepository", () => {
  it("builds the scoped, filtered, keyset where and asks for limit+1", async () => {
    const { repo, findMany } = repoWith([]);
    await repo.list(
      { kind: "projects", projectIds: ["p1", "p2"] },
      { entityType: "role", action: "create", from: "2026-10-01T00:00:00.000Z" },
      50,
      "0192f3a0-7d3e-7b1a-9c2f-0000000000c0",
    );
    expect(findMany).toHaveBeenCalledWith({
      where: {
        projectId: { in: ["p1", "p2"] },
        entityType: "role",
        action: "create",
        occurredAt: { gte: new Date("2026-10-01T00:00:00.000Z") },
        id: { lt: "0192f3a0-7d3e-7b1a-9c2f-0000000000c0" },
      },
      orderBy: { id: "desc" },
      take: 51,
    });
  });

  it("omits the project filter for all-scope and sets no cursor when absent", async () => {
    const { repo, findMany } = repoWith([]);
    await repo.list({ kind: "all" }, {}, 50, undefined);
    expect(findMany).toHaveBeenCalledWith({ where: {}, orderBy: { id: "desc" }, take: 51 });
  });

  it("returns a nextCursor only when there is another page", async () => {
    const more = await repoWith(makeRows(3)).repo.list({ kind: "all" }, {}, 2, undefined);
    expect(more.rows).toHaveLength(2);
    expect(more.nextCursor).toBe("0192f3a0-7d3e-7b1a-9c2f-000000000001");

    const last = await repoWith(makeRows(2)).repo.list({ kind: "all" }, {}, 2, undefined);
    expect(last.rows).toHaveLength(2);
    expect(last.nextCursor).toBeNull();
  });

  it("caps an export at max and flags truncation", async () => {
    const truncated = await repoWith(makeRows(3)).repo.export({ kind: "all" }, {}, 2);
    expect(truncated.rows).toHaveLength(2);
    expect(truncated.truncated).toBe(true);

    const whole = await repoWith(makeRows(3)).repo.export({ kind: "all" }, {}, 5);
    expect(whole.rows).toHaveLength(3);
    expect(whole.truncated).toBe(false);
  });

  it("maps the stored images (beforeJson/afterJson) onto before/after", async () => {
    const [base] = makeRows(1);
    const row: Row = { ...base!, beforeJson: { a: 1 }, afterJson: { a: 2 } };
    const result = await repoWith([row]).repo.list({ kind: "all" }, {}, 10, undefined);
    expect(result.rows[0]).toMatchObject({ before: { a: 1 }, after: { a: 2 } });
  });
});
