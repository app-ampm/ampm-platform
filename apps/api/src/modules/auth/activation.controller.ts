import { Controller, Headers, HttpCode, Post } from "@nestjs/common";
import { activateRequest, errors, type ActivateRequest, type ActivateResponse } from "@ampm/core";

import { RateLimit } from "../../common/rate-limit/rate-limit.decorator.js";
import { ZodBody } from "../../common/zod.js";
import { Public, SelfAudited } from "../../policy/decorators.js";
import { ActivationService } from "../../identity/activation.service.js";

/**
 * Invitation activation (Module A, feature 5.2). Public because the activating user has no linked
 * identity yet, so the principal-resolving guard would reject them; the handler verifies the provider
 * access token itself (via ActivationService → IdentityAdapter) and the invite token. Self-audits.
 */
@Controller("auth")
export class ActivationController {
  constructor(private readonly activation: ActivationService) {}

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
}
