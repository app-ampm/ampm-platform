import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";

import { answerParserRefusal } from "./common/app-error.filter.js";
import { requestContextMiddleware } from "./common/request-context.middleware.js";

/**
 * The largest JSON body the API reads. Requests carry records, never files: documents and media go
 * to S3 through signed URLs (security.md), so a bigger body is refused by the parser before any
 * guard runs, and AppErrorFilter answers it as payload_too_large.
 */
export const JSON_BODY_LIMIT = "100kb";

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
  app.use(answerParserRefusal);
  // Says nothing a caller needs and names the framework to anyone probing for it.
  app.disable("x-powered-by");
}
