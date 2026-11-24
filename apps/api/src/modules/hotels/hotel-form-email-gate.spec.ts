import { CONFIG_REGISTRY, type HotelFormMode } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import type { ConfigService } from "../admin/config/config.service.js";
import type { GatedNotification } from "../admin/notification/notification-send-gates.js";
import type { NotificationService } from "../admin/notification/notification.service.js";
import { HotelFormEmailGate, modeAdmits } from "./hotel-form-email-gate.js";
import type { HotelInfoRequestsRepository } from "./hotel-info-requests.repository.js";

/*
 * The hotel form's kill switch at send time (D-188 §5): the worker drops a queued `hotel_form.*` email
 * whose mode no longer admits it. The mode is read past the configuration cache, every time.
 */

const REQUEST_ID = "0192f1a0-0000-7000-8000-0000000000b1";

const linkEmail: GatedNotification = {
  templateKey: "hotel_form.link",
  recipientType: "external",
  recipientId: REQUEST_ID,
  channel: "email",
  entityType: "hotel_info_request",
  entityId: REQUEST_ID,
};

function build(mode: HotelFormMode, isTest = false) {
  const policy = { ...CONFIG_REGISTRY["hotel_form.policy"].default, mode };
  const config = { get: vi.fn(), getFresh: vi.fn(async () => policy) };
  const repo = { isTestRequest: vi.fn(async () => isTest) };
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
    const off = build("off", true);
    expect(await off.gate.admits(linkEmail)).toBe(false);
    expect(off.repo.isTestRequest).not.toHaveBeenCalled();
  });

  it("in test_only, sends a test request's email and drops any other", async () => {
    const test = build("test_only", true);
    expect(await test.gate.admits(linkEmail)).toBe(true);
    expect(test.repo.isTestRequest).toHaveBeenCalledWith(REQUEST_ID);
    expect(await build("test_only", false).gate.admits(linkEmail)).toBe(false);
    const elsewhere = { ...linkEmail, entityType: "hotel", entityId: REQUEST_ID };
    expect(await build("test_only", true).gate.admits(elsewhere)).toBe(false);
    expect(await build("test_only", true).gate.admits({ ...linkEmail, entityId: null })).toBe(
      false,
    );
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
