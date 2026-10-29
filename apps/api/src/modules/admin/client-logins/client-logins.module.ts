import { Module } from "@nestjs/common";

import { IdentityModule } from "../../../identity/identity.module.js";
import { PolicyModule } from "../../../policy/policy.module.js";
import { NotificationModule } from "../notification/notification.module.js";
import { ClientLoginsController } from "./client-logins.controller.js";
import {
  ClientLoginsRepository,
  PrismaClientLoginsRepository,
} from "./client-logins.repository.js";
import { ClientLoginsService } from "./client-logins.service.js";

/**
 * Client-login administration (Module A, feature 5.3). PolicyModule provides SessionService;
 * IdentityModule provides AuthTokenService (the invite); NotificationModule provides delivery.
 */
@Module({
  imports: [PolicyModule, IdentityModule, NotificationModule],
  controllers: [ClientLoginsController],
  providers: [
    { provide: ClientLoginsRepository, useClass: PrismaClientLoginsRepository },
    ClientLoginsService,
  ],
})
export class ClientLoginsModule {}
