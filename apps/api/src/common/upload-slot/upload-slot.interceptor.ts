import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import { errors } from "@ampm/core";
import type { Response } from "express";
import { finalize, type Observable } from "rxjs";

import { AppLogger } from "../logger.service.js";
import { clientKey } from "../rate-limit/client-key.js";
import { requestContext, type RequestContext } from "../request-context.js";
import { UploadSlots } from "./upload-slots.js";

/** The busy answer's wording (D-187). */
export const UPLOAD_BUSY_MESSAGE = "The server is busy with other uploads. Try again in 5 seconds.";

/** When a caller refused as busy may try again, in seconds (the busy answer's Retry-After). */
export const UPLOAD_RETRY_AFTER_SECONDS = 5;

/**
 * The longest a slot is held. Far beyond any upload's real work (a 60-second read, the scan, one image
 * at a time, the store), so it only ever frees the slot of a handler that never settles: a bug, logged.
 */
export const UPLOAD_SLOT_MAX_HOLD_MS = 5 * 60_000;

/** Who a slot counts against, and how a log line names them without personal data. */
interface SlotOwner {
  readonly key: string;
  readonly logged: string;
}

/**
 * Takes an upload slot (UploadSlots) for a route that reads a file, after the guards and before the
 * handler, so before any byte of the body is read (D-187 §1). With no slot free it answers 503
 * `unavailable` with Retry-After: 5. The slot bounds the memory uploads hold, so it is held until the
 * handler's work ends (success, error or unsubscription), not merely until the caller leaves: a caller
 * who hangs up after sending the whole body leaves its bytes in the scan, the re-encode and the store,
 * and one who hangs up earlier makes readBoundedBody fail at once, which ends the work. A handler that
 * never settles has its slot taken back after five minutes, logged as `upload_slot.force_released`.
 * The slot is given back exactly once. Applied with @UploadRoute, never alone.
 */
@Injectable()
export class UploadSlotInterceptor implements NestInterceptor {
  constructor(
    private readonly slots: UploadSlots,
    private readonly logger: AppLogger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const owner = slotOwner(requestContext.get());
    const release = this.slots.tryTake(owner.key);
    if (!release) {
      const response = context.switchToHttp().getResponse<Response>();
      response.setHeader("Retry-After", String(UPLOAD_RETRY_AFTER_SECONDS));
      throw errors.unavailable(UPLOAD_BUSY_MESSAGE);
    }
    const route = `${context.getClass().name}.${context.getHandler().name}`;
    const safetyNet = setTimeout(() => {
      release();
      this.logger.error("upload_slot.force_released", { route, owner: owner.logged });
    }, UPLOAD_SLOT_MAX_HOLD_MS);
    safetyNet.unref();
    return next.handle().pipe(
      finalize(() => {
        clearTimeout(safetyNet);
        release();
      }),
    );
  }
}

/** Who a slot counts against: the signed-in user, else the client network, as the rate limit counts. */
function slotOwner(current: RequestContext | undefined): SlotOwner {
  const principal = current?.principal;
  if (principal && "userId" in principal) {
    const key = `user:${principal.userId}`;
    return { key, logged: key };
  }
  // A network is an address, personal data: it counts the slot but is never logged.
  return { key: `ip:${clientKey(current?.ip)}`, logged: "network" };
}
