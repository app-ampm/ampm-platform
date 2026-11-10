/**
 * Golden table of §6 (docs/permission-matrix.md lines 344-375), written by hand from the document
 * and never read from matrix.json: for every row and every column (CR, GU, DP), the actions the
 * cell allows and the facts its note needs, in full. decideReach() must allow each with its facts,
 * refuse it when a fact is missing or a list is widened, and refuse every action the cell does not
 * list. Rows are found by their label as the document writes it.
 */
import { describe, expect, it } from "vitest";

import { documentTableRows } from "./authz/document";
import type { ConditionFacts } from "./conditions";
import { refusedVariants } from "./golden/facts";
import { decideReach, type ReachPrincipal } from "./reach";
import { ACTION_LETTERS, type Action } from "./roles";

/** The actions a cell allows, each with the facts its note needs ({} for a plain grant). */
type Cell = Partial<Record<Action, ConditionFacts>>;

interface Row {
  readonly line: number;
  readonly label: string;
  readonly CR?: Cell;
  readonly GU?: Cell;
  readonly DP?: Cell;
}

const ALL_ACTIONS: readonly Action[] = Object.values(ACTION_LETTERS);
const COLUMNS: readonly [ReachPrincipal, "CR" | "GU" | "DP"][] = [
  ["client", "CR"],
  ["guest", "GU"],
  ["demo", "DP"],
];

/** The same facts for each of these actions. */
function each(actions: readonly Action[], facts: ConditionFacts): Cell {
  return Object.fromEntries(actions.map((action) => [action, facts]));
}

/** Plain grants of these actions. */
function plain(...actions: Action[]): Cell {
  return each(actions, {});
}

const CRUD = plain("create", "read", "update", "delete");
const CRU = plain("create", "read", "update");
/** "R sample": the demo reads demo or sample records only. */
const SAMPLE: Cell = { read: { checks: ["demo_record"] } };
/** "C, routed to Sales": what the demo creates goes to Sales. */
const ROUTED: Cell = { create: { checks: ["routed_to_sales"] } };
/** "R summaries". */
const SUMMARIES: Cell = { read: { view: "summary" } };

const ROWS: readonly Row[] = [
  {
    line: 343,
    label: "Hotel discovery (per entitlement §3)",
    CR: plain("read"),
    DP: { read: { view: "masked" } },
  },
  {
    line: 344,
    label: "Saved hotels and compare",
    CR: CRUD,
    DP: each(["create", "read", "update", "delete"], { checks: ["demo_record"] }),
  },
  { line: 345, label: "Hotel assistance requests", CR: CRU, DP: ROUTED },
  {
    line: 346,
    label: "Enquiry status, non-internal events, site visit dates, client feedback",
    CR: { read: {}, update: { fields: ["feedback"] } },
    DP: SAMPLE,
  },
  { line: 347, label: "Hotel proposals, client amounts", CR: plain("read", "approve"), DP: SAMPLE },
  { line: 348, label: "Wedding dashboard, overview, milestones", CR: plain("read"), DP: SAMPLE },
  {
    line: 349,
    label: "Family and decision-maker contacts (`account_contacts`)",
    CR: plain("read"),
  },
  {
    line: 350,
    label: "Functions and shared programme",
    CR: plain("read"),
    GU: { read: { checks: ["invited"] } },
    DP: SAMPLE,
  },
  {
    line: 351,
    label: "Client budget: estimate, approved, actual amounts of client-visible lines",
    DP: { read: { checks: ["demo_record"], view: "masked" } },
  },
  { line: 352, label: "Invoices issued to the client, inbound payments, milestones" },
  { line: 353, label: "Pay a milestone online (A-2)" },
  {
    line: 354,
    label: "Vendor options, client descriptions, portfolios",
    CR: plain("read"),
    DP: SAMPLE,
  },
  {
    line: 355,
    label: "Vendor decision (interested, shortlisted, selected, declined)",
    CR: plain("update"),
  },
  {
    line: 356,
    label: "Vendor proposals, client amounts",
    CR: plain("read", "approve"),
    DP: SAMPLE,
  },
  {
    line: 357,
    label: "Shared design versions",
    CR: { read: {}, create: { subjects: ["comment"] }, approve: {} },
    DP: SAMPLE,
  },
  {
    line: 358,
    label: "Invitations and save-the-dates, shared versions",
    CR: plain("read", "approve"),
  },
  {
    line: 359,
    label: "Family groups and guests, standard fields",
    CR: { read: { view: "summary", checks: ["approved"] } },
    GU: {
      read: {},
      update: { fields: ["attendance", "dietary"] },
      create: { checks: ["within_allowance"] },
    },
  },
  {
    line: 360,
    label: "Guest sensitive fields (allergies, accessibility)",
    GU: plain("read", "update"),
  },
  { line: 361, label: "Guest internal notes" },
  {
    line: 362,
    label: "Identity documents",
    GU: { create: { checks: ["identity_required"] }, read: { view: "status_only" } },
  },
  {
    line: 363,
    label: "Attendance and RSVP progress",
    CR: SUMMARIES,
    GU: plain("read", "update"),
    DP: SAMPLE,
  },
  {
    line: 364,
    label: "Rooming (own guests)",
    CR: SUMMARIES,
    GU: { read: { checks: ["allocation_confirmed"] } },
  },
  {
    line: 365,
    label: "Travel and transport (own guests)",
    CR: SUMMARIES,
    GU: each(["create", "read", "update"], {
      fields: ["travel_details"],
      checks: ["travel_requested"],
    }),
  },
  { line: 366, label: "Menus, shared versions", CR: plain("read", "approve"), DP: SAMPLE },
  {
    line: 367,
    label: "Client requests: questions, change requests, support",
    CR: CRU,
    GU: { create: { subjects: ["support_request"] } },
    DP: ROUTED,
  },
  { line: 368, label: "Approval decisions", CR: plain("approve") },
  {
    line: 369,
    label: "Shared documents",
    CR: plain("read"),
    GU: { read: { checks: ["shared_with_guests"] } },
    DP: SAMPLE,
  },
  { line: 370, label: "Upload documents (signed contract, guest list file)", CR: plain("create") },
  { line: 371, label: "Tasks flagged client-visible (pending decisions)", CR: plain("read") },
  { line: 372, label: "Notification preferences", CR: CRUD, DP: CRUD },
  { line: 373, label: "Feedback after the wedding", CR: plain("create") },
  { line: 374, label: "Exports" },
  { line: 375, label: "Live chat (Q20)", CR: CRU, DP: ROUTED },
];

function expectCell(type: ReachPrincipal, label: string, cell: Cell): void {
  for (const action of ALL_ACTIONS) {
    const facts = cell[action];
    if (facts === undefined) {
      expect(decideReach(type, label, action).reason, action).toBe("no_grant");
      continue;
    }
    expect(decideReach(type, label, action, facts), action).toEqual({
      allowed: true,
      scope: "own",
      reason: "granted",
    });
    for (const fewer of refusedVariants(facts)) {
      expect(
        decideReach(type, label, action, fewer).allowed,
        `${action} ${JSON.stringify(fewer)}`,
      ).toBe(false);
    }
  }
}

describe("§6 golden table: client, guest and demo principals", () => {
  it("holds every row of §6, on the line and under the label the document's text gives it", () => {
    const document = documentTableRows("## 6. Permission matrix", "## 7. Status transitions");
    expect(ROWS.map((row) => [row.line, row.label])).toEqual(
      document.map((row) => [row.line, row.cells[0]]),
    );
    expect(ROWS).toHaveLength(33);
  });

  for (const row of ROWS) {
    for (const [type, column] of COLUMNS) {
      const cell = row[column] ?? {};
      const listed = ALL_ACTIONS.filter((action) => cell[action] !== undefined);
      it(`§6 line ${row.line}: ${column} may ${listed.join(", ") || "nothing"} on ${row.label}`, () => {
        expectCell(type, row.label, cell);
      });
    }
  }
});
