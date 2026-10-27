/**
 * Golden cases for canTransition(): every expected value is copied from docs/permission-matrix.md §7
 * (line in the test name), never read from matrix.json.
 */
import { describe, expect, it } from "vitest";

import type { PolicyPrincipal } from "./engine";
import type { StaffRole } from "./roles";
import { canTransition } from "./transitions";

function staff(roles: readonly StaffRole[], userId = "u-1"): PolicyPrincipal {
  return { type: "staff", userId, roles, projectIds: ["p-1"] };
}
const system: PolicyPrincipal = { type: "system" };
const client: PolicyPrincipal = { type: "client", userId: "c-1", projectIds: ["p-1"] };
const onProject = { projectId: "p-1" };

describe("§7 wedding project", () => {
  it("§7 line 419, §5.15 line 312: FA cannot close a wedding; PM (a) and SA can", () => {
    expect(canTransition(staff(["FA"]), "wedding_project", "closure", "closed", onProject)).toBe(
      null,
    );
    expect(
      canTransition(staff(["PM"]), "wedding_project", "closure", "closed", onProject),
    ).not.toBeNull();
    expect(canTransition(staff(["PM"]), "wedding_project", "closure", "closed")).toBeNull();
    expect(canTransition(staff(["SA"]), "wedding_project", "closure", "closed")).not.toBeNull();
  });

  it("§7 line 421: on_hold goes back to the previous status only", () => {
    const sa = staff(["SA"]);
    expect(
      canTransition(sa, "wedding_project", "on_hold", "planning", { previousStatus: "planning" }),
    ).not.toBeNull();
    expect(
      canTransition(sa, "wedding_project", "on_hold", "planning", { previousStatus: "live" }),
    ).toBeNull();
    expect(canTransition(sa, "wedding_project", "on_hold", "planning")).toBeNull();
    expect(
      canTransition(staff(["PM"]), "wedding_project", "on_hold", "live", {
        ...onProject,
        previousStatus: "live",
      }),
    ).not.toBeNull();
  });

  it("§7 line 422: only the Super Admin reopens a closed wedding", () => {
    expect(canTransition(staff(["SA"]), "wedding_project", "closed", "closure")).not.toBeNull();
    expect(
      canTransition(staff(["PM"]), "wedding_project", "closed", "closure", onProject),
    ).toBeNull();
  });
});

describe("§7 'any <qualifier>' rows never reach terminal states", () => {
  it("§7 line 455: a resolved or closed incident is not escalated by 'any open state'", () => {
    const pm = staff(["PM"]);
    for (const from of ["resolved", "closed"]) {
      expect(canTransition(pm, "incident", from, "escalated", onProject)).toBeNull();
      expect(canTransition(system, "incident", from, "escalated")).toBeNull();
      expect(canTransition(pm, "incident", from, "escalated", { assigneeId: "u-1" })).toBeNull();
    }
    expect(canTransition(system, "incident", "open", "escalated")).not.toBeNull();
    expect(canTransition(pm, "incident", "in_progress", "escalated", onProject)).not.toBeNull();
    expect(
      canTransition(staff([]), "incident", "assigned", "escalated", { assigneeId: "u-1" }),
    ).not.toBeNull();
  });

  it("§7 line 405: a confirmed or closed enquiry does not return to proposal_received", () => {
    const ht = staff(["HT"]);
    expect(canTransition(ht, "hotel_enquiry", "closed", "proposal_received")).toBeNull();
    expect(canTransition(ht, "hotel_enquiry", "confirmed", "proposal_received")).toBeNull();
    expect(canTransition(ht, "hotel_enquiry", "negotiating", "proposal_received")).not.toBeNull();
  });
});

describe("§7 client request", () => {
  it("§7 lines 478-480: the assigned staff member reviews, questions and answers a request", () => {
    const assignee = staff(["RG"]);
    const assigned = { assigneeId: "u-1" };
    expect(
      canTransition(assignee, "client_request", "submitted", "under_review", assigned),
    ).not.toBeNull();
    expect(
      canTransition(
        assignee,
        "client_request",
        "under_review",
        "clarification_requested",
        assigned,
      ),
    ).not.toBeNull();
    expect(
      canTransition(assignee, "client_request", "under_review", "answered", {
        ...assigned,
        kind: "question",
      }),
    ).not.toBeNull();
    expect(
      canTransition(assignee, "client_request", "under_review", "answered", {
        ...assigned,
        kind: "change_request",
      }),
    ).toBeNull();
    expect(
      canTransition(staff(["RG"], "u-2"), "client_request", "submitted", "under_review", assigned),
    ).toBeNull();
  });

  it("§7 line 481: PM (a) or SA accept or reject a change request, not a question", () => {
    const pm = staff(["PM"]);
    const change = { ...onProject, kind: "change_request" };
    expect(canTransition(pm, "client_request", "under_review", "rejected", change)).not.toBeNull();
    expect(canTransition(pm, "client_request", "under_review", "accepted", change)).not.toBeNull();
    expect(
      canTransition(pm, "client_request", "under_review", "rejected", {
        ...onProject,
        kind: "question",
      }),
    ).toBeNull();
    expect(
      canTransition(staff(["SA"]), "client_request", "under_review", "rejected", {
        kind: "change_request",
      }),
    ).not.toBeNull();
  });

  it("§7 line 483: the requester withdraws their own request", () => {
    expect(
      canTransition(client, "client_request", "submitted", "withdrawn", { requesterId: "c-1" }),
    ).not.toBeNull();
    expect(
      canTransition(client, "client_request", "under_review", "withdrawn", {
        requesterId: "c-2",
      }),
    ).toBeNull();
    expect(
      canTransition(staff(["SA"]), "client_request", "submitted", "withdrawn", {
        requesterId: "c-1",
      }),
    ).toBeNull();
  });
});

describe("§7 function readiness and subscriptions", () => {
  it("§7 line 446, data-model.md lines 849 and 1838: only the System derives readiness, even past an exception", () => {
    expect(canTransition(system, "function_readiness", "blocked", "ready")).not.toBeNull();
    expect(canTransition(system, "function_readiness", "not_started", "ready")).not.toBeNull();
    // AC-13.2: SA authorises the exception on the checklist item (decide() on readiness_exceptions);
    // the System then derives ready. A caller's claim of an exception moves nothing.
    const claimed = { ...onProject, exception: true };
    for (const from of ["not_started", "in_progress", "blocked"]) {
      expect(canTransition(staff(["SA"]), "function_readiness", from, "ready", claimed)).toBeNull();
      expect(canTransition(staff(["PM"]), "function_readiness", from, "ready", claimed)).toBeNull();
    }
  });

  it("§7 line 447: a ready function goes live by PM (a) or HL (a) on the day", () => {
    expect(
      canTransition(staff(["HL"]), "function_readiness", "ready", "live", onProject),
    ).not.toBeNull();
    expect(canTransition(staff(["CD"]), "function_readiness", "ready", "live", onProject)).toBe(
      null,
    );
  });

  it("§7 line 389: the System activates on payment; FA or SA manually; never Sales", () => {
    expect(canTransition(system, "subscription", "pending_payment", "active")).not.toBeNull();
    expect(canTransition(staff(["FA"]), "subscription", "trial", "active")).not.toBeNull();
    expect(canTransition(staff(["SM"]), "subscription", "pending_payment", "active")).toBeNull();
  });

  it("§7 lines 394-395: a client asks to cancel through a request; an expired row is never reactivated", () => {
    expect(canTransition(client, "subscription", "active", "cancelled")).toBeNull();
    expect(canTransition(staff(["SM"]), "subscription", "active", "cancelled")).not.toBeNull();
    for (const from of ["expired", "cancelled"]) {
      expect(canTransition(staff(["SA"]), "subscription", from, "active")).toBeNull();
      expect(canTransition(system, "subscription", from, "active")).toBeNull();
    }
  });
});
