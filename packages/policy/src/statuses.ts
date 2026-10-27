/**
 * The status enumerations of the records permission-matrix §7 governs, copied from docs/data-model.md,
 * with the named sets §7's cells refer to ("any active", "any open state", "derived") and the record
 * kinds its parenthesised qualifiers name ("answered (question)"). The generator expands §7 against
 * these and stops on a status, set or qualifier they do not define; canTransition() refuses a status
 * outside them. Node runs the generator on this file with type stripping: no imports.
 */

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
  /** Where an authorised exception moves the record (P-8 changed by Q10), if the machine has one. */
  readonly exceptionTarget: string | null;
  /** A From-cell prefix that selects this machine under a shared heading ("readiness:"). */
  readonly prefix: string | null;
}

const PLAIN = { sets: {}, kinds: {}, exceptionTarget: null, prefix: null } as const;

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
    statuses: ["draft", "submitted", "revision_requested", "approved", "rejected", "superseded"],
  },
  vendor_assignment: {
    ...PLAIN,
    heading: "Vendor assignment",
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
    statuses: ["planned", "confirmed", "cancelled"],
  },
  function_readiness: {
    ...PLAIN,
    heading: "Function status and readiness",
    prefix: "readiness",
    statuses: ["not_started", "in_progress", "blocked", "ready", "live", "completed"],
    // The checklist derives these four; live and completed are set on the day (§7, AC-13.3).
    sets: { derived: ["not_started", "in_progress", "blocked", "ready"] },
    // An authorised exception lets a function become ready with a required check unmet (AC-13.2).
    exceptionTarget: "ready",
  },
  incident: {
    ...PLAIN,
    heading: "Incident",
    statuses: ["open", "assigned", "in_progress", "escalated", "resolved", "closed"],
    sets: { "open state": ["open", "assigned", "in_progress"] },
  },
  task: {
    ...PLAIN,
    heading: "Task",
    statuses: ["not_started", "in_progress", "blocked", "completed", "cancelled"],
  },
  room_allocation: {
    ...PLAIN,
    heading: "Room allocation",
    statuses: ["requested", "proposed", "confirmed", "checked_in", "checked_out", "cancelled"],
  },
  client_request: {
    ...PLAIN,
    heading: "Client request",
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
  },
};
