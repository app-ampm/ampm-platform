import { createHash } from "node:crypto";

import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { errors, SIGN_IN_ERRORS, type ClientCodeSent } from "@ampm/core";

import { AppLogger } from "../../common/logger.service.js";
import { RateLimitStore } from "../../common/rate-limit/rate-limit.store.js";
import { ENV, type Env } from "../../env.js";
import { AuthTokenService } from "../../identity/auth-token.service.js";
import {
  generateOneTimeCode,
  hashOneTimeCode,
  ONE_TIME_CODE_TTL_MS,
  oneTimeCodeMatches,
} from "../../identity/one-time-code.js";
import { SIGN_IN_KEYS, type SignInKeys } from "../../identity/sign-in-keys.js";
import { NotificationService } from "../admin/notification/notification.service.js";
import type { CredentialRecord } from "./credentials.repository.js";

/** Codes per number: an hour's and a day's worth, and the pause before the next one (D-147). */
const HOUR_MS = 60 * 60 * 1000;
const CODES_PER_HOUR = 5;
const CODES_PER_DAY = 10;
const RESEND_PAUSE_MS = 30_000;

/** The account a code is for: who, and the mobile the code goes to. */
export type CodeRecipient = Pick<CredentialRecord, "id" | "phone">;

/**
 * The clients' one-time sign-in codes (D-147), shared by sign-in and activation.
 * - `allow` applies the per-number limits before any lookup, so the answer is the same for a number with
 *   no client, and nobody can use the limits to learn which numbers have accounts.
 * - `send` issues a code (its HMAC at rest, the previous one retired) and queues the SMS. While SMS
 *   delivery is not live (`CLIENT_OTP_SCREEN_ECHO`) the code also goes back for the screen to show.
 * - `verify` checks a typed code against the live one, burning it after five wrong tries.
 * - Everything fails closed: a limiter outage issues no code, and every refusal of a code reads the same.
 */
@Injectable()
export class ClientCodes implements OnModuleInit {
  constructor(
    @Inject(SIGN_IN_KEYS) private readonly keys: SignInKeys | null,
    @Inject(ENV) private readonly env: Env,
    private readonly tokens: AuthTokenService,
    private readonly notifications: NotificationService,
    private readonly throttle: RateLimitStore,
    private readonly logger: AppLogger,
  ) {}

  /** A loud reminder at every production boot while codes are shown on screen (D-147). */
  onModuleInit(): void {
    if (this.env.CLIENT_OTP_SCREEN_ECHO && this.env.NODE_ENV === "production") {
      this.logger.warn("auth.client_code_screen_echo_on", {
        note: "client sign-in codes are shown on screen; turn CLIENT_OTP_SCREEN_ECHO off before go-live",
      });
    }
  }

  /** Refuses a code when this number had one too recently or too often (429), known or not. */
  async allow(phone: string): Promise<void> {
    const key = createHash("sha256").update(phone).digest("hex");
    const pause = await this.hits(`auth:client_code:pause:${key}`, RESEND_PAUSE_MS);
    if (pause > 1) throw errors.rateLimited(SIGN_IN_ERRORS.clientCodeTooSoon);
    const hour = await this.hits(`auth:client_code:hour:${key}`, HOUR_MS);
    const day = await this.hits(`auth:client_code:day:${key}`, 24 * HOUR_MS);
    if (hour > CODES_PER_HOUR || day > CODES_PER_DAY) {
      throw errors.rateLimited(SIGN_IN_ERRORS.clientCodeLimit);
    }
  }

  /** Issues and sends a code to this account's mobile; answers what the screen needs. */
  async send(recipient: CodeRecipient): Promise<ClientCodeSent> {
    const { otpKey } = this.signer();
    const code = generateOneTimeCode();
    await this.tokens.issueOneTimeCode(
      recipient.id,
      hashOneTimeCode(recipient.id, code, otpKey),
      ONE_TIME_CODE_TTL_MS,
    );
    await this.notifications.queue({
      recipientType: "user",
      recipientId: recipient.id,
      channel: "sms",
      eventType: "auth.client_otp",
      templateKey: "auth.client_otp",
      entityType: "user",
      entityId: recipient.id,
      variables: { code },
      required: true,
    });
    this.logger.info("auth.client_code_sent", { userId: recipient.id });
    return {
      ...this.nothingSent(),
      ...(this.env.CLIENT_OTP_SCREEN_ECHO ? { screenCode: code } : {}),
    };
  }

  /** The answer for a number with no client: the same timings, no code, nothing sent. */
  nothingSent(): ClientCodeSent {
    return {
      expiresInSeconds: ONE_TIME_CODE_TTL_MS / 1000,
      resendAfterSeconds: RESEND_PAUSE_MS / 1000,
    };
  }

  /** Whether codes also go back to the screen (`CLIENT_OTP_SCREEN_ECHO`, temporary, D-147). */
  showsOnScreen(): boolean {
    return this.env.CLIENT_OTP_SCREEN_ECHO;
  }

  /**
   * Accepts the account's live code once. Each try is reserved atomically before the comparison, so
   * guesses sent at once share the five tries; the fifth wrong one burns the code; a right one is spent
   * atomically, so two racing requests with it cannot both pass. Every refusal is the same message.
   */
  async verify(userId: string, code: string): Promise<void> {
    const { otpKey } = this.signer();
    const refused = errors.unauthenticated(SIGN_IN_ERRORS.invalidClientCode);
    const live = await this.tokens.findLiveOneTimeCode(userId);
    if (!live || !(await this.tokens.claimAttempt(live.id))) throw refused;
    if (!oneTimeCodeMatches(userId, code, live.tokenHash, otpKey)) {
      await this.tokens.burnIfSpent(live.id);
      throw refused;
    }
    if (!(await this.tokens.markUsedIfLive(live.id))) throw refused;
  }

  /** The sign-in keys, or 404 where the provider signs people in itself (Cognito). */
  signer(): SignInKeys {
    if (!this.keys) throw errors.notFound();
    return this.keys;
  }

  /**
   * Counts a hit in a window. Unlike the staff throttle, which sits behind a password, a limiter outage
   * fails closed here: the code is the client's only credential, so none is issued uncounted (503).
   */
  private async hits(key: string, windowMs: number): Promise<number> {
    try {
      return (await this.throttle.hit(key, windowMs)).count;
    } catch {
      this.logger.warn("auth.client_code_throttle_unavailable", {});
      throw errors.unavailable(SIGN_IN_ERRORS.clientCodesUnavailable);
    }
  }
}
