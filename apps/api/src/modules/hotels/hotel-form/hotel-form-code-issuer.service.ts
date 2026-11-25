import { randomInt } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import {
  errors,
  HOTEL_FORM_CODE_ACTION,
  HOTEL_FORM_ERRORS,
  HOTEL_FORM_NOTICE_VERSION,
  maskPhone,
  uuidv7,
  type HotelFormCodeDelivery,
  type HotelFormCodeIssued,
  type HotelFormCodeRequest,
} from "@ampm/core";

import {
  BOT_CHECK_ADAPTER,
  type BotCheckAdapter,
} from "../../../common/bot-check/bot-check.adapter.js";
import { AppLogger } from "../../../common/logger.service.js";
import { requestContext } from "../../../common/request-context.js";
import { ENV, type Env } from "../../../env.js";
import { hashDestination } from "../../../identity/destination-hash.js";
import {
  generateOneTimeCode,
  hashOneTimeCode,
  ONE_TIME_CODE_TTL_MS,
} from "../../../identity/one-time-code.js";
import { SIGN_IN_KEYS, type SignInKeys } from "../../../identity/sign-in-keys.js";
import { AuditService } from "../../../policy/audit.service.js";
import { NotificationService } from "../../admin/notification/notification.service.js";
import { codeForPage, hotelFormCodeSms, hotelFormDeliveryFor } from "../hotel-form-delivery.js";
import { HotelInfoRequestJournal } from "../hotel-info-request-journal.js";
import { HotelFormChallengesRepository } from "./hotel-form-challenges.repository.js";
import { HotelFormGate } from "./hotel-form-gate.js";
import { HOTEL_FORM_CODE_LIMITS, HotelFormLimits } from "./hotel-form-limits.js";
import { BURN_LOOKBACK_MS, lockedUntil } from "./hotel-form-lock.js";
import { HotelFormPeopleRepository } from "./hotel-form-people.repository.js";
import { HotelFormRequestsRepository } from "./hotel-form-requests.repository.js";
import type { FormRequest } from "./hotel-form-state.js";

/** The audit's entity for a code challenge. */
export const HOTEL_FORM_CHALLENGE_ENTITY = "hotel_info_request_challenge";

/** Who is calling, as the controller read it: the address and the browser, both RESTRICTED-CONTACT. */
export interface FormClient {
  readonly ip: string | null;
  readonly userAgent: string | null;
}

/** What one code request stores and sends. */
interface Issue {
  readonly request: FormRequest;
  readonly body: HotelFormCodeRequest;
  readonly client: FormClient;
  readonly destinationHash: string;
  readonly delivery: HotelFormCodeDelivery;
  readonly code: string;
  readonly challengeId: string;
}

/** A byte from the CSPRNG for a challenge's UUID v7, as the core helper takes randomness. */
const cryptoByte = (): number => randomInt(256) / 256;

/**
 * Issues hotel form codes (D-189 §2 to §4). In order: the link must be open to the form (the gate: mode
 * off is 404, a link not active is 404), the notice current (409), the bot check passed for the site and
 * `hf_code` (400), the mobile not one AMPM removed from the request (403) nor locked after burned codes
 * (429), and every limit within bounds, the global SMS cap last and in SMS mode only. Only then is the
 * claim held on a new challenge, which retires the mobile's live one, with the code stored as its HMAC
 * bound to the challenge. It creates or changes no person. The code goes by SMS in SMS mode and back to
 * the page in on-screen mode, never both; it is never logged.
 */
@Injectable()
export class HotelFormCodeIssuer {
  constructor(
    private readonly gate: HotelFormGate,
    private readonly requests: HotelFormRequestsRepository,
    private readonly challenges: HotelFormChallengesRepository,
    private readonly people: HotelFormPeopleRepository,
    private readonly limits: HotelFormLimits,
    private readonly journal: HotelInfoRequestJournal,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly logger: AppLogger,
    @Inject(BOT_CHECK_ADAPTER) private readonly botCheck: BotCheckAdapter,
    @Inject(SIGN_IN_KEYS) private readonly keys: SignInKeys,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async issue(
    body: HotelFormCodeRequest,
    client: FormClient,
    now: Date = new Date(),
  ): Promise<HotelFormCodeIssued> {
    const { policy, request } = await this.gate.openLink(body.token, now);
    if (body.noticeVersion !== HOTEL_FORM_NOTICE_VERSION) {
      throw errors.conflict(HOTEL_FORM_ERRORS.noticeStale);
    }
    await this.checkBot(body.botToken, client.ip);
    await this.refuseRemoved(request.id, body.mobile);
    const destinationHash = hashDestination(body.mobile, this.keys.hotelFormAddress);
    await this.refuseLocked(request.id, destinationHash, now);
    await this.limits.allowCodeRequest({ ip: client.ip, destinationHash, requestId: request.id });
    const delivery = hotelFormDeliveryFor(this.env);
    if (delivery === "sms") await this.limits.allowSms(policy.smsDailyCap, now);
    const issue: Issue = {
      request,
      body,
      client,
      destinationHash,
      delivery,
      code: generateOneTimeCode(),
      challengeId: uuidv7(now.getTime(), cryptoByte),
    };
    await this.store(issue, now);
    if (delivery === "sms") await this.send(issue, now);
    return {
      challengeId: issue.challengeId,
      maskedMobile: maskPhone(body.mobile),
      expiresAt: new Date(now.getTime() + ONE_TIME_CODE_TTL_MS).toISOString(),
      resendAfter: new Date(now.getTime() + HOTEL_FORM_CODE_LIMITS.mobilePauseMs).toISOString(),
      ...codeForPage(delivery, issue.code),
    };
  }

  /** The Turnstile pass, for the site's own host and the code request's action (D-189 §3, §7). */
  private async checkBot(botToken: string | undefined, ip: string | null): Promise<void> {
    const human = await this.botCheck.verify(botToken, {
      remoteIp: ip ?? undefined,
      expectedHostnames: [new URL(this.env.PUBLIC_SITE_URL).hostname],
      expectedAction: HOTEL_FORM_CODE_ACTION,
    });
    if (!human) {
      const detail = { path: "botToken", message: HOTEL_FORM_ERRORS.botCheck };
      throw errors.validation([detail], HOTEL_FORM_ERRORS.botCheck);
    }
  }

  /**
   * A mobile whose person AMPM removed from this request gets no code (plan §4.3), unless a live person
   * holds it now. While codes are shown on screen this proves nothing; reissuing the link is the way out.
   */
  private async refuseRemoved(requestId: string, mobile: string): Promise<void> {
    if (!(await this.people.wasRemoved(requestId, mobile))) return;
    if ((await this.people.findLive(requestId, mobile)) !== null) return;
    throw errors.forbidden(HOTEL_FORM_ERRORS.mobileRemoved);
  }

  /** The lock after three burned codes in an hour (hotel-form-lock.ts): 429 until it ends. */
  private async refuseLocked(requestId: string, destinationHash: string, now: Date): Promise<void> {
    const since = new Date(now.getTime() - BURN_LOOKBACK_MS);
    const until = lockedUntil(
      await this.challenges.recentBurns(requestId, destinationHash, since),
      now,
    );
    if (until === null) return;
    const seconds = Math.ceil((until.getTime() - now.getTime()) / 1000);
    throw errors.rateLimited(HOTEL_FORM_ERRORS.mobileLocked, seconds);
  }

  /**
   * The new challenge, the mobile's live one retired, its event and its audit, in one transaction, as the
   * claimant: their actor is the challenge until a person exists.
   */
  private async store(issue: Issue, now: Date): Promise<void> {
    const { request, body, challengeId } = issue;
    requestContext.setHotelFormActor({ requestId: request.id, challengeId });
    await this.requests.transaction(async (tx) => {
      await this.challenges.retireOpen(request.id, issue.destinationHash, now, tx);
      await this.challenges.create(
        {
          id: challengeId,
          requestId: request.id,
          linkGeneration: request.tokenGeneration,
          claimedFullName: body.fullName,
          claimedDesignation: body.designation,
          claimedPhone: body.mobile,
          claimedNoticeVersion: body.noticeVersion,
          delivery: issue.delivery,
          destinationHash: issue.destinationHash,
          codeHmac: hashOneTimeCode(challengeId, issue.code, this.keys.hotelFormCode),
          codeExpiresAt: new Date(now.getTime() + ONE_TIME_CODE_TTL_MS),
          ipAddress: issue.client.ip,
          userAgent: issue.client.userAgent,
        },
        tx,
      );
      await this.recordRequest(issue, now, tx);
    });
  }

  private async recordRequest(
    issue: Issue,
    now: Date,
    tx: Parameters<HotelInfoRequestJournal["event"]>[1],
  ): Promise<void> {
    const { request, challengeId, delivery } = issue;
    await this.journal.event(
      {
        requestId: request.id,
        eventType: "code_requested",
        actor: { kind: "hotel_person", personId: null },
        at: now,
        detail: { challengeId, delivery },
      },
      tx,
    );
    await this.audit.record(
      {
        action: "create",
        entityType: HOTEL_FORM_CHALLENGE_ENTITY,
        entityId: challengeId,
        after: { id: challengeId, requestId: request.id },
      },
      tx,
    );
  }

  /**
   * Queues the code's SMS (D-189 §2). If it cannot be queued, the challenge is retired, its claim cleared,
   * and the caller gets 503; the failure is logged without its message, which may echo the SMS's data.
   */
  private async send(issue: Issue, now: Date): Promise<void> {
    const { request, body, code } = issue;
    try {
      await this.notifications.queue(
        hotelFormCodeSms({
          requestId: request.id,
          linkGeneration: request.tokenGeneration,
          mobile: body.mobile,
          code,
        }),
      );
    } catch {
      this.logger.warn("hotel_form.code_sms_not_queued", { requestId: request.id });
      await this.challenges.retire(issue.challengeId, now).catch(() => undefined);
      throw errors.unavailable(HOTEL_FORM_ERRORS.codesUnavailable);
    }
  }
}
