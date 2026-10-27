import type { PolicyPrincipal, StaffRole } from "@ampm/policy";
import { describe, expect, it } from "vitest";

import { refusalFor } from "./refusal.js";

const MEMBER = "0192f3a0-7d3e-7b1a-9c2f-0000000000a1";
const OTHER = "0192f3a0-7d3e-7b1a-9c2f-0000000000b2";

function staff(roles: StaffRole[]): PolicyPrincipal {
  return { type: "staff", userId: `u-${roles.join("-")}`, roles, projectIds: [MEMBER] };
}

describe("refusalFor (test-cases.md line 212, denial semantics)", () => {
  it("§5.13 line 296: a 403 for CD (a), who reads the incidents it may not update", () => {
    expect(refusalFor(staff(["CD"]), "tasks.incidents.update", MEMBER).status).toBe(403);
  });

  it("the 404 of a missing record outside the wedding, or for a role that reads none", () => {
    expect(refusalFor(staff(["CD"]), "tasks.incidents.update", OTHER).toEnvelope()).toEqual({
      error: { code: "not_found", message: "Not found" },
    });
    expect(refusalFor(staff(["SM"]), "tasks.incidents.update", MEMBER).status).toBe(404);
  });

  it("§5.13 line 293: a 404 where the only read is the principal's own records", () => {
    expect(refusalFor(staff(["FA"]), "tasks.tasks.delete", MEMBER).status).toBe(404);
  });
});
