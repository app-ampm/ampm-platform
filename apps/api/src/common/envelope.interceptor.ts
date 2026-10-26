import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import type { ApiSuccess } from "@ampm/core";
import { map, type Observable } from "rxjs";

/** Every success leaves as `{ data }` (api.md); controllers return the view, nothing else. */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<ApiSuccess<unknown>> {
    return next.handle().pipe(map((data) => ({ data })));
  }
}
