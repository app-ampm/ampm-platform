import { describe, expect, it, vi } from "vitest";

import {
  requestContext,
  type HotelFormActor,
  type RequestContext,
} from "../common/request-context.js";
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
      identitySubject: "ampm:sub-1",
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
    expect(JSON.stringify(data)).not.toMatch(/abc123|ampm:sub-1/);
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

describe("AuditService: hotel-form contributors (D-180, D-189 §6)", () => {
  const REQUEST_ID = "0196a0b0-0000-7000-8000-00000000f001";
  const PERSON_ID = "0196a0b0-0000-7000-8000-00000000f002";
  const CHALLENGE_ID = "0196a0b0-0000-7000-8000-00000000f003";

  /** A public hotel-form request (no principal) whose actor the form has set. */
  function asContributor<T>(actor: HotelFormActor, fn: () => Promise<T>): Promise<T> {
    return inRequest(null, () => {
      requestContext.setHotelFormActor(actor);
      return fn();
    });
  }

  it("records guest_token with no user and the person's actor_ref", async () => {
    const { service, create } = setup();
    await asContributor({ requestId: REQUEST_ID, personId: PERSON_ID }, () =>
      service.record({
        action: "update",
        entityType: "hotel_info_request_person",
        entityId: PERSON_ID,
      }),
    );
    expect(create.mock.calls[0]?.[0].data).toMatchObject({
      actorUserId: null,
      actorType: "guest_token",
      actorRef: `hir:${REQUEST_ID}/person:${PERSON_ID}`,
      ipAddress: "203.0.113.9",
      requestId: "req-1",
    });
  });

  it("records the challenge as the actor before a person exists", async () => {
    const { service, create } = setup();
    await asContributor({ requestId: REQUEST_ID, challengeId: CHALLENGE_ID }, () =>
      service.record({
        action: "create",
        entityType: "hotel_info_request_challenge",
        entityId: CHALLENGE_ID,
      }),
    );
    expect(create.mock.calls[0]?.[0].data).toMatchObject({
      actorType: "guest_token",
      actorRef: `hir:${REQUEST_ID}/challenge:${CHALLENGE_ID}`,
    });
  });

  it("keeps only ids, changed field names and masked values in the images, even unmasked ones", async () => {
    const { service, create } = setup();
    const after = {
      id: PERSON_ID,
      requestId: REQUEST_ID,
      fullName: "Synthetic Person",
      designation: "Sales Manager",
      changedFields: ["fullName", "designation"],
      note: "free text a stranger typed",
    };
    await asContributor({ requestId: REQUEST_ID, personId: PERSON_ID }, () =>
      service.record({
        action: "update",
        entityType: "hotel_info_request_person",
        entityId: PERSON_ID,
        before: { id: PERSON_ID, fullName: "Synthetic Before" },
        after,
        // A caller cannot turn the allow-list off for a contributor.
        maskImages: false,
      }),
    );
    const { data } = create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(data["beforeJson"]).toEqual({ id: PERSON_ID, fullName: "[redacted]" });
    expect(data["afterJson"]).toEqual({
      id: PERSON_ID,
      requestId: REQUEST_ID,
      fullName: "[redacted]",
      designation: "[redacted]",
      changedFields: ["fullName", "designation"],
    });
    expect(JSON.stringify(data)).not.toMatch(/Synthetic|Sales Manager|free text/);
  });

  it("puts no actor_ref on a staff or System event", async () => {
    const { service, create } = setup();
    await inRequest(STAFF, () =>
      service.record({ action: "update", entityType: "users", entityId: "u-2" }),
    );
    await inRequest(SYSTEM, () =>
      service.record({ action: "export", entityType: "guests", entityId: "g-1" }),
    );
    for (const call of create.mock.calls) expect(call[0].data).not.toHaveProperty("actorRef");
  });
});
