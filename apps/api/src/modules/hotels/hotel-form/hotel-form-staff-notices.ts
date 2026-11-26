import { Inject, Injectable } from "@nestjs/common";
import type { NotificationChannel } from "@ampm/core";
import type { StaffRole } from "@ampm/policy";

import { AppLogger } from "../../../common/logger.service.js";
import { ENV, type Env } from "../../../env.js";
import { NotificationService } from "../../admin/notification/notification.service.js";
import {
  HOTEL_TEAM_ALERT_ROLES,
  StaffAlertRecipients,
  SUPER_ADMIN_ALERT_ROLES,
} from "../../admin/notification/staff-alert-recipients.js";
import { HOTEL_INFO_REQUEST_ENTITY } from "../hotel-form-email-gate.js";
import { HotelFormSubmissionsRepository } from "./hotel-form-submissions.repository.js";

/**
 * The hotel form's staff notices (D-190 §4), each its own template and preference key. They sit outside
 * the `hotel_form.` family on purpose, as the SMS cap's alert does: that family's send gate is for
 * messages to a hotel, and drops what it does not admit.
 */
export const HOTEL_FORM_STAFF_NOTICES = {
  submitted: "system.hotel_form_submitted",
  correction: "system.hotel_form_correction",
  withdrawal: "system.hotel_form_withdrawal",
} as const;

/** Where a staff notice points: the requests' inbox in the staff app (TW-99). */
const REQUESTS_PATH = "/hotels-admin/requests";

/** One kind of notice: its template, who gets it and on which channels. */
interface Notice {
  readonly templateKey: string;
  readonly roles: readonly StaffRole[];
  readonly channels: readonly NotificationChannel[];
}

const SUBMITTED: Notice = {
  templateKey: HOTEL_FORM_STAFF_NOTICES.submitted,
  roles: HOTEL_TEAM_ALERT_ROLES,
  channels: ["in_app", "email"],
};
const CORRECTION: Notice = {
  templateKey: HOTEL_FORM_STAFF_NOTICES.correction,
  roles: HOTEL_TEAM_ALERT_ROLES,
  channels: ["in_app", "email"],
};
const WITHDRAWAL: Notice = {
  templateKey: HOTEL_FORM_STAFF_NOTICES.withdrawal,
  roles: SUPER_ADMIN_ALERT_ROLES,
  channels: ["in_app"],
};

/**
 * Tells staff what a hotel did on the form (D-190 §4): a submit and a correction request go to the active
 * Super Admin and Hotel team staff in-app and by email; a withdrawal or removal request to the Super Admins
 * in-app. Every notice carries only the request's reference, the hotel's name as AMPM knows it (the
 * catalogue's, else the staff label) and a link into the app, never text a hotel typed, so staff read a
 * correction in the app. Recipients come from the query every staff alert shares. Sent after the change
 * commits; a notice that cannot go is logged without its recipient and never undoes the change.
 */
@Injectable()
export class HotelFormStaffNotices {
  constructor(
    private readonly recipients: StaffAlertRecipients,
    private readonly notifications: NotificationService,
    private readonly submissions: HotelFormSubmissionsRepository,
    private readonly logger: AppLogger,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** A request was submitted; answers how many notices were queued. */
  submitted(requestId: string): Promise<number> {
    return this.send(SUBMITTED, requestId);
  }

  /** A person asked for a correction after submitting. */
  correction(requestId: string): Promise<number> {
    return this.send(CORRECTION, requestId);
  }

  /** A person withdrew a consent or asked for their details to be removed. */
  withdrawal(requestId: string): Promise<number> {
    return this.send(WITHDRAWAL, requestId);
  }

  private async send(notice: Notice, requestId: string): Promise<number> {
    try {
      const [subject, recipients] = await Promise.all([
        this.submissions.noticeSubject(requestId),
        this.recipients.ids(notice.roles),
      ]);
      if (subject === null || recipients.length === 0) {
        this.logger.warn("hotel_form.staff_notice_no_recipients", {
          templateKey: notice.templateKey,
        });
        return 0;
      }
      const variables = {
        reference: subject.reference,
        hotelName: subject.name,
        link: `${this.env.WEB_APP_URL}${REQUESTS_PATH}`,
      };
      let sent = 0;
      for (const recipientId of recipients) {
        for (const channel of notice.channels) {
          sent += await this.queueOne(notice, recipientId, channel, requestId, variables);
        }
      }
      return sent;
    } catch (error) {
      this.failed(notice, null, error);
      return 0;
    }
  }

  private async queueOne(
    notice: Notice,
    recipientId: string,
    channel: NotificationChannel,
    requestId: string,
    variables: Readonly<Record<string, string>>,
  ): Promise<number> {
    try {
      const result = await this.notifications.queue({
        recipientType: "user",
        recipientId,
        channel,
        eventType: notice.templateKey,
        templateKey: notice.templateKey,
        entityType: HOTEL_INFO_REQUEST_ENTITY,
        entityId: requestId,
        variables,
      });
      return result.suppressed ? 0 : 1;
    } catch (error) {
      this.failed(notice, channel, error);
      return 0;
    }
  }

  /** A notice that could not go: logged with its template and channel, never its recipient. */
  private failed(notice: Notice, channel: NotificationChannel | null, error: unknown): void {
    const reason = error instanceof Error ? error.message : String(error);
    this.logger.warn("hotel_form.staff_notice_failed", {
      templateKey: notice.templateKey,
      channel,
      error: reason.slice(0, 200),
    });
  }
}
