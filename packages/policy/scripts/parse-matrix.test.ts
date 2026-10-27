/**
 * Golden cases for reading the §5 and §6 tables: every row is parsed by a known layout or the
 * generator stops, and the §5.16 report table becomes report keys with their exclusions (rows copied
 * from docs/permission-matrix.md, line in the test name).
 */
import { describe, expect, it } from "vitest";

import { parseMatrix } from "./parse-matrix.ts";

const ROLES = "| Resource | SA | SM | HT | PM | CD | VC | RG | HL | FA |";
const REPORTS = "| Report (SPEC §9) | May run | May export | Excluded from the export |";

describe("parseMatrix", () => {
  it("§5.1 line 146: a staff row keeps its cells and parses every role", () => {
    const block = [
      "### 5.1 Administration",
      ROLES,
      "|---|---|---|---|---|---|---|---|---|---|",
      "| Audit log | RX | — | — | R (a) | — | — | — | — | R finance entities |",
    ].join("\n");
    const [row] = parseMatrix(block, "staff", { partial: true });
    expect(row).toMatchObject({ section: "5.1", module: "admin", resource: "audit_log" });
    expect(row?.cells["FA"]).toBe("R finance entities");
    expect(row?.grants["FA"]).toEqual([
      {
        actions: ["read"],
        scope: "all",
        conditions: [{ kind: "subject", anyOf: ["finance_entity"] }],
      },
    ]);
    expect(row?.grants["SA"]).toEqual([
      { actions: ["read", "export"], scope: "all", conditions: [] },
    ]);
  });

  it("§5.16 lines 327 and 330: report rows become read and export grants with their exclusions", () => {
    const block = [
      "### 5.16 Reports and exports",
      REPORTS,
      "|---|---|---|---|",
      "| Internal cost and margin variance | SA, FA, PM (a) | SA, FA | — |",
      "| Rooming list and arrival or departure manifests | SA, HL (a), RG (a), PM (a) | SA, HL (a) | Identity documents; the hotel rooming list export carries names, dates and room category only and is audited |",
    ].join("\n");
    const [internal, rooming] = parseMatrix(block, "staff", { partial: true });
    expect(internal).toMatchObject({ module: "reports", resource: "budget_internal" });
    expect(internal?.grants["FA"]).toEqual([
      { actions: ["read", "export"], scope: "all", conditions: [] },
    ]);
    expect(internal?.grants["PM"]).toEqual([
      { actions: ["read"], scope: "assigned", conditions: [] },
    ]);
    expect(internal?.grants["HT"]).toEqual([]);
    expect(rooming?.exclusions).toEqual([
      { kind: "class", class: "RESTRICTED-IDENTITY", unlessRoles: [] },
      {
        kind: "variant",
        variant: "hotel_rooming_list",
        onlyFields: ["names", "dates", "room_category"],
        audited: true,
      },
    ]);
  });

  it("stops on a row of an unknown layout, an unknown role in a report list or an unknown exclusion", () => {
    const broken = ["### 5.1 Administration", ROLES, "|---|", "| Audit log | RX | — |"].join("\n");
    expect(() => parseMatrix(broken, "staff")).toThrow(/cells/);
    const unknownRole = ["### 5.16 Reports", REPORTS, "|---|", "| Funnel | SA, XX | SA | — |"];
    expect(() => parseMatrix(unknownRole.join("\n"), "staff")).toThrow(/XX/);
    const unknownExclusion = [
      "### 5.16 Reports",
      REPORTS,
      "|---|",
      "| Funnel | SA | SA | Gossip |",
    ];
    expect(() => parseMatrix(unknownExclusion.join("\n"), "staff")).toThrow(/Gossip/);
    const unknownHeader = [
      "### 5.1 Administration",
      "| Resource | SA | ZZ |",
      "|---|",
      "| A | R | R |",
    ];
    expect(() => parseMatrix(unknownHeader.join("\n"), "staff")).toThrow(/layout/);
  });

  it("§5.15 line 316, §6 line 374: stops on an indented row, which GFM still renders in the table", () => {
    const staffBlock = [
      "### 5.15 Closure, feedback and public website",
      ROLES,
      "|---|---|---|---|---|---|---|---|---|---|",
      "| Client feedback | R | R | — | R (a) | — | — | — | — | — |",
      " | CMS pages and showcase items | CRUD | CRU | R | R | R | R | R | R | R |",
    ].join("\n");
    expect(() => parseMatrix(staffBlock, "staff")).toThrow(/indented/);
    const othersBlock = [
      "| Resource | CR (both representatives) | GU | DP |",
      "|---|---|---|---|",
      "| Exports | To confirm (Q4); never guest data | — | — |",
      "  | Live chat (Q20) | CRU own conversations | — | C, routed to Sales |",
    ].join("\n");
    expect(() => parseMatrix(othersBlock, "others")).toThrow(/indented/);
  });

  it("§10 lines 545, 546 and 551: stops when a §10 key names a row label the section does not have", () => {
    const block = [
      "### 5.7 Budget and finance",
      ROLES,
      "|---|---|---|---|---|---|---|---|---|---|",
      "| Raw vendor quotes | CRUD | — | — | R (a) | — | CRUD | — | — | R |",
    ].join("\n");
    expect(() => parseMatrix(block, "staff", { partial: true })).toThrow(/vendors\.quotes\.read/);
  });

  it("§4 line 125, §5.8 line 233: a reading of one cell holds there only, and stops once the cell changes", () => {
    const readUpdate = [{ actions: ["read", "update"], scope: "all", conditions: [] }];
    const vendors = (bankForVC: string) =>
      [
        "### 5.8 Vendors, artists and production",
        ROLES,
        "|---|---|---|---|---|---|---|---|---|---|",
        "| Vendor profiles, client fields | CRUD | R | — | R | R | CRUD | — | R | R |",
        "| Vendor contacts | RU | — | — | R (a) | — | RU | — | R (a) | — |",
        "| Vendor internal rating and notes | RU | — | — | R (a) | — | RU | — | — | — |",
        `| Vendor bank details | R | — | — | — | — | ${bankForVC} | — | — | RU |`,
        "| Vendor proposals, client amounts | CRUS | — | — | RUS (a) | R (a) | CRUS | — | — | R |",
        "| Vendor proposals, internal cost | RU | — | — | R (a) | — | RU | — | — | R |",
        "| Artist bookings | CRUD | — | — | CRU (a) | R (a) | CRU | — | R (a) | — |",
        "| Artist fee, internal | RU | — | — | R (a) | — | RU | — | — | R |",
      ].join("\n");
    const rows = parseMatrix(vendors("RU"), "staff");
    const bank = rows.find((row) => row.label === "Vendor bank details");
    expect(bank?.cells["VC"]).toBe("RU");
    expect(bank?.grants["VC"]).toEqual([]);
    expect(bank?.grants["FA"]).toEqual(readUpdate);
    expect(bank?.grants["SA"]).toEqual([{ actions: ["read"], scope: "all", conditions: [] }]);
    expect(rows.find((row) => row.label === "Vendor contacts")?.grants["VC"]).toEqual(readUpdate);
    // Once the document changes the cell, the reading names nothing: review it, never drop it.
    expect(() => parseMatrix(vendors("R"), "staff")).toThrow(/READINGS/);
  });

  it("§4 line 125, §5.8 line 233: a whole §5 block without the reading's subsection stops", () => {
    // A renumbered or dropped §5.8 must not let VC's "RU" through as written (notes.ts READINGS).
    const block = [
      "### 5.1 Administration",
      ROLES,
      "|---|---|---|---|---|---|---|---|---|---|",
      "| Audit log | RX | — | — | R (a) | — | — | — | — | R finance entities |",
    ].join("\n");
    expect(() => parseMatrix(block, "staff")).toThrow(/READINGS "§5\.8 Vendor bank details/);
    expect(parseMatrix(block, "staff", { partial: true })).toHaveLength(1);
    // A §5 reading is not the §6 table's to hold.
    const others = ["| Resource | CR (both representatives) | GU | DP |", "|---|---|---|---|"];
    expect(
      parseMatrix([...others, "| Notification preferences | own | — | own |"].join("\n"), "others"),
    ).toHaveLength(1);
  });

  it("§6 line 371: the client, guest and demo table parses with its own columns", () => {
    const block = [
      "| Resource | CR (both representatives) | GU | DP |",
      "|---|---|---|---|",
      "| Notification preferences | own | — | own |",
    ].join("\n");
    const [row] = parseMatrix(block, "others");
    expect(row).toMatchObject({
      section: "6",
      module: "client",
      resource: "notification_preferences",
    });
    expect(row?.grants["CR"]).toEqual([
      { actions: ["create", "read", "update", "delete"], scope: "own", conditions: [] },
    ]);
    expect(row?.grants["GU"]).toEqual([]);
  });
});
