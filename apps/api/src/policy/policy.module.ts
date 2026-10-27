import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { IdentityModule } from "../identity/identity.module.js";
import { AuditService } from "./audit.service.js";
import { AuthGuard } from "./auth.guard.js";
import { PermissionGuard } from "./permission.guard.js";
import { PrincipalRepository, PrismaPrincipalRepository } from "./principal.repository.js";
import { PrincipalService } from "./principal.service.js";

/** The eight-step pipeline as guards and services (architecture §6); the guards run on every route. */
@Module({
  imports: [IdentityModule],
  providers: [
    { provide: PrincipalRepository, useClass: PrismaPrincipalRepository },
    PrincipalService,
    AuditService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
  exports: [PrincipalService, AuditService, PrincipalRepository],
})
export class PolicyModule {}
