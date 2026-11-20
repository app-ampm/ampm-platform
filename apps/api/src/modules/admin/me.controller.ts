import { Controller, Get } from "@nestjs/common";
import type { MeResponse } from "@ampm/core";

import { RateLimit } from "../../common/rate-limit/rate-limit.decorator.js";
import { CurrentPrincipal } from "../../policy/decorators.js";
import type { Principal } from "../../policy/principal.types.js";
import { MeService } from "./me.service.js";

@Controller("me")
export class MeController {
  constructor(private readonly me: MeService) {}

  /** Any authenticated principal; the apps call it first and keep the result as the session state. */
  @Get()
  @RateLimit({ name: "me", limit: 120, perIpLimit: 1200, windowMs: 60_000, failClosed: false })
  get(@CurrentPrincipal() principal: Principal): MeResponse {
    return this.me.view(principal);
  }
}
