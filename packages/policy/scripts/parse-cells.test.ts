/**
 * Golden cases for the §5 and §6 cell parser, taken from the literal cell text of
 * docs/permission-matrix.md (line in the test name): qualified, multi-grant, noted, prefixed and
 * blank cells, and the cells that must make the generator stop.
 */
import { describe, expect, it } from "vitest";

import { parseCell } from "./parse-cells.ts";

describe("parseCell, §5 staff cells", () => {
  it("§5 line 136: (a) and (o) bind to the letters they follow (§5.9 line 248 'CR (a) UD (o)')", () => {
    expect(parseCell("CR (a) UD (o)", "staff")).toEqual([
      { actions: ["create", "read"], scope: "assigned", conditions: [] },
      { actions: ["update", "delete"], scope: "own", conditions: [] },
    ]);
  });

  it("§5.9 line 248: 'CR (o) UD' would edit every comment while reading only one's own; read as UD (o)", () => {
    expect(parseCell("CR (o) UD", "staff")).toEqual([
      { actions: ["create", "read"], scope: "own", conditions: [] },
      { actions: ["update", "delete"], scope: "own", conditions: [] },
    ]);
  });

  it("§5.10 line 264: 'with explicit grant' and 'check-in only' narrow the grant", () => {
    expect(parseCell("CRU (a) with explicit grant", "staff")).toEqual([
      {
        actions: ["create", "read", "update"],
        scope: "assigned",
        conditions: [{ kind: "explicit_grant" }],
      },
    ]);
    expect(parseCell("R (a) check-in only", "staff")).toEqual([
      { actions: ["read"], scope: "assigned", conditions: [{ kind: "check", check: "check_in" }] },
    ]);
    expect(parseCell("R break-glass", "staff")).toEqual([
      { actions: ["read"], scope: "all", conditions: [{ kind: "check", check: "break_glass" }] },
    ]);
  });

  it("§5.7 line 216 and §5.6 line 203: side and field notes, including a note split by commas", () => {
    expect(parseCell("RU hotel lines", "staff")).toEqual([
      {
        actions: ["read", "update"],
        scope: "all",
        conditions: [{ kind: "side", anyOf: ["hotel"] }],
      },
    ]);
    // §5.7 line 222: "CR (a) vendor" is the vendor side of an invoice received, not a record type.
    expect(parseCell("CR (a) vendor", "staff")).toEqual([
      {
        actions: ["create", "read"],
        scope: "assigned",
        conditions: [{ kind: "side", anyOf: ["vendor"] }],
      },
    ]);
    expect(parseCell("RU (a) theme, dress code", "staff")).toEqual([
      {
        actions: ["read", "update"],
        scope: "assigned",
        conditions: [{ kind: "fields", only: ["theme", "dress_code"] }],
      },
    ]);
    expect(parseCell("C budget lines, contracts, invoices", "staff")).toEqual([
      {
        actions: ["create"],
        scope: "all",
        conditions: [{ kind: "subject", anyOf: ["budget_line", "contract", "invoice"] }],
      },
    ]);
  });

  it("§5.15 line 312: the closure precondition; §5.6 line 207: 'request only' grants nothing", () => {
    expect(
      parseCell("A (a) when the checklist is complete and final accounts are approved", "staff"),
    ).toEqual([
      {
        actions: ["approve"],
        scope: "assigned",
        conditions: [{ kind: "check", check: "closure_ready" }],
      },
    ]);
    expect(parseCell("request only", "staff")).toEqual([]);
    expect(parseCell("—", "staff")).toEqual([]);
  });

  it("refuses an unknown note, a §6 phrase in §5 and an ambiguous cell, so nothing is dropped silently", () => {
    expect(() => parseCell("R hotel lines only on Tuesdays", "staff")).toThrow(/unknown note/);
    expect(() => parseCell("CRUD own", "staff")).toThrow(/unknown note/);
    expect(() => parseCell("R (o) U", "staff")).toThrow(/wider than its read/);
    expect(() => parseCell("RR", "staff")).toThrow(/twice/);
  });

  it("POL-19: refuses every edit that reaches records the cell does not read", () => {
    // Each probe edits records it cannot read: a later grant, an assigned against an own read, or
    // no read at all.
    expect(() => parseCell("RU (o), D", "staff")).toThrow(/wider than its read/);
    expect(() => parseCell("CR (o) U (a)", "staff")).toThrow(/wider than its read/);
    expect(() => parseCell("R (o) D (a)", "staff")).toThrow(/wider than its read/);
    expect(() => parseCell("R (a) U (o)", "staff")).toThrow(/wider than its read/);
    expect(() => parseCell("C (o) UD", "staff")).toThrow(/does not read/);
    expect(() => parseCell("UD", "staff")).toThrow(/does not read/);
    expect(() => parseCell("U", "others")).not.toThrow();
    expect(() => parseCell("D", "others")).toThrow(/does not read/);
  });

  it("§5.6 line 208, §5.8 line 238, §5.9 line 248, §5.15 line 311: the document's own edit-beyond-read cells parse", () => {
    for (const cell of [
      "U",
      "U (a)",
      "U (a) mark delivered",
      "U vendor completion",
      "U (a) departures, lost and found",
      "U final accounts",
      "CR (a) UD (o)",
    ]) {
      expect(() => parseCell(cell, "staff"), cell).not.toThrow();
    }
    expect(() => parseCell("U (either representative)", "others")).not.toThrow();
  });
});

describe("parseCell, §6 client, guest and demo cells", () => {
  it("§6 line 338: every client grant is scoped to the principal's own wedding or account", () => {
    expect(parseCell("R", "others")).toEqual([{ actions: ["read"], scope: "own", conditions: [] }]);
    expect(parseCell("CRUD own account", "others")).toEqual([
      { actions: ["create", "read", "update", "delete"], scope: "own", conditions: [] },
    ]);
  });

  it("§6 line 371: a bare 'own' manages the principal's own record", () => {
    expect(parseCell("own", "others")).toEqual([
      { actions: ["create", "read", "update", "delete"], scope: "own", conditions: [] },
    ]);
  });

  it("§6 line 345: 'R, U feedback' limits the update, not the read", () => {
    expect(parseCell("R, U feedback", "others")).toEqual([
      { actions: ["read"], scope: "own", conditions: [] },
      { actions: ["update"], scope: "own", conditions: [{ kind: "fields", only: ["feedback"] }] },
    ]);
  });

  it("§6 line 356: 'comment' is its own grant, a comment created on the shared version", () => {
    expect(parseCell("R, comment, A", "others")).toEqual([
      { actions: ["read"], scope: "own", conditions: [] },
      { actions: ["create"], scope: "own", conditions: [{ kind: "subject", anyOf: ["comment"] }] },
      { actions: ["approve"], scope: "own", conditions: [] },
    ]);
  });

  it("§6 line 361: each note of the guest's identity-document cell binds to its own grant", () => {
    expect(
      parseCell("own: C upload when the project requires it, R status only", "others"),
    ).toEqual([
      {
        actions: ["create"],
        scope: "own",
        conditions: [{ kind: "check", check: "identity_required" }],
      },
      { actions: ["read"], scope: "own", conditions: [{ kind: "view", view: "status_only" }] },
    ]);
  });

  it("§6 lines 358 and 363: prefixes and notes of the guest cells", () => {
    expect(
      parseCell(
        "own group: R members, U attendance and dietary, C members up to allowance",
        "others",
      ),
    ).toEqual([
      { actions: ["read"], scope: "own", conditions: [] },
      {
        actions: ["update"],
        scope: "own",
        conditions: [{ kind: "fields", only: ["attendance", "dietary"] }],
      },
      {
        actions: ["create"],
        scope: "own",
        conditions: [{ kind: "check", check: "within_allowance" }],
      },
    ]);
    expect(parseCell("own allocation once confirmed: R", "others")).toEqual([
      {
        actions: ["read"],
        scope: "own",
        conditions: [{ kind: "check", check: "allocation_confirmed" }],
      },
    ]);
  });

  it("§6 lines 350-352 and 373: 'to confirm' and dashed cells grant nothing until AMPM answers", () => {
    expect(parseCell("To confirm (Q4); internal data never", "others")).toEqual([]);
    expect(parseCell("— (not in the first release, Q4)", "others")).toEqual([]);
    expect(parseCell("To confirm (Q4); never guest data", "others")).toEqual([]);
  });

  it("§6 lines 342 and 344: the demo's masked reads and routed creations are conditions", () => {
    expect(parseCell("R sample masked", "others")).toEqual([
      {
        actions: ["read"],
        scope: "own",
        conditions: [
          { kind: "check", check: "demo_record" },
          { kind: "view", view: "masked" },
        ],
      },
    ]);
    expect(parseCell("C, routed to Sales", "others")).toEqual([
      {
        actions: ["create"],
        scope: "own",
        conditions: [{ kind: "check", check: "routed_to_sales" }],
      },
    ]);
  });

  it("refuses an unknown §6 note or prefix", () => {
    expect(() => parseCell("R on weekdays", "others")).toThrow(/unknown note/);
    expect(() => parseCell("other group: R", "others")).toThrow(/unknown prefix/);
  });
});
