import { Controller, Get } from "@nestjs/common";
import type { PlansResponse } from "@ampm/core";

import { RateLimit } from "../../../common/rate-limit/rate-limit.decorator.js";
import { Public } from "../../../policy/decorators.js";
import { PlansService } from "./plans.service.js";

/**
 * The public plan catalogue (Module B CRM, feature 8.3). Like the public enquiry form it needs no
 * principal — a prospect browses plans before signing in — so it is `@Public()` and rate-limited; it
 * returns only active plans (PUBLIC). Staff plan management (TW-92) lands with its admin screen.
 */
@Controller("crm")
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get("plans")
  @Public()
  @RateLimit({ name: "crm.plans", limit: 60, windowMs: 60_000 })
  list(): Promise<PlansResponse> {
    return this.plans.listActive();
  }
}
