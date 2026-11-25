import { CONFIG_REGISTRY, type HotelFormMode, type HotelInfoRequestStatus } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import type { ConfigService } from "../admin/config/config.service.js";
import type { GatedNotification } from "../admin/notification/notification-send-gates.js";
import type { NotificationService } from "../admin/notification/notification.service.js";
import { HotelFormEmailGate, modeAdmits } from "./hotel-form-email-gate.js";
import type { HotelInfoRequestsRepository } from "./hotel-info-requests.repository.js";

/*
 * The hotel form's kill switch at send time (D-188 §5): the worker drops a queued `hotel_form.*` email
 * whose mode no longer admits it, whose request is gone, deleted or no longer live, or whose link was
 * reissued after it was queued. The mode is read past the configuration cache, every time.
 */

const REQUEST_ID = "0192f1a0-0000-7000-8000-0000000000b1";

const linkEmail: GatedNotification = {
  templateKey: "hotel_form.link",
  recipientType: "external",
  recipientId: REQUEST_ID,
  channel: "email",
  entityType: "hotel_info_request",
  entityId: REQUEST_ID,
  gateRef: "1",
};

/** A code SMS (D-189 §2) for the same request, queued on its first link. */
const codeSms: GatedNotification = {
  ...linkEmail,
  templateKey: "hotel_form.code",
  channel: "sms",
};

const HOUR_MS = 60 * 60 * 1000;

/** The request as the gate reads it: by default a live, non-test request on its first link. */
type GateRequest = {
  isTest: boolean;
  status: HotelInfoRequestStatus;
  tokenGeneration: number;
  statusOnlyUntil: Date | null;
};

function build(mode: HotelFormMode, request: Partial<GateRequest> | null = {}) {
  const policy = { ...CONFIG_REGISTRY["hotel_form.policy"].default, mode };
  const config = { get: vi.fn(), getFresh: vi.fn(async () => policy) };
  const state: GateRequest | null = request && {
    isTest: false,
    status: "open",
    tokenGeneration: 1,
    statusOnlyUntil: null,
    ...request,
  };
  const repo = { sendGateState: vi.fn(async (): Promise<GateRequest | null> => state) };
  const notifications = { registerSendGate: vi.fn() };
  const gate = new HotelFormEmailGate(
    notifications as unknown as NotificationService,
    config as unknown as ConfigService,
    repo as unknown as HotelInfoRequestsRepository,
  );
  return { gate, config, repo, notifications };
}

describe("modeAdmits", () => {
  it("admits every request when on, only a test request in test_only, and none when off", () => {
    expect(modeAdmits("on", false)).toBe(true);
    expect(modeAdmits("on", true)).toBe(true);
    expect(modeAdmits("test_only", true)).toBe(true);
    expect(modeAdmits("test_only", false)).toBe(false);
    expect(modeAdmits("off", true)).toBe(false);
    expect(modeAdmits("off", false)).toBe(false);
  });
});

describe("HotelFormEmailGate", () => {
  it("registers itself for every hotel_form email", () => {
    const { gate, notifications } = build("on");
    gate.onModuleInit();
    expect(notifications.registerSendGate).toHaveBeenCalledWith(
      "hotel_form.",
      expect.any(Function),
    );
  });

  it("sends when the mode is on, and drops everything when it is off, asking nothing else", async () => {
    const on = build("on");
    expect(await on.gate.admits(linkEmail)).toBe(true);
    expect(on.repo.sendGateState).toHaveBeenCalledWith(REQUEST_ID);
    const off = build("off", { isTest: true });
    expect(await off.gate.admits(linkEmail)).toBe(false);
    expect(off.repo.sendGateState).not.toHaveBeenCalled();
  });

  it("in test_only, sends a test request's email and drops any other", async () => {
    expect(await build("test_only", { isTest: true }).gate.admits(linkEmail)).toBe(true);
    expect(await build("test_only", { isTest: false }).gate.admits(linkEmail)).toBe(false);
  });

  it("drops an email that is about no request, or about one that is gone or deleted", async () => {
    const elsewhere = { ...linkEmail, entityType: "hotel" };
    expect(await build("on").gate.admits(elsewhere)).toBe(false);
    expect(await build("on").gate.admits({ ...linkEmail, entityId: null })).toBe(false);
    // The repository reads only a request that exists and is not deleted.
    expect(await build("on", null).gate.admits(linkEmail)).toBe(false);
  });

  it("drops a link email once its request is no longer live", async () => {
    for (const status of ["merged", "rejected", "revoked"] as const) {
      expect(await build("on", { status }).gate.admits(linkEmail), status).toBe(false);
    }
    for (const status of ["open", "submitted", "in_review", "changes_requested"] as const) {
      expect(await build("on", { status }).gate.admits(linkEmail), status).toBe(true);
    }
  });

  it("drops a link email whose link was reissued after it was queued, or that names no link", async () => {
    const reissued = build("on", { tokenGeneration: 2 });
    expect(await reissued.gate.admits(linkEmail)).toBe(false);
    expect(await reissued.gate.admits({ ...linkEmail, gateRef: "2" })).toBe(true);
    expect(await build("on").gate.admits({ ...linkEmail, gateRef: null })).toBe(false);
  });

  it("sends a code SMS for a live request on its current link while the mode admits it (D-189 §2)", async () => {
    for (const status of ["open", "submitted", "in_review", "changes_requested"] as const) {
      expect(await build("on", { status }).gate.admits(codeSms), status).toBe(true);
    }
    expect(await build("test_only", { isTest: true }).gate.admits(codeSms)).toBe(true);
    expect(await build("test_only", { isTest: false }).gate.admits(codeSms)).toBe(false);
    expect(await build("off", { isTest: true }).gate.admits(codeSms)).toBe(false);
    expect(await build("on", null).gate.admits(codeSms)).toBe(false);
  });

  it("sends a code SMS for a merged request only inside its status-only window", async () => {
    const inside = { status: "merged" as const, statusOnlyUntil: new Date(Date.now() + HOUR_MS) };
    expect(await build("on", inside).gate.admits(codeSms)).toBe(true);
    const after = { status: "merged" as const, statusOnlyUntil: new Date(Date.now() - HOUR_MS) };
    expect(await build("on", after).gate.admits(codeSms)).toBe(false);
    expect(await build("on", { status: "merged" }).gate.admits(codeSms)).toBe(false);
    for (const status of ["rejected", "revoked"] as const) {
      const window = { status, statusOnlyUntil: new Date(Date.now() + HOUR_MS) };
      expect(await build("on", window).gate.admits(codeSms), status).toBe(false);
    }
  });

  it("drops a code SMS whose link was reissued after it was queued, or that names no link", async () => {
    const reissued = build("on", { tokenGeneration: 2 });
    expect(await reissued.gate.admits(codeSms)).toBe(false);
    expect(await reissued.gate.admits({ ...codeSms, gateRef: "2" })).toBe(true);
    expect(await build("on").gate.admits({ ...codeSms, gateRef: null })).toBe(false);
  });

  it("reads the mode past the cache every time", async () => {
    const { gate, config } = build("on");
    await gate.admits(linkEmail);
    await gate.admits(linkEmail);
    expect(config.getFresh).toHaveBeenCalledTimes(2);
    expect(config.getFresh).toHaveBeenCalledWith("hotel_form.policy");
    expect(config.get).not.toHaveBeenCalled();
  });
});
