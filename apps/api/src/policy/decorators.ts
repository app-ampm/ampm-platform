import { createParamDecorator, type ExecutionContext, SetMetadata } from "@nestjs/common";

import { type Access, requestContext } from "../common/request-context.js";
import type { Principal } from "./principal.types.js";

export const IS_PUBLIC = "ampm:public";
export const PERMISSION = "ampm:permission";

/** No principal needed: health checks, public website data, webhooks (which verify a signature instead). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export interface PermissionRequirement {
  readonly key: string;
  /** The route parameter that names the project the action targets (for `:assigned` grants). */
  readonly projectParam?: string | undefined;
}

/**
 * Step 4: the permission key a handler needs, checked by PermissionGuard before any data is read.
 * A principal who may not see the records answers 404, as for a missing record; one who may see
 * them but not act answers 403 (architecture §6, denial equals absence). One who sees only its own
 * records ("(o)") answers 404 too: before the record is read, the guard cannot tell it is theirs.
 *
 * @example
 * \@RequirePermission("tasks.incidents.read", { projectParam: "projectId" })
 */
export const RequirePermission = (key: string, options: Omit<PermissionRequirement, "key"> = {}) =>
  SetMetadata(PERMISSION, { key, ...options } satisfies PermissionRequirement);

/** The principal of the current request, for handlers. */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, _context: ExecutionContext): Principal => {
    const principal = requestContext.principal();
    if (!principal) throw new Error("CurrentPrincipal used on a route without authentication");
    return principal;
  },
);

/**
 * What PermissionGuard allowed on this route, for the repository scope (step 5).
 *
 * @example
 * list(\@CurrentPrincipal() principal: Principal, \@CurrentAccess() access: Access) {
 *   return this.notes.list(recordScope(principal, access.scope));
 * }
 */
export const CurrentAccess = createParamDecorator(
  (_data: unknown, _context: ExecutionContext): Access => {
    const access = requestContext.access();
    if (!access) throw new Error("CurrentAccess used on a route without @RequirePermission");
    return access;
  },
);
