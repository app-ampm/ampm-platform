import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

describe("Configuration (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Reset the rows the tests edited back to the seed baselines.
    await prisma.configuration.updateMany({
      where: { configKey: "feature.flags" },
      data: { valueJson: {} },
    });
    await prisma.configuration.updateMany({
      where: { configKey: "notification.default_channels" },
      data: { valueJson: { inApp: true, email: true, sms: false, whatsapp: false, push: false } },
    });
    await app.close();
  });

  const put = (bearer: string, key: string, value: unknown) =>
    request(app.getHttpServer())
      .put(`/admin/configurations/${key}`)
      .set("authorization", `Bearer ${bearer}`)
      .send({ value });

  const get = (bearer: string, key: string) =>
    request(app.getHttpServer())
      .get(`/admin/configurations/${key}`)
      .set("authorization", `Bearer ${bearer}`);

  it("lets a Super Admin write a value, persists it, and audits the change", async () => {
    const token = await mint("local:admin");
    const response = await put(token, "feature.flags", { beta: true }).expect(200);
    expect(response.body.data).toEqual({ key: "feature.flags", value: { beta: true } });

    const row = await prisma.configuration.findUnique({ where: { configKey: "feature.flags" } });
    expect(row?.valueJson).toEqual({ beta: true });

    const audit = await prisma.auditEvent.findFirst({
      where: { entityType: "configuration" },
      orderBy: { occurredAt: "desc" },
    });
    expect(audit?.actorType).toBe("user");
    expect(audit?.action === "create" || audit?.action === "update").toBe(true);
  });

  it("audits the create path (no prior row) without crashing on a null before image", async () => {
    const token = await mint("local:admin");
    await prisma.configuration.deleteMany({ where: { configKey: "feature.flags" } });
    await put(token, "feature.flags", { fresh: true }).expect(200);
    const audit = await prisma.auditEvent.findFirst({
      where: { entityType: "configuration" },
      orderBy: { occurredAt: "desc" },
    });
    expect(audit?.action).toBe("create");
    expect(audit?.beforeJson).toBeNull();
  });

  it("does not mask a config field named like PII (the email channel toggle)", async () => {
    const token = await mint("local:admin");
    const channels = { inApp: true, email: true, sms: false, whatsapp: false, push: false };
    await put(token, "notification.default_channels", channels).expect(200);
    const audit = await prisma.auditEvent.findFirst({
      where: { entityType: "configuration" },
      orderBy: { occurredAt: "desc" },
    });
    expect(audit?.afterJson).toEqual(channels); // "email" is preserved, not "[redacted]"
  });

  it("refuses a non-Super-Admin (denial is absence)", async () => {
    const token = await mint("local:pm");
    await put(token, "feature.flags", { beta: false }).expect(404);
  });

  it("rejects a value that does not match the key's schema with a 400 naming the field", async () => {
    const token = await mint("local:admin");
    const response = await put(token, "session.idle_timeouts", { staffMinutes: "soon" }).expect(
      400,
    );
    expect(response.body.error.code).toBe("validation_failed");
    expect(JSON.stringify(response.body.error.details)).toContain("value");
  });

  it("refuses an unknown configuration key", async () => {
    const token = await mint("local:admin");
    await put(token, "nope.not_a_key", {}).expect(404);
  });

  it("lets a Super Admin read a configuration value", async () => {
    const token = await mint("local:admin");
    const response = await get(token, "notification.templates").expect(200);
    expect(response.body.data.key).toBe("notification.templates");
    expect(response.body.data.value["staff.invite"].email.subject).toBe("Your AMPM invitation");
  });

  it("lets Finance read a configuration value but refuses a write with 403, not 404", async () => {
    const token = await mint("local:fa");
    // Finance holds admin.configurations.read (matrix §5.1), so it reads any key ...
    await get(token, "notification.templates").expect(200);
    // ... but not admin.configurations.update. Because Finance MAY see configuration, the refused
    // write is 403 (forbidden on a visible resource), not the 404 absence a principal without the
    // read key gets (the Project Manager above) — the guard's denial split (refusalFor, AC-12.1).
    await put(token, "feature.flags", { beta: true }).expect(403);
  });

  it("refuses a non-Super-Admin read (denial is absence)", async () => {
    const token = await mint("local:pm");
    await get(token, "notification.templates").expect(404);
  });

  it("refuses an unknown configuration key on read", async () => {
    const token = await mint("local:admin");
    await get(token, "nope.not_a_key").expect(404);
  });
});
