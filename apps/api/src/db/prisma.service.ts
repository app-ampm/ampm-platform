import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";

import { ENV, type Env } from "../env.js";
import { PrismaClient } from "../generated/prisma/client.js";

/** One Prisma client per process, on the pg driver adapter (Prisma 7). */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(ENV) env: Env) {
    super({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** `SELECT 1` within a time limit, for the health check. */
  async ping(timeoutMs = 1000): Promise<boolean> {
    try {
      await Promise.race([
        this.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("database ping timed out")), timeoutMs),
        ),
      ]);
      return true;
    } catch {
      return false;
    }
  }
}
