import { describe, expect, it } from "vitest";

import { can } from "./engine";
import { STAFF_ROLES, type StaffRole } from "./roles";
import { canRecordSubscriptionPayment } from "./subscription-payments";

const staff = (role: StaffRole) => ({ type: "staff" as const, roles: [role] });
const ALLOWED: readonly StaffRole[] = ["SA", "SM", "FA"];

describe("canRecordSubscriptionPayment", () => {
  it("lets Super Admin, Sales and Finance record a manual payment", () => {
    for (const role of ALLOWED) {
      expect(canRecordSubscriptionPayment(staff(role)), role).toBe(true);
    }
  });

  it("refuses every other staff role, and anyone who is not staff", () => {
    const others = (Object.keys(STAFF_ROLES) as StaffRole[]).filter((r) => !ALLOWED.includes(r));
    expect(others).toHaveLength(6);
    for (const role of others) {
      expect(canRecordSubscriptionPayment(staff(role)), role).toBe(false);
    }
    expect(canRecordSubscriptionPayment({ type: "client" })).toBe(false);
  });

  it("decides on the status alone: Finance's grant covers no other field", () => {
    const key = "crm.subscriptions.update";
    // The plain key is what the route guard used to ask, and Finance's status-only grant fails it.
    expect(can(staff("FA"), key)).toBe(false);
    expect(can(staff("FA"), key, { fields: ["status", "billing"] })).toBe(false);
    expect(can(staff("FA"), key, { fields: ["status"] })).toBe(true);
  });
});
