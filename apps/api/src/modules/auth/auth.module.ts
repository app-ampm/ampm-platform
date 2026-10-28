import { Module } from "@nestjs/common";

import { ActivationService } from "../../identity/activation.service.js";
import { IdentityModule } from "../../identity/identity.module.js";
import { ActivationController } from "./activation.controller.js";

/**
 * The public auth flows the API owns (Module A, feature 5.2): invitation activation. IdentityModule
 * provides the identity adapter and AuthTokenService; PrismaService and AuditService are global.
 */
@Module({
  imports: [IdentityModule],
  controllers: [ActivationController],
  providers: [ActivationService],
})
export class AuthModule {}
