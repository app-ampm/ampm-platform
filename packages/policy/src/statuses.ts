/**
 * The status enumerations of the records permission-matrix §7 governs, copied from docs/data-model.md,
 * with the named sets §7's cells refer to ("any active", "any open state", "derived") and the record
 * kinds its parenthesised qualifiers name ("answered (question)"). A plain "any" is every status but
 * the machine's terminal ones. The generator expands §7 against these and stops on a status, set or
 * qualifier they do not define; canTransition() refuses a status outside them. Node runs the
 * generator on this file with type stripping: type imports only.
 */
import type { Actor } from "./matrix";
import type { PrincipalType } from "./roles";

/**
 * A principal that may be one of a record's people.
 *
 * @example
 * const requesters: readonly ActorPrincipal[] = ["client", "guest", "demo"];
 */
export type ActorPrincipal = Exclude<PrincipalType, "system">;

/**
 * One record's statuses as §7 moves them.
 *
 * @example
 * STATUS_MACHINES["incident"]?.sets["open state"]; // ["open", "assigned", "in_progress"]
 */
export interface StatusMachine {
  /** The §7 heading the machine's rows sit under; two machines may share one. */
  readonly heading: string;
  /** The `status` enumeration of the table (data-model.md). */
  readonly statuses: readonly string[];
  /** Named subsets, by the words after "any" or the whole cell ("derived"). */
  readonly sets: Readonly<Record<string, readonly string[]>>;
  /** A parenthesised qualifier → the record kind a row is limited to (`client_requests.request_type`). */
  readonly kinds: Readonly<Record<string, string>>;
  /** A From-cell prefix that selects this machine under a shared heading ("readiness:"). */
  readonly prefix: string | null;
  /**
   * Outcomes a plain "any" does not reach. The record leaves them only by a row that names them
   * ("closed → closure", SA only), so "any → on_hold" cannot reopen a closed wedding (AC-15.7).
   */
  readonly terminal: readonly string[];
  /**
   * Who each of the record's people §7 names may be ("The requester" of a client request is a
   * client, guest or demo principal, §6 line 367); the generator stops on a person not bound here.
   */
  readonly actors: Readonly<Partial<Record<Actor, readonly ActorPrincipal[]>>>;
}

const PLAIN = { sets: {}, kinds: {}, prefix: null, actors: {} } as const;

/**
 * The machines by entity, the `entity` canTransition() takes.
 *
 * @example
 * STATUS_MACHINES["wedding_project"]?.statuses.includes("on_hold"); // true
 */
export const STATUS_MACHINES: Readonly<Record<string, StatusMachine>> = {
  subscription: {
    ...PLAIN,
    heading: "Subscription",
    // §7 line 396: an expired or cancelled row is never reactivated; a new row starts.
    terminal: ["expired", "cancelled"],
    statuses: [
      "trial",
      "pending_payment",
      "active",
      "expiring",
      "expired",
      "suspended",
      "cancelled",
    ],
  },
  hotel_enquiry: {
    ...PLAIN,
    heading: "Hotel enquiry",
    // A confirmed enquiry is still closed with its outcome (§7 line 409).
    terminal: ["closed"],
    statuses: [
      "draft",
      "submitted",
      "awaiting_hotel",
      "response_received",
      "negotiating",
      "visit_scheduled",
      "proposal_received",
      "client_decision",
      "confirmed",
      "closed",
    ],
    // "Any active" is not defined in the document: submitted to the client's decision. A draft is
    // the client's until they submit it, and confirmed and closed are outcomes (fail closed).
    sets: {
      active: [
        "submitted",
        "awaiting_hotel",
        "response_received",
        "negotiating",
        "visit_scheduled",
        "proposal_received",
        "client_decision",
      ],
    },
  },
  wedding_project: {
    ...PLAIN,
    heading: "Wedding project",
    // §7 line 423: closed is left only for closure, by SA, audited.
    terminal: ["closed"],
    statuses: [
      "setup",
      "planning",
      "approvals",
      "pre_production",
      "ready",
      "live",
      "closure",
      "closed",
      "on_hold",
    ],
  },
  approval: {
    ...PLAIN,
    heading: "Approval",
    // An approved or rejected approval is still superseded by a new version (§7 line 430).
    terminal: ["superseded"],
    statuses: ["draft", "submitted", "revision_requested", "approved", "rejected", "superseded"],
    // §7 line 428, "The requester per §5.9": line 252 lists staff roles only; clients decide.
    actors: { requester: ["staff"] },
  },
  vendor_assignment: {
    ...PLAIN,
    heading: "Vendor assignment",
    terminal: ["completed", "cancelled", "declined"],
    statuses: [
      "option",
      "shortlisted",
      "selected",
      "contracted",
      "delivering",
      "completed",
      "cancelled",
      "declined",
    ],
  },
  function: {
    ...PLAIN,
    heading: "Function status and readiness",
    terminal: ["cancelled"],
    statuses: ["planned", "confirmed", "cancelled"],
  },
  function_readiness: {
    ...PLAIN,
    heading: "Function status and readiness",
    terminal: ["completed"],
    prefix: "readiness",
    statuses: ["not_started", "in_progress", "blocked", "ready", "live", "completed"],
    // The checklist derives these four, an item's authorised exception included (data-model.md
    // lines 850 and 1838, AC-13.2); live and completed are set on the day (§7, AC-13.3).
    sets: { derived: ["not_started", "in_progress", "blocked", "ready"] },
  },
  incident: {
    ...PLAIN,
    heading: "Incident",
    terminal: ["closed"],
    statuses: ["open", "assigned", "in_progress", "escalated", "resolved", "closed"],
    sets: { "open state": ["open", "assigned", "in_progress"] },
    actors: { assignee: ["staff"] },
  },
  task: {
    ...PLAIN,
    heading: "Task",
    terminal: ["completed", "cancelled"],
    statuses: ["not_started", "in_progress", "blocked", "completed", "cancelled"],
    // §6 line 371 gives a client representative R on tasks only, so owners and creators are staff.
    actors: { owner: ["staff"], creator: ["staff"] },
  },
  room_allocation: {
    ...PLAIN,
    heading: "Room allocation",
    terminal: ["checked_out", "cancelled"],
    statuses: ["requested", "proposed", "confirmed", "checked_in", "checked_out", "cancelled"],
  },
  client_request: {
    ...PLAIN,
    heading: "Client request",
    terminal: ["rejected", "implemented", "closed", "withdrawn"],
    statuses: [
      "submitted",
      "under_review",
      "clarification_requested",
      "answered",
      "accepted",
      "rejected",
      "implemented",
      "closed",
      "withdrawn",
    ],
    kinds: { question: "question", "change request": "change_request" },
    // §6 line 367: the representatives, a guest (support request) and the demo (routed to Sales)
    // create requests; "The assigned staff member" is staff.
    actors: { assignee: ["staff"], requester: ["client", "guest", "demo"] },
  },
};
