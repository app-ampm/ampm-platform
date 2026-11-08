/**
 * The generated authorisation suite for client, guest and demo principals (test-cases.md V-16,
 * permission-matrix §6): every §6 row × every column × every action, through clientReach() and
 * decideReach(). Guest tokens are deferred with the guest principal (D-023), but their column is
 * parsed and checked the same way.
 */
import { describe, expect, it } from "vitest";

import { MATRIX } from "../matrix";
import { clientReach, decideReach, type ReachPrincipal } from "../reach";
import { ACTION_LETTERS, type Action } from "../roles";
import { documentRows } from "./document";
import { factsFor } from "./fixtures";

const ALL_ACTIONS: readonly Action[] = Object.values(ACTION_LETTERS);
const COLUMNS: readonly [ReachPrincipal, string][] = [
  ["client", "CR"],
  ["guest", "GU"],
  ["demo", "DP"],
];

describe("generated authorisation suite: §6 client, guest and demo principals", () => {
  it("covers every row of §6, as the document's text counts them", () => {
    const rows = documentRows("## 6. Permission matrix", "## 7. Status transitions");
    expect(rows).toBe(33);
    expect(MATRIX.others).toHaveLength(rows);
  });

  for (const row of MATRIX.others) {
    for (const [type, column] of COLUMNS) {
      const cell = row.grants[column] ?? [];

      it(`${column} reaches exactly its cell "${row.cells[column] ?? ""}": ${row.label}`, () => {
        expect(clientReach(type, row.resource)).toEqual(cell);
        expect(clientReach(type, row.label)).toEqual(cell);
        // §6 line 339: "Own" is the wedding or account the principal belongs to, for every grant.
        for (const grant of cell) expect(grant.scope).toBe("own");
      });

      for (const action of ALL_ACTIONS) {
        const grants = cell.filter((grant) => grant.actions.includes(action));
        const [grant] = grants;
        it(`${column} ${grant ? "may" : "may not"} ${action} ${row.label}`, () => {
          expect(grants.length).toBeLessThanOrEqual(1);
          if (!grant) {
            expect(decideReach(type, row.resource, action).reason).toBe("no_grant");
            return;
          }
          const { facts } = factsFor(grant.conditions);
          expect(decideReach(type, row.resource, action, facts)).toEqual({
            allowed: true,
            scope: "own",
            reason: "granted",
          });
          if (grant.conditions.length > 0) {
            expect(decideReach(type, row.resource, action).reason).toBe("condition_unmet");
          }
        });
      }
    }
  }
});
