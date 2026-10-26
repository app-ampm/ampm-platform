import { Controller, Get } from "@nestjs/common";
import type { MeResponse } from "@ampm/core";

import { CurrentPrincipal } from "../../policy/decorators.js";
import type { Principal } from "../../policy/principal.types.js";
import { MeService } from "./me.service.js";

@Controller("me")
export class MeController {
  constructor(private readonly me: MeService) {}

  /** Any authenticated principal; the apps call it first and keep the result as the session state. */
  @Get()
  get(@CurrentPrincipal() principal: Principal): MeResponse {
    return this.me.view(principal);
  }
}
