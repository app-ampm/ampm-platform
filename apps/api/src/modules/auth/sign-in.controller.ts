import { Controller, HttpCode, Post } from "@nestjs/common";
import {
  activationConfirmRequest,
  activationPasswordRequest,
  forgotPasswordRequest,
  invitationTokenRequest,
  resetPasswordRequest,
  signInCodeRequest,
  signInRequest,
  type Acknowledged,
  type ActivationConfirmRequest,
  type ActivationPasswordRequest,
  type ActivationPasswordResponse,
  type EnrolledGrant,
  type ForgotPasswordRequest,
  type InvitationPreview,
  type InvitationTokenRequest,
  type ResetPasswordRequest,
  type SignInCodeRequest,
  type SignInGrant,
  type SignInRequest,
  type SignInResponse,
} from "@ampm/core";

import { RateLimit } from "../../common/rate-limit/rate-limit.decorator.js";
import { ZodBody } from "../../common/zod.js";
import { AuditExempt, Public, SelfAudited } from "../../policy/decorators.js";
import { PasswordResetService } from "./password-reset.service.js";
import { StaffActivationService } from "./staff-activation.service.js";
import { StaffSignInService } from "./staff-sign-in.service.js";

const MINUTE = 60_000;

/**
 * AMPM's own sign-in (D-142): staff password + authenticator code, invitation activation that sets both,
 * a forgotten-password link, and sign-out. Public except sign-out; every route is capped per client
 * address (the limiter keys by IP before sign-in), on top of the per-account lockout in the services.
 * Under Cognito the services answer 404, so these routes do not exist there.
 */
@Controller("auth")
export class SignInController {
  constructor(
    private readonly signIns: StaffSignInService,
    private readonly activation: StaffActivationService,
    private readonly resets: PasswordResetService,
  ) {}

  @Post("sign-in")
  @Public()
  @RateLimit({ name: "auth.sign_in", limit: 10, windowMs: MINUTE })
  @HttpCode(200)
  @AuditExempt("checks a password and issues a short-lived challenge; changes no business record")
  signIn(@ZodBody(signInRequest) body: SignInRequest): Promise<SignInResponse> {
    return this.signIns.signIn(body);
  }

  @Post("sign-in/code")
  @Public()
  @RateLimit({ name: "auth.sign_in_code", limit: 10, windowMs: MINUTE })
  @HttpCode(200)
  @AuditExempt("issues an access token; the session it opens is audited on first use")
  signInCode(@ZodBody(signInCodeRequest) body: SignInCodeRequest): Promise<SignInGrant> {
    return this.signIns.verifyCode(body);
  }

  @Post("sign-out")
  @HttpCode(200)
  @SelfAudited()
  signOut(): Promise<Acknowledged> {
    return this.signIns.signOut();
  }

  @Post("activation/preview")
  @Public()
  @RateLimit({ name: "auth.activation_preview", limit: 20, windowMs: MINUTE })
  @HttpCode(200)
  @AuditExempt("reads who an invitation is for; changes nothing")
  preview(
    @ZodBody(invitationTokenRequest) body: InvitationTokenRequest,
  ): Promise<InvitationPreview> {
    return this.activation.preview(body.token);
  }

  @Post("activation/password")
  @Public()
  @RateLimit({ name: "auth.activation_password", limit: 10, windowMs: MINUTE })
  @HttpCode(200)
  @AuditExempt("sets the credentials of a still-invited account; activation itself is audited")
  activationPassword(
    @ZodBody(activationPasswordRequest) body: ActivationPasswordRequest,
  ): Promise<ActivationPasswordResponse> {
    return this.activation.setPassword(body);
  }

  @Post("activation/confirm")
  @Public()
  @RateLimit({ name: "auth.activation_confirm", limit: 10, windowMs: MINUTE })
  @HttpCode(200)
  @SelfAudited()
  activationConfirm(
    @ZodBody(activationConfirmRequest) body: ActivationConfirmRequest,
  ): Promise<EnrolledGrant> {
    return this.activation.confirm(body);
  }

  @Post("password/forgot")
  @Public()
  @RateLimit({ name: "auth.password_forgot", limit: 5, windowMs: 15 * MINUTE })
  @HttpCode(200)
  @AuditExempt("queues a reset email; changes no business record")
  forgotPassword(
    @ZodBody(forgotPasswordRequest) body: ForgotPasswordRequest,
  ): Promise<Acknowledged> {
    return this.resets.request(body);
  }

  @Post("password/reset")
  @Public()
  @RateLimit({ name: "auth.password_reset", limit: 10, windowMs: MINUTE })
  @HttpCode(200)
  @SelfAudited()
  resetPassword(@ZodBody(resetPasswordRequest) body: ResetPasswordRequest): Promise<Acknowledged> {
    return this.resets.reset(body);
  }
}
