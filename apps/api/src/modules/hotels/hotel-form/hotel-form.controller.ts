import { Controller, Get, Headers, HttpCode, Patch, Post, UseGuards } from "@nestjs/common";
import {
  hotelFormCodeRequest,
  hotelFormMeUpdateRequest,
  hotelFormOpenRequest,
  hotelFormVerifyRequest,
  type Acknowledged,
  type HotelFormCodeIssued,
  type HotelFormCodeRequest,
  type HotelFormMe as HotelFormMeView,
  type HotelFormMeUpdateRequest,
  type HotelFormOpenAnswer,
  type HotelFormOpenRequest,
  type HotelFormVerified,
  type HotelFormVerifyRequest,
} from "@ampm/core";

import { RateLimit } from "../../../common/rate-limit/rate-limit.decorator.js";
import { requestContext } from "../../../common/request-context.js";
import { ZodBody } from "../../../common/zod.js";
import { AuditExempt, Public, SelfAudited } from "../../../policy/decorators.js";
import { HotelFormCodeIssuer, type FormClient } from "./hotel-form-code-issuer.service.js";
import { HotelFormCodeVerifier } from "./hotel-form-code-verifier.service.js";
import { HotelFormGate } from "./hotel-form-gate.js";
import { HotelFormMe } from "./hotel-form-me.service.js";
import {
  HOTEL_FORM_CODES,
  HOTEL_FORM_OPEN,
  HOTEL_FORM_READS,
  HOTEL_FORM_SIGN_OUT,
  HOTEL_FORM_VERIFY,
  HOTEL_FORM_WRITES,
} from "./hotel-form-route-limits.js";
import { CurrentFormSession, HotelFormSessionGuard } from "./hotel-form-session.guard.js";
import { HotelFormSessions, type FormSession } from "./hotel-form-sessions.service.js";

/** The longest user agent kept (`hotel_info_request_challenges.user_agent`, VARCHAR(512)). */
const USER_AGENT_MAX = 512;

/**
 * Who is calling: the address the request context took from the connection (trusted proxies only) and
 * the browser's user agent, printable ASCII only and cut to its column; both RESTRICTED-CONTACT.
 */
function clientOf(userAgent: string | undefined): FormClient {
  const printable = (userAgent ?? "").replace(/[^\x20-\x7E]/g, "").slice(0, USER_AGENT_MAX);
  return { ip: requestContext.get()?.ip ?? null, userAgent: printable === "" ? null : printable };
}

/**
 * The hotel form's public routes (D-189 §4; plan §7.1), which the website calls. All are @Public: the link's
 * secret, sent in POST bodies only, and then a form session (`Authorization: Bearer hfs_…`, checked by
 * HotelFormSessionGuard) are the keys, never a user. While the form's mode is off every route answers 404;
 * under test_only a request that is not a test is not active. No answer carries anything about the hotel.
 * Every limit fails closed but sign-out's (rate-limit-coverage.spec.ts); the code routes add the limits of
 * D-189 §3 in their service. A contributor's writes audit as guest_token (D-180, D-189 §6).
 */
@Controller("hotel-form")
@Public()
export class HotelFormController {
  constructor(
    private readonly gate: HotelFormGate,
    private readonly issuer: HotelFormCodeIssuer,
    private readonly verifier: HotelFormCodeVerifier,
    private readonly sessions: HotelFormSessions,
    private readonly me: HotelFormMe,
  ) {}

  @Post("open")
  @RateLimit(HOTEL_FORM_OPEN)
  @HttpCode(200)
  @AuditExempt("reads the state a link opens to; changes nothing and records no open (D-189 §4)")
  open(@ZodBody(hotelFormOpenRequest) body: HotelFormOpenRequest): Promise<HotelFormOpenAnswer> {
    return this.gate.open(body.token, new Date());
  }

  @Post("codes")
  @RateLimit(HOTEL_FORM_CODES)
  @HttpCode(200)
  @SelfAudited()
  requestCode(
    @ZodBody(hotelFormCodeRequest) body: HotelFormCodeRequest,
    @Headers("user-agent") userAgent: string | undefined,
  ): Promise<HotelFormCodeIssued> {
    return this.issuer.issue(body, clientOf(userAgent));
  }

  @Post("codes/verify")
  @RateLimit(HOTEL_FORM_VERIFY)
  @HttpCode(200)
  @SelfAudited()
  verifyCode(
    @ZodBody(hotelFormVerifyRequest) body: HotelFormVerifyRequest,
    @Headers("user-agent") userAgent: string | undefined,
  ): Promise<HotelFormVerified> {
    return this.verifier.verify(body, clientOf(userAgent));
  }

  @Get("me")
  @UseGuards(HotelFormSessionGuard)
  @RateLimit(HOTEL_FORM_READS)
  getMe(@CurrentFormSession() session: FormSession): HotelFormMeView {
    return this.me.get(session);
  }

  @Patch("me")
  @UseGuards(HotelFormSessionGuard)
  @RateLimit(HOTEL_FORM_WRITES)
  @SelfAudited()
  updateMe(
    @CurrentFormSession() session: FormSession,
    @ZodBody(hotelFormMeUpdateRequest) body: HotelFormMeUpdateRequest,
  ): Promise<HotelFormMeView> {
    return this.me.update(session, body);
  }

  @Post("sign-out")
  @UseGuards(HotelFormSessionGuard)
  @RateLimit(HOTEL_FORM_SIGN_OUT)
  @HttpCode(200)
  @SelfAudited()
  signOut(@CurrentFormSession() session: FormSession): Promise<Acknowledged> {
    return this.sessions.signOut(session);
  }
}
