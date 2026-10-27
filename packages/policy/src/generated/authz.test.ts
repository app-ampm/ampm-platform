/**
 * The generated authorisation suite (test-cases.md, architecture §6): for every row of the matrix
 * and every principal, the engine must allow exactly what the document allows. The cases are the
 * generated matrix itself, so a document change that is not regenerated fails here, and a drift
 * between the committed file and a fresh generation fails in CI (`pnpm authz:generate` then diff).
 */
import { describe, expect, it } from "vitest";

import { decide } from "../engine";
import { MATRIX, type MatrixRow } from "../matrix";
import { ACTION_LETTERS, STAFF_ROLE_CODES, type Action, type StaffRole } from "../roles";

const ALL_ACTIONS = Object.values(ACTION_LETTERS) as Action[];

function expected(
  row: MatrixRow,
  role: StaffRole,
  action: Action,
): "all" | "assigned" | "own" | null {
  let best: "all" | "assigned" | "own" | null = null;
  const rank = { all: 3, assigned: 2, own: 1 } as const;
  for (const grant of row.grants[role] ?? []) {
    if (grant.actions.includes(action) && (best === null || rank[grant.scope] > rank[best]))
      best = grant.scope;
  }
  return best;
}

describe("generated authorisation suite", () => {
  it("covers the whole staff matrix", () => {
    expect(MATRIX.staff.length).toBeGreaterThan(100);
    expect(MATRIX.others.length).toBeGreaterThan(20);
    expect(MATRIX.transitions.length).toBeGreaterThan(40);
  });

  for (const row of MATRIX.staff) {
    for (const role of STAFF_ROLE_CODES) {
      for (const action of ALL_ACTIONS) {
        const key = `${row.module}.${row.resource}.${action}`;
        const scope = expected(row, role, action);
        it(`${role} ${scope ? `may ${action} (${scope})` : `may not ${action}`} ${row.label} [${row.section}]`, () => {
          const unscoped = decide(
            { type: "staff", userId: "me", roles: [role], projectIds: ["p"] },
            key,
          );
          const assigned = decide(
            { type: "staff", userId: "me", roles: [role], projectIds: ["p"] },
            key,
            { projectId: "p", ownerId: "me" },
          );
          const foreign = decide(
            { type: "staff", userId: "me", roles: [role], projectIds: ["p"] },
            key,
            { projectId: "other", ownerId: "someone" },
          );
          if (scope === null) {
            expect(unscoped.allowed).toBe(false);
            expect(assigned.allowed).toBe(false);
          } else if (scope === "all") {
            expect(unscoped.allowed).toBe(true);
            expect(foreign.allowed).toBe(true);
          } else {
            expect(assigned.allowed).toBe(true);
            expect(foreign.allowed).toBe(false);
            expect(unscoped.allowed).toBe(false);
          }
        });
      }
    }
  }

  it("never grants a permission key to a client, guest or demo principal", () => {
    for (const type of ["client", "guest", "demo"] as const) {
      expect(decide({ type }, "admin.staff_users.read").allowed).toBe(false);
    }
  });
});
