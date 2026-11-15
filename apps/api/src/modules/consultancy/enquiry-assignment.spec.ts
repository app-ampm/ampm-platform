import { HOTEL_ENQUIRY_OPEN_STATUSES } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import type { PrincipalService } from "../../policy/principal.service.js";
import type { Principal } from "../../policy/principal.types.js";
import {
  assigneeWhere,
  ENQUIRY_HOLDER_KEY,
  EnquiryAssignmentService,
} from "./enquiry-assignment.js";

const HEMA = { id: "0192f3a0-7d3e-7b1a-9c2f-0000000000e1", name: "Hema Hotels" };
const FARAH = "0192f3a0-7d3e-7b1a-9c2f-0000000000e2";

/** The policy kernel's lookup: Hema can hold an enquiry; anyone else asked about cannot. */
function assignment() {
  const principals = {
    staffHolding: vi.fn(async (_key: string, ids?: readonly string[]) =>
      [HEMA].filter((member) => ids === undefined || ids.includes(member.id)),
    ),
  };
  return {
    service: new EnquiryAssignmentService(principals as unknown as PrincipalService),
    principals,
  };
}

const reader = (userId: string): Principal => ({
  type: "staff",
  userId,
  name: "Reader",
  email: null,
  phone: null,
  status: "active",
  lastLoginAt: null,
  memberships: [],
  roles: ["HT"],
});

describe("EnquiryAssignmentService", () => {
  it("lists the people the update grant reaches on every enquiry", async () => {
    const { service, principals } = assignment();
    expect(await service.assignees()).toEqual([HEMA]);
    expect(principals.staffHolding).toHaveBeenCalledWith(ENQUIRY_HOLDER_KEY);
  });

  it("accepts someone on the hotel team as the owner", async () => {
    const { service } = assignment();
    await expect(service.assertAssignable(HEMA.id, null)).resolves.toBeUndefined();
  });

  it("refuses an owner who cannot work the enquiry, on the assignedUserId field", async () => {
    const { service } = assignment();
    await expect(service.assertAssignable(FARAH, null)).rejects.toMatchObject({
      code: "validation_failed",
      message: "Choose someone on the hotel team who can work this enquiry",
      details: [expect.objectContaining({ path: "assignedUserId" })],
    });
  });

  it("clears, keeps the current owner, or leaves the owner alone without looking anyone up", async () => {
    const { service, principals } = assignment();
    await service.assertAssignable(null, FARAH);
    await service.assertAssignable(FARAH, FARAH);
    await service.assertAssignable(undefined, null);
    expect(principals.staffHolding).not.toHaveBeenCalled();
  });
});

describe("assigneeWhere", () => {
  const open = { in: [...HOTEL_ENQUIRY_OPEN_STATUSES] };

  it("narrows to the reader's open enquiries, or the open ones nobody holds", () => {
    expect(assigneeWhere("me", reader(HEMA.id))).toEqual({
      status: open,
      assignedUserId: HEMA.id,
    });
    expect(assigneeWhere("unassigned", reader(HEMA.id))).toEqual({
      status: open,
      assignedUserId: null,
    });
  });

  it("leaves the queue whole without a filter, and finds nothing held by the system", () => {
    expect(assigneeWhere(undefined, reader(HEMA.id))).toEqual({});
    expect(assigneeWhere("me", { type: "system", name: "sweep" })).toEqual({ id: { in: [] } });
  });

  it("never counts an outcome as open work", () => {
    expect(HOTEL_ENQUIRY_OPEN_STATUSES).not.toContain("confirmed");
    expect(HOTEL_ENQUIRY_OPEN_STATUSES).not.toContain("closed");
    expect(HOTEL_ENQUIRY_OPEN_STATUSES).toContain("submitted");
  });
});
