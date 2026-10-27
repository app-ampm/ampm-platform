import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startApi } from "./start-api.js";

const PROJECT = "0192f3a0-7d3e-7b1a-9c2f-aaaaaaaaaaaa";
const NOTES = `/spike/projects/${PROJECT}/field-notes`;

/** What every request meets before any guard: the request id, the body parser, the headers. */
describe("the HTTP edge (e2e)", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    ({ app } = await startApi());
  });

  afterAll(async () => {
    await app.close();
  });

  it("refuses an oversized body before any guard, as payload_too_large", async () => {
    const response = await request(app.getHttpServer())
      .post(NOTES)
      .set("content-type", "application/json")
      .send(JSON.stringify({ body: "x".repeat(200 * 1024) }))
      .expect(413);
    expect(response.body).toEqual({
      error: { code: "payload_too_large", message: "Request body too large" },
    });
  });

  it("answers a malformed JSON body as validation_failed", async () => {
    // Nest turns the parser's SyntaxError into a BadRequestException carrying the parser's message.
    const response = await request(app.getHttpServer())
      .post(NOTES)
      .set("content-type", "application/json")
      .send('{"body": ')
      .expect(400);
    expect(response.body.error.code).toBe("validation_failed");
  });

  it("does not name the framework in its headers", async () => {
    const response = await request(app.getHttpServer()).get("/health").expect(200);
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("keeps a caller's request id", async () => {
    const response = await request(app.getHttpServer())
      .get("/health")
      .set("x-request-id", "trace-abc-123")
      .expect(200);
    expect(response.headers["x-request-id"]).toBe("trace-abc-123");
  });
});
