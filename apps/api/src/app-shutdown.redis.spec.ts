import { once } from "node:events";
import type { Server } from "node:http";
import { connect } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppModule } from "./app.module.js";
import { PrismaService } from "./db/prisma.service.js";
import { configureHttp } from "./http.setup.js";
import { JobQueue } from "./jobs/job-queue.js";

const REDIS_URL = process.env["REDIS_URL"];
const DATABASE_URL = process.env["DATABASE_URL"];

/** TCP sockets and servers held by this process: what keeps node running once its shutdown is done. */
function openTcpHandles(): number {
  return process
    .getActiveResourcesInfo()
    .filter((resource) => resource === "TCPSocketWrap" || resource === "TCPServerWrap").length;
}

/** The open TCP handles once closing sockets have finished closing (a quit resolves before its close). */
async function openTcpHandlesWhenSettled(baseline: number): Promise<number> {
  const deadline = Date.now() + 5_000;
  while (openTcpHandles() > baseline && Date.now() < deadline) await delay(25);
  return openTcpHandles();
}

/**
 * Starts `GET /health` and returns once the server has its headers but not its body: a request in
 * flight. The returned function sends the body and resolves with the status line ("" after a reset).
 */
async function startRequestInFlight(server: Server): Promise<() => Promise<string>> {
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("the API is not on TCP");
  const socket = connect(address.port, "127.0.0.1");
  let reply = "";
  socket.on("data", (chunk: Buffer) => {
    reply += chunk.toString();
  });
  socket.on("error", () => undefined); // a reset shows as an empty reply
  const closed = new Promise<void>((resolve) => socket.once("close", () => resolve()));
  const received = once(server, "request");
  socket.write(
    "GET /health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n" +
      "Content-Type: application/json\r\nContent-Length: 2\r\n\r\n",
  );
  await received;
  return async () => {
    socket.write("{}");
    await closed;
    return reply.split("\r\n")[0] ?? "";
  };
}

/**
 * The API and the worker must leave nothing open once Nest's shutdown has run. In the container node is
 * PID 1, which ignores the SIGTERM Nest re-raises after its hooks, so the process ends only when no
 * handle is left: on 20 Nov 2026 the rate-limit store's Redis client was one, and every stop ended in
 * Docker's SIGKILL (exit 137). This boots the real application against Redis and PostgreSQL, so it runs
 * where both are configured (CI's Redis step, which has DATABASE_URL) and is skipped by the unit run.
 */
describe.skipIf(!REDIS_URL || !DATABASE_URL)(
  "Shutdown against Redis and PostgreSQL",
  { timeout: 30_000 },
  () => {
    const saved = { JOB_WORKER: process.env["JOB_WORKER"], LOG_LEVEL: process.env["LOG_LEVEL"] };

    beforeEach(() => {
      process.env["LOG_LEVEL"] = "error";
    });

    afterEach(() => {
      vi.restoreAllMocks();
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });

    it("the worker closes every connection, its job queues before the database", async () => {
      const baseline = openTcpHandles();
      const jobsShutdown = vi.spyOn(JobQueue.prototype, "onApplicationShutdown");
      const databaseShutdown = vi.spyOn(PrismaService.prototype, "onApplicationShutdown");
      process.env["JOB_WORKER"] = "true"; // as worker.ts sets it
      const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
      expect(openTcpHandles()).toBeGreaterThan(baseline);

      await app.close();

      expect(await openTcpHandlesWhenSettled(baseline)).toBe(baseline);
      // BullMQ waits for the active jobs, which still need the database, so the queues close first.
      expect(jobsShutdown).toHaveBeenCalledBefore(databaseShutdown);
    });

    it("the API serves a request in flight before closing the database, then closes everything", async () => {
      const baseline = openTcpHandles();
      delete process.env["JOB_WORKER"];
      const app = await NestFactory.create<NestExpressApplication>(AppModule, {
        logger: false,
        rawBody: true,
      });
      configureHttp(app);
      await app.listen(0, "127.0.0.1");
      const finishRequest = await startRequestInFlight(app.getHttpServer());

      const closing = app.close();
      await delay(300); // the shutdown goes as far as it can while the request waits for its body
      expect(await finishRequest()).toBe("HTTP/1.1 200 OK");
      await closing;

      // Had the database disconnected before the server drained, Prisma would have reconnected for this
      // request and left that pool open, holding the process just as the Redis client did.
      expect(await openTcpHandlesWhenSettled(baseline)).toBe(baseline);
    });
  },
);
