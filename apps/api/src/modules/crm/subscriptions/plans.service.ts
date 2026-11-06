import { Injectable } from "@nestjs/common";
import type { PlansResponse } from "@ampm/core";

import { PlansRepository } from "./plans.repository.js";
import { toPlanPublicView } from "./plans.view.js";

/**
 * Subscription plans (Module B CRM, feature 8.3). The public catalogue (PUB-07, CP-11) lists active
 * plans with their price and inclusions; the price is the plan row's own value, never code (AC-02.9).
 * Super-Admin plan management (TW-92) lands with its admin screen.
 */
@Injectable()
export class PlansService {
  constructor(private readonly plans: PlansRepository) {}

  async listActive(): Promise<PlansResponse> {
    const rows = await this.plans.listActive();
    return { items: rows.map(toPlanPublicView) };
  }
}
