import { Injectable } from "@nestjs/common";
import type { HotelFormPolicy, HotelInfoRequestLinkEmail } from "@ampm/core";

import { AppLogger } from "../../common/logger.service.js";
import { ConfigService } from "../admin/config/config.service.js";
import { NotificationService } from "../admin/notification/notification.service.js";
import {
  HOTEL_FORM_LINK_TEMPLATE,
  HOTEL_INFO_REQUEST_ENTITY,
  modeAdmits,
} from "./hotel-form-email-gate.js";
import { HotelInfoRequestJournal, type RequestActor } from "./hotel-info-request-journal.js";
import { expiryForEmail } from "./hotel-info-request-link.js";
import { HotelInfoRequestsRepository } from "./hotel-info-requests.repository.js";

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
 * email marks the request emailed, with its `link_emailed` event. It never throws: it runs after the
 * request is committed, and a failure answers `failed` so the link is still answered.
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
    const policy = await this.policyFor(email.requestId);
    if (policy === null) return "failed";
    if (policy.mode === "off") return "mode_off";
    if (!modeAdmits(policy.mode, email.isTest)) return "mode_test_only";
    if (email.recipientEmail === null || !(await this.queue(email, policy.replyTo))) {
      return "failed";
    }
    await this.markEmailed(email, actor);
    return "queued";
  }

  /**
   * The form's policy, read past the cache; null when it cannot be read. The request and its link are
   * committed by now, so the link is answered and the email is answered as failed.
   */
  private async policyFor(requestId: string): Promise<HotelFormPolicy | null> {
    try {
      return await this.config.getFresh("hotel_form.policy");
    } catch {
      this.logger.warn("hotel_form.link_email_policy_unread", { requestId });
      return null;
    }
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
        // The send gate drops the email if the link is reissued before it goes (D-188 §5).
        gateRef: String(email.generation),
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
   * transaction; a link reissued meanwhile is not marked, and gets no event. The email is already queued,
   * so a failure here is logged, not answered.
   */
  private async markEmailed(email: LinkEmail, actor: RequestActor): Promise<void> {
    try {
      await this.repo.transaction(async (tx) => {
        const at = new Date();
        const marked = await this.repo.markEmailed(email.requestId, email.generation, at, tx);
        if (marked === 0) return;
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
