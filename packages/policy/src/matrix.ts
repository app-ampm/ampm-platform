import matrix from "./generated/matrix.json" with { type: "json" };
import type { VisibilityClass } from "./classes";
import type { Condition } from "./conditions";
import { readMatrix } from "./matrix-load";
import type { Action, Scope, StaffRole } from "./roles";

/*
 * The shape of src/generated/matrix.json, which scripts/generate.ts writes from
 * docs/permission-matrix.md. The file is checked against these types when it loads, so a stale or
 * hand-edited file stops the package instead of granting by accident.
 */

/**
 * One run of action letters in a cell, with its scope and the conditions its note sets.
 *
 * @example
 * // "RU hotel lines" (HT, §5.7)
 * const grant: Grant = {
 *   actions: ["read", "update"],
 *   scope: "all",
 *   conditions: [{ kind: "subject", anyOf: ["hotel"] }],
 * };
 */
export interface Grant {
  readonly actions: readonly Action[];
  readonly scope: Scope;
  /** Every condition must be met; an empty list is a plain grant. */
  readonly conditions: readonly Condition[];
}

/**
 * What a §5.16 report's export leaves out.
 *
 * @example
 * const bank: ReportExclusion = { kind: "class", class: "RESTRICTED-BANK", unlessRoles: [] };
 */
export type ReportExclusion =
  | {
      readonly kind: "class";
      readonly class: VisibilityClass;
      /** Roles the class stays in for ("Internal amounts unless FA or SA"). */
      readonly unlessRoles: readonly StaffRole[];
    }
  | {
      readonly kind: "variant";
      /** A named export of the report that carries only these fields. */
      readonly variant: string;
      readonly onlyFields: readonly string[];
      readonly audited: boolean;
    };

/**
 * One row of a §5 or §6 table.
 *
 * @example
 * MATRIX.staff.find((row) => row.resource === "audit_log")?.grants["FA"];
 */
export interface MatrixRow {
  readonly section: string;
  readonly module: string;
  readonly resource: string;
  readonly label: string;
  readonly provisional: boolean;
  /** The document's cells, by column (role codes; for §5.16 the report columns). */
  readonly cells: Readonly<Record<string, string>>;
  readonly grants: Readonly<Record<string, readonly Grant[]>>;
  /** §5.16 rows only. */
  readonly exclusions: readonly ReportExclusion[];
}

/**
 * A record's person a §7 rule names: the assignee, owner, creator or requester.
 *
 * @example
 * MATRIX.transitions.filter((rule) => rule.actors.includes("requester"));
 */
export type Actor = "assignee" | "owner" | "creator" | "requester";

/**
 * One mover clause of a §7 row: who may move the record from one status to another.
 *
 * @example
 * const rule = canTransition(principal, "incident", "resolved", "closed", { projectId });
 * if (rule?.condition) checkCondition(rule.condition);
 */
export interface Transition {
  readonly entity: string;
  readonly from: readonly string[];
  /** Empty when the rule restores the previous status. */
  readonly to: readonly string[];
  /** "previous status": back to the status the record had before it was put on hold. */
  readonly restore: boolean;
  /** The record kind the row is limited to ("answered (question)"), or null. */
  readonly kind: string | null;
  readonly roles: readonly { readonly role: StaffRole; readonly assigned: boolean }[];
  /** Either client representative. */
  readonly client: boolean;
  readonly system: boolean;
  readonly actors: readonly Actor[];
  /** The movers act only through an authorised exception (P-8 changed by Q10). */
  readonly exception: boolean;
  /** The whole Who cell, for reference. */
  readonly who: string;
  /** What the service still has to check for this clause ("with reason", "only when ..."). */
  readonly condition: string | null;
}

/**
 * The generated matrix as a whole.
 *
 * @example
 * const matrix: Matrix = readMatrix(JSON.parse(text));
 */
export interface Matrix {
  readonly source: string;
  readonly staff: readonly MatrixRow[];
  readonly others: readonly MatrixRow[];
  readonly transitions: readonly Transition[];
}

/**
 * The matrix as generated from docs/permission-matrix.md (scripts/generate.ts).
 *
 * @example
 * MATRIX.staff.filter((row) => row.section === "5.16").map((row) => row.resource);
 */
export const MATRIX: Matrix = readMatrix(matrix);
