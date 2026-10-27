import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { errors } from "@ampm/core";
import { decide } from "@ampm/policy";
import type { Request } from "express";

import { AppLogger } from "../common/logger.service.js";
import { requestContext } from "../common/request-context.js";
import { PERMISSION, type PermissionRequirement } from "./decorators.js";
import { toPolicyPrincipal } from "./principal.types.js";

/** Step 4: the permission key and its scope, before any data is read (architecture §6). */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly logger: AppLogger,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requirement = this.reflector.getAllAndOverride<PermissionRequirement | undefined>(
      PERMISSION,
      [context.getHandler(), context.getClass()],
    );
    if (!requirement) return true;
    const principal = requestContext.principal();
    if (!principal) throw errors.unauthenticated();
    const request = context.switchToHttp().getRequest<Request>();
    const rawProject = requirement.projectParam
      ? request.params[requirement.projectParam]
      : undefined;
    const projectId = typeof rawProject === "string" ? rawProject : undefined;
    const decision = decide(toPolicyPrincipal(principal), requirement.key, { projectId });
    if (decision.allowed) return true;
    this.logger.info("permission.denied", { key: requirement.key, reason: decision.reason });
    throw requirement.denyAsNotFound ? errors.notFound() : errors.forbidden();
  }
}
