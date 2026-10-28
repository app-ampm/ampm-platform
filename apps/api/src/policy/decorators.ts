import { createParamDecorator, type ExecutionContext, SetMetadata } from "@nestjs/common";

import { type Access, requestContext } from "../common/request-context.js";
import type { AuditAction } from "../generated/prisma/client.js";
import type { Principal } from "./principal.types.js";

export const IS_PUBLIC = "ampm:public";
export const PERMISSION = "ampm:permission";
export const AUDITED = "ampm:audited";

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

export interface AuditedOptions {
  readonly entityType: string;
  /**
   * The audit action. Defaults from the HTTP method (POST→create, PUT/PATCH→update, DELETE→delete);
   * pass it explicitly for approve, share or export, which no method implies.
   */
  readonly action?: AuditAction | undefined;
  /** Dot-path to the entity's uuid in the handler's return value; defaults to `id`. */
  readonly entityIdPath?: string | undefined;
  /** Route parameter holding the entity's uuid, used when the response carries no id (e.g. a DELETE). */
  readonly entityIdParam?: string | undefined;
}

/**
 * How a mutating handler declares its §9 audit: the backstop interceptor records it, its service
 * audits it in a transaction, or it is an explicit, reasoned exemption. The audit-coverage test fails
 * CI when a mutating route carries none of these.
 */
export type AuditMarker =
  | ({ readonly kind: "intercept" } & AuditedOptions)
  | { readonly kind: "self" }
  | { readonly kind: "exempt"; readonly reason: string };

/**
 * Step 8 backstop (§9): marks a mutating staff handler so AuditInterceptor writes an audit event from
 * the response. Best-effort — a failed write is logged, not raised — so a mutation whose audit must be
 * guaranteed (finance, identity, role changes) uses @SelfAudited to write it in the same transaction.
 *
 * @example
 * \@Audited({ entityType: "role", entityIdParam: "roleId" })
 */
export const Audited = (options: AuditedOptions) =>
  SetMetadata(AUDITED, { kind: "intercept", ...options } satisfies AuditMarker);

/** Marks a mutating handler whose service writes its own in-transaction audit (the config.set pattern). */
export const SelfAudited = () => SetMetadata(AUDITED, { kind: "self" } satisfies AuditMarker);

/**
 * Marks a mutating handler that is deliberately not audited, with a reason — a dev spike, or system
 * housekeeping that is not a §9 internal-user action. The reason keeps the exemption a reviewed choice.
 */
export const AuditExempt = (reason: string) =>
  SetMetadata(AUDITED, { kind: "exempt", reason } satisfies AuditMarker);
