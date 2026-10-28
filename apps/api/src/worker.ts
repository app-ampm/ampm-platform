import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { AppLogger } from "./common/logger.service.js";

/**
 * The worker process (D-031): a Nest application context (no HTTP server) that runs the BullMQ
 * workers. `JOB_WORKER=true` makes the job driver consume; the API process (main.ts) leaves it
 * false and only enqueues. Jobs register themselves through JobQueue at module start-up, so
 * importing AppModule is all that is needed. Without REDIS_URL the inline driver is used and there
 * is nothing to consume — the worker is only meaningful once Redis is configured.
 */
async function bootstrap(): Promise<void> {
  // The worker bootstrap selects its own mode before env.ts reads it (like NODE_ENV in a launcher).
  process.env["JOB_WORKER"] = "true";
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  app.useLogger(app.get(AppLogger));
  app.enableShutdownHooks();
  app.get(AppLogger).info("worker.started");
}

void bootstrap();
