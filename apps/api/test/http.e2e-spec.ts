import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AppLogger } from "../src/common/logger.service.js";
import { requestContext } from "../src/common/request-context.js";
import { startApi } from "./start-api.js";

const PROJECT = "0192f3a0-7d3e-7b1a-9c2f-aaaaaaaaaaaa";
const NOTES = `/spike/projects/${PROJECT}/field-notes`;
const OVERSIZED = JSON.stringify({ body: "x".repeat(200 * 1024) });
// The seeded wedding (prisma/seed.ts), of which the project manager is a member.
const SEEDED_NOTES = "/spike/projects/0192f3a0-7d3e-7b1a-9c2f-0000000000a1/field-notes";
const JSON_TYPE = "application/json";
const MALFORMED = { code: "validation_failed", message: "Malformed request body" };
const PARSER_REFUSALS = [
  {
    refusal: "a truncated body",
    type: JSON_TYPE,
    body: '{"body": ',
    status: 400,
    error: MALFORMED,
  },
  {
    refusal: "a bare string",
    type: JSON_TYPE,
    body: '"just a string"',
    status: 400,
    error: MALFORMED,
  },
  {
    refusal: "a charset the API does not read",
    type: `${JSON_TYPE}; charset=iso-8859-1`,
    body: "{}",
    status: 415,
    error: { code: "unsupported_media_type", message: "Unsupported media type" },
  },
];

/** What every request meets before any guard: the request id, the body parser, the headers. */
describe("the HTTP edge (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;

  beforeAll(async () => {
    ({ app, mint } = await startApi());
  });

  afterAll(async () => {
    await app.close();
  });

  it("refuses an oversized body before any guard, as payload_too_large", async () => {
    const response = await request(app.getHttpServer())
      .post(NOTES)
      .set("content-type", "application/json")
      .send(OVERSIZED)
      .expect(413);
    expect(response.body).toEqual({
      error: { code: "payload_too_large", message: "Request body too large" },
    });
  });

  // The parser's own text describes the parser, and V8's quotes the body ('"just a string"').
  it.each(PARSER_REFUSALS)(
    "answers $refusal with the parser's fixed wording only",
    async ({ type, body, status, error }) => {
      const response = await request(app.getHttpServer())
        .post(NOTES)
        .set("content-type", type)
        .send(body)
        .expect(status);
      expect(response.body).toEqual({ error });
    },
  );

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

  it("api.md, structured logging with a request id: a parser refusal carries the caller's", async () => {
    const logged: (string | undefined)[] = [];
    const info = vi.spyOn(app.get(AppLogger), "info").mockImplementation((event: string) => {
      if (event === "request.rejected") logged.push(requestContext.requestId());
    });
    try {
      const malformed = await request(app.getHttpServer())
        .post(NOTES)
        .set("content-type", "application/json")
        .set("x-request-id", "trace-malformed-01")
        .send('{"body": ')
        .expect(400);
      const oversized = await request(app.getHttpServer())
        .post(NOTES)
        .set("content-type", "application/json")
        .set("x-request-id", "trace-oversized-01")
        .send(OVERSIZED)
        .expect(413);
      expect(malformed.headers["x-request-id"]).toBe("trace-malformed-01");
      expect(oversized.headers["x-request-id"]).toBe("trace-oversized-01");
      expect(logged).toEqual(["trace-malformed-01", "trace-oversized-01"]);
    } finally {
      info.mockRestore();
    }
  });

  it("keeps the request context through a body read in many chunks, up to the guards", async () => {
    // Close to the limit, so the parser reads it in several chunks; the schema drops the padding.
    const note = {
      id: "0192f3a0-7d3e-7b1a-9c2f-00000000e2e1",
      baseVersion: 0,
      body: "Generator at the mandap is down",
      status: "open",
      clientTimestamp: "2026-10-27T05:00:00.000Z",
      padding: "x".repeat(90 * 1024),
    };
    const response = await request(app.getHttpServer())
      .post(SEEDED_NOTES)
      .set("authorization", `Bearer ${await mint("local:pm")}`)
      .send(note)
      .expect(201);
    expect(response.body.data.outcome).toBe("applied");
  });

  it("creates the request context once per request, with the id the response carries", async () => {
    const run = vi.spyOn(requestContext, "run");
    try {
      const response = await request(app.getHttpServer()).get("/health").expect(200);
      expect(run).toHaveBeenCalledTimes(1);
      expect(run.mock.calls[0]?.[0].requestId).toBe(response.headers["x-request-id"]);
    } finally {
      run.mockRestore();
    }
  });
});
