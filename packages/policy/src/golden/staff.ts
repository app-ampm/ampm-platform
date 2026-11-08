import { expect } from "vitest";

import { FOREIGN_PROJECT, ME, MEMBER_PROJECT, SOMEONE, member } from "../authz/fixtures";
import type { ConditionFacts } from "../conditions";
import { decide, type PolicyTarget } from "../engine";
import type { DenialReason } from "../evaluate";
import { MODULES, RESOURCES, slugify } from "../resources";
import { ACTION_LETTERS, type Action, type Scope, type StaffRole } from "../roles";
import { refusedVariants } from "./facts";

/*
 * The §5 golden tables' vocabulary and assertions. A table row is written by hand from
 * docs/permission-matrix.md: per role, the letters of each run of the cell, their scope, and the
 * facts its note needs, in full. Keys are named as resources.ts names rows, never read from the parse.
 */

/**
 * One run of a cell's letters ("CRU (a)"), with the facts its note needs ("theme, dress code").
 *
 * @example
 * const hotelLines: GoldenGrant = all("RU", { side: "hotel" });
 */
export interface GoldenGrant {
  readonly letters: string;
  readonly scope: Scope;
  readonly facts: ConditionFacts;
  /** "with explicit grant": the user holds an explicit grant of the key on the wedding (P-5). */
  readonly explicit: boolean;
}

/**
 * A role's cell: letters at scope all, one run, or several runs ("CR (a) UD (o)").
 *
 * @example
 * const cell: GoldenCell = [assigned("CR"), own("UD")];
 */
export type GoldenCell = string | GoldenGrant | readonly GoldenGrant[];

/**
 * One §5 row as the document writes it; a role it does not list has "—".
 *
 * @example
 * row(146, "5.1", "Audit log", { SA: "RX", PM: assigned("R") });
 */
export interface GoldenRow {
  readonly line: number;
  readonly section: string;
  readonly label: string;
  readonly cells: Readonly<Partial<Record<StaffRole, GoldenCell>>>;
}

/** @example all("RU", { side: "hotel" }); // "RU hotel lines" */
export const all = (letters: string, facts: ConditionFacts = {}): GoldenGrant => ({
  letters,
  scope: "all",
  facts,
  explicit: false,
});
/** @example assigned("CRU"); // "CRU (a)" */
export const assigned = (letters: string, facts: ConditionFacts = {}): GoldenGrant => ({
  ...all(letters, facts),
  scope: "assigned",
});
/** @example own("R"); // "R (o)" */
export const own = (letters: string, facts: ConditionFacts = {}): GoldenGrant => ({
  ...all(letters, facts),
  scope: "own",
});

/** @example explicit(assigned("CRU")); // "CRU (a) with explicit grant" */
export const explicit = (grant: GoldenGrant): GoldenGrant => ({ ...grant, explicit: true });

/**
 * Builds a row.
 *
 * @example
 * row(238, "5.8", "Vendor proposals, internal cost", { SA: "RU", PM: assigned("R"), VC: "RU", FA: "R" });
 */
export function row(
  line: number,
  section: string,
  label: string,
  cells: GoldenRow["cells"],
): GoldenRow {
  return { line, section, label, cells };
}

const ALL_ACTIONS: readonly Action[] = Object.values(ACTION_LETTERS);
const IN_SCOPE: Readonly<Record<Scope, PolicyTarget>> = {
  all: {},
  assigned: { projectId: MEMBER_PROJECT, ownerId: SOMEONE },
  own: { projectId: FOREIGN_PROJECT, ownerId: ME },
};
const OUT_OF_SCOPE: Readonly<Partial<Record<Scope, readonly [PolicyTarget, DenialReason]>>> = {
  assigned: [{ projectId: FOREIGN_PROJECT, ownerId: SOMEONE }, "not_assigned"],
  own: [{ projectId: MEMBER_PROJECT, ownerId: SOMEONE }, "not_owner"],
};

function grantsOf(cell: GoldenCell | undefined): readonly GoldenGrant[] {
  if (cell === undefined) return [];
  if (typeof cell === "string") return [all(cell)];
  return "letters" in cell ? [cell] : cell;
}

function actionsOf(letters: string): Action[] {
  return [...letters].map((letter) => {
    const action = ACTION_LETTERS[letter];
    if (action === undefined) throw new Error(`golden table: no action letter "${letter}"`);
    return action;
  });
}

function keyOf(golden: GoldenRow, action: Action): string {
  const module = MODULES[golden.section];
  if (module === undefined) throw new Error(`golden table: no module for §${golden.section}`);
  const resource = RESOURCES[golden.section]?.[golden.label] ?? slugify(golden.label);
  return `${module}.${resource}.${action}`;
}

function expectGrant(role: StaffRole, key: string, grant: GoldenGrant): void {
  const principal = grant.explicit ? member(role, key) : member(role);
  const target = { ...IN_SCOPE[grant.scope], ...grant.facts };
  const granted = { allowed: true, scope: grant.scope, reason: "granted" };
  expect(decide(principal, key, target), `${role} ${key}`).toEqual(granted);
  const outside = OUT_OF_SCOPE[grant.scope];
  if (outside) {
    expect(decide(principal, key, { ...outside[0], ...grant.facts }).reason).toBe(outside[1]);
  }
  for (const facts of refusedVariants(grant.facts)) {
    const refused = decide(principal, key, { ...IN_SCOPE[grant.scope], ...facts });
    expect(refused.allowed, `${role} ${key} ${JSON.stringify(facts)}`).toBe(false);
  }
  if (grant.explicit) expect(decide(member(role), key, target).allowed).toBe(false);
}

/**
 * Asserts decide() for one role on one row, every action: each listed run allowed in its scope
 * with its facts and refused outside it or without them, every other action no_grant.
 *
 * @example
 * it("§5.8 line 234: HT on vendor bank details", () => expectRow(bankDetails, "HT"));
 */
export function expectRow(golden: GoldenRow, role: StaffRole): void {
  const grants = grantsOf(golden.cells[role]);
  const letters = grants.flatMap((grant) => actionsOf(grant.letters));
  expect(new Set(letters).size, "a letter twice in the golden cell").toBe(letters.length);
  for (const action of ALL_ACTIONS) {
    const key = keyOf(golden, action);
    const grant = grants.find((candidate) => actionsOf(candidate.letters).includes(action));
    if (grant) {
      expectGrant(role, key, grant);
      continue;
    }
    for (const target of Object.values(IN_SCOPE)) {
      expect(decide(member(role, key), key, target).reason, `${role} ${key}`).toBe("no_grant");
    }
  }
}
