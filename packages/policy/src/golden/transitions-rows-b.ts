import type { GoldenTransition } from "./transitions-types";

/*
 * Golden table of §7, lines 436-484 of docs/permission-matrix.md, written by hand from the document,
 * line by line (src/transitions-rows.golden.test.ts). "any" is expanded here by hand: every status
 * but the machine's terminal ones and the target (AC-15.7: nothing leaves closed by "any"); "any
 * active", "any open state" and "derived" are the sets statuses.ts names after the document.
 */

const STAFF_ONLY = ["staff"] as const;

/**
 * The rows of §7 lines 436-484, in the document's order.
 *
 * @example
 * TRANSITIONS_434_TO_483.find((row) => row.line === 434)?.entity;
 */
export const TRANSITIONS_434_TO_483: readonly GoldenTransition[] = [
  // Vendor assignment
  {
    line: 435,
    entity: "vendor_assignment",
    from: ["option"],
    to: ["shortlisted", "declined"],
    client: true,
    movers: ["VC", "PM (a)"],
  },
  {
    line: 436,
    entity: "vendor_assignment",
    from: ["shortlisted"],
    to: ["selected"],
    client: true,
    movers: ["PM (a)"],
  },
  {
    line: 437,
    entity: "vendor_assignment",
    from: ["selected"],
    to: ["contracted"],
    movers: ["VC"],
  },
  {
    line: 438,
    entity: "vendor_assignment",
    from: ["contracted"],
    to: ["delivering"],
    movers: ["VC", "PM (a)"],
  },
  {
    line: 439,
    entity: "vendor_assignment",
    from: ["delivering"],
    to: ["completed"],
    movers: ["PM (a)"],
  },
  {
    line: 440,
    entity: "vendor_assignment",
    from: ["option", "shortlisted", "selected", "contracted", "delivering"],
    to: ["cancelled"],
    movers: ["PM (a)", "VC", "SA"],
  },
  // Function status and readiness
  { line: 445, entity: "function", from: ["planned"], to: ["confirmed"], movers: ["PM (a)"] },
  {
    line: 446,
    entity: "function",
    from: ["planned", "confirmed"],
    to: ["cancelled"],
    movers: ["PM (a)", "SA"],
  },
  // "an exception needs SA" authorises the item's exception (§5.6 line 208); the System derives.
  {
    line: 447,
    entity: "function_readiness",
    from: ["not_started", "in_progress", "blocked", "ready"],
    to: ["not_started", "in_progress", "blocked", "ready"],
    system: true,
  },
  {
    line: 448,
    entity: "function_readiness",
    from: ["ready"],
    to: ["live"],
    movers: ["PM (a)", "HL (a)"],
  },
  {
    line: 449,
    entity: "function_readiness",
    from: ["live"],
    to: ["completed"],
    movers: ["PM (a)"],
  },
  // Incident
  {
    line: 454,
    entity: "incident",
    from: ["open"],
    to: ["assigned"],
    movers: ["PM (a)", "HL (a)", "SA"],
  },
  {
    line: 455,
    entity: "incident",
    from: ["assigned"],
    to: ["in_progress"],
    actors: { assignee: STAFF_ONLY },
  },
  {
    line: 456,
    entity: "incident",
    from: ["open", "assigned", "in_progress"],
    to: ["escalated"],
    actors: { assignee: STAFF_ONLY },
    movers: ["PM (a)"],
    system: true,
  },
  {
    line: 457,
    entity: "incident",
    from: ["in_progress", "escalated"],
    to: ["resolved"],
    actors: { assignee: STAFF_ONLY },
    movers: ["PM (a)"],
  },
  { line: 458, entity: "incident", from: ["resolved"], to: ["closed"], movers: ["PM (a)", "SA"] },
  // Task
  {
    line: 463,
    entity: "task",
    from: ["not_started"],
    to: ["in_progress", "blocked", "completed"],
    actors: { owner: STAFF_ONLY },
    movers: ["PM (a)"],
  },
  {
    line: 464,
    entity: "task",
    from: ["blocked"],
    to: ["in_progress"],
    actors: { owner: STAFF_ONLY },
    movers: ["PM (a)"],
  },
  {
    line: 465,
    entity: "task",
    from: ["not_started", "in_progress", "blocked"],
    to: ["cancelled"],
    actors: { creator: STAFF_ONLY },
    movers: ["PM (a)", "SA"],
  },
  // Room allocation
  {
    line: 470,
    entity: "room_allocation",
    from: ["requested"],
    to: ["proposed"],
    movers: ["HL (a)", "RG (a)"],
  },
  {
    line: 471,
    entity: "room_allocation",
    from: ["proposed"],
    to: ["confirmed"],
    movers: ["HL (a)"],
  },
  {
    line: 472,
    entity: "room_allocation",
    from: ["confirmed"],
    to: ["checked_in"],
    movers: ["HL (a)"],
  },
  {
    line: 473,
    entity: "room_allocation",
    from: ["checked_in"],
    to: ["checked_out"],
    movers: ["HL (a)"],
  },
  {
    line: 474,
    entity: "room_allocation",
    from: ["requested", "proposed", "confirmed", "checked_in"],
    to: ["cancelled"],
    movers: ["HL (a)", "PM (a)"],
  },
  // Client request
  {
    line: 479,
    entity: "client_request",
    from: ["submitted"],
    to: ["under_review"],
    actors: { assignee: STAFF_ONLY },
  },
  {
    line: 480,
    entity: "client_request",
    from: ["under_review"],
    to: ["clarification_requested"],
    actors: { assignee: STAFF_ONLY },
  },
  {
    line: 481,
    entity: "client_request",
    from: ["under_review"],
    to: ["answered"],
    kind: "question",
    actors: { assignee: STAFF_ONLY },
  },
  {
    line: 482,
    entity: "client_request",
    from: ["under_review"],
    to: ["accepted", "rejected"],
    kind: "change_request",
    movers: ["PM (a)", "SA"],
  },
  {
    line: 483,
    entity: "client_request",
    from: ["accepted"],
    to: ["implemented"],
    movers: ["PM (a)"],
  },
  {
    line: 484,
    entity: "client_request",
    from: ["submitted", "under_review", "clarification_requested", "answered", "accepted"],
    to: ["withdrawn"],
    actors: { requester: ["client", "guest", "demo"] },
  },
];
