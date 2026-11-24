import { applyDecorators, UseInterceptors } from "@nestjs/common";

import { RateLimit } from "../rate-limit/rate-limit.decorator.js";
import { UPLOADS } from "../rate-limit/route-limits.js";
import { UploadSlotInterceptor } from "./upload-slot.interceptor.js";

/**
 * Marks a route that reads a file from its body (D-187 §1): it counts against the upload rate limit,
 * which fails closed, and takes an upload slot after the guards, before its handler reads a byte with
 * readBoundedBody. upload-coverage.spec.ts fails for a route that reads a body without it.
 *
 * @example
 * \@Post(":mediaId/upload")
 * \@RequirePermission("hotels.hotel_media_rights_status.update")
 * \@UploadRoute()
 * \@SelfAudited()
 * async upload(\@Req() req: Request) {
 *   const bytes = await readBoundedBody(req, octetStreamBody(MAX_MEDIA_UPLOAD_BYTES));
 * }
 */
export const UploadRoute = () =>
  applyDecorators(RateLimit(UPLOADS), UseInterceptors(UploadSlotInterceptor));
