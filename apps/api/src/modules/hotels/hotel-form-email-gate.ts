import { Injectable, type OnModuleInit } from "@nestjs/common";
import { isLiveHotelInfoRequestStatus, type HotelFormMode } from "@ampm/core";

import { ConfigService } from "../admin/config/config.service.js";
import type { GatedNotification } from "../admin/notification/notification-send-gates.js";
import { NotificationService } from "../admin/notification/notification.service.js";
import {
  HotelInfoRequestsRepository,
  type SendGateState,
} from "./hotel-info-requests.repository.js";

/*
 * The hotel form's kill switch (D-188 §5; plan §4.9 and §4.10). Email and SMS to a hotel are queued only
 * while the form's mode admits their request; and since a queued message may wait for the worker, the send
 * path asks again at send time, through this gate on every `hotel_form.*` template: a mode switched off, or
 * to test_only for a request that is not a test, drops the message, its address and render data cleared.
 * So does a request that is gone or deleted. A link email is dropped too once its request is no longer
 * live, and a code SMS (D-189 §2) once its request is neither live nor merged inside its status-only
 * window; either is dropped once its link was reissued after it was queued (each names its link's
 * generation as its gate reference).
 */

/** The template-key prefix of every hotel form email and SMS. */
export const HOTEL_FORM_TEMPLATE_PREFIX = "hotel_form.";
/** The template of a request's link email (core CONFIG_REGISTRY `notification.templates`). */
export const HOTEL_FORM_LINK_TEMPLATE = "hotel_form.link";
/** The template of a code sent by SMS in SMS mode (D-189 §2; built by `hotelFormCodeSms`). */
export const HOTEL_FORM_CODE_TEMPLATE = "hotel_form.code";
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

/** Whether a merged request is still inside its status-only window at `now`. */
function inStatusOnlyWindow(request: SendGateState, now: Date): boolean {
  return (
    request.status === "merged" &&
    request.statusOnlyUntil !== null &&
    request.statusOnlyUntil.getTime() > now.getTime()
  );
}

/** Whether a message names the request's current link: a reissue since it was queued drops it. */
function onCurrentLink(notification: GatedNotification, request: SendGateState): boolean {
  return notification.gateRef === String(request.tokenGeneration);
}

/**
 * What a template asks of its request beyond the mode: a link email a live request on its link; a code
 * SMS a request a person can still sign in to (live, or merged inside its status-only window) on its
 * link; any other hotel form message nothing more.
 */
function templateAdmits(
  notification: GatedNotification,
  request: SendGateState,
  now: Date,
): boolean {
  if (notification.templateKey === HOTEL_FORM_LINK_TEMPLATE) {
    return isLiveHotelInfoRequestStatus(request.status) && onCurrentLink(notification, request);
  }
  if (notification.templateKey === HOTEL_FORM_CODE_TEMPLATE) {
    const open = isLiveHotelInfoRequestStatus(request.status) || inStatusOnlyWindow(request, now);
    return open && onCurrentLink(notification, request);
  }
  return true;
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
   * At send time: the mode, read past the configuration cache, admits the message's request, which exists
   * and is not deleted (in test_only only a test request passes); and the template's own rule holds
   * (templateAdmits): a link email's request is still live, a code SMS's still open to sign-in, each on
   * the link it carries.
   */
  async admits(notification: GatedNotification): Promise<boolean> {
    const { mode } = await this.config.getFresh("hotel_form.policy");
    if (mode === "off") return false;
    const requestId =
      notification.entityType === HOTEL_INFO_REQUEST_ENTITY ? notification.entityId : null;
    if (requestId === null) return false;
    const request = await this.repo.sendGateState(requestId);
    if (request === null || !modeAdmits(mode, request.isTest)) return false;
    return templateAdmits(notification, request, new Date());
  }
}
