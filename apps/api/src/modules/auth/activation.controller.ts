import { Controller, Headers, HttpCode, Post } from "@nestjs/common";
import {
  activateRequest,
  devCreateClientRequest,
  devLoginRequest,
  devOtpSendRequest,
  devOtpVerifyRequest,
  errors,
  type ActivateRequest,
  type ActivateResponse,
  type DevCreateClientRequest,
  type DevCreateClientResponse,
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
 * a token for a seeded staff account so the Sales workspace can authenticate without a password, and is
 * refused outside a local, non-production config (DevLoginService). `dev-login/request-otp` and
 * `dev-login/verify-otp` are the same dev-only path for mobile+OTP sign-in — the demo stand-in until the
 * SMS provider is wired; the request returns the one-time code for the screen to show, and both are
 * refused in production too (DevOtpService, SMS/OTP audit). `dev-login/invite` is the local stand-in
 * for the provider sign-in that precedes `activate`: it exchanges a live invite token for a local access
 * token that the activation screen then presents to `activate` (DevLoginService.signInForInvite).
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
  @RateLimit({ name: "auth.activate", limit: 10, windowMs: 60_000, failClosed: true })
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
  @RateLimit({ name: "auth.dev_login", limit: 10, windowMs: 60_000, failClosed: true })
  @HttpCode(200)
  @AuditExempt(
    "dev-only local sign-in; mints a token for an existing active staff or client account and writes nothing; the API refuses it unless IDENTITY_PROVIDER=local and NODE_ENV is not production",
  )
  devLoginHandler(@ZodBody(devLoginRequest) body: DevLoginRequest): Promise<DevLoginResponse> {
    return this.devLogin.signIn(body.email);
  }

  @Post("dev-login/demo")
  @Public()
  @RateLimit({ name: "auth.dev_demo", limit: 10, windowMs: 60_000, failClosed: true })
  @HttpCode(200)
  @AuditExempt(
    "dev-only demo sign-in; mints a token for the seeded demo prospect and writes nothing; the API refuses it unless IDENTITY_PROVIDER=local and NODE_ENV is not production",
  )
  demoLogin(): Promise<DevLoginResponse> {
    return this.devLogin.signInDemo();
  }

  // Under `dev-login/` on purpose: the test box keeps `/_api/auth/dev-login*` behind its Basic-Auth
  // (D-080), and this mints a token for whoever holds a live invitation link.
  @Post("dev-login/invite")
  @Public()
  @RateLimit({ name: "auth.dev_invite", limit: 10, windowMs: 60_000, failClosed: true })
  @HttpCode(200)
  @AuditExempt(
    "dev-only stand-in for the provider sign-in before activation: mints a local token for the account of a live invitation and writes nothing (the activation that follows self-audits); the API refuses it unless IDENTITY_PROVIDER=local and NODE_ENV is not production",
  )
  inviteLogin(@ZodBody(activateRequest) body: ActivateRequest): Promise<DevLoginResponse> {
    return this.devLogin.signInForInvite(body.token);
  }

  @Post("dev-login/request-otp")
  @Public()
  @RateLimit({ name: "auth.dev_otp_request", limit: 10, windowMs: 60_000, failClosed: true })
  @HttpCode(200)
  @AuditExempt(
    "dev-only demo OTP: generates a one-time code for an existing active client and writes nothing; the API refuses it unless IDENTITY_PROVIDER=local and NODE_ENV is not production",
  )
  requestOtp(@ZodBody(devOtpSendRequest) body: DevOtpSendRequest): Promise<DevOtpSendResponse> {
    return this.devOtp.sendOtp(body.phone);
  }

  @Post("dev-login/verify-otp")
  @Public()
  @RateLimit({ name: "auth.dev_otp_verify", limit: 10, windowMs: 60_000, failClosed: true })
  @HttpCode(200)
  @AuditExempt(
    "dev-only demo OTP: mints a token for an existing active client on a correct code and writes nothing; the API refuses it unless IDENTITY_PROVIDER=local and NODE_ENV is not production",
  )
  verifyOtp(@ZodBody(devOtpVerifyRequest) body: DevOtpVerifyRequest): Promise<DevLoginResponse> {
    return this.devOtp.verifyOtp(body.phone, body.code);
  }

  @Post("dev-login/create-client")
  @Public()
  @RateLimit({ name: "auth.dev_create_client", limit: 10, windowMs: 60_000, failClosed: true })
  @HttpCode(201)
  @AuditExempt(
    "dev-only demo: creates a synthetic active prospect client for the mobile+OTP demo; dev-gated with no principal to attribute, and refused unless IDENTITY_PROVIDER=local and NODE_ENV is not production",
  )
  createClient(
    @ZodBody(devCreateClientRequest) body: DevCreateClientRequest,
  ): Promise<DevCreateClientResponse> {
    return this.devOtp.createClient(body.name, body.phone);
  }
}
