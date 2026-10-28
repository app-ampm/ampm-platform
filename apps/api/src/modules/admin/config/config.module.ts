import { Global, Module } from "@nestjs/common";

import { ConfigController } from "./config.controller.js";
import { ConfigRepository, PrismaConfigRepository } from "./config.repository.js";
import { ConfigService } from "./config.service.js";

/**
 * Configuration as a typed, cached accessor available everywhere (like the environment): the
 * session, notification and later feature code read their limits, defaults and switches through
 * ConfigService rather than hard-coding them (api.md "configuration, not code"). A Super Admin
 * writes values through the controller, which audits the change.
 */
@Global()
@Module({
  controllers: [ConfigController],
  providers: [{ provide: ConfigRepository, useClass: PrismaConfigRepository }, ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
