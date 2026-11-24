import { Injectable } from "@nestjs/common";
import type { HotelInfoRequestLinkEmail } from "@ampm/core";

import { AppLogger } from "../../common/logger.service.js";
import { ConfigService } from "../admin/config/config.service.js";
import { NotificationService } from "../admin/notification/notification.service.js";
import { HOTEL_INFO_REQUEST_ENTITY, modeAdmits } from "./hotel-form-email-gate.js";
import { HotelInfoRequestJournal, type RequestActor } from "./hotel-info-request-journal.js";
import { expiryForEmail } from "./hotel-info-request-link.js";
import { HotelInfoRequestsRepository } from "./hotel-info-requests.repository.js";

/** The template of a request's link email (core CONFIG_REGISTRY `notification.templates`). */
export const HOTEL_FORM_LINK_TEMPLATE = "hotel_form.link";

/**
 * What a link's email carries: the reference, the hotel's name as AMPM knows it (the staff label, else
 * the catalogue's name, else the name staff proposed), the expiry and the link; never text a hotel typed.
 */
export interface LinkEmail {
  readonly requestId: string;
  readonly isTest: boolean;
  readonly recipientEmail: string | null;
  readonly reference: string;
  readonly hotelName: string;
  readonly expiresAt: Date;
  readonly url: string;
  /** The link's generation, so the request is marked emailed only while that link stands. */
  readonly generation: number;
}

/**
 * Emails a request's link to the recipient AMPM entered (D-188 §5): an external email with the hotel
 * form's reply-to when one is set, queued only when staff asked and the form's mode, read past the cache,
 * admits the request. Otherwise the link stands and the answer says why it was not emailed. Only a queued
 * email marks the request emailed, with its `link_emailed` event.
 */
@Injectable()
export class HotelInfoRequestMailer {
  constructor(
    private readonly repo: HotelInfoRequestsRepository,
    private readonly journal: HotelInfoRequestJournal,
    private readonly notifications: NotificationService,
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
  ) {}

  /**
   * @example
   * const email = await mailer.sendLink(linkEmail, body.emailIt, staffActor(principal)); // "queued", …
   */
  async sendLink(
    email: LinkEmail,
    asked: boolean,
    actor: RequestActor,
  ): Promise<HotelInfoRequestLinkEmail> {
    if (!asked) return "not_requested";
    const policy = await this.config.getFresh("hotel_form.policy");
    if (policy.mode === "off") return "mode_off";
    if (!modeAdmits(policy.mode, email.isTest)) return "mode_test_only";
    if (email.recipientEmail === null || !(await this.queue(email, policy.replyTo))) {
      return "failed";
    }
    await this.markEmailed(email, actor);
    return "queued";
  }

  private async queue(email: LinkEmail, replyTo: string | null): Promise<boolean> {
    try {
      await this.notifications.queue({
        recipientType: "external",
        recipientId: email.requestId,
        recipientAddress: email.recipientEmail ?? "",
        channel: "email",
        eventType: HOTEL_FORM_LINK_TEMPLATE,
        templateKey: HOTEL_FORM_LINK_TEMPLATE,
        entityType: HOTEL_INFO_REQUEST_ENTITY,
        entityId: email.requestId,
        variables: {
          reference: email.reference,
          hotelName: email.hotelName,
          expiresOn: expiryForEmail(email.expiresAt),
          link: email.url,
        },
        ...(replyTo ? { replyTo } : {}),
      });
      return true;
    } catch {
      // The request and its link stand; staff copy the link or reissue it with the email.
      this.logger.warn("hotel_form.link_email_not_queued", { requestId: email.requestId });
      return false;
    }
  }

  /**
   * The request marked emailed, while the link emailed is still its link, and the event, in one
   * transaction. The email is already queued, so a failure here is logged, not answered.
   */
  private async markEmailed(email: LinkEmail, actor: RequestActor): Promise<void> {
    try {
      await this.repo.transaction(async (tx) => {
        const at = new Date();
        await this.repo.markEmailed(email.requestId, email.generation, at, tx);
        await this.journal.event(
          {
            requestId: email.requestId,
            eventType: "link_emailed",
            actor,
            at,
            detail: { generation: email.generation },
          },
          tx,
        );
      });
    } catch {
      this.logger.warn("hotel_form.link_email_not_recorded", { requestId: email.requestId });
    }
  }
}
