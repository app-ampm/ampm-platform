import type { NestApplicationOptions } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";

import { answerParserRefusal } from "./common/app-error.filter.js";
import { requestContextMiddleware } from "./common/request-context.middleware.js";
import type { Env } from "./env.js";

/**
 * The largest JSON body the API reads. JSON requests carry records, never files, so a bigger body is
 * refused by the parser before any guard runs, and AppErrorFilter answers it as payload_too_large. A
 * file goes up as raw bytes to an upload route, which reads it after the guards, in its handler, with
 * its own cap (common/bounded-body.ts; D-187).
 */
export const JSON_BODY_LIMIT = "100kb";

/**
 * How main.ts and the e2e suite create the application. `rawBody` keeps the exact request bytes on
 * `req.rawBody`, so the payment webhook can verify the provider's HMAC signature over them (feature 8.3,
 * AC-02.6). `bodyParser: false` stops Nest adding its own parsers: configureHttp adds the JSON parser and
 * nothing else, so no other body is read before the guards (D-187).
 *
 * @example
 * const app = await NestFactory.create<NestExpressApplication>(AppModule, HTTP_APP_OPTIONS);
 */
export const HTTP_APP_OPTIONS = {
  rawBody: true,
  bodyParser: false,
} as const satisfies NestApplicationOptions;

/** The headers a web portal may read from an API response: the request id, and a busy answer's wait. */
const EXPOSED_HEADERS = ["x-request-id", "retry-after"];

/** CORS as app.enableCors takes it, with the fields the API sets. */
export interface ApiCorsOptions {
  origin: string[];
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  maxAge: number;
}

/**
 * CORS for the web build of the client portals (the native apps need none): the configured origins,
 * or in development the local Metro and Next origins when none are configured.
 *
 * @example
 * app.enableCors(corsOptions(app.get<Env>(ENV)));
 */
export function corsOptions(env: Pick<Env, "CORS_ORIGINS" | "NODE_ENV">): ApiCorsOptions {
  const origins =
    env.CORS_ORIGINS.length > 0
      ? env.CORS_ORIGINS
      : env.NODE_ENV === "development"
        ? ["http://localhost:8082", "http://localhost:3417"]
        : [];
  return {
    origin: origins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["authorization", "content-type", "x-request-id"],
    exposedHeaders: [...EXPOSED_HEADERS],
    maxAge: 600,
  };
}

/**
 * HTTP settings shared by the server and the e2e suite, so the tests exercise what runs. Express
 * runs middleware in the order it is added: the request context comes first (step 0), so the JSON
 * parser and its refusals run inside it, and the parser's refusals are answered right after it,
 * in fixed wording, before Nest rewrites them. The JSON parser is the only one (D-187): a body of any
 * other type is left unread for the route, and only an upload route reads one, after the guards.
 *
 * @example
 * const app = await NestFactory.create<NestExpressApplication>(AppModule, HTTP_APP_OPTIONS);
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
