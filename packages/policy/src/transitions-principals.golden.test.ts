/**
 * Golden cases for who §7's people are: "The requester", "The owner", "The creator" and "The
 * assignee" are bound to the principal types the document gives each record (§6 and §5.9), never
 * matched by user id alone. Expected values come from docs/permission-matrix.md, line in the name.
 */
import { describe, expect, it } from "vitest";

import type { PolicyPrincipal } from "./engine";
import { canTransition } from "./transitions";

const staffMember: PolicyPrincipal = {
  type: "staff",
  userId: "u-1",
  roles: [],
  projectIds: ["p-1"],
};
const client: PolicyPrincipal = { type: "client", userId: "u-1", projectIds: ["p-1"] };
const guest: PolicyPrincipal = { type: "guest", userId: "u-1", projectIds: ["p-1"] };
const demo: PolicyPrincipal = { type: "demo", userId: "u-1", projectIds: ["p-1"] };
const mine = { projectId: "p-1", requesterId: "u-1" };

describe("§7 actors are bound to the principals the record allows", () => {
  it("§7 line 483 with §6 line 366: a guest or the demo withdraws the request they submitted", () => {
    for (const principal of [client, guest, demo]) {
      expect(
        canTransition(principal, "client_request", "submitted", "withdrawn", mine),
        principal.type,
      ).not.toBeNull();
    }
    const theirs = { projectId: "p-1", requesterId: "u-2" };
    expect(canTransition(guest, "client_request", "submitted", "withdrawn", theirs)).toBeNull();
  });

  it("§7 line 483 with §5.9 line 250: a client request's requester is a client, guest or demo", () => {
    expect(canTransition(staffMember, "client_request", "submitted", "withdrawn", mine)).toBeNull();
  });

  it("§7 lines 462-464 with §6 line 370: a task's owner and creator are staff; a client only reads tasks", () => {
    const owned = { projectId: "p-1", ownerId: "u-1", creatorId: "u-1" };
    expect(canTransition(staffMember, "task", "not_started", "completed", owned)).not.toBeNull();
    expect(canTransition(staffMember, "task", "in_progress", "cancelled", owned)).not.toBeNull();
    for (const principal of [client, guest, demo]) {
      expect(canTransition(principal, "task", "not_started", "completed", owned)).toBeNull();
      expect(canTransition(principal, "task", "in_progress", "cancelled", owned)).toBeNull();
    }
  });

  it("§7 line 427 with §5.9 line 251: an approval's requester is staff; clients decide, not submit", () => {
    expect(canTransition(staffMember, "approval", "draft", "submitted", mine)).not.toBeNull();
    expect(canTransition(client, "approval", "draft", "submitted", mine)).toBeNull();
  });

  it("§7 lines 454-456: an incident's assignee is staff", () => {
    const assigned = { projectId: "p-1", assigneeId: "u-1" };
    expect(
      canTransition(staffMember, "incident", "assigned", "in_progress", assigned),
    ).not.toBeNull();
    expect(canTransition(client, "incident", "assigned", "in_progress", assigned)).toBeNull();
  });
});
