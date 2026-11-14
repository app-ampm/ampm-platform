import { Module } from "@nestjs/common";

import { ActivationService } from "../../identity/activation.service.js";
import { DevLoginService } from "../../identity/dev-login.service.js";
import { DevOtpService } from "../../identity/dev-otp.service.js";
import { IdentityModule } from "../../identity/identity.module.js";
import { ActivationController } from "./activation.controller.js";

/**
 * The public auth flows the API owns (Module A, feature 5.2): invitation activation, and the dev-only
 * local sign-in (feature TW-11 demo). IdentityModule provides the identity adapter and AuthTokenService;
 * DevLoginService constructs a LocalIdentityAdapter directly; PrismaService and the ENV are global.
 */
@Module({
  imports: [IdentityModule],
  controllers: [ActivationController],
  providers: [ActivationService, DevLoginService, DevOtpService],
})
export class AuthModule {}
