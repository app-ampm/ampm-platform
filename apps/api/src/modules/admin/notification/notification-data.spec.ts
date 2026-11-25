import { describe, expect, it } from "vitest";

import {
  gateRefOf,
  NOTIFICATION_GATE_REF_KEY,
  renderVariablesOf,
  storedDataOf,
} from "./notification-data.js";

/*
 * A notification row's server-only data (D-044, D-188 §5): its render variables, and beside them the
 * reference its send gate compares, which is never rendered.
 */
describe("notification data", () => {
  const variables = { reference: "HIR-2026-0001", link: "https://site.synthetic.example/x" };

  it("stores the gate reference beside the render variables, and the variables alone without one", () => {
    expect(storedDataOf(variables, "2")).toEqual({
      ...variables,
      [NOTIFICATION_GATE_REF_KEY]: "2",
    });
    expect(storedDataOf(variables, undefined)).toBe(variables);
    expect(storedDataOf(undefined, undefined)).toBeUndefined();
    expect(storedDataOf(undefined, "1")).toEqual({ [NOTIFICATION_GATE_REF_KEY]: "1" });
  });

  it("reads the render variables without the gate reference, and the reference alone", () => {
    const stored = storedDataOf(variables, "2");
    expect(renderVariablesOf(stored)).toEqual(variables);
    expect(gateRefOf(stored)).toBe("2");
    expect(gateRefOf(variables)).toBeNull();
  });

  it("reads nothing from data that is not a record of strings", () => {
    for (const data of [null, "text", 7, { link: 7 }]) {
      expect(renderVariablesOf(data)).toEqual({});
      expect(gateRefOf(data)).toBeNull();
    }
  });
});
