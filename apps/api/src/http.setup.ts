import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";

import { answerParserRefusal, refuseBinaryOutsideUpload } from "./common/app-error.filter.js";
import { requestContextMiddleware } from "./common/request-context.middleware.js";

/**
 * The largest JSON body the API reads. Requests carry records, never files: documents and media go
 * to S3 through signed URLs (security.md), so a bigger body is refused by the parser before any
 * guard runs, and AppErrorFilter answers it as payload_too_large.
 */
export const JSON_BODY_LIMIT = "100kb";

/**
 * The raw-body ceiling for media uploads (application/octet-stream), feature 9.3b. Set just above the
 * service's per-file limit (25 MiB) so an oversized upload is answered by the service with the named limit
 * (AC-20.2), not the parser. Only the upload route reaches this parser (refuseBinaryOutsideUpload gates it);
 * in production media uploads to object storage through signed URLs, so these bytes bypass the API.
 */
export const MEDIA_UPLOAD_LIMIT = "26mb";

/**
 * HTTP settings shared by the server and the e2e suite, so the tests exercise what runs. Express
 * runs middleware in the order it is added: the request context comes first (step 0), so the body
 * parser and its refusals run inside it, and the parser's refusals are answered right after it,
 * in fixed wording, before Nest rewrites them.
 *
 * @example
 * const app = await NestFactory.create<NestExpressApplication>(AppModule);
 * configureHttp(app);
 */
export function configureHttp(app: NestExpressApplication): void {
  app.use(requestContextMiddleware);
  // Baseline response hardening on the JSON API (Caddy adds HSTS and the edge headers): never let a
  // browser sniff the content type, leak a referrer cross-origin, or frame an API response. Set before
  // the body parser so even its refusals (malformed, oversized or unsupported body) carry the headers.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });
  app.useBodyParser("json", { limit: JSON_BODY_LIMIT });
  // Binary bodies are refused everywhere but the media upload route, before the raw parser buffers them.
  app.use(refuseBinaryOutsideUpload);
  app.useBodyParser("raw", { type: "application/octet-stream", limit: MEDIA_UPLOAD_LIMIT });
  app.use(answerParserRefusal);
  // Says nothing a caller needs and names the framework to anyone probing for it.
  app.disable("x-powered-by");
}
