import { describe, expect, it, vi } from "vitest";

import { requestContext, type RequestContext } from "../common/request-context.js";
import type { PrismaService } from "../db/prisma.service.js";
import { AuditService } from "./audit.service.js";
import type { Principal, StaffPrincipal, SystemPrincipal } from "./principal.types.js";

function setup() {
  const create = vi.fn().mockResolvedValue(undefined);
  const prisma = { auditEvent: { create } } as unknown as PrismaService;
  return { service: new AuditService(prisma), create };
}

const STAFF: StaffPrincipal = {
  type: "staff",
  userId: "user-1",
  name: "Priya Manager",
  email: "pm@example.com",
  phone: null,
  status: "active",
  lastLoginAt: null,
  memberships: [],
  roles: ["PM"],
};
const SYSTEM: SystemPrincipal = { type: "system", name: "retention job" };

function inRequest<T>(principal: Principal | null, fn: () => T): T {
  const context: RequestContext = {
    requestId: "req-1",
    ip: "203.0.113.9",
    principal,
    access: null,
  };
  return requestContext.run(context, fn);
}

describe("AuditService", () => {
  it("records the actor, request id and address from the request context", async () => {
    const { service, create } = setup();
    await inRequest(STAFF, () =>
      service.record({ action: "update", entityType: "users", entityId: "u-2", projectId: "p-1" }),
    );
    expect(create).toHaveBeenCalledWith({
      data: {
        actorUserId: "user-1",
        actorType: "user",
        action: "update",
        entityType: "users",
        entityId: "u-2",
        projectId: "p-1",
        beforeJson: undefined,
        afterJson: undefined,
        ipAddress: "203.0.113.9",
        requestId: "req-1",
      },
    });
  });

  it("masks secrets in Prisma-shaped (camelCase) before and after images", async () => {
    const { service, create } = setup();
    const token = { id: "t-1", tokenHash: "abc123", purpose: "invite", usedAt: null };
    const user = {
      id: "u-1",
      identitySubject: "cognito-sub",
      name: "Asha",
      email: "a@example.com",
    };
    await inRequest(STAFF, () =>
      service.record({
        action: "update",
        entityType: "auth_tokens",
        entityId: "t-1",
        before: token,
        after: user,
      }),
    );
    const { data } = create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(data["beforeJson"]).toEqual({ ...token, tokenHash: "[redacted]" });
    expect(data["afterJson"]).toEqual({
      ...user,
      identitySubject: "[redacted]",
      email: "[redacted]",
    });
    expect(JSON.stringify(data)).not.toMatch(/abc123|cognito-sub/);
  });

  it("records the system as the actor without a user, and nothing when there is no request", async () => {
    const { service, create } = setup();
    await inRequest(SYSTEM, () =>
      service.record({ action: "export", entityType: "guests", entityId: "g-1" }),
    );
    expect(create.mock.calls[0]?.[0].data).toMatchObject({
      actorUserId: null,
      actorType: "system",
    });
    await service.record({ action: "delete", entityType: "guests", entityId: "g-2" });
    expect(create.mock.calls[1]?.[0].data).toMatchObject({
      actorUserId: null,
      actorType: "user",
      ipAddress: null,
      requestId: null,
      projectId: null,
    });
  });
});
