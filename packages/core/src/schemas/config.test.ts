import { describe, expect, it } from "vitest";

import { CONFIG_REGISTRY, hotelFormMode, hotelFormPolicy, storageDiskGuard } from "./config.js";

/*
 * The disk guard (D-177): the worker's disk check warns below `warnGiB` and calls it critical below
 * `floorGiB`, the floor below which the hotel form's uploads will be refused (Slice 9).
 */
describe("storage.disk_guard", () => {
  it("defaults to a 9 GiB floor and a 12 GiB warning level", () => {
    expect(CONFIG_REGISTRY["storage.disk_guard"].default).toEqual({ floorGiB: 9, warnGiB: 12 });
  });

  it("takes a floor of 9 GiB or more with the warning level above it, both up to 1000 GiB", () => {
    expect(storageDiskGuard.safeParse({ floorGiB: 9, warnGiB: 9.5 }).success).toBe(true);
    expect(storageDiskGuard.safeParse({ floorGiB: 20, warnGiB: 40 }).success).toBe(true);
    expect(storageDiskGuard.safeParse({ floorGiB: 999, warnGiB: 1000 }).success).toBe(true);
  });

  it("refuses a floor below 9 GiB", () => {
    expect(storageDiskGuard.safeParse({ floorGiB: 8.9, warnGiB: 12 }).success).toBe(false);
    expect(storageDiskGuard.safeParse({ floorGiB: 0, warnGiB: 12 }).success).toBe(false);
  });

  it("refuses a warning level at or below the floor, naming the warning level", () => {
    const equal = storageDiskGuard.safeParse({ floorGiB: 12, warnGiB: 12 });
    expect(equal.success).toBe(false);
    expect(equal.error?.issues[0]?.path).toEqual(["warnGiB"]);
    expect(storageDiskGuard.safeParse({ floorGiB: 20, warnGiB: 12 }).success).toBe(false);
  });

  it("refuses more than 1000 GiB, a value that is not a number, and a missing value", () => {
    expect(storageDiskGuard.safeParse({ floorGiB: 9, warnGiB: 1000.5 }).success).toBe(false);
    expect(storageDiskGuard.safeParse({ floorGiB: 1001, warnGiB: 1002 }).success).toBe(false);
    expect(storageDiskGuard.safeParse({ floorGiB: "9", warnGiB: 12 }).success).toBe(false);
    expect(storageDiskGuard.safeParse({ floorGiB: Number.NaN, warnGiB: 12 }).success).toBe(false);
    expect(storageDiskGuard.safeParse({ floorGiB: 9 }).success).toBe(false);
  });
});

/*
 * The hotel information form's policy (D-188 §6; plan §4.2, §4.9 and §4.10): the mode a Super Admin
 * switches, the link's lifetime and extension, the status-only days, the cap on people, and the reply-to
 * address and help contact. The mode starts off, so nothing reaches a hotel until it is switched.
 */
describe("hotel_form.policy", () => {
  const valid = {
    mode: "test_only",
    linkValidityDays: 30,
    maxExtensionDays: 60,
    statusOnlyDays: 7,
    maxPeople: 10,
    replyTo: "admin@ampm.example",
    helpContact: "Call AMPM on +91 22 0000 0000",
  } as const;

  it("defaults to mode off, a 30-day link extendable by 60 days, 7 status-only days and 10 people", () => {
    expect(CONFIG_REGISTRY["hotel_form.policy"].default).toEqual({
      mode: "off",
      linkValidityDays: 30,
      maxExtensionDays: 60,
      statusOnlyDays: 7,
      maxPeople: 10,
      replyTo: null,
      helpContact: null,
    });
  });

  it("takes the three modes and nothing else", () => {
    for (const mode of ["off", "test_only", "on"]) {
      expect(hotelFormPolicy.safeParse({ ...valid, mode }).success, mode).toBe(true);
    }
    expect(hotelFormPolicy.safeParse({ ...valid, mode: "live" }).success).toBe(false);
    expect(hotelFormMode.options).toEqual(["off", "test_only", "on"]);
  });

  it("bounds the link to 1 to 90 days and the extension to 0 to 60 days, in whole days", () => {
    for (const days of [1, 90]) {
      expect(hotelFormPolicy.safeParse({ ...valid, linkValidityDays: days }).success).toBe(true);
    }
    for (const days of [0, 91, 30.5]) {
      expect(hotelFormPolicy.safeParse({ ...valid, linkValidityDays: days }).success).toBe(false);
    }
    for (const days of [0, 60]) {
      expect(hotelFormPolicy.safeParse({ ...valid, maxExtensionDays: days }).success).toBe(true);
    }
    for (const days of [-1, 61, 1.5]) {
      expect(hotelFormPolicy.safeParse({ ...valid, maxExtensionDays: days }).success).toBe(false);
    }
  });

  it("bounds the status-only days to 0 to 30 and the people to 1 to 20", () => {
    expect(hotelFormPolicy.safeParse({ ...valid, statusOnlyDays: 0 }).success).toBe(true);
    expect(hotelFormPolicy.safeParse({ ...valid, statusOnlyDays: 30 }).success).toBe(true);
    expect(hotelFormPolicy.safeParse({ ...valid, statusOnlyDays: 31 }).success).toBe(false);
    expect(hotelFormPolicy.safeParse({ ...valid, maxPeople: 1 }).success).toBe(true);
    expect(hotelFormPolicy.safeParse({ ...valid, maxPeople: 20 }).success).toBe(true);
    expect(hotelFormPolicy.safeParse({ ...valid, maxPeople: 0 }).success).toBe(false);
    expect(hotelFormPolicy.safeParse({ ...valid, maxPeople: 21 }).success).toBe(false);
  });

  it("takes an email address as the reply-to, stored lower-case, or none until one is set", () => {
    const parsed = hotelFormPolicy.parse({ ...valid, replyTo: " Admin@AMPM.Example " });
    expect(parsed.replyTo).toBe("admin@ampm.example");
    expect(hotelFormPolicy.safeParse({ ...valid, replyTo: null }).success).toBe(true);
    expect(hotelFormPolicy.safeParse({ ...valid, replyTo: "not an address" }).success).toBe(false);
    expect(hotelFormPolicy.safeParse({ ...valid, replyTo: "" }).success).toBe(false);
  });

  it("takes a help contact of 1 to 300 characters, trimmed, or none until one is set", () => {
    expect(hotelFormPolicy.parse({ ...valid, helpContact: "  Email AMPM  " }).helpContact).toBe(
      "Email AMPM",
    );
    expect(hotelFormPolicy.safeParse({ ...valid, helpContact: null }).success).toBe(true);
    expect(hotelFormPolicy.safeParse({ ...valid, helpContact: "   " }).success).toBe(false);
    expect(hotelFormPolicy.safeParse({ ...valid, helpContact: "x".repeat(301) }).success).toBe(
      false,
    );
  });

  it("refuses a value missing a field, and drops a field it does not know", () => {
    const { maxPeople: _omit, ...withoutPeople } = valid;
    expect(hotelFormPolicy.safeParse(withoutPeople).success).toBe(false);
    // A later slice adds fields: the release before it must still read the value after a rollback.
    expect(hotelFormPolicy.parse({ ...valid, smsCap: 300 })).toEqual(valid);
  });
});
