/**
 * Golden cases for the §7 parser, taken from the literal rows of docs/permission-matrix.md (line in
 * the test name): movers come only from the who-part, status sets and qualifiers are named, and a
 * row the parser cannot read stops the generator.
 */
import { describe, expect, it } from "vitest";

import { parseTransitions } from "./parse-transitions.ts";

function table(heading: string, ...rows: string[]): string {
  return [`### ${heading}`, "| From | To | Who |", "|---|---|---|", ...rows].join("\n");
}

describe("parseTransitions", () => {
  it("§7 line 419: role codes come from the who-part, never from the condition ('approved by FA')", () => {
    const [rule] = parseTransitions(
      table(
        "Wedding project",
        "| closure | closed | PM (a), SA, only when the closure checklist is complete and final accounts are approved by FA |",
      ),
    );
    expect(rule).toMatchObject({
      entity: "wedding_project",
      from: ["closure"],
      to: ["closed"],
      roles: [
        { role: "PM", assigned: true },
        { role: "SA", assigned: false },
      ],
      client: false,
      system: false,
      actors: [],
      condition:
        "only when the closure checklist is complete and final accounts are approved by FA",
    });
  });

  it("§7 line 455: 'any open state' is the named set of open incident states", () => {
    const [rule] = parseTransitions(
      table(
        "Incident",
        "| any open state | escalated | The assignee, PM (a), or System per the escalation rules |",
      ),
    );
    expect(rule).toMatchObject({
      from: ["open", "assigned", "in_progress"],
      to: ["escalated"],
      roles: [{ role: "PM", assigned: true }],
      system: true,
      actors: ["assignee"],
      condition: "per the escalation rules",
    });
  });

  it("§7 lines 389 and 400: each clause of a who-cell is its own rule", () => {
    const rules = parseTransitions(
      table(
        "Subscription",
        "| pending_payment or trial | active | System on payment succeeded; FA or SA manually, with a payment record attached |",
      ),
    );
    expect(rules.map((r) => [r.system, r.roles.map((g) => g.role), r.condition])).toEqual([
      [true, [], "on payment succeeded"],
      [false, ["FA", "SA"], "manually, with a payment record attached"],
    ]);
    const enquiry = parseTransitions(
      table("Hotel enquiry", "| draft | submitted | Either CR; SM or HT on the client's behalf |"),
    );
    expect(enquiry.map((r) => [r.client, r.roles.map((g) => g.role)])).toEqual([
      [true, []],
      [false, ["SM", "HT"]],
    ]);
  });

  it("§7 lines 478-483: the assigned staff member and the requester are actors; qualifiers are kinds", () => {
    const rules = parseTransitions(
      table(
        "Client request",
        "| submitted | under_review | The assigned staff member |",
        "| under_review | answered (question) | The assigned staff member |",
        "| under_review | accepted or rejected (change request) | PM (a), SA |",
        "| any | withdrawn | The requester |",
      ),
    );
    expect(rules.map((r) => [r.to, r.kind, r.actors])).toEqual([
      [["under_review"], null, ["assignee"]],
      [["answered"], "question", ["assignee"]],
      [["accepted", "rejected"], "change_request", []],
      [["withdrawn"], null, ["requester"]],
    ]);
    expect(rules[3]?.from).not.toContain("withdrawn");
  });

  it("§7 line 421: 'previous status' restores the status saved before the hold", () => {
    const [rule] = parseTransitions(
      table("Wedding project", "| on_hold | previous status | PM (a), SA |"),
    );
    expect(rule).toMatchObject({ from: ["on_hold"], to: [], restore: true });
  });

  it("§7 lines 420 and 422: a plain 'any' leaves out the terminal statuses and the target", () => {
    const [rule] = parseTransitions(
      table("Wedding project", "| any | on_hold | PM (a), SA, with reason; approvals are paused |"),
    );
    expect(rule?.from).toEqual([
      "setup",
      "planning",
      "approvals",
      "pre_production",
      "ready",
      "live",
      "closure",
    ]);
  });

  it("§7 line 446: readiness is derived by the System; 'an exception needs SA' names no mover", () => {
    const rules = parseTransitions(
      table(
        "Function status and readiness",
        "| readiness: not_started, in_progress, blocked, ready | derived | System, from the readiness checklist; an exception needs SA, Eva's authorised personnel (P-8 changed by Q10) |",
        "| ready | live | PM (a), HL (a) on the day |",
      ),
    );
    // data-model.md line 1838: the exception is authorised on the checklist item (§5.6 line 207);
    // the System derives ready from the items, so SA moves the readiness status by no rule.
    expect(rules.map((r) => [r.entity, r.from, r.to, r.system, r.roles])).toEqual([
      [
        "function_readiness",
        ["not_started", "in_progress", "blocked", "ready"],
        ["not_started", "in_progress", "blocked", "ready"],
        true,
        [],
      ],
      [
        "function_readiness",
        ["ready"],
        ["live"],
        false,
        [
          { role: "PM", assigned: true },
          { role: "HL", assigned: true },
        ],
      ],
    ]);
    expect(rules[0]?.condition).toBe(
      "from the readiness checklist; an exception needs SA, Eva's authorised personnel (P-8 changed by Q10)",
    );
  });

  it("§7 line 395: a row with no mover is kept only when the document says nobody moves it", () => {
    const [rule] = parseTransitions(
      table(
        "Subscription",
        "| expired or cancelled | active | New subscription row; the old one is never reactivated |",
      ),
    );
    expect(rule).toMatchObject({ roles: [], client: false, system: false, actors: [] });
  });

  it("stops on an unknown status, set, qualifier, entity or a who-cell without a mover", () => {
    expect(() => parseTransitions(table("Incident", "| open | reopened | SA |"))).toThrow(
      /reopened/,
    );
    expect(() => parseTransitions(table("Incident", "| any stale state | closed | SA |"))).toThrow(
      /stale state/,
    );
    expect(() =>
      parseTransitions(table("Client request", "| under_review | answered (complaint) | SA |")),
    ).toThrow(/complaint/);
    expect(() => parseTransitions(table("Invoice", "| draft | issued | FA |"))).toThrow(/Invoice/);
    expect(() =>
      parseTransitions(table("Incident", "| open | assigned | whoever is on duty |")),
    ).toThrow(/no mover/);
    // A person the record does not bind to a principal type (statuses.ts actors) names nobody.
    expect(() =>
      parseTransitions(table("Room allocation", "| requested | proposed | The owner |")),
    ).toThrow(/owner/);
  });

  it("§7 line 483: stops on an indented row instead of skipping it", () => {
    const block = table(
      "Client request",
      "| accepted | implemented | PM (a) |",
      " | any | withdrawn | The requester |",
    );
    expect(() => parseTransitions(block)).toThrow(/indented/);
  });

  it("§7 line 428: a later sentence of a Who cell is read like the first, so its mover is a rule", () => {
    const rules = parseTransitions(
      table("Incident", "| resolved | closed | PM (a). SA may also close it |"),
    );
    expect(rules.map((rule) => [rule.roles, rule.condition])).toEqual([
      [[{ role: "PM", assigned: true }], null],
      [[{ role: "SA", assigned: false }], "may also close it"],
    ]);
  });

  it("§7 line 428: a later sentence that names no mover, or leaves a role in a condition, stops it", () => {
    const later = (who: string) => () =>
      parseTransitions(table("Incident", `| resolved | closed | ${who} |`));
    expect(later("PM (a). An auditor; HL (a) on the day")).toThrow(/no mover in "An auditor"/);
    expect(later("PM (a). Closing needs the sign-off of SA")).toThrow(/no mover/);
    expect(later("PM (a). HL (a) and SA")).toThrow(/SA is in the condition/);
  });

  it("§7 line 428: the approval row's second sentence names no mover and is known to need none", () => {
    const counting =
      "Approved needs `required_decisions` approvals, one by default; one rejection or revision request moves it immediately";
    const rules = parseTransitions(
      table(
        "Approval",
        `| submitted | approved, revision_requested or rejected | Either CR; PM (a) or SA on the client's behalf with a note or record (P-9 confirmed). ${counting} |`,
      ),
    );
    expect(
      rules.map((rule) => [rule.client, rule.roles.map((g) => g.role), rule.condition]),
    ).toEqual([
      [true, [], counting],
      [
        false,
        ["PM", "SA"],
        `on the client's behalf with a note or record (P-9 confirmed); ${counting}`,
      ],
    ]);
  });

  it("§7 line 419: a role code left in a condition stops the generator unless it says who approves", () => {
    expect(() =>
      parseTransitions(table("Room allocation", "| proposed | confirmed | PM (a) and HL |")),
    ).toThrow(/HL/);
    expect(() =>
      parseTransitions(table("Incident", "| resolved | closed | PM (a), later SA |")),
    ).toThrow(/SA/);
    const [closing] = parseTransitions(
      table(
        "Wedding project",
        "| closure | closed | PM (a), SA, only when the closure checklist is complete and final accounts are approved by FA |",
      ),
    );
    expect(closing?.roles.map((mover) => mover.role)).toEqual(["PM", "SA"]);
  });
});
