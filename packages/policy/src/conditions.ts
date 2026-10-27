/**
 * The structured meaning of the notes that narrow a §5 or §6 grant ("RU hotel lines", "CRU (a) with
 * explicit grant", "R (a) check-in only", "R summaries"). The generator maps every note text of the
 * document to these conditions and stops on a text it does not know (scripts/notes.ts). decide() and
 * decideReach() allow a conditioned grant only when the caller's facts meet every condition, so a
 * narrowed grant is never a plain one; a caller that supplies no facts is denied (fail closed).
 *
 * Node runs the generator on these sources with type stripping, so this module has no value imports.
 */

/**
 * What a record is or belongs to: its counterparty side, its type, or the record it is attached to.
 *
 * @example
 * decide(principal, "budget.budget_lines_internal_cost.read", { subjects: ["hotel"] });
 */
export const SUBJECTS = [
  "hotel",
  "vendor",
  "guest",
  "transport_vendor",
  "finance_entity",
  "hotel_proposal",
  "vendor_proposal",
  "design",
  "invitation",
  "budget_line",
  "contract",
  "client_contract",
  "invoice",
  "departures",
  "lost_and_found",
  "vendor_completion",
  "final_accounts",
  "comment",
  "support_request",
] as const;
/** @example const side: Subject = "vendor"; */
export type Subject = (typeof SUBJECTS)[number];

/**
 * The field groups an action may be limited to, named as the document names them.
 *
 * @example
 * decide(principal, "functions.functions.update", { projectId, fields: ["theme"] });
 */
export const FIELD_GROUPS = [
  "billing",
  "status",
  "rights",
  "showcase",
  "theme",
  "dress_code",
  "logistics_notes",
  "vendor_cues",
  "delivered",
  "feedback",
  "attendance",
  "dietary",
  "travel_details",
] as const;
/** @example const field: FieldGroup = "dress_code"; */
export type FieldGroup = (typeof FIELD_GROUPS)[number];

/**
 * Facts the service establishes before it acts: a moment, a flow, or a state of the data.
 *
 * @example
 * decide(principal, "guests.identity_documents.read", { projectId, checks: ["check_in"] });
 */
export const CHECKS = [
  /** HL reads identity documents at check-in only (§5.10, P-5). */
  "check_in",
  /** The Super Admin's audited and alerted break-glass read (§4, §5.10). */
  "break_glass",
  /** The closure checklist is complete and final accounts are approved (§5.15). */
  "closure_ready",
  /** The project requires identity documents, so the guest may upload one (§6). */
  "identity_required",
  /** The guest's household is invited to the function (§6). */
  "invited",
  /** A new member stays within the household's allowance (§6). */
  "within_allowance",
  /** The room allocation is confirmed (§6). */
  "allocation_confirmed",
  /** AMPM has asked the household for travel details (§6). */
  "travel_requested",
  /** The document is shared to guests (§6). */
  "shared_with_guests",
  /** Only the approved guest list is summarised (§6, Q7). */
  "approved",
  /** The record is demo or sample data (§6 demo column). */
  "demo_record",
  /** What the demo creates goes to Sales as a lead activity (§3, §6). */
  "routed_to_sales",
] as const;
/** @example const check: Check = "closure_ready"; */
export type Check = (typeof CHECKS)[number];

/**
 * Response models a read may be limited to.
 *
 * @example
 * decideReach("client", "attendance_rsvp_progress", "read", { view: "summary" });
 */
export const VIEWS = ["summary", "status_only", "masked"] as const;
/** @example const view: View = "status_only"; */
export type View = (typeof VIEWS)[number];

/**
 * The kinds of Condition, for code that reads conditions from untyped data.
 *
 * @example
 * CONDITION_KINDS.includes("explicit_grant"); // true
 */
export const CONDITION_KINDS = ["subject", "fields", "check", "view", "explicit_grant"] as const;

/**
 * One narrowing of a grant; a grant applies only when every one of its conditions is met.
 *
 * @example
 * const hotelLines: Condition = { kind: "subject", anyOf: ["hotel"] };
 */
export type Condition =
  /** The record is about one of these subjects ("hotel lines", "finance entities"). */
  | { readonly kind: "subject"; readonly anyOf: readonly Subject[] }
  /** The action reads or writes these field groups only ("billing", "theme, dress code"). */
  | { readonly kind: "fields"; readonly only: readonly FieldGroup[] }
  /** The service has verified this fact ("check-in only", "when the checklist is complete"). */
  | { readonly kind: "check"; readonly check: Check }
  /** The response is this model ("summaries", "status only", "masked"). */
  | { readonly kind: "view"; readonly view: View }
  /** The principal holds an explicit grant of the key on the record's wedding (P-5). */
  | { readonly kind: "explicit_grant" };

/**
 * What the caller knows about the record and the action; decide() takes these with the target.
 *
 * @example
 * const facts: ConditionFacts = { subjects: ["vendor"], fields: ["vendor_cues"] };
 */
export interface ConditionFacts {
  readonly subjects?: readonly Subject[] | undefined;
  readonly fields?: readonly FieldGroup[] | undefined;
  readonly checks?: readonly Check[] | undefined;
  readonly view?: View | undefined;
}

function conditionMet(
  condition: Condition,
  facts: ConditionFacts,
  explicitGrant: boolean,
): boolean {
  switch (condition.kind) {
    case "subject":
      return (facts.subjects ?? []).some((subject) => condition.anyOf.includes(subject));
    case "fields": {
      const fields = facts.fields ?? [];
      return fields.length > 0 && fields.every((field) => condition.only.includes(field));
    }
    case "check":
      return (facts.checks ?? []).includes(condition.check);
    case "view":
      return facts.view === condition.view;
    case "explicit_grant":
      return explicitGrant;
  }
}

/**
 * The conditions the facts leave unmet; an empty result means the grant applies.
 *
 * @example
 * unmetConditions([{ kind: "subject", anyOf: ["hotel"] }], { subjects: ["vendor"] });
 * // → [{ kind: "subject", anyOf: ["hotel"] }]
 */
export function unmetConditions(
  conditions: readonly Condition[],
  facts: ConditionFacts,
  explicitGrant = false,
): readonly Condition[] {
  return conditions.filter((condition) => !conditionMet(condition, facts, explicitGrant));
}
