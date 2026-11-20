import { Module } from "@nestjs/common";

import { ActivationService } from "../../identity/activation.service.js";
import { DevLoginService } from "../../identity/dev-login.service.js";
import { DevOtpService } from "../../identity/dev-otp.service.js";
import { IdentityModule } from "../../identity/identity.module.js";
import { PolicyModule } from "../../policy/policy.module.js";
import { NotificationModule } from "../admin/notification/notification.module.js";
import { ActivationController } from "./activation.controller.js";
import { ClientActivationService } from "./client-activation.service.js";
import { ClientCodes } from "./client-codes.service.js";
import { ClientSignInController } from "./client-sign-in.controller.js";
import { ClientSignInService } from "./client-sign-in.service.js";
import { CredentialsRepository } from "./credentials.repository.js";
import { PasswordResetService } from "./password-reset.service.js";
import { SignInGrants } from "./sign-in-grant.js";
import { SignInController } from "./sign-in.controller.js";
import { StaffActivationService } from "./staff-activation.service.js";
import { StaffSignInService } from "./staff-sign-in.service.js";

/**
 * The auth flows the API owns (Module A): AMPM's own staff sign-in, activation and password reset
 * (D-142), client sign-in and activation by a mobile code (D-147), the Cognito-era link-on-activate
 * (feature 5.2), and the dev-only local sign-in (feature TW-11 demo). IdentityModule provides the
 * identity adapter, the sign-in keys and AuthTokenService; PolicyModule the sessions and the rate-limit
 * store; NotificationModule the reset email and the code SMS; PrismaService and the ENV are global.
 */
@Module({
  imports: [IdentityModule, PolicyModule, NotificationModule],
  controllers: [ActivationController, SignInController, ClientSignInController],
  providers: [
    ActivationService,
    ClientCodes,
    ClientSignInService,
    ClientActivationService,
    DevLoginService,
    DevOtpService,
    CredentialsRepository,
    StaffSignInService,
    StaffActivationService,
    PasswordResetService,
    SignInGrants,
  ],
})
export class AuthModule {}
