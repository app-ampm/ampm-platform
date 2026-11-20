import { Controller, HttpCode, Post } from "@nestjs/common";
import {
  clientActivationConfirmRequest,
  clientCodeRequest,
  clientSignInRequest,
  invitationTokenRequest,
  type ClientActivationCodeSent,
  type ClientActivationConfirmRequest,
  type ClientCodeRequest,
  type ClientCodeSent,
  type ClientSignInRequest,
  type InvitationTokenRequest,
  type SignInGrant,
} from "@ampm/core";

import { RateLimit } from "../../common/rate-limit/rate-limit.decorator.js";
import { ZodBody } from "../../common/zod.js";
import { AuditExempt, Public, SelfAudited } from "../../policy/decorators.js";
import { ClientActivationService } from "./client-activation.service.js";
import { ClientSignInService } from "./client-sign-in.service.js";

const MINUTE = 60_000;

/**
 * Client sign-in and activation by a one-time code sent to the mobile on file (D-147). Public, capped
 * per client address here, on top of the per-number limits and the per-code tries in the services.
 * Under Cognito the services answer 404, so these routes do not exist there.
 */
@Controller("auth")
export class ClientSignInController {
  constructor(
    private readonly signIns: ClientSignInService,
    private readonly activation: ClientActivationService,
  ) {}

  @Post("client/code")
  @Public()
  @RateLimit({ name: "auth.client_code", limit: 10, windowMs: MINUTE })
  @HttpCode(200)
  @AuditExempt("issues a short-lived sign-in code and queues its SMS; changes no business record")
  requestCode(@ZodBody(clientCodeRequest) body: ClientCodeRequest): Promise<ClientCodeSent> {
    return this.signIns.requestCode(body);
  }

  @Post("client/sign-in")
  @Public()
  @RateLimit({ name: "auth.client_sign_in", limit: 10, windowMs: MINUTE })
  @HttpCode(200)
  @AuditExempt("issues an access token; the session it opens is audited when it opens")
  signIn(@ZodBody(clientSignInRequest) body: ClientSignInRequest): Promise<SignInGrant> {
    return this.signIns.signIn(body);
  }

  @Post("activation/client/code")
  @Public()
  @RateLimit({ name: "auth.client_activation_code", limit: 10, windowMs: MINUTE })
  @HttpCode(200)
  @AuditExempt(
    "issues a short-lived activation code and queues its SMS; changes no business record",
  )
  sendActivationCode(
    @ZodBody(invitationTokenRequest) body: InvitationTokenRequest,
  ): Promise<ClientActivationCodeSent> {
    return this.activation.sendCode(body);
  }

  @Post("activation/client/confirm")
  @Public()
  @RateLimit({ name: "auth.client_activation_confirm", limit: 10, windowMs: MINUTE })
  @HttpCode(200)
  @SelfAudited()
  confirmActivation(
    @ZodBody(clientActivationConfirmRequest) body: ClientActivationConfirmRequest,
  ): Promise<SignInGrant> {
    return this.activation.confirm(body);
  }
}
