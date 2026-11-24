import type { GoldenTransition } from "./transitions-types";

/*
 * Golden table of §7, lines 441-490 of docs/permission-matrix.md, written by hand from the document,
 * line by line (src/transitions-rows.golden.test.ts). "any" is expanded here by hand: every status
 * but the machine's terminal ones and the target (AC-15.7: nothing leaves closed by "any"); "any
 * active", "any open state" and "derived" are the sets statuses.ts names after the document.
 */

const STAFF_ONLY = ["staff"] as const;

/**
 * The rows of §7 lines 441-490, in the document's order.
 *
 * @example
 * TRANSITIONS_434_TO_483.find((row) => row.line === 441)?.entity; // "vendor_assignment"
 */
export const TRANSITIONS_434_TO_483: readonly GoldenTransition[] = [
  // Vendor assignment
  {
    line: 441,
    entity: "vendor_assignment",
    from: ["option"],
    to: ["shortlisted", "declined"],
    client: true,
    movers: ["VC", "PM (a)"],
  },
  {
    line: 442,
    entity: "vendor_assignment",
    from: ["shortlisted"],
    to: ["selected"],
    client: true,
    movers: ["PM (a)"],
  },
  {
    line: 443,
    entity: "vendor_assignment",
    from: ["selected"],
    to: ["contracted"],
    movers: ["VC"],
  },
  {
    line: 444,
    entity: "vendor_assignment",
    from: ["contracted"],
    to: ["delivering"],
    movers: ["VC", "PM (a)"],
  },
  {
    line: 445,
    entity: "vendor_assignment",
    from: ["delivering"],
    to: ["completed"],
    movers: ["PM (a)"],
  },
  {
    line: 446,
    entity: "vendor_assignment",
    from: ["option", "shortlisted", "selected", "contracted", "delivering"],
    to: ["cancelled"],
    movers: ["PM (a)", "VC", "SA"],
  },
  // Function status and readiness
  { line: 451, entity: "function", from: ["planned"], to: ["confirmed"], movers: ["PM (a)"] },
  {
    line: 452,
    entity: "function",
    from: ["planned", "confirmed"],
    to: ["cancelled"],
    movers: ["PM (a)", "SA"],
  },
  // "an exception needs SA" authorises the item's exception (§5.6 line 212); the System derives.
  {
    line: 453,
    entity: "function_readiness",
    from: ["not_started", "in_progress", "blocked", "ready"],
    to: ["not_started", "in_progress", "blocked", "ready"],
    system: true,
  },
  {
    line: 454,
    entity: "function_readiness",
    from: ["ready"],
    to: ["live"],
    movers: ["PM (a)", "HL (a)"],
  },
  {
    line: 455,
    entity: "function_readiness",
    from: ["live"],
    to: ["completed"],
    movers: ["PM (a)"],
  },
  // Incident
  {
    line: 460,
    entity: "incident",
    from: ["open"],
    to: ["assigned"],
    movers: ["PM (a)", "HL (a)", "SA"],
  },
  {
    line: 461,
    entity: "incident",
    from: ["assigned"],
    to: ["in_progress"],
    actors: { assignee: STAFF_ONLY },
  },
  {
    line: 462,
    entity: "incident",
    from: ["open", "assigned", "in_progress"],
    to: ["escalated"],
    actors: { assignee: STAFF_ONLY },
    movers: ["PM (a)"],
    system: true,
  },
  {
    line: 463,
    entity: "incident",
    from: ["in_progress", "escalated"],
    to: ["resolved"],
    actors: { assignee: STAFF_ONLY },
    movers: ["PM (a)"],
  },
  { line: 464, entity: "incident", from: ["resolved"], to: ["closed"], movers: ["PM (a)", "SA"] },
  // Task
  {
    line: 469,
    entity: "task",
    from: ["not_started"],
    to: ["in_progress", "blocked", "completed"],
    actors: { owner: STAFF_ONLY },
    movers: ["PM (a)"],
  },
  {
    line: 470,
    entity: "task",
    from: ["blocked"],
    to: ["in_progress"],
    actors: { owner: STAFF_ONLY },
    movers: ["PM (a)"],
  },
  {
    line: 471,
    entity: "task",
    from: ["not_started", "in_progress", "blocked"],
    to: ["cancelled"],
    actors: { creator: STAFF_ONLY },
    movers: ["PM (a)", "SA"],
  },
  // Room allocation
  {
    line: 476,
    entity: "room_allocation",
    from: ["requested"],
    to: ["proposed"],
    movers: ["HL (a)", "RG (a)"],
  },
  {
    line: 477,
    entity: "room_allocation",
    from: ["proposed"],
    to: ["confirmed"],
    movers: ["HL (a)"],
  },
  {
    line: 478,
    entity: "room_allocation",
    from: ["confirmed"],
    to: ["checked_in"],
    movers: ["HL (a)"],
  },
  {
    line: 479,
    entity: "room_allocation",
    from: ["checked_in"],
    to: ["checked_out"],
    movers: ["HL (a)"],
  },
  {
    line: 480,
    entity: "room_allocation",
    from: ["requested", "proposed", "confirmed", "checked_in"],
    to: ["cancelled"],
    movers: ["HL (a)", "PM (a)"],
  },
  // Client request
  {
    line: 485,
    entity: "client_request",
    from: ["submitted"],
    to: ["under_review"],
    actors: { assignee: STAFF_ONLY },
  },
  {
    line: 486,
    entity: "client_request",
    from: ["under_review"],
    to: ["clarification_requested"],
    actors: { assignee: STAFF_ONLY },
  },
  {
    line: 487,
    entity: "client_request",
    from: ["under_review"],
    to: ["answered"],
    kind: "question",
    actors: { assignee: STAFF_ONLY },
  },
  {
    line: 488,
    entity: "client_request",
    from: ["under_review"],
    to: ["accepted", "rejected"],
    kind: "change_request",
    movers: ["PM (a)", "SA"],
  },
  {
    line: 489,
    entity: "client_request",
    from: ["accepted"],
    to: ["implemented"],
    movers: ["PM (a)"],
  },
  {
    line: 490,
    entity: "client_request",
    from: ["submitted", "under_review", "clarification_requested", "answered", "accepted"],
    to: ["withdrawn"],
    actors: { requester: ["client", "guest", "demo"] },
  },
];
