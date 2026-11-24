import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import { errors } from "@ampm/core";
import type { Request, Response } from "express";
import type { Observable } from "rxjs";

import { clientKey } from "../rate-limit/client-key.js";
import { requestContext, type RequestContext } from "../request-context.js";
import { UploadSlots, type ReleaseSlot } from "./upload-slots.js";

/** The busy answer's wording (D-187). */
export const UPLOAD_BUSY_MESSAGE = "The server is busy with other uploads. Try again in 5 seconds.";

/** When a caller refused as busy may try again, in seconds (the busy answer's Retry-After). */
export const UPLOAD_RETRY_AFTER_SECONDS = 5;

/**
 * Takes an upload slot (UploadSlots) for a route that reads a file, after the guards and before the
 * handler, so before any byte of the body is read (D-187 §1). With no slot free it answers 503
 * `unavailable` with Retry-After: 5. The slot is given back once: when the response has been sent, or
 * when the connection closes first (an aborted upload). Applied with @UploadRoute, never alone.
 */
@Injectable()
export class UploadSlotInterceptor implements NestInterceptor {
  constructor(private readonly slots: UploadSlots) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const response = http.getResponse<Response>();
    const release = this.slots.tryTake(slotOwner(requestContext.get()));
    if (!release) {
      response.setHeader("Retry-After", String(UPLOAD_RETRY_AFTER_SECONDS));
      throw errors.unavailable(UPLOAD_BUSY_MESSAGE);
    }
    releaseWhenDone(http.getRequest<Request>(), response, release);
    return next.handle();
  }
}

/** Who a slot counts against: the signed-in user, else the client network, as the rate limit counts. */
function slotOwner(current: RequestContext | undefined): string {
  const principal = current?.principal;
  if (principal && "userId" in principal) return `user:${principal.userId}`;
  return `ip:${clientKey(current?.ip)}`;
}

/** Gives the slot back once the response is sent or the connection closes, whichever comes first. */
function releaseWhenDone(request: Request, response: Response, release: ReleaseSlot): void {
  response.once("finish", release);
  response.once("close", release);
  // A caller who left while the guards ran has already closed: neither event would come.
  if (request.socket.destroyed) release();
}
