import type { GoldenTransition } from "./transitions-types";

/*
 * Golden table of §7, lines 498-507 of docs/permission-matrix.md, written by hand from the document,
 * line by line (src/transitions-rows.golden.test.ts): the hotel information request (D-188 §2). The
 * moves a hotel's people cause are the System's, since the table names no hotel actor.
 */

/**
 * The rows of §7 lines 498-507, in the document's order.
 *
 * @example
 * TRANSITIONS_498_TO_507.find((row) => row.line === 506)?.system; // true: a deleted hotel's request
 */
export const TRANSITIONS_498_TO_507: readonly GoldenTransition[] = [
  // Hotel information request
  {
    line: 498,
    entity: "hotel_info_request",
    from: ["open"],
    to: ["submitted"],
    system: true,
  },
  {
    line: 499,
    entity: "hotel_info_request",
    from: ["submitted"],
    to: ["in_review"],
    movers: ["SA", "HT"],
  },
  {
    line: 500,
    entity: "hotel_info_request",
    from: ["in_review"],
    to: ["submitted"],
    movers: ["SA", "HT"],
  },
  {
    line: 501,
    entity: "hotel_info_request",
    from: ["in_review", "submitted"],
    to: ["changes_requested"],
    movers: ["SA", "HT"],
  },
  {
    line: 502,
    entity: "hotel_info_request",
    from: ["changes_requested"],
    to: ["submitted"],
    system: true,
  },
  {
    line: 503,
    entity: "hotel_info_request",
    from: ["in_review"],
    to: ["merged"],
    movers: ["SA", "HT"],
  },
  {
    line: 504,
    entity: "hotel_info_request",
    from: ["submitted", "in_review"],
    to: ["rejected"],
    movers: ["SA", "HT"],
  },
  {
    line: 505,
    entity: "hotel_info_request",
    from: ["open", "changes_requested"],
    to: ["revoked"],
    movers: ["SA", "HT"],
    system: true,
  },
  {
    line: 506,
    entity: "hotel_info_request",
    from: ["submitted", "in_review"],
    to: ["revoked"],
    system: true,
  },
  {
    line: 507,
    entity: "hotel_info_request",
    from: ["merged"],
    to: ["changes_requested"],
    movers: ["SA", "HT"],
  },
];
