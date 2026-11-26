import { Injectable } from "@nestjs/common";

import { AppLogger } from "../../../common/logger.service.js";
import { NotificationService } from "../../admin/notification/notification.service.js";
import {
  HOTEL_TEAM_ALERT_ROLES,
  StaffAlertRecipients,
} from "../../admin/notification/staff-alert-recipients.js";

/**
 * The in-app notice the global SMS cap sends (D-189 §3). Outside the `hotel_form.` family on purpose:
 * that family's send gate drops a message that names no request, and this one is about the whole form.
 */
export const HOTEL_FORM_SMS_CAP_TEMPLATE = "system.hotel_form_sms_cap";

/**
 * Tells the active Super Admin and Hotel team staff, in-app, that the day's hotel form SMS budget is spent
 * and codes are refused until the next day in India, as the disk check alerts them (D-177), read through
 * the query every staff alert shares (D-190 §4). HotelFormLimits sends it once a day. A notice that fails
 * is logged (without its recipient) and the others still go.
 */
@Injectable()
export class HotelFormSmsCapAlert {
  constructor(
    private readonly recipients: StaffAlertRecipients,
    private readonly notifications: NotificationService,
    private readonly logger: AppLogger,
  ) {}

  /** Queues the notice to every recipient; answers how many were queued. */
  async send(cap: number, day: string): Promise<number> {
    const recipients = await this.recipients.ids(HOTEL_TEAM_ALERT_ROLES);
    if (recipients.length === 0) {
      this.logger.warn("hotel_form.sms_cap_no_recipients", { day });
      return 0;
    }
    let sent = 0;
    for (const recipientId of recipients) sent += await this.queueOne(recipientId, cap, day);
    this.logger.warn("hotel_form.sms_cap_reached", { cap, day, notices: sent });
    return sent;
  }

  private async queueOne(recipientId: string, cap: number, day: string): Promise<number> {
    try {
      const result = await this.notifications.queue({
        recipientType: "user",
        recipientId,
        channel: "in_app",
        eventType: HOTEL_FORM_SMS_CAP_TEMPLATE,
        templateKey: HOTEL_FORM_SMS_CAP_TEMPLATE,
        variables: { cap: String(cap), day },
      });
      return result.suppressed ? 0 : 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn("hotel_form.sms_cap_notice_failed", { error: reason.slice(0, 200) });
      return 0;
    }
  }
}
