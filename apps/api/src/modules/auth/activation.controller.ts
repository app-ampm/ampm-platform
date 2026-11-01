import { Controller, Headers, HttpCode, Post } from "@nestjs/common";
import {
  activateRequest,
  devLoginRequest,
  errors,
  type ActivateRequest,
  type ActivateResponse,
  type DevLoginRequest,
  type DevLoginResponse,
} from "@ampm/core";

import { RateLimit } from "../../common/rate-limit/rate-limit.decorator.js";
import { ZodBody } from "../../common/zod.js";
import { AuditExempt, Public, SelfAudited } from "../../policy/decorators.js";
import { ActivationService } from "../../identity/activation.service.js";
import { DevLoginService } from "../../identity/dev-login.service.js";

/**
 * The public auth flows the API owns. `activate` (Module A, feature 5.2) is public because the
 * activating user has no linked identity yet; it verifies the provider access token and the invite
 * token itself and self-audits. `dev-login` (feature TW-11 demo) is a dev-only local sign-in: it mints
 * a token for a seeded staff account so the Sales workspace can authenticate without Cognito, and is
 * refused outside a local, non-production config (DevLoginService).
 */
@Controller("auth")
export class ActivationController {
  constructor(
    private readonly activation: ActivationService,
    private readonly devLogin: DevLoginService,
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
    "dev-only local sign-in; mints a token for an existing active staff account and writes nothing; the API refuses it unless IDENTITY_PROVIDER=local and NODE_ENV is not production",
  )
  devLoginHandler(@ZodBody(devLoginRequest) body: DevLoginRequest): Promise<DevLoginResponse> {
    return this.devLogin.signIn(body.email);
  }
}
