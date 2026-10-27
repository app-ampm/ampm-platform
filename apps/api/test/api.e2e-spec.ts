import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { type App } from "supertest/types.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../src/app.module.js";
import { LocalIdentityAdapter } from "../src/identity/local.adapter.js";

describe("API (e2e)", () => {
  let app: INestApplication<App>;
  let mint: (subject: string) => Promise<string>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    const adapter = new LocalIdentityAdapter(process.env["IDENTITY_LOCAL_SECRET"] ?? "");
    mint = (subject) => adapter.mint(subject);
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health answers without a token and names the database", async () => {
    const response = await request(app.getHttpServer()).get("/health").expect(200);
    expect(response.body.data).toMatchObject({ status: "ok", checks: { database: "ok" } });
    expect(response.headers["x-request-id"]).toMatch(/[0-9a-f-]{36}/);
  });

  it("GET /me needs a token (401 with the envelope)", async () => {
    const response = await request(app.getHttpServer()).get("/me").expect(401);
    expect(response.body).toEqual({
      error: { code: "unauthenticated", message: "Sign in to continue" },
    });
  });

  it("GET /me rejects a tampered token and an unknown account", async () => {
    const token = await mint("local:admin");
    await request(app.getHttpServer())
      .get("/me")
      .set("authorization", `Bearer ${token}tampered`)
      .expect(401);
    await request(app.getHttpServer())
      .get("/me")
      .set("authorization", `Bearer ${await mint("local:nobody")}`)
      .expect(401);
    const disabled = await request(app.getHttpServer())
      .get("/me")
      .set("authorization", `Bearer ${await mint("local:disabled")}`)
      .expect(401);
    expect(disabled.body.error.code).toBe("unauthenticated");
  });

  it("GET /me returns the Super Admin with her role and no entitlements", async () => {
    const response = await request(app.getHttpServer())
      .get("/me")
      .set("authorization", `Bearer ${await mint("local:admin")}`)
      .expect(200);
    expect(response.body.data).toMatchObject({
      principal: {
        type: "staff",
        name: "Asha Admin",
        email: "admin@example.com",
        status: "active",
      },
      roles: ["SA"],
      memberships: [],
      entitlements: { modules: [] },
      isDemo: false,
    });
    expect(JSON.stringify(response.body)).not.toMatch(/identitySubject|password|token_hash/);
  });

  it("GET /me returns the client representative with her membership and entitlements", async () => {
    const response = await request(app.getHttpServer())
      .get("/me")
      .set("authorization", `Bearer ${await mint("local:client")}`)
      .expect(200);
    expect(response.body.data.principal.type).toBe("client");
    expect(response.body.data.memberships[0]).toMatchObject({
      projectRole: "client_representative",
      clientSide: "bride",
      canApprove: true,
    });
    expect(response.body.data.entitlements.modules).toContain("wedding_workspace");
  });

  it("keeps a caller's request id", async () => {
    const response = await request(app.getHttpServer())
      .get("/health")
      .set("x-request-id", "trace-abc-123")
      .expect(200);
    expect(response.headers["x-request-id"]).toBe("trace-abc-123");
  });
});
