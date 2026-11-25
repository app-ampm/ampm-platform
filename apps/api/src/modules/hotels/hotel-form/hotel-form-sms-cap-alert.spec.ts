import { createMemoryLogger } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../../../common/logger.service.js";
import type { NotificationService } from "../../admin/notification/notification.service.js";
import type { HotelFormRequestsRepository } from "./hotel-form-requests.repository.js";
import { HOTEL_FORM_SMS_CAP_TEMPLATE, HotelFormSmsCapAlert } from "./hotel-form-sms-cap-alert.js";

/*
 * The global SMS cap's alert (D-189 §3): when the day's budget is spent, the active Super Admin and Hotel
 * team staff get an in-app notice, as the disk check alerts them (D-177). HotelFormLimits sends it once a
 * day; this is the sending.
 */

function build(recipients: string[]) {
  const queue = vi.fn(async () => ({ suppressed: false as const, notificationId: "n1" }));
  const { logger, entries } = createMemoryLogger("debug");
  const alert = new HotelFormSmsCapAlert(
    { alertRecipientIds: vi.fn(async () => recipients) } as unknown as HotelFormRequestsRepository,
    { queue } as unknown as NotificationService,
    logger as unknown as AppLogger,
  );
  return { alert, queue, entries };
}

describe("HotelFormSmsCapAlert", () => {
  it("queues one in-app notice per recipient, outside the hotel form's send gate", async () => {
    const { alert, queue, entries } = build(["u-sa", "u-ht"]);
    expect(await alert.send(300, "2026-11-25")).toBe(2);
    expect(queue).toHaveBeenCalledTimes(2);
    expect(queue).toHaveBeenCalledWith({
      recipientType: "user",
      recipientId: "u-sa",
      channel: "in_app",
      eventType: HOTEL_FORM_SMS_CAP_TEMPLATE,
      templateKey: HOTEL_FORM_SMS_CAP_TEMPLATE,
      variables: { cap: "300", day: "2026-11-25" },
    });
    // hotel_form.* templates pass the request's send gate; a staff alert names no request.
    expect(HOTEL_FORM_SMS_CAP_TEMPLATE.startsWith("hotel_form.")).toBe(false);
    expect(entries.find((entry) => entry.event === "hotel_form.sms_cap_reached")?.fields).toEqual({
      cap: 300,
      day: "2026-11-25",
      notices: 2,
    });
  });

  it("goes on to the others when one notice fails, and counts the ones queued", async () => {
    const { alert, queue, entries } = build(["u-sa", "u-ht"]);
    queue.mockRejectedValueOnce(new Error("insert failed"));
    expect(await alert.send(300, "2026-11-25")).toBe(1);
    expect(entries.map((entry) => entry.event)).toContain("hotel_form.sms_cap_notice_failed");
  });

  it("logs when there is no one to tell", async () => {
    const { alert, entries } = build([]);
    expect(await alert.send(300, "2026-11-25")).toBe(0);
    expect(entries.map((entry) => entry.event)).toContain("hotel_form.sms_cap_no_recipients");
  });
});
