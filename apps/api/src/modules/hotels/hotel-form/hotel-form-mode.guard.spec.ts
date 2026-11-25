import { CONFIG_REGISTRY, type HotelFormPolicy } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import type { ConfigService } from "../../admin/config/config.service.js";
import { formRequests, refusalOf } from "../testing/hotel-form-fixtures.js";
import { HotelFormGate } from "./hotel-form-gate.js";
import { HotelFormModeGuard } from "./hotel-form-mode.guard.js";

/*
 * The hotel form's mode guard (D-189 §4): on every public route, after the global guards and before the
 * route's own guard and its pipes, it reads the mode past the configuration cache and answers 404 while
 * the mode is off, so no body is read and no field named.
 */

function guardIn(mode: HotelFormPolicy["mode"]) {
  const value = { ...CONFIG_REGISTRY["hotel_form.policy"].default, mode };
  const getFresh = vi.fn(async () => value);
  const gate = new HotelFormGate({ getFresh } as unknown as ConfigService, formRequests().typed);
  return { guard: new HotelFormModeGuard(gate), getFresh };
}

describe("HotelFormModeGuard", () => {
  it("answers 404 while the mode is off", async () => {
    const refused = await refusalOf(guardIn("off").guard.canActivate());
    expect(refused?.status).toBe(404);
    expect(refused?.message).toBe("Not found");
    expect(refused?.details).toBeUndefined();
  });

  it("lets the route run under test_only and on, reading the mode afresh on every call", async () => {
    for (const mode of ["test_only", "on"] as const) {
      const { guard, getFresh } = guardIn(mode);
      expect(await guard.canActivate()).toBe(true);
      expect(await guard.canActivate()).toBe(true);
      expect(getFresh).toHaveBeenCalledTimes(2);
      expect(getFresh).toHaveBeenCalledWith("hotel_form.policy");
    }
  });
});
