import type { StaffRole } from "@ampm/policy";
import { describe, expect, it, vi } from "vitest";

import type { AuditService } from "../../../policy/audit.service.js";
import type { Principal } from "../../../policy/principal.types.js";
import { AuditLogRepository, type AuditEventRow } from "./audit-log.repository.js";
import { AuditLogService } from "./audit-log.service.js";

const ROW: AuditEventRow = {
  id: "0192f3a0-7d3e-7b1a-9c2f-000000000001",
  actorUserId: "0192f3a0-7d3e-7b1a-9c2f-0000000000aa",
  actorType: "user",
  action: "update",
  entityType: "configuration",
  entityId: "0192f3a0-7d3e-7b1a-9c2f-0000000000bb",
  projectId: null,
  before: { a: 1 },
  after: { a: 2 },
  ipAddress: "127.0.0.1",
  requestId: "req-1",
  occurredAt: new Date("2026-10-28T10:00:00.000Z"),
};

class FakeRepository extends AuditLogRepository {
  list = vi.fn(async () => ({ rows: [ROW], nextCursor: "cursor-1" as string | null }));
  export = vi.fn(async () => ({ rows: [ROW], truncated: false }));
}

function harness(repo: FakeRepository) {
  const record = vi.fn(async () => undefined);
  const audit = { record } as unknown as AuditService;
  return { service: new AuditLogService(repo, audit), record };
}

function staff(roles: StaffRole[], projectIds: string[] = []): Principal {
  return {
    type: "staff",
    userId: "actor",
    name: "Actor",
    email: null,
    phone: null,
    status: "active",
    lastLoginAt: null,
    memberships: projectIds.map((projectId) => ({
      projectId,
      projectRole: "staff" as const,
      clientSide: null,
      canViewFinance: false,
      canApprove: false,
    })),
    roles,
  };
}

describe("AuditLogService", () => {
  it("reads with all-scope and maps rows to views", async () => {
    const repo = new FakeRepository();
    const result = await harness(repo).service.list(staff(["SA"]), "all", { limit: 50 });
    expect(repo.list).toHaveBeenCalledWith({ kind: "all" }, {}, 50, undefined);
    expect(result.items[0]).toMatchObject({
      id: ROW.id,
      action: "update",
      entityType: "configuration",
      occurredAt: "2026-10-28T10:00:00.000Z",
    });
    expect(result.nextCursor).toBe("cursor-1");
  });

  it("scopes an assigned reader to their memberships", async () => {
    const repo = new FakeRepository();
    await harness(repo).service.list(staff(["PM"], ["p1", "p2"]), "assigned", { limit: 50 });
    expect(repo.list).toHaveBeenCalledWith(
      { kind: "projects", projectIds: ["p1", "p2"] },
      {},
      50,
      undefined,
    );
  });

  it("reaches no project when the scope is neither all nor assigned (fail-closed)", async () => {
    const repo = new FakeRepository();
    await harness(repo).service.list(staff(["SA"]), "own", { limit: 50 });
    expect(repo.list).toHaveBeenCalledWith({ kind: "projects", projectIds: [] }, {}, 50, undefined);
  });

  it("passes filters and cursor through to the repository", async () => {
    const repo = new FakeRepository();
    await harness(repo).service.list(staff(["SA"]), "all", {
      limit: 25,
      cursor: "c0",
      action: "delete",
      entityType: "role",
    });
    expect(repo.list).toHaveBeenCalledWith(
      { kind: "all" },
      { action: "delete", entityType: "role" },
      25,
      "c0",
    );
  });

  it("exports and audits the export with its filters and row count", async () => {
    const repo = new FakeRepository();
    const { service, record } = harness(repo);
    const result = await service.export(staff(["SA"]), "all", { action: "update" });
    expect(result).toMatchObject({ rowCount: 1, truncated: false });
    expect(result.rows).toHaveLength(1);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "export",
        entityType: "audit_log",
        after: { filters: { action: "update" }, rowCount: 1, truncated: false },
      }),
    );
  });
});
