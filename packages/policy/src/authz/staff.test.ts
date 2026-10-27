/**
 * The generated authorisation suite for staff (test-cases.md V-16 and AC-12.1, architecture §6):
 * every §5 row, the §5.16 reports included, × every role × every action. The cases come from the
 * generated matrix, so this proves decide() applies each cell's scope and conditions; whether the
 * parse matches the document is proved by the golden tests (*.golden.test.ts and scripts/*.test.ts),
 * and an unregenerated document change fails the CI drift check
 * (`pnpm authz:generate && git diff --exit-code -- packages/policy/src/generated`).
 *
 * Targets keep assigned and own apart: the member project with someone else's record reaches an
 * (a) grant only, the user's own record in a foreign project an (o) grant only.
 */
import { describe, expect, it } from "vitest";

import { decide, type PolicyTarget } from "../engine";
import { MATRIX, type Grant } from "../matrix";
import { ACTION_LETTERS, STAFF_ROLE_CODES, type Action, type StaffRole } from "../roles";
import { FOREIGN_PROJECT, ME, MEMBER_PROJECT, SOMEONE, factsFor, member } from "./fixtures";

const ALL_ACTIONS: readonly Action[] = Object.values(ACTION_LETTERS);
const ASSIGNED_TARGET = { projectId: MEMBER_PROJECT, ownerId: SOMEONE } as const;
const OWN_TARGET = { projectId: FOREIGN_PROJECT, ownerId: ME } as const;
const FOREIGN_TARGET = { projectId: FOREIGN_PROJECT, ownerId: SOMEONE } as const;

function expectGrant(grant: Grant, role: StaffRole, key: string): void {
  const { facts, explicitGrant } = factsFor(grant.conditions);
  const principal = member(role, explicitGrant ? key : undefined);
  const inScope: PolicyTarget =
    grant.scope === "own" ? OWN_TARGET : grant.scope === "assigned" ? ASSIGNED_TARGET : {};
  const target: PolicyTarget = {
    ...inScope,
    ...facts,
    ...(explicitGrant ? { projectId: MEMBER_PROJECT } : {}),
  };
  expect(decide(principal, key, target)).toEqual({
    allowed: true,
    scope: grant.scope,
    reason: "granted",
  });
  if (grant.scope === "all") {
    expect(decide(principal, key, { ...FOREIGN_TARGET, ...facts }).allowed).toBe(!explicitGrant);
  } else {
    const outOfScope = grant.scope === "own" ? ASSIGNED_TARGET : OWN_TARGET;
    expect(decide(principal, key, { ...outOfScope, ...facts }).reason).toBe(
      grant.scope === "own" ? "not_owner" : "not_assigned",
    );
    expect(decide(principal, key, facts).allowed).toBe(false);
  }
  if (grant.conditions.length > 0) {
    // Without the facts, and without an explicit grant, the cell's narrowing holds.
    expect(decide(member(role), key, inScope).reason).toBe("condition_unmet");
  }
}

function expectNoGrant(role: StaffRole, key: string): void {
  const principal = member(role, key);
  for (const target of [{}, ASSIGNED_TARGET, OWN_TARGET]) {
    expect(decide(principal, key, target)).toEqual({ allowed: false, reason: "no_grant" });
  }
}

describe("generated authorisation suite: §5 staff roles", () => {
  it("covers every row of §5, the reports of §5.16 included", () => {
    expect(MATRIX.staff.filter((row) => row.section !== "5.16").length).toBeGreaterThanOrEqual(105);
    expect(MATRIX.staff.filter((row) => row.section === "5.16")).toHaveLength(11);
  });

  for (const row of MATRIX.staff) {
    for (const role of STAFF_ROLE_CODES) {
      for (const action of ALL_ACTIONS) {
        const key = `${row.module}.${row.resource}.${action}`;
        const grants = (row.grants[role] ?? []).filter((grant) => grant.actions.includes(action));
        const [grant] = grants;
        const title = grant
          ? `may ${action} (${grant.scope}${grant.conditions.length ? ", conditioned" : ""})`
          : `may not ${action}`;
        it(`${role} ${title} ${row.label} [${row.section}]`, () => {
          expect(grants.length).toBeLessThanOrEqual(1);
          if (grant) expectGrant(grant, role, key);
          else expectNoGrant(role, key);
        });
      }
    }
  }

  for (const row of MATRIX.staff) {
    it(`never gives a key to a client, guest or demo principal: ${row.label} [${row.section}]`, () => {
      for (const type of ["client", "guest", "demo"] as const) {
        for (const action of ALL_ACTIONS) {
          const decision = decide({ type, userId: ME }, `${row.module}.${row.resource}.${action}`);
          expect(decision).toEqual({ allowed: false, reason: "not_staff" });
        }
      }
    });
  }
});
