import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { errors } from "@ampm/core";
import { decideBeforeRead, readKeyFor, type PolicyPrincipal } from "@ampm/policy";
import type { Request } from "express";

import { AppLogger } from "../common/logger.service.js";
import { requestContext } from "../common/request-context.js";
import { PERMISSION, type PermissionRequirement } from "./decorators.js";
import { toPolicyPrincipal } from "./principal.types.js";

/**
 * Step 4: the permission key and its scope, before any data is read (architecture §6). An allowed
 * request carries the scope the grant reached to the repository (step 5); an own-scope grant
 * passes as "own", so the repository reads only the principal's records. A refusal is a 404 unless
 * the principal may read the records the key acts on, then a 403 (test-cases.md, denial semantics).
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
    const visible = canSee(caller, requirement.key, projectId);
    this.logger.info("permission.denied", {
      key: requirement.key,
      reason: decision.reason,
      status: visible ? 403 : 404,
    });
    throw visible ? errors.forbidden() : errors.notFound();
  }
}

function projectOf(request: Request, requirement: PermissionRequirement): string | undefined {
  const raw = requirement.projectParam ? request.params[requirement.projectParam] : undefined;
  return typeof raw === "string" ? raw : undefined;
}

/** May the principal read the records the key acts on? Then a refusal says so (403). */
function canSee(principal: PolicyPrincipal, key: string, projectId: string | undefined): boolean {
  const readKey = readKeyFor(key);
  return readKey !== null && decideBeforeRead(principal, readKey, { projectId }).allowed;
}
