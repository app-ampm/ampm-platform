import type { GoldenTransition } from "./transitions-types";

/*
 * Golden table of §7, lines 391-430 of docs/permission-matrix.md, written by hand from the document,
 * line by line (src/transitions-rows.golden.test.ts). "any" is expanded here by hand: every status
 * but the machine's terminal ones and the target (AC-15.7: nothing leaves closed by "any"); "any
 * active", "any open state" and "derived" are the sets statuses.ts names after the document.
 */

const STAFF_ONLY = ["staff"] as const;

/**
 * The rows of §7 lines 391-430, in the document's order.
 *
 * @example
 * TRANSITIONS_389_TO_429.find((row) => row.line === 389)?.entity;
 */
export const TRANSITIONS_389_TO_429: readonly GoldenTransition[] = [
  // Subscription
  {
    line: 390,
    entity: "subscription",
    from: ["pending_payment", "trial"],
    to: ["active"],
    system: true,
    movers: ["FA", "SA"],
  },
  { line: 391, entity: "subscription", from: ["active"], to: ["expiring"], system: true },
  { line: 392, entity: "subscription", from: ["expiring"], to: ["expired"], system: true },
  {
    line: 393,
    entity: "subscription",
    from: ["active", "expiring"],
    to: ["suspended"],
    movers: ["SA", "FA"],
  },
  { line: 394, entity: "subscription", from: ["suspended"], to: ["active"], movers: ["SA", "FA"] },
  {
    line: 395,
    entity: "subscription",
    from: ["trial", "pending_payment", "active", "expiring", "suspended"],
    to: ["cancelled"],
    movers: ["SA", "SM"],
  },
  // "New subscription row; the old one is never reactivated": nobody.
  { line: 396, entity: "subscription", from: ["expired", "cancelled"], to: ["active"] },
  // Hotel enquiry
  {
    line: 401,
    entity: "hotel_enquiry",
    from: ["draft"],
    to: ["submitted"],
    client: true,
    movers: ["SM", "HT"],
  },
  {
    line: 402,
    entity: "hotel_enquiry",
    from: ["submitted"],
    to: ["awaiting_hotel"],
    movers: ["HT"],
  },
  {
    line: 403,
    entity: "hotel_enquiry",
    from: ["awaiting_hotel"],
    to: ["response_received"],
    movers: ["HT"],
  },
  {
    line: 404,
    entity: "hotel_enquiry",
    from: ["response_received"],
    to: ["negotiating"],
    movers: ["HT"],
  },
  {
    line: 405,
    entity: "hotel_enquiry",
    from: ["negotiating", "response_received"],
    to: ["visit_scheduled"],
    movers: ["HT", "PM (a)"],
  },
  {
    line: 406,
    entity: "hotel_enquiry",
    from: [
      "submitted",
      "awaiting_hotel",
      "response_received",
      "negotiating",
      "visit_scheduled",
      "client_decision",
    ],
    to: ["proposal_received"],
    movers: ["HT"],
  },
  {
    line: 407,
    entity: "hotel_enquiry",
    from: ["proposal_received"],
    to: ["client_decision"],
    movers: ["HT", "PM (a)"],
  },
  {
    line: 408,
    entity: "hotel_enquiry",
    from: ["client_decision"],
    to: ["confirmed"],
    movers: ["HT", "SA"],
  },
  {
    line: 409,
    entity: "hotel_enquiry",
    from: [
      "draft",
      "submitted",
      "awaiting_hotel",
      "response_received",
      "negotiating",
      "visit_scheduled",
      "proposal_received",
      "client_decision",
      "confirmed",
    ],
    to: ["closed"],
    movers: ["HT", "SA", "PM (a)"],
  },
  // Wedding project
  {
    line: 414,
    entity: "wedding_project",
    from: ["setup"],
    to: ["planning"],
    movers: ["PM (a)", "SA"],
  },
  {
    line: 415,
    entity: "wedding_project",
    from: ["planning"],
    to: ["approvals"],
    movers: ["PM (a)"],
  },
  {
    line: 416,
    entity: "wedding_project",
    from: ["approvals"],
    to: ["pre_production"],
    movers: ["PM (a)"],
  },
  {
    line: 417,
    entity: "wedding_project",
    from: ["pre_production"],
    to: ["ready"],
    movers: ["PM (a)"],
  },
  { line: 418, entity: "wedding_project", from: ["ready"], to: ["live"], movers: ["PM (a)", "SA"] },
  { line: 419, entity: "wedding_project", from: ["live"], to: ["closure"], movers: ["PM (a)"] },
  {
    line: 420,
    entity: "wedding_project",
    from: ["closure"],
    to: ["closed"],
    movers: ["PM (a)", "SA"],
  },
  {
    line: 421,
    entity: "wedding_project",
    from: ["setup", "planning", "approvals", "pre_production", "ready", "live", "closure"],
    to: ["on_hold"],
    movers: ["PM (a)", "SA"],
  },
  {
    line: 422,
    entity: "wedding_project",
    from: ["on_hold"],
    to: "previous",
    movers: ["PM (a)", "SA"],
  },
  { line: 423, entity: "wedding_project", from: ["closed"], to: ["closure"], movers: ["SA"] },
  // Approval
  {
    line: 428,
    entity: "approval",
    from: ["draft"],
    to: ["submitted"],
    actors: { requester: STAFF_ONLY },
  },
  {
    line: 429,
    entity: "approval",
    from: ["submitted"],
    to: ["approved", "revision_requested", "rejected"],
    client: true,
    movers: ["PM (a)", "SA"],
  },
  {
    line: 430,
    entity: "approval",
    from: ["draft", "submitted", "revision_requested", "approved", "rejected"],
    to: ["superseded"],
    system: true,
  },
];
