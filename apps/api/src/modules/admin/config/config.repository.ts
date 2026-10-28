import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../db/prisma.service.js";
import { Prisma } from "../../../generated/prisma/client.js";

/** The stored value behind a configuration key; the service validates `valueJson`, not the repository. */
export interface ConfigRecord {
  readonly valueJson: unknown;
}

export abstract class ConfigRepository {
  abstract findByKey(key: string): Promise<ConfigRecord | null>;
  /** Inserts or replaces the global value of a key; returns the row id for the audit trail. */
  abstract upsert(key: string, valueJson: unknown): Promise<{ id: string }>;
}

@Injectable()
export class PrismaConfigRepository extends ConfigRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByKey(key: string): Promise<ConfigRecord | null> {
    // `config_key` is globally unique; project-scoped configuration arrives with module E.
    const row = await this.prisma.configuration.findUnique({ where: { configKey: key } });
    return row ? { valueJson: row.valueJson } : null;
  }

  async upsert(key: string, valueJson: unknown): Promise<{ id: string }> {
    const row = await this.prisma.configuration.upsert({
      where: { configKey: key },
      create: { configKey: key, valueJson: valueJson as Prisma.InputJsonValue, scope: "global" },
      update: { valueJson: valueJson as Prisma.InputJsonValue },
    });
    return { id: row.id };
  }
}
