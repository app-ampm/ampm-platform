import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { errors } from "@ampm/core";
import { decideBeforeRead } from "@ampm/policy";
import type { Request } from "express";

import { AppLogger } from "../common/logger.service.js";
import { requestContext } from "../common/request-context.js";
import { PERMISSION, type PermissionRequirement } from "./decorators.js";
import { toPolicyPrincipal } from "./principal.types.js";
import { refusalFor } from "./refusal.js";

/**
 * Step 4: the permission key and its scope, before any data is read (architecture §6). An allowed
 * request carries the scope the grant reached to the repository (step 5); an own-scope grant
 * passes as "own", so the repository reads only the principal's records. A refusal is a 404 unless
 * the principal may read the records the key acts on, then a 403 (test-cases.md, denial semantics).
 * When the only read that shows those records is own-scope ("(o)"), the guard cannot tell before
 * the record is read whether it is the principal's, so the refusal is a 404: denial equals absence
 * (refusalFor).
 *
 * @example
 * // policy.module.ts, after AuthGuard has put the principal on the request context:
 * { provide: APP_GUARD, useClass: PermissionGuard }
 */
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
    const projectId = projectOf(context.switchToHttp().getRequest<Request>(), requirement);
    const caller = toPolicyPrincipal(principal);
    const decision = decideBeforeRead(caller, requirement.key, { projectId });
    const store = requestContext.get();
    if (decision.allowed && decision.scope && store) {
      store.access = { key: requirement.key, scope: decision.scope };
      return true;
    }
    const refusal = refusalFor(caller, requirement.key, projectId);
    this.logger.info("permission.denied", {
      key: requirement.key,
      reason: decision.reason,
      status: refusal.status,
    });
    throw refusal;
  }
}

function projectOf(request: Request, requirement: PermissionRequirement): string | undefined {
  const raw = requirement.projectParam ? request.params[requirement.projectParam] : undefined;
  return typeof raw === "string" ? raw : undefined;
}
