import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../db/prisma.service.js";

/** The stored value behind a configuration key; the service validates `valueJson`, not the repository. */
export interface ConfigRecord {
  readonly valueJson: unknown;
}

export abstract class ConfigRepository {
  abstract findByKey(key: string): Promise<ConfigRecord | null>;
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
}
