import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import {
  MemoryRateLimitStore,
  RateLimitStore,
  RedisRateLimitStore,
} from "../common/rate-limit/rate-limit.store.js";
import { RateLimitGuard } from "../common/rate-limit/rate-limit.guard.js";
import { ENV, type Env } from "../env.js";
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
 * Order matters: AuthGuard resolves the principal, then RateLimitGuard keys its window by that
 * principal (or the IP for a public route), then PermissionGuard authorises. A public route like
 * activation skips AuthGuard's work, so it is still rate-limited by IP with no wasted JWKS call.
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
    {
      provide: RateLimitStore,
      useFactory: (env: Env): RateLimitStore =>
        env.REDIS_URL ? RedisRateLimitStore.fromUrl(env.REDIS_URL) : new MemoryRateLimitStore(),
      inject: [ENV],
    },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
  exports: [PrincipalService, PrincipalRepository, SessionService],
})
export class PolicyModule {}
