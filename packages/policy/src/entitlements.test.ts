import { describe, expect, it } from "vitest";

import { resolveClientEntitlements } from "./entitlements";

const base = {
  isDemo: false,
  suspended: false,
  subscription: "none",
  hotelAssistanceAgreement: false,
  project: "none",
} as const;

describe("resolveClientEntitlements", () => {
  it("refuses a suspended account", () => {
    expect(resolveClientEntitlements({ ...base, suspended: true }).signInRefused).toBe(true);
  });

  it("gives an active discovery subscription the hotel modules only", () => {
    const result = resolveClientEntitlements({ ...base, subscription: "active" });
    expect(result.modules).toEqual(
      expect.arrayContaining(["hotel_discovery", "saved_hotels", "hotel_assistance", "support"]),
    );
    expect(result.modules).not.toContain("wedding_workspace");
    expect(result.readOnly).toBe(false);
  });

  it("keeps an expired subscription read-only with saved hotels and invoices", () => {
    const result = resolveClientEntitlements({ ...base, subscription: "expired" });
    expect(result.modules).not.toContain("hotel_discovery");
    expect(result.modules).toEqual(expect.arrayContaining(["saved_hotels", "client_finance"]));
    expect(result.readOnly).toBe(true);
  });

  it("opens the wedding workspace to a project member and pauses it on hold", () => {
    expect(resolveClientEntitlements({ ...base, project: "active" }).modules).toContain(
      "wedding_workspace",
    );
    expect(resolveClientEntitlements({ ...base, project: "on_hold" }).readOnly).toBe(true);
    expect(resolveClientEntitlements({ ...base, project: "archived" }).modules).not.toContain(
      "wedding_workspace",
    );
  });

  it("gives a demo account the sample set, read-only", () => {
    const result = resolveClientEntitlements({ ...base, isDemo: true });
    expect(result.modules).toContain("hotel_discovery");
    expect(result.readOnly).toBe(true);
  });
});
