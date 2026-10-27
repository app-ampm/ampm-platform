import { createParamDecorator, type ExecutionContext, SetMetadata } from "@nestjs/common";

import { requestContext } from "../common/request-context.js";
import type { Principal } from "./principal.types.js";

export const IS_PUBLIC = "ampm:public";
export const PERMISSION = "ampm:permission";

/** No principal needed: health checks, public website data, webhooks (which verify a signature instead). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export interface PermissionRequirement {
  readonly key: string;
  /** The route parameter that names the project the action targets (for `:assigned` grants). */
  readonly projectParam?: string | undefined;
  /** Answer 404 instead of 403, for record-level routes (denial equals absence). */
  readonly denyAsNotFound?: boolean | undefined;
}

/** Step 4: the permission key a handler needs, checked by PermissionGuard before any data is read. */
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
