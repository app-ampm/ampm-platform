import type { HotelFormCodeDelivery } from "@ampm/core";

import type { Env } from "../../env.js";
import type { QueueNotification } from "../admin/notification/notification.service.js";
import {
  smsProviderConfigured,
  type SmsProviderEnv,
} from "../admin/notification/sms-transports.js";
import { HOTEL_FORM_CODE_TEMPLATE, HOTEL_INFO_REQUEST_ENTITY } from "./hotel-form-email-gate.js";

/*
 * How the hotel form delivers its codes (D-189 §2; plan §4.3). On-screen mode is not a setting: it holds
 * exactly while the form cannot send its own SMS, that is while no SMS provider is configured or
 * SMS_HOTEL_FORM_TEMPLATE is unset, and it ends by itself once both are in place, even when client sign-in
 * wired the provider first. In on-screen mode the code is returned to the page and no SMS is queued; in
 * SMS mode it is never returned, logged or stored outside its HMAC, except in the render data of its SMS,
 * which the notification holds only while queued.
 */

/** The settings the decision reads. */
export type HotelFormDeliveryEnv = SmsProviderEnv & Pick<Env, "SMS_HOTEL_FORM_TEMPLATE">;

/**
 * Whether this API sends the hotel form's codes by SMS, or shows them on screen. Read it from the
 * environment each time a code is issued; it is pure.
 *
 * @example
 * const delivery = hotelFormDeliveryFor(env); // "screen" until a provider and the template are set
 */
export function hotelFormDeliveryFor(env: HotelFormDeliveryEnv): HotelFormCodeDelivery {
  return smsProviderConfigured(env) && env.SMS_HOTEL_FORM_TEMPLATE !== undefined ? "sms" : "screen";
}

/** What the page may be told about a code: the code itself in on-screen mode only. */
export type HotelFormCodeForPage =
  { readonly delivery: "sms" } | { readonly delivery: "screen"; readonly code: string };

/**
 * The code's part of the code route's answer (D-189 §4: `delivery`, plus `code` in on-screen mode only),
 * so no caller can hand the page a code that went by SMS.
 *
 * @example
 * return { challengeId, maskedMobile, expiresAt, resendAfter, ...codeForPage(delivery, code) };
 */
export function codeForPage(delivery: HotelFormCodeDelivery, code: string): HotelFormCodeForPage {
  return delivery === "screen" ? { delivery, code } : { delivery };
}

/** What a code's SMS needs: its request, the link generation its challenge was issued on, the mobile and the code. */
export interface HotelFormCodeSmsInput {
  readonly requestId: string;
  /** `hotel_info_request_challenges.link_generation`: a reissue since drops the SMS at send time. */
  readonly linkGeneration: number;
  /** The mobile in E.164, as the person gave it. */
  readonly mobile: string;
  readonly code: string;
}

/**
 * The SMS that carries a code in SMS mode (D-189 §2): an `external`, `required` notification to the
 * mobile, about the request, on `hotel_form.code` (D-174's DLT text), with the link's generation as its
 * gate reference, which the send gate compares (HotelFormEmailGate). Queue it only when
 * {@link hotelFormDeliveryFor} says `sms`.
 *
 * @example
 * await notifications.queue(hotelFormCodeSms({ requestId, linkGeneration, mobile, code }));
 */
export function hotelFormCodeSms(input: HotelFormCodeSmsInput): QueueNotification {
  return {
    recipientType: "external",
    recipientId: input.requestId,
    recipientAddress: input.mobile,
    channel: "sms",
    eventType: HOTEL_FORM_CODE_TEMPLATE,
    templateKey: HOTEL_FORM_CODE_TEMPLATE,
    entityType: HOTEL_INFO_REQUEST_ENTITY,
    entityId: input.requestId,
    variables: { code: input.code },
    required: true,
    gateRef: String(input.linkGeneration),
  };
}
