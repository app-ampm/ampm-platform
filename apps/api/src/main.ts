import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { AppModule } from "./app.module.js";
import { AppLogger } from "./common/logger.service.js";
import { ENV, type Env } from "./env.js";
import { configureHttp } from "./http.setup.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  configureHttp(app);
  const logger = app.get(AppLogger);
  app.useLogger(logger);
  app.enableShutdownHooks();
  const env = app.get<Env>(ENV);
  // Trust the configured number of proxy hops (Caddy) so req.ip — the rate-limit and audit key — is the
  // real client, not the reverse proxy. 0 (dev/test, no proxy) leaves Express reading the socket address.
  if (env.TRUST_PROXY > 0) app.set("trust proxy", env.TRUST_PROXY);
  // The native apps need no CORS; the web build of the client portals does. Development allows the
  // local Metro and Next origins when none are configured.
  const origins =
    env.CORS_ORIGINS.length > 0
      ? env.CORS_ORIGINS
      : env.NODE_ENV === "development"
        ? ["http://localhost:8082", "http://localhost:3417"]
        : [];
  app.enableCors({
    origin: origins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["authorization", "content-type", "x-request-id"],
    exposedHeaders: ["x-request-id"],
    maxAge: 600,
  });
  await app.listen(env.PORT);
  logger.info("api.started", {
    port: env.PORT,
    identityProvider: env.IDENTITY_PROVIDER,
    nodeEnv: env.NODE_ENV,
  });
}

await bootstrap();
