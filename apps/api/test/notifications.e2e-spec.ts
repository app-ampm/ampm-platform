import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

describe("Notifications (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;
  let pmNotif: string;
  let cdNotif: string;

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    const pm = await prisma.user.findFirstOrThrow({ where: { identitySubject: "local:pm" } });
    const cd = await prisma.user.findFirstOrThrow({ where: { identitySubject: "local:cd" } });
    const pmRow = await prisma.notification.create({
      data: {
        recipientType: "user",
        recipientId: pm.id,
        channel: "in_app",
        templateKey: "e2e.pm",
        status: "delivered",
      },
    });
    const cdRow = await prisma.notification.create({
      data: {
        recipientType: "user",
        recipientId: cd.id,
        channel: "in_app",
        templateKey: "e2e.cd",
        status: "delivered",
      },
    });
    pmNotif = pmRow.id;
    cdNotif = cdRow.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { id: { in: [pmNotif, cdNotif] } } });
    await app.close();
  });

  const as = async (subject: string): Promise<string> => `Bearer ${await mint(subject)}`;
  const ids = (body: { data: { items: { id: string }[] } }): string[] =>
    body.data.items.map((n) => n.id);

  it("needs a token", async () => {
    await request(app.getHttpServer()).get("/notifications").expect(401);
  });

  it("returns only the caller's own notifications (own scope), another's is absent", async () => {
    const pm = await request(app.getHttpServer())
      .get("/notifications")
      .set("authorization", await as("local:pm"))
      .expect(200);
    expect(ids(pm.body)).toContain(pmNotif);
    expect(ids(pm.body)).not.toContain(cdNotif);

    const cd = await request(app.getHttpServer())
      .get("/notifications")
      .set("authorization", await as("local:cd"))
      .expect(200);
    expect(ids(cd.body)).toContain(cdNotif);
    expect(ids(cd.body)).not.toContain(pmNotif);
  });

  it("lets the Super Admin read the whole user log (all scope)", async () => {
    const admin = await request(app.getHttpServer())
      .get("/notifications")
      .set("authorization", await as("local:admin"))
      .expect(200);
    expect(ids(admin.body)).toEqual(expect.arrayContaining([pmNotif, cdNotif]));
  });
});
