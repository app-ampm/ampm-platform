import { createMemoryLogger, type NotificationChannel } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../../../common/logger.service.js";
import type { Env } from "../../../env.js";
import { SendGates } from "../../admin/notification/notification-send-gates.js";
import type {
  NotificationService,
  QueueNotification,
  QueueResult,
} from "../../admin/notification/notification.service.js";
import {
  HOTEL_TEAM_ALERT_ROLES,
  SUPER_ADMIN_ALERT_ROLES,
  type StaffAlertRecipients,
} from "../../admin/notification/staff-alert-recipients.js";
import { HOTEL_FORM_TEMPLATE_PREFIX } from "../hotel-form-email-gate.js";
import {
  FORM_REFERENCE,
  FORM_REQUEST_ID,
  formSubmissions,
} from "../testing/hotel-form-draft-fixtures.js";
import { HOTEL_FORM_STAFF_NOTICES, HotelFormStaffNotices } from "./hotel-form-staff-notices.js";

/*
 * The hotel form's staff notices (D-190 §4): a submit and a correction tell the active Super Admin and
 * Hotel team staff in-app and by email, a withdrawal or removal request tells the Super Admins in-app.
 * Each carries the reference, the hotel's name as AMPM knows it and a link into the app, never text a
 * hotel typed; each sits outside the `hotel_form.` family, so the hotel send gate never sees it. A notice
 * that cannot go is logged, never thrown: the hotel's submit stands.
 */

const APP = "https://app.synthetic.example";
const LINK = `${APP}/hotels-admin/requests`;

function build(options: { readonly failFor?: string; readonly recipientsFail?: boolean } = {}) {
  const ids = vi.fn(async (roles: readonly string[]) => {
    if (options.recipientsFail) throw new Error("connection reset");
    return roles.includes("HT") ? ["u-sa", "u-ht"] : ["u-sa"];
  });
  const queue = vi.fn(async (input: QueueNotification): Promise<QueueResult> => {
    if (input.recipientId === options.failFor) throw new Error("insert failed");
    return { suppressed: false, notificationId: `n-${input.recipientId}-${input.channel}` };
  });
  const submissions = formSubmissions();
  const { logger, entries } = createMemoryLogger("debug");
  const notices = new HotelFormStaffNotices(
    { ids } as unknown as StaffAlertRecipients,
    { queue } as unknown as NotificationService,
    submissions.typed,
    logger as unknown as AppLogger,
    { WEB_APP_URL: APP } as unknown as Env,
  );
  return { notices, ids, queue, entries };
}

/** What was queued, as [recipient, channel, template]. */
const queued = (
  calls: readonly (readonly [QueueNotification])[],
): [string, NotificationChannel, string][] =>
  calls.map(([input]) => [input.recipientId, input.channel, input.templateKey]);

describe("HotelFormStaffNotices", () => {
  it("tells the Super Admin and the Hotel team of a submit, in-app and by email", async () => {
    const { notices, ids, queue } = build();
    expect(await notices.submitted(FORM_REQUEST_ID)).toBe(4);
    expect(ids).toHaveBeenCalledWith(HOTEL_TEAM_ALERT_ROLES);
    expect(queued(queue.mock.calls)).toEqual([
      ["u-sa", "in_app", "system.hotel_form_submitted"],
      ["u-sa", "email", "system.hotel_form_submitted"],
      ["u-ht", "in_app", "system.hotel_form_submitted"],
      ["u-ht", "email", "system.hotel_form_submitted"],
    ]);
    expect(queue).toHaveBeenCalledWith({
      recipientType: "user",
      recipientId: "u-ht",
      channel: "email",
      eventType: "system.hotel_form_submitted",
      templateKey: "system.hotel_form_submitted",
      entityType: "hotel_info_request",
      entityId: FORM_REQUEST_ID,
      variables: { reference: FORM_REFERENCE, hotelName: "Synthetic Lake Hotel", link: LINK },
    });
  });

  it("tells them of a correction the same way, never with its message", async () => {
    const { notices, queue } = build();
    expect(await notices.correction(FORM_REQUEST_ID)).toBe(4);
    for (const [input] of queue.mock.calls) {
      expect(input.templateKey).toBe("system.hotel_form_correction");
      expect(Object.keys(input.variables ?? {}).sort()).toEqual(["hotelName", "link", "reference"]);
    }
  });

  it("tells the Super Admins alone, in-app only, of a withdrawal or a removal request", async () => {
    const { notices, ids, queue } = build();
    expect(await notices.withdrawal(FORM_REQUEST_ID)).toBe(1);
    expect(ids).toHaveBeenCalledWith(SUPER_ADMIN_ALERT_ROLES);
    expect(queued(queue.mock.calls)).toEqual([["u-sa", "in_app", "system.hotel_form_withdrawal"]]);
  });

  it("goes on to the others when one notice fails, logging no recipient", async () => {
    const { notices, entries } = build({ failFor: "u-sa" });
    expect(await notices.submitted(FORM_REQUEST_ID)).toBe(2);
    const failed = entries.filter((entry) => entry.event === "hotel_form.staff_notice_failed");
    expect(failed).toHaveLength(2);
    expect(JSON.stringify(failed)).not.toContain("u-sa");
  });

  it("never throws: no recipients, or a query that fails, is logged and answers 0", async () => {
    const down = build({ recipientsFail: true });
    expect(await down.notices.submitted(FORM_REQUEST_ID)).toBe(0);
    expect(down.entries.map((entry) => entry.event)).toContain("hotel_form.staff_notice_failed");
  });

  it("keeps every notice outside the hotel form's send gate, which never sees them", async () => {
    const gates = new SendGates();
    const hotelGate = vi.fn(async () => false);
    gates.register(HOTEL_FORM_TEMPLATE_PREFIX, hotelGate);
    for (const templateKey of Object.values(HOTEL_FORM_STAFF_NOTICES)) {
      expect(templateKey.startsWith(HOTEL_FORM_TEMPLATE_PREFIX)).toBe(false);
      const admitted = await gates.admits({
        templateKey,
        recipientType: "user",
        recipientId: "u-sa",
        channel: "email",
        entityType: "hotel_info_request",
        entityId: FORM_REQUEST_ID,
        gateRef: null,
      });
      expect(admitted).toBe(true);
    }
    expect(hotelGate).not.toHaveBeenCalled();
  });
});
