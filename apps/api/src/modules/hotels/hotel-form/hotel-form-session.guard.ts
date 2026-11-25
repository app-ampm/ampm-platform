import {
  createParamDecorator,
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";

import { HotelFormSessions, type FormSession } from "./hotel-form-sessions.service.js";

/** An HTTP request a session route serves, carrying the session the guard passed. */
export interface HotelFormHttpRequest extends Request {
  hotelFormSession?: FormSession;
}

/**
 * The hotel form's session guard (D-189 §5): on every session route, after the global guards (so the
 * route's rate limit has counted the call), it authenticates the `Authorization: Bearer hfs_…` header and
 * re-checks everything (HotelFormSessions.authenticate): 404 while the mode is off, else a 401 with its
 * reason on any failure. A session that passes is handed to the handler through CurrentFormSession, and
 * its person is the request's actor for audit.
 *
 * @example
 * \@Get("me") \@UseGuards(HotelFormSessionGuard)
 * me(\@CurrentFormSession() session: FormSession) {}
 */
@Injectable()
export class HotelFormSessionGuard implements CanActivate {
  constructor(private readonly sessions: HotelFormSessions) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<HotelFormHttpRequest>();
    request.hotelFormSession = await this.sessions.authenticate(
      request.header("authorization"),
      new Date(),
    );
    return true;
  }
}

/** The session HotelFormSessionGuard passed, for a session route's handler. */
export const CurrentFormSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): FormSession => {
    const session = context.switchToHttp().getRequest<HotelFormHttpRequest>().hotelFormSession;
    if (!session)
      throw new Error("CurrentFormSession used on a route without HotelFormSessionGuard");
    return session;
  },
);
