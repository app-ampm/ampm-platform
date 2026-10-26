import { Controller, Get, HttpCode, Res } from "@nestjs/common";
import { healthResponse, type HealthResponse } from "@ampm/core";
import type { Response } from "express";

import { Public } from "../../policy/decorators.js";
import { HealthService } from "./health.service.js";

@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** 200 while the database answers, 503 otherwise, so the load balancer and the uptime check agree. */
  @Public()
  @Get()
  @HttpCode(200)
  async get(@Res({ passthrough: true }) response: Response): Promise<HealthResponse> {
    const result = healthResponse.parse(await this.health.check());
    if (result.status !== "ok") response.status(503);
    return result;
  }
}
