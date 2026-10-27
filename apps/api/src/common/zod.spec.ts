import { Controller, Get, Post, type INestApplication } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { type App } from "supertest/types.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z, ZodError } from "zod";

import { AppErrorFilter } from "./app-error.filter.js";
import { AppLogger } from "./logger.service.js";
import { ZodBody, ZodParams, ZodQuery, ZodValidationPipe } from "./zod.js";

const params = z.object({ id: z.uuid() });
const query = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) });
const body = z.object({ title: z.string().min(1), tags: z.array(z.string()).default([]) });

const ID = "0192f3a0-7d3e-7b1a-9c2f-000000000001";

/** A handler per decorator; what it returns is exactly what the decorators handed it. */
@Controller("probe")
class ProbeController {
  @Get(":id")
  read(@ZodParams(params) p: z.infer<typeof params>, @ZodQuery(query) q: z.infer<typeof query>) {
    return { id: p.id, limit: q.limit };
  }

  @Post(":id")
  write(@ZodParams(params) p: z.infer<typeof params>, @ZodBody(body) b: z.infer<typeof body>) {
    return { id: p.id, ...b };
  }
}

const silentLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

describe("Zod decorators (validate at the edge)", () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
      providers: [
        { provide: AppLogger, useValue: silentLogger },
        { provide: APP_FILTER, useClass: AppErrorFilter },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("the pipe parses and coerces, and throws the ZodError on a bad value", () => {
    const pipe = new ZodValidationPipe(query);
    expect(pipe.transform({ limit: "5" })).toEqual({ limit: 5 });
    expect(pipe.transform({})).toEqual({ limit: 20 });
    expect(() => pipe.transform({ limit: "0" })).toThrow(ZodError);
  });

  it("hands the handler the parsed params, query and body", async () => {
    const read = await request(app.getHttpServer()).get(`/probe/${ID}?limit=5`).expect(200);
    expect(read.body).toEqual({ id: ID, limit: 5 });

    const write = await request(app.getHttpServer())
      .post(`/probe/${ID}`)
      .send({ title: "Gate 3 power is out" })
      .expect(201);
    expect(write.body).toEqual({ id: ID, title: "Gate 3 power is out", tags: [] });
  });

  it("answers a bad param or body as validation_failed with the field path", async () => {
    const badParam = await request(app.getHttpServer()).get("/probe/not-a-uuid").expect(400);
    expect(badParam.body.error.code).toBe("validation_failed");
    expect(badParam.body.error.details).toEqual([expect.objectContaining({ path: "id" })]);

    const badBody = await request(app.getHttpServer())
      .post(`/probe/${ID}`)
      .send({ title: "" })
      .expect(400);
    expect(badBody.body.error.code).toBe("validation_failed");
    expect(badBody.body.error.details).toEqual([expect.objectContaining({ path: "title" })]);
  });
});
