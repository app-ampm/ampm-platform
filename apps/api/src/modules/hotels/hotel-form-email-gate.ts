import { Injectable, type OnModuleInit } from "@nestjs/common";
import type { HotelFormMode } from "@ampm/core";

import { ConfigService } from "../admin/config/config.service.js";
import type { GatedNotification } from "../admin/notification/notification-send-gates.js";
import { NotificationService } from "../admin/notification/notification.service.js";
import { HotelInfoRequestsRepository } from "./hotel-info-requests.repository.js";

/*
 * The hotel form's kill switch (D-188 §5; plan §4.9 and §4.10). Email to a hotel is queued only while the
 * form's mode admits its request; and since a queued email may wait for the worker, the send path asks
 * again at send time, through this gate on every `hotel_form.*` template: a mode switched off, or to
 * test_only for a request that is not a test, drops the email, its address and render data cleared.
 */

/** The template-key prefix of every hotel form email. */
export const HOTEL_FORM_TEMPLATE_PREFIX = "hotel_form.";
/** The entity a hotel form email is about: its request. */
export const HOTEL_INFO_REQUEST_ENTITY = "hotel_info_request";

/**
 * Whether the hotel form's mode admits a request: every request when on, a test request in test_only,
 * none when off.
 *
 * @example
 * modeAdmits("test_only", request.isTest);
 */
export function modeAdmits(mode: HotelFormMode, isTest: boolean): boolean {
  return mode === "on" || (mode === "test_only" && isTest);
}

@Injectable()
export class HotelFormEmailGate implements OnModuleInit {
  constructor(
    private readonly notifications: NotificationService,
    private readonly config: ConfigService,
    private readonly repo: HotelInfoRequestsRepository,
  ) {}

  /** Registers the gate in every process: the worker sends, so it asks there. */
  onModuleInit(): void {
    this.notifications.registerSendGate(HOTEL_FORM_TEMPLATE_PREFIX, (notification) =>
      this.admits(notification),
    );
  }

  /**
   * At send time: the mode, read past the configuration cache, admits the email; in test_only only an
   * email about a test request passes.
   */
  async admits(notification: GatedNotification): Promise<boolean> {
    const { mode } = await this.config.getFresh("hotel_form.policy");
    if (mode !== "test_only") return mode === "on";
    const requestId =
      notification.entityType === HOTEL_INFO_REQUEST_ENTITY ? notification.entityId : null;
    return requestId !== null && (await this.repo.isTestRequest(requestId));
  }
}
