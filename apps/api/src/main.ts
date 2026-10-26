import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { AppLogger } from "./common/logger.service.js";
import { ENV, type Env } from "./env.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(AppLogger);
  app.useLogger(logger);
  app.enableShutdownHooks();
  const env = app.get<Env>(ENV);
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
