import { Module } from "@nestjs/common";

import { IdentityModule } from "../../../identity/identity.module.js";
import { PolicyModule } from "../../../policy/policy.module.js";
import { NotificationModule } from "../notification/notification.module.js";
import { StaffUsersController } from "./staff-users.controller.js";
import { PrismaStaffUsersRepository, StaffUsersRepository } from "./staff-users.repository.js";
import { StaffUsersService } from "./staff-users.service.js";

/**
 * Staff-user administration (Module A, feature 5.1). PolicyModule provides SessionService for
 * revocation; PrismaService and AuditService are global.
 */
@Module({
  imports: [PolicyModule, IdentityModule, NotificationModule],
  controllers: [StaffUsersController],
  providers: [
    { provide: StaffUsersRepository, useClass: PrismaStaffUsersRepository },
    StaffUsersService,
  ],
})
export class StaffUsersModule {}
