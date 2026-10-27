import { createRequire } from "node:module";

import { Injectable } from "@nestjs/common";
import type { HealthResponse } from "@ampm/core";

import { PrismaService } from "../../db/prisma.service.js";

const { version } = createRequire(import.meta.url)("../../../package.json") as { version: string };
const startedAt = Date.now();

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResponse> {
    const database = (await this.prisma.ping()) ? "ok" : "down";
    return {
      status: database === "ok" ? "ok" : "degraded",
      version,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      checks: { database },
    };
  }
}
