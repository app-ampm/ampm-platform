import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { errors } from "@ampm/core";
import type { Request } from "express";

import { requestContext } from "../common/request-context.js";
import { IDENTITY_ADAPTER, type IdentityAdapter } from "../identity/identity.types.js";
import { IS_PUBLIC } from "./decorators.js";
import { PrincipalService } from "./principal.service.js";

/**
 * Steps 1 to 3 for every route that is not @Public(): bearer token → verified identity →
 * principal (with entitlements), placed on the request context for guards, services and logs.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(IDENTITY_ADAPTER) private readonly identity: IdentityAdapter,
    private readonly principals: PrincipalService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.header("authorization") ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) throw errors.unauthenticated();
    const verified = await this.identity.verifyAccessToken(token);
    const principal = await this.principals.resolve(verified);
    const store = requestContext.get();
    if (store) store.principal = principal;
    return true;
  }
}
