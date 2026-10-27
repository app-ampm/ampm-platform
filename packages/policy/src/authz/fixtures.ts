import type { Condition, ConditionFacts } from "../conditions";
import type { PolicyPrincipal } from "../engine";
import type { StaffRole } from "../roles";

/**
 * The generated suites' world: the member project, the user, and a project and an owner the user
 * has nothing to do with.
 *
 * @example
 * decide(member("PM"), key, { projectId: MEMBER_PROJECT, ownerId: SOMEONE });
 */
export const MEMBER_PROJECT = "p";
/** @example decide(member("SM"), key, { projectId: FOREIGN_PROJECT, ownerId: ME }); */
export const ME = "me";
/** @example decide(member("PM"), key, { projectId: FOREIGN_PROJECT }).reason; // "not_assigned" */
export const FOREIGN_PROJECT = "other";
/** @example decide(member("SM"), key, { ownerId: SOMEONE }).reason; // "not_owner" */
export const SOMEONE = "someone";

type ViewCondition = Extract<Condition, { kind: "view" }>;
type SideCondition = Extract<Condition, { kind: "side" }>;

/**
 * Facts that meet every condition of a grant, so the generated suites can reach a conditioned
 * grant, and check that it is refused without them.
 *
 * @example
 * factsFor([{ kind: "side", anyOf: ["hotel"] }]); // { facts: { side: "hotel", ... } }
 */
export function factsFor(conditions: readonly Condition[]): {
  readonly facts: ConditionFacts;
  readonly explicitGrant: boolean;
} {
  const view = conditions.find(
    (condition): condition is ViewCondition => condition.kind === "view",
  );
  const side = conditions.find(
    (condition): condition is SideCondition => condition.kind === "side",
  );
  return {
    facts: {
      side: side?.anyOf[0],
      subjects: conditions.flatMap((c) => (c.kind === "subject" ? c.anyOf.slice(0, 1) : [])),
      fields: conditions.flatMap((c) => (c.kind === "fields" ? c.only : [])),
      checks: conditions.flatMap((c) => (c.kind === "check" ? [c.check] : [])),
      view: view?.view,
    },
    explicitGrant: conditions.some((condition) => condition.kind === "explicit_grant"),
  };
}

/**
 * A staff member of the member project holding one role, with an explicit grant of `key` there
 * when asked for.
 *
 * @example
 * member("RG", "guests.identity_documents.read");
 */
export function member(role: StaffRole, explicitKey?: string): PolicyPrincipal {
  return {
    type: "staff",
    userId: ME,
    roles: [role],
    projectIds: [MEMBER_PROJECT],
    explicitGrants:
      explicitKey === undefined ? [] : [{ key: explicitKey, projectId: MEMBER_PROJECT }],
  };
}
