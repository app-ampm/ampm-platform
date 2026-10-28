import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { IdentityModule } from "../identity/identity.module.js";
import { AuthGuard } from "./auth.guard.js";
import { PermissionGuard } from "./permission.guard.js";
import { PrincipalRepository, PrismaPrincipalRepository } from "./principal.repository.js";
import { PrincipalService } from "./principal.service.js";
import { SessionReaperService } from "./session-reaper.service.js";
import { PrismaSessionRepository, SessionRepository } from "./session.repository.js";
import { SessionService } from "./session.service.js";

/**
 * The eight-step pipeline as guards and services (architecture §6); the guards run on every route.
 * AuditService is provided globally by AuditModule, so it is injected here without a local provider.
 */
@Module({
  imports: [IdentityModule],
  providers: [
    { provide: PrincipalRepository, useClass: PrismaPrincipalRepository },
    PrincipalService,
    { provide: SessionRepository, useClass: PrismaSessionRepository },
    SessionService,
    SessionReaperService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
  exports: [PrincipalService, PrincipalRepository, SessionService],
})
export class PolicyModule {}
