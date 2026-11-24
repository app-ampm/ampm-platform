import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { AppModule } from "./app.module.js";
import { AppLogger } from "./common/logger.service.js";
import { ENV, type Env } from "./env.js";
import { configureHttp, corsOptions, HTTP_APP_OPTIONS } from "./http.setup.js";

async function bootstrap(): Promise<void> {
  // The raw request bytes for the payment webhook's signature check, and the JSON parser only (D-187).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    ...HTTP_APP_OPTIONS,
  });
  configureHttp(app);
  const logger = app.get(AppLogger);
  app.useLogger(logger);
  app.enableShutdownHooks();
  const env = app.get<Env>(ENV);
  // Trust the configured number of proxy hops (Caddy) so req.ip — the rate-limit and audit key — is the
  // real client, not the reverse proxy. 0 (dev/test, no proxy) leaves Express reading the socket address.
  if (env.TRUST_PROXY > 0) app.set("trust proxy", env.TRUST_PROXY);
  // The native apps need no CORS; the web build of the client portals does.
  app.enableCors(corsOptions(env));
  await app.listen(env.PORT);
  logger.info("api.started", {
    port: env.PORT,
    identityProvider: env.IDENTITY_PROVIDER,
    nodeEnv: env.NODE_ENV,
  });
}

await bootstrap();
