import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { concatMap, from, type Observable } from "rxjs";

import { AppLogger } from "../common/logger.service.js";
import { requestContext } from "../common/request-context.js";
import type { AuditAction } from "../generated/prisma/client.js";
import { AuditService, type AuditInput } from "./audit.service.js";
import { AUDITED, type AuditedOptions, type AuditMarker } from "./decorators.js";

/** The audit action a mutating method implies when @Audited does not override it. */
const METHOD_ACTION: Readonly<Record<string, AuditAction | undefined>> = {
  POST: "create",
  PUT: "update",
  PATCH: "update",
  DELETE: "delete",
};

interface HttpRequest {
  readonly method?: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

/**
 * Step 8 backstop (security.md §9): every staff mutation whose handler carries @Audited writes an
 * audit event from the response, so a mutation is never silently unaudited. Handlers that audit in
 * their own transaction carry @SelfAudited and are skipped here (the explicit audit is richer and
 * commits with the change); the audit-coverage test fails CI when a mutating handler declares nothing.
 *
 * Scope and reliability: this covers HTTP controller routes only — worker and webhook mutations audit
 * in their own service. It is best-effort: a failed or unresolvable write is logged at error, not
 * raised, so it never turns a committed mutation into a 500. A mutation whose audit must be guaranteed
 * uses @SelfAudited to write it in the same transaction.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
    private readonly logger: AppLogger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler<unknown>): Observable<unknown> {
    const marker = this.reflector.get<AuditMarker | undefined>(AUDITED, context.getHandler());
    if (marker === undefined || marker.kind !== "intercept") return next.handle();
    const request = context.switchToHttp().getRequest<HttpRequest>();
    return next
      .handle()
      .pipe(concatMap((value) => from(this.record(marker, request, value).then(() => value))));
  }

  private async record(
    marker: AuditedOptions,
    request: HttpRequest,
    value: unknown,
  ): Promise<void> {
    try {
      const principal = requestContext.principal();
      // Only internal users; a @RequirePermission route never admits a non-staff principal, so this
      // guards against a @Audited decorator reaching a public or client route by mistake.
      if (!principal || principal.type !== "staff") return;
      const action = marker.action ?? METHOD_ACTION[request.method ?? ""];
      const entityId = resolveEntityId(marker, request, value);
      if (action === undefined || entityId === undefined) {
        // The backstop is this route's only audit, so an unrecorded mutation is loud, not a warning.
        this.logger.error("audit.backstop.unrecorded", {
          entityType: marker.entityType,
          method: request.method ?? null,
          missing: action === undefined ? "action" : "entityId",
        });
        return;
      }
      const input: AuditInput = { action, entityType: marker.entityType, entityId };
      await this.audit.record(input);
    } catch (error) {
      this.logger.error("audit.backstop.failed", {
        entityType: marker.entityType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/** The entity's uuid: a route parameter when named (a DELETE's `:id`), else a path in the response. */
function resolveEntityId(
  marker: AuditedOptions,
  request: HttpRequest,
  value: unknown,
): string | undefined {
  if (marker.entityIdParam !== undefined) {
    const param = request.params?.[marker.entityIdParam];
    if (typeof param === "string") return param;
  }
  const fromBody = resolvePath(value, marker.entityIdPath ?? "id");
  return typeof fromBody === "string" ? fromBody : undefined;
}

/** Resolves a dot-path against the handler's return value, or its `{ data }` envelope if it has one. */
function resolvePath(value: unknown, path: string): unknown {
  const direct = navigate(value, path);
  if (direct !== undefined) return direct;
  if (isRecord(value) && "data" in value) return navigate(value["data"], path);
  return undefined;
}

function navigate(value: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((acc, key) => (isRecord(acc) ? acc[key] : undefined), value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
