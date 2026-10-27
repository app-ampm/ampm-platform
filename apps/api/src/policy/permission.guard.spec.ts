import { Reflector } from "@nestjs/core";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host.js";
import { isAppError, type Membership } from "@ampm/core";
import type { StaffRole } from "@ampm/policy";
import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../common/logger.service.js";
import { requestContext, type RequestContext } from "../common/request-context.js";
import { RequirePermission } from "./decorators.js";
import { PermissionGuard } from "./permission.guard.js";
import type { ClientPrincipal, Principal, StaffPrincipal } from "./principal.types.js";

const MEMBER = "0192f3a0-7d3e-7b1a-9c2f-0000000000a1";
const OTHER = "0192f3a0-7d3e-7b1a-9c2f-0000000000b2";

/** Routes as a controller declares them; the guard reads the same metadata. */
class Routes {
  @RequirePermission("tasks.incidents.read", { projectParam: "projectId" })
  readIncidents(): void {}

  @RequirePermission("tasks.incidents.update", { projectParam: "projectId" })
  updateIncident(): void {}

  @RequirePermission("tasks.tasks.read", { projectParam: "projectId" })
  readTasks(): void {}

  @RequirePermission("tasks.tasks.delete", { projectParam: "projectId" })
  deleteTask(): void {}

  @RequirePermission("budget.budget_lines_client_facing.read_internal_cost", {
    projectParam: "projectId",
  })
  readInternalCost(): void {}

  // §10 line 551.
  @RequirePermission("projects.close:assigned", { projectParam: "projectId" })
  closeProject(): void {}

  @RequirePermission("functions.readiness_exceptions.authorise_exception", {
    projectParam: "projectId",
  })
  authoriseException(): void {}

  // §10 line 550 spells the same decision as the document does.
  @RequirePermission("functions.readiness.authorise_exception:assigned", {
    projectParam: "projectId",
  })
  authoriseExceptionAsDocumented(): void {}

  // §10 line 543.
  @RequirePermission("budget.lines.read_internal_cost:assigned", { projectParam: "projectId" })
  readInternalCostAsDocumented(): void {}

  open(): void {}
}

function membership(projectId: string): Membership {
  return {
    projectId,
    projectRole: "staff",
    clientSide: null,
    canViewFinance: false,
    canApprove: false,
  };
}

function staff(roles: StaffRole[], projects: string[] = [MEMBER]): StaffPrincipal {
  return {
    type: "staff",
    userId: `user-${roles.join("-")}`,
    name: roles.join("+"),
    email: null,
    phone: null,
    status: "active",
    lastLoginAt: null,
    memberships: projects.map(membership),
    roles,
  };
}

const CLIENT: ClientPrincipal = {
  ...staff([]),
  type: "client",
  memberships: [{ ...membership(MEMBER), projectRole: "client_representative" }],
  entitlements: {
    modules: ["wedding_workspace"],
    readOnlyModules: [],
    hotelReach: [],
    financeReach: [],
    requestTypes: { wedding: [], account: [] },
    signInRefused: false,
  },
};

/** Runs the guard on one route as `principal`, returning what it decided and the access it left. */
function run(principal: Principal | null, route: keyof Routes, projectId = MEMBER) {
  const logger = { info: vi.fn() } as unknown as AppLogger;
  const guard = new PermissionGuard(new Reflector(), logger);
  const request = { params: { projectId } };
  const context = new ExecutionContextHost(
    [request, {}, () => undefined],
    Routes,
    Routes.prototype[route],
  );
  const store: RequestContext = { requestId: "req-1", ip: null, principal, access: null };
  return requestContext.run(store, () => {
    try {
      return { allowed: guard.canActivate(context), access: store.access, status: undefined };
    } catch (error) {
      if (!isAppError(error)) throw error;
      return { allowed: false, access: store.access, status: error.status };
    }
  });
}

describe("PermissionGuard (architecture §6 step 4)", () => {
  it("lets a route without a permission key through", () => {
    expect(run(staff(["PM"]), "open").allowed).toBe(true);
  });

  it("asks for a principal on a guarded route", () => {
    expect(run(null, "readIncidents").status).toBe(401);
  });

  it("permission-matrix §5.13 line 296: SA reaches every wedding, PM (a) its own", () => {
    expect(run(staff(["SA"], []), "readIncidents", OTHER)).toMatchObject({
      allowed: true,
      access: { key: "tasks.incidents.read", scope: "all" },
    });
    expect(run(staff(["PM"]), "readIncidents")).toMatchObject({
      allowed: true,
      access: { scope: "assigned" },
    });
  });

  it("test-cases.md denial semantics: PM (other) gets the 404 of a missing record", () => {
    expect(run(staff(["PM"]), "readIncidents", OTHER)).toMatchObject({
      allowed: false,
      status: 404,
      access: null,
    });
    expect(run(staff(["PM"]), "updateIncident", OTHER).status).toBe(404);
  });

  it("test-cases.md denial semantics: CD (a) sees the incidents but may not update them, a 403", () => {
    expect(run(staff(["CD"]), "readIncidents").allowed).toBe(true);
    expect(run(staff(["CD"]), "updateIncident").status).toBe(403);
    expect(run(staff(["CD"]), "updateIncident", OTHER).status).toBe(404);
  });

  it("§5 legend line 136, §5.13 line 293: an own-scope grant passes as own for the repository", () => {
    expect(run(staff(["FA"], []), "readTasks", OTHER)).toMatchObject({
      allowed: true,
      access: { scope: "own" },
    });
    // §1 line 51: PM's assigned miss does not take away FA's own records.
    expect(run(staff(["PM", "FA"]), "readTasks", OTHER).access).toEqual({
      key: "tasks.tasks.read",
      scope: "own",
    });
  });

  it("§5.13 line 293, test-cases.md line 212: FA and SM see only their own tasks, so a delete is a 404", () => {
    // Their read is "(o)": before the task is read the guard cannot tell theirs from Bob's.
    expect(run(staff(["FA"], []), "deleteTask", OTHER).status).toBe(404);
    expect(run(staff(["SM"], []), "deleteTask", OTHER).status).toBe(404);
    expect(run(staff(["FA"]), "deleteTask").status).toBe(404);
    // CD (a) reads every task of its wedding, so the same refusal is a 403 there.
    expect(run(staff(["CD"]), "deleteTask").status).toBe(403);
    expect(run(staff(["PM"]), "deleteTask").allowed).toBe(true);
  });

  it("§6 line 338: a client never holds a staff key and sees no staff records, a 404", () => {
    expect(run(CLIENT, "readIncidents").status).toBe(404);
  });

  it("refuses a role that holds nothing on the row as absence, a 404", () => {
    expect(run(staff(["SM"]), "readIncidents").status).toBe(404);
  });

  it("test-cases.md line 212, §5.7 line 215: CD (a) sees the line but not its internal cost, a 403", () => {
    expect(run(staff(["CD"]), "readInternalCost").status).toBe(403);
    expect(run(staff(["CD"]), "readInternalCost", OTHER).status).toBe(404);
  });

  it("§5.15 line 312: PM (a) closing before the checklist is complete sees its wedding, a 403", () => {
    expect(run(staff(["PM"]), "closeProject").status).toBe(403);
    expect(run(staff(["PM"]), "closeProject", OTHER).status).toBe(404);
    expect(run(staff(["SA"], []), "closeProject", OTHER).allowed).toBe(true);
  });

  it("AC-13.2 (test-cases.md line 925): HL and PM authorising an exception get 403, 404 outside", () => {
    for (const role of ["HL", "PM"] as const) {
      expect(run(staff([role]), "authoriseException").status).toBe(403);
      expect(run(staff([role]), "authoriseException", OTHER).status).toBe(404);
    }
    expect(run(staff(["SA"], []), "authoriseException").allowed).toBe(true);
  });

  it("§10 line 550, AC-13.2: the key as §10 spells it refuses HL and PM (a) with 403, lets SA through", () => {
    for (const role of ["HL", "PM"] as const) {
      expect(run(staff([role]), "authoriseExceptionAsDocumented").status).toBe(403);
      expect(run(staff([role]), "authoriseExceptionAsDocumented", OTHER).status).toBe(404);
    }
    expect(run(staff(["SA"], []), "authoriseExceptionAsDocumented", OTHER).allowed).toBe(true);
  });

  it("§10 line 543, §5.7 lines 215-216: budget.lines.read_internal_cost as §10 spells it", () => {
    expect(run(staff(["PM"]), "readInternalCostAsDocumented").allowed).toBe(true);
    expect(run(staff(["CD"]), "readInternalCostAsDocumented").status).toBe(403);
    expect(run(staff(["CD"]), "readInternalCostAsDocumented", OTHER).status).toBe(404);
    expect(run(staff(["FA"], []), "readInternalCostAsDocumented", OTHER).allowed).toBe(true);
  });
});
