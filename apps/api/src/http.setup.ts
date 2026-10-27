import type { NestExpressApplication } from "@nestjs/platform-express";

/**
 * The largest JSON body the API reads. Requests carry records, never files: documents and media go
 * to S3 through signed URLs (security.md), so a bigger body is refused by the parser before any
 * guard runs, and AppErrorFilter answers it as payload_too_large.
 */
export const JSON_BODY_LIMIT = "100kb";

/**
 * HTTP settings shared by the server and the e2e suite, so the tests exercise what runs.
 *
 * @example
 * const app = await NestFactory.create<NestExpressApplication>(AppModule);
 * configureHttp(app);
 */
export function configureHttp(app: NestExpressApplication): void {
  app.useBodyParser("json", { limit: JSON_BODY_LIMIT });
  // Says nothing a caller needs and names the framework to anyone probing for it.
  app.disable("x-powered-by");
}
