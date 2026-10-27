/**
 * Client entitlements against the rows of docs/permission-matrix.md §3 (line in the test name):
 * which modules each account state reaches, which of them are read-only, and which hotels discovery
 * reaches. Expected values are copied from the table, never computed.
 */
import { describe, expect, it } from "vitest";

import { resolveClientEntitlements, type ClientAccountState } from "./entitlements";

const base: ClientAccountState = {
  isDemo: false,
  suspended: false,
  subscription: "none",
  hotelAssistanceAgreement: false,
  project: "none",
};

function resolve(state: Partial<ClientAccountState>) {
  return resolveClientEntitlements({ ...base, ...state });
}

describe("resolveClientEntitlements", () => {
  it("§3 line 103: refuses a suspended account", () => {
    expect(resolve({ suspended: true })).toEqual({
      modules: [],
      readOnlyModules: [],
      hotelReach: [],
      financeReach: [],
      requestTypes: { wedding: [], account: [] },
      signInRefused: true,
    });
  });

  it("§3 line 96: an active discovery subscription reaches the hotel modules only", () => {
    const result = resolve({ subscription: "active" });
    expect(result.modules).toEqual([
      "hotel_discovery",
      "saved_hotels",
      "hotel_assistance",
      "support",
    ]);
    expect(result.readOnlyModules).toEqual(["hotel_discovery"]);
    expect(result.hotelReach).toEqual(["all_hotels"]);
  });

  it("§3 line 97: a lapsed subscription keeps saved hotels, enquiries and invoices read-only", () => {
    for (const subscription of ["expired", "cancelled", "suspended"] as const) {
      const result = resolve({ subscription });
      expect(result.modules).toEqual([
        "saved_hotels",
        "hotel_assistance",
        "client_finance",
        "support",
      ]);
      expect(result.readOnlyModules).toEqual([
        "saved_hotels",
        "hotel_assistance",
        "client_finance",
      ]);
      expect(result.hotelReach).toEqual([]);
    }
  });

  it("§3 lines 98 and 109: an agreement reaches only its own enquiries' hotels, never hotel search", () => {
    const result = resolve({ hotelAssistanceAgreement: true });
    expect(result.hotelReach).toEqual(["agreement_hotels"]);
    expect(result.modules).toEqual([
      "hotel_discovery",
      "saved_hotels",
      "hotel_assistance",
      "client_finance",
      "support",
    ]);
    expect(result.readOnlyModules).toEqual(["hotel_discovery", "saved_hotels", "client_finance"]);
  });

  it("§3 line 99: a project member acts on the wedding whatever the subscription state", () => {
    for (const subscription of ["none", "expired", "cancelled", "suspended"] as const) {
      const result = resolve({ project: "active", subscription });
      expect(result.modules).toEqual(
        expect.arrayContaining(["wedding_workspace", "saved_hotels", "hotel_assistance", "menus"]),
      );
      expect(result.readOnlyModules).not.toContain("wedding_workspace");
      expect(result.readOnlyModules).not.toContain("saved_hotels");
      expect(result.readOnlyModules).not.toContain("menus");
      expect(result.readOnlyModules).toContain("guests_rsvp");
      expect(result.modules).toContain("live_chat");
      expect(result.hotelReach).toEqual(["project_hotels"]);
    }
  });

  it("§3 line 99: full hotel search for a project member needs an active subscription", () => {
    expect(resolve({ project: "active", subscription: "active" }).hotelReach).toEqual([
      "all_hotels",
      "project_hotels",
    ]);
  });

  it("§3 line 99: the wedding's client finance waits for AMPM (Q4)", () => {
    expect(resolve({ project: "active" }).modules).not.toContain("client_finance");
    expect(resolve({ project: "active" }).financeReach).toEqual([]);
  });

  it("§3 lines 97-99: a lapsed subscription or an agreement reaches its own invoices, never the wedding's finance", () => {
    for (const subscription of ["expired", "cancelled", "suspended"] as const) {
      const result = resolve({ subscription, project: "active" });
      expect(result.readOnlyModules).toContain("client_finance");
      expect(result.financeReach, subscription).toEqual(["own_invoices"]);
    }
    const agreement = resolve({ hotelAssistanceAgreement: true, project: "active" });
    expect(agreement.financeReach).toEqual(["agreement_invoices"]);
    expect(resolve({ subscription: "active", project: "active" }).financeReach).toEqual([]);
    expect(resolve({ isDemo: true }).financeReach).toEqual(["demo_sample"]);
  });

  it("§3 line 100: a project on hold is read-only except support, without live chat", () => {
    const result = resolve({ project: "on_hold" });
    expect(result.modules).toEqual([
      "hotel_discovery",
      "saved_hotels",
      "hotel_assistance",
      "wedding_workspace",
      "guests_rsvp",
      "menus",
      "support",
    ]);
    expect(result.readOnlyModules).toEqual(result.modules.filter((m) => m !== "support"));
    expect(result.hotelReach).toEqual(["project_hotels"]);
  });

  it("§3 line 101: a closed project in its window keeps support and drops live chat", () => {
    const result = resolve({ project: "closed_in_window" });
    expect(result.modules).toContain("support");
    expect(result.modules).not.toContain("live_chat");
    expect(result.readOnlyModules).not.toContain("support");
    expect(result.readOnlyModules).toContain("wedding_workspace");
  });

  it("§3 lines 100-101: on hold any request may be created; closed in its window, support ones only", () => {
    const all = ["question", "change_request", "support"];
    const onHold = resolve({ project: "on_hold" });
    const closed = resolve({ project: "closed_in_window" });
    expect(onHold.requestTypes).toEqual({ wedding: all, account: [] });
    expect(closed.requestTypes).toEqual({ wedding: ["support"], account: [] });
    expect(closed).not.toEqual(onHold);
    expect(resolve({ project: "active" }).requestTypes).toEqual({ wedding: all, account: [] });
  });

  it("§3 lines 96, 97 and 101: a subscription asks at account level and never widens a closed wedding", () => {
    const all = ["question", "change_request", "support"];
    for (const subscription of ["active", "expired", "cancelled"] as const) {
      expect(resolve({ project: "closed_in_window", subscription }).requestTypes).toEqual({
        wedding: ["support"],
        account: all,
      });
    }
    expect(
      resolve({ project: "closed_in_window", hotelAssistanceAgreement: true }).requestTypes,
    ).toEqual({ wedding: ["support"], account: all });
    expect(resolve({ subscription: "active" }).requestTypes).toEqual({ wedding: [], account: all });
  });

  it("§3 line 102: an archived wedding reaches nothing in the portal, not even support", () => {
    expect(resolve({ project: "archived" })).toEqual({
      modules: [],
      readOnlyModules: [],
      hotelReach: [],
      financeReach: [],
      requestTypes: { wedding: [], account: [] },
      signInRefused: false,
    });
  });

  it("§3 line 94: the demo reads sample finance and may save hotels and ask for assistance", () => {
    const result = resolve({ isDemo: true });
    expect(result.modules).toEqual([
      "hotel_discovery",
      "saved_hotels",
      "hotel_assistance",
      "wedding_workspace",
      "client_finance",
      "guests_rsvp",
      "menus",
      "support",
      "live_chat",
    ]);
    expect(result.readOnlyModules).toEqual([
      "hotel_discovery",
      "wedding_workspace",
      "client_finance",
      "guests_rsvp",
      "menus",
    ]);
    expect(result.hotelReach).toEqual(["demo_hotels"]);
  });

  it("§3 lines 96 and 99: sources combine, and a module is writable when any source writes it", () => {
    const result = resolve({ project: "on_hold", subscription: "active" });
    expect(result.readOnlyModules).not.toContain("saved_hotels");
    expect(result.readOnlyModules).toContain("wedding_workspace");
    expect(result.hotelReach).toEqual(["all_hotels", "project_hotels"]);
  });
});
