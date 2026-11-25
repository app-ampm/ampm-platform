import { AppError, CONFIG_REGISTRY, HOTEL_FORM_ERRORS, type HotelFormPolicy } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import type { ConfigService } from "../../admin/config/config.service.js";
import { hashLinkSecret, mintLinkSecret } from "../hotel-info-request-link.js";
import { HotelFormGate } from "./hotel-form-gate.js";
import type {
  HotelFormRequestsRepository,
  LinkedRequest,
} from "./hotel-form-requests.repository.js";

/*
 * The gate every public route passes (D-189 §4): the mode read fresh (off answers 404 everywhere), the
 * request found only by its link's hash and compared in constant time, and the state the link opens to;
 * open answers it with nothing about the hotel, and the code routes refuse a link that is not active.
 */

const NOW = new Date("2026-11-25T10:00:00.000Z");
const LATER = new Date("2026-12-25T10:00:00.000Z");
const { secret, hash } = mintLinkSecret();

function linked(overrides: Partial<LinkedRequest> = {}): LinkedRequest {
  return {
    id: "0192f1a0-0000-7000-8000-0000000000b1",
    isTest: true,
    status: "open",
    expiresAt: LATER,
    statusOnlyUntil: null,
    tokenGeneration: 1,
    displayLabel: "Monsoon refresh",
    staffNote: null,
    hotelDeleted: false,
    tokenHash: hash,
    ...overrides,
  };
}

function build(policy: Partial<HotelFormPolicy>, row: LinkedRequest | null = linked()) {
  const value = { ...CONFIG_REGISTRY["hotel_form.policy"].default, ...policy };
  const getFresh = vi.fn(async () => value);
  const findByLinkHash = vi.fn(async () => row);
  const gate = new HotelFormGate(
    { getFresh } as unknown as ConfigService,
    { findByLinkHash } as unknown as HotelFormRequestsRepository,
  );
  return { gate, getFresh, findByLinkHash };
}

async function refusal(attempt: Promise<unknown>): Promise<AppError | null> {
  try {
    await attempt;
    return null;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
}

describe("HotelFormGate", () => {
  it("answers 404 on every route while the mode is off, before reading any request", async () => {
    const { gate, findByLinkHash, getFresh } = build({ mode: "off" });
    expect((await refusal(gate.open(secret, NOW)))?.status).toBe(404);
    expect((await refusal(gate.openLink(secret, NOW)))?.status).toBe(404);
    expect((await refusal(gate.policy()))?.status).toBe(404);
    expect(findByLinkHash).not.toHaveBeenCalled();
    expect(getFresh).toHaveBeenCalledWith("hotel_form.policy");
  });

  it("finds the request by the link's SHA-256 only", async () => {
    const { gate, findByLinkHash } = build({ mode: "on" });
    await gate.open(secret, NOW);
    expect(findByLinkHash).toHaveBeenCalledWith(hashLinkSecret(secret));
  });

  it("opens a ready link to its state, its expiry and the help contact, and nothing more", async () => {
    const { gate } = build({ mode: "on", helpContact: "AMPM hotel desk, +91 70000 09999" });
    expect(await gate.open(secret, NOW)).toEqual({
      state: "ready",
      expiresAt: LATER.toISOString(),
      helpContact: "AMPM hotel desk, +91 70000 09999",
    });
  });

  it("opens an unknown, revoked or unadmitted link as not_active, with no expiry", async () => {
    const notActive = { state: "not_active", expiresAt: null, helpContact: null };
    expect(await build({ mode: "on" }, null).gate.open(secret, NOW)).toEqual(notActive);
    const revoked = build({ mode: "on" }, linked({ status: "revoked" }));
    expect(await revoked.gate.open(secret, NOW)).toEqual(notActive);
    const real = build({ mode: "test_only" }, linked({ isTest: false }));
    expect(await real.gate.open(secret, NOW)).toEqual(notActive);
  });

  it("opens a merged request inside its window as status_only, until the window's end", async () => {
    const merged = linked({ status: "merged", statusOnlyUntil: LATER, expiresAt: NOW });
    expect(await build({ mode: "on" }, merged).gate.open(secret, NOW)).toEqual({
      state: "status_only",
      expiresAt: LATER.toISOString(),
      helpContact: null,
    });
  });

  it("refuses a stored hash that does not match the token's", async () => {
    const other = build({ mode: "on" }, linked({ tokenHash: "0".repeat(64) }));
    expect((await other.gate.open(secret, NOW)).state).toBe("not_active");
  });

  it("hands a code route an open link, and refuses one not active with 404", async () => {
    const { gate } = build({ mode: "on" });
    const link = await gate.openLink(secret, NOW);
    expect(link.state).toBe("ready");
    expect(link.request.id).toBe(linked().id);
    expect(link.policy.mode).toBe("on");
    const closed = await refusal(build({ mode: "on" }, null).gate.openLink(secret, NOW));
    expect(closed?.status).toBe(404);
    expect(closed?.message).toBe(HOTEL_FORM_ERRORS.notActive);
  });
});
