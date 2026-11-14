import { Controller, Headers, HttpCode, Post } from "@nestjs/common";
import {
  activateRequest,
  devLoginRequest,
  devOtpSendRequest,
  devOtpVerifyRequest,
  errors,
  type ActivateRequest,
  type ActivateResponse,
  type DevLoginRequest,
  type DevLoginResponse,
  type DevOtpSendRequest,
  type DevOtpSendResponse,
  type DevOtpVerifyRequest,
} from "@ampm/core";

import { RateLimit } from "../../common/rate-limit/rate-limit.decorator.js";
import { ZodBody } from "../../common/zod.js";
import { AuditExempt, Public, SelfAudited } from "../../policy/decorators.js";
import { ActivationService } from "../../identity/activation.service.js";
import { DevLoginService } from "../../identity/dev-login.service.js";
import { DevOtpService } from "../../identity/dev-otp.service.js";

/**
 * The public auth flows the API owns. `activate` (Module A, feature 5.2) is public because the
 * activating user has no linked identity yet; it verifies the provider access token and the invite
 * token itself and self-audits. `dev-login` (feature TW-11 demo) is a dev-only local sign-in: it mints
 * a token for a seeded staff account so the Sales workspace can authenticate without Cognito, and is
 * refused outside a local, non-production config (DevLoginService). `dev-login/request-otp` and
 * `dev-login/verify-otp` are the same dev-only path for mobile+OTP sign-in — the demo stand-in until the
 * SMS provider is wired; the request returns the one-time code for the screen to show, and both are
 * refused in production too (DevOtpService, SMS/OTP audit).
 */
@Controller("auth")
export class ActivationController {
  constructor(
    private readonly activation: ActivationService,
    private readonly devLogin: DevLoginService,
    private readonly devOtp: DevOtpService,
  ) {}

  @Post("activate")
  @Public()
  @RateLimit({ name: "auth.activate", limit: 10, windowMs: 60_000 })
  @HttpCode(200)
  @SelfAudited()
  activate(
    @ZodBody(activateRequest) body: ActivateRequest,
    @Headers("authorization") authorization: string | undefined,
  ): Promise<ActivateResponse> {
    const [scheme, token] = (authorization ?? "").split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) {
      throw errors.unauthenticated("A provider access token is required to activate");
    }
    return this.activation.activate(body.token, token);
  }

  @Post("dev-login")
  @Public()
  @RateLimit({ name: "auth.dev_login", limit: 10, windowMs: 60_000 })
  @HttpCode(200)
  @AuditExempt(
    "dev-only local sign-in; mints a token for an existing active staff or client account and writes nothing; the API refuses it unless IDENTITY_PROVIDER=local and NODE_ENV is not production",
  )
  devLoginHandler(@ZodBody(devLoginRequest) body: DevLoginRequest): Promise<DevLoginResponse> {
    return this.devLogin.signIn(body.email);
  }

  @Post("dev-login/request-otp")
  @Public()
  @RateLimit({ name: "auth.dev_otp_request", limit: 10, windowMs: 60_000 })
  @HttpCode(200)
  @AuditExempt(
    "dev-only demo OTP: generates a one-time code for an existing active client and writes nothing; the API refuses it unless IDENTITY_PROVIDER=local and NODE_ENV is not production",
  )
  requestOtp(@ZodBody(devOtpSendRequest) body: DevOtpSendRequest): Promise<DevOtpSendResponse> {
    return this.devOtp.sendOtp(body.phone);
  }

  @Post("dev-login/verify-otp")
  @Public()
  @RateLimit({ name: "auth.dev_otp_verify", limit: 10, windowMs: 60_000 })
  @HttpCode(200)
  @AuditExempt(
    "dev-only demo OTP: mints a token for an existing active client on a correct code and writes nothing; the API refuses it unless IDENTITY_PROVIDER=local and NODE_ENV is not production",
  )
  verifyOtp(@ZodBody(devOtpVerifyRequest) body: DevOtpVerifyRequest): Promise<DevLoginResponse> {
    return this.devOtp.verifyOtp(body.phone, body.code);
  }
}
