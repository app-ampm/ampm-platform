import { unmetConditions, type Condition, type ConditionFacts } from "./conditions";
import type { Decision } from "./engine";
import { MATRIX, type Grant } from "./matrix";
import type { Action } from "./roles";

/**
 * The non-staff principals of §6: CR, GU and DP.
 *
 * @example
 * const type: ReachPrincipal = principal.type === "demo" ? "demo" : "client";
 */
export type ReachPrincipal = "client" | "guest" | "demo";

const COLUMNS: Readonly<Record<ReachPrincipal, string>> = { client: "CR", guest: "GU", demo: "DP" };

/**
 * The §6 cell of a client, guest or demo principal on a row, by resource slug or label. Every grant
 * is scoped to the principal's own wedding, account or household (§6 preamble), which the
 * repository's membership and demo filters enforce.
 *
 * @example
 * clientReach("client", "shared_design_versions").flatMap((grant) => grant.actions);
 * // → ["read", "create", "approve"]
 */
export function clientReach(type: ReachPrincipal, resource: string): readonly Grant[] {
  const row = MATRIX.others.find(
    (candidate) => candidate.resource === resource || candidate.label === resource,
  );
  return row?.grants[COLUMNS[type]] ?? [];
}

/**
 * May a client, guest or demo principal take this action on a §6 row, given what the service
 * knows? Conditions are those of decide(): "R summaries" needs `view: "summary"`, "C, routed to
 * Sales" needs `checks: ["routed_to_sales"]`; without the facts the answer is condition_unmet.
 *
 * @example
 * decideReach("client", "enquiry_status_non_internal", "update", { fields: ["feedback"] });
 */
export function decideReach(
  type: ReachPrincipal,
  resource: string,
  action: Action,
  facts: ConditionFacts = {},
): Decision {
  const grants = clientReach(type, resource).filter((grant) => grant.actions.includes(action));
  let unmet: readonly Condition[] | undefined;
  for (const grant of grants) {
    const missing = unmetConditions(grant.conditions, facts);
    if (missing.length === 0) return { allowed: true, scope: grant.scope, reason: "granted" };
    unmet ??= missing;
  }
  return unmet
    ? { allowed: false, reason: "condition_unmet", unmet }
    : { allowed: false, reason: "no_grant" };
}
