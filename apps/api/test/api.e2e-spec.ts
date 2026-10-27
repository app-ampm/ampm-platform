import { errors } from "@ampm/core";
import { STAFF_ROLES } from "@ampm/policy";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const PROJECT = "0192f3a0-7d3e-7b1a-9c2f-aaaaaaaaaaaa";
// The seeded wedding (prisma/seed.ts): the project manager and the client are its members.
const SEEDED_PROJECT = "0192f3a0-7d3e-7b1a-9c2f-0000000000a1";

describe("API (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;

  beforeAll(async () => {
    ({ app, mint } = await startApi());
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

  it("stops granting a role once the role is soft-deleted", async () => {
    const prisma = app.get(PrismaService);
    const token = await mint("local:pm");
    const before = await request(app.getHttpServer())
      .get("/me")
      .set("authorization", `Bearer ${token}`)
      .expect(200);
    expect(before.body.data.roles).toEqual(["PM"]);
    const roleKey = STAFF_ROLES.PM.key;
    await prisma.role.update({ where: { roleKey }, data: { deletedAt: new Date() } });
    try {
      const after = await request(app.getHttpServer())
        .get("/me")
        .set("authorization", `Bearer ${token}`)
        .expect(200);
      expect(after.body.data.roles).toEqual([]);
    } finally {
      await prisma.role.update({ where: { roleKey }, data: { deletedAt: null } });
    }
  });

  describe("a guarded route (test-cases.md, denial semantics)", () => {
    const notes = (projectId: string) => `/spike/projects/${projectId}/field-notes`;
    const as = async (subject: string) => `Bearer ${await mint(subject)}`;

    it("lets SA read any wedding and PM (a) read its own", async () => {
      for (const subject of ["local:admin", "local:pm"]) {
        const response = await request(app.getHttpServer())
          .get(notes(SEEDED_PROJECT))
          .set("authorization", await as(subject))
          .expect(200);
        expect(response.body.data).toEqual({ items: [], nextCursor: null });
      }
    });

    it("AC-12.2: answers PM (other) and a client with the 404 of a missing record", async () => {
      const missing = errors.notFound().toEnvelope();
      const other = await request(app.getHttpServer())
        .get(notes(PROJECT))
        .set("authorization", await as("local:pm"))
        .expect(404);
      expect(other.body).toEqual(missing);
      await request(app.getHttpServer())
        .post(notes(PROJECT))
        .set("authorization", await as("local:pm"))
        .send({})
        .expect(404);
      const client = await request(app.getHttpServer())
        .get(notes(SEEDED_PROJECT))
        .set("authorization", await as("local:client"))
        .expect(404);
      expect(client.body).toEqual(missing);
    });

    it("answers a malformed project id as validation_failed naming the field", async () => {
      const response = await request(app.getHttpServer())
        .get(notes("not-a-uuid"))
        .set("authorization", await as("local:admin"))
        .expect(400);
      expect(response.body.error.code).toBe("validation_failed");
      expect(JSON.stringify(response.body.error.details)).toContain("projectId");
    });

    it("§5.13 line 296: CD (a), create-only on incidents, adds notes but changing one is a 403", async () => {
      const post = async (subject: string, id: string, baseVersion: number, body: string) =>
        request(app.getHttpServer())
          .post(notes(SEEDED_PROJECT))
          .set("authorization", await as(subject))
          .send({ id, baseVersion, body, status: "open", clientTimestamp: "2026-10-27T05:00:00Z" });
      const pmNote = "0192f3a0-7d3e-7b1a-9c2f-00000000a1a1";
      expect((await post("local:pm", pmNote, 0, "Stage lights flicker")).status).toBe(201);
      const changed = await post("local:cd", pmNote, 1, "Replaced by the creative");
      expect(changed.status).toBe(403);
      expect(changed.body).toEqual(errors.forbidden().toEnvelope());
      // PM (a) holds the update key (CRUA (a)); the creative's own new note is a create.
      const edited = await post("local:pm", pmNote, 1, "Electrician on the way");
      expect(edited.body.data).toMatchObject({ outcome: "applied", note: { version: 2 } });
      const created = await post("local:cd", "0192f3a0-7d3e-7b1a-9c2f-00000000a1a2", 0, "Florist");
      expect(created.body.data.outcome).toBe("applied");
    });
  });
});
