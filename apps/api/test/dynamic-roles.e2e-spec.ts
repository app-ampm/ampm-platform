import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const ROLE_KEY = "custom_cfg_editor_e2e";
const EMAIL = "custom-cfg-e2e@example.com";
const SUBJECT = "local:custom-cfg-e2e";
const CAPABILITY_KEY = "admin.configurations.update:all";

/**
 * The custom-role path end to end (D-036): a role that is not one of the nine, granted a single
 * catalog capability, lets its holder perform exactly that action and nothing else — through the DB
 * (role_grants), the principal resolver, resolveCustomGrants and the engine. The e2e env sets
 * DYNAMIC_ROLES=true; with it off the unit test proves the same role grants nothing.
 */
describe("Dynamic roles (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;

  /** Remove the fixtures, sessions and grants first — self-healing if a prior run left them behind. */
  async function removeFixtures(): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    if (user) {
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.userRole.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    const role = await prisma.role.findUnique({ where: { roleKey: ROLE_KEY } });
    if (role) {
      await prisma.roleGrant.deleteMany({ where: { roleId: role.id } });
      await prisma.rolePermissionSet.deleteMany({ where: { roleId: role.id } });
      await prisma.userRole.deleteMany({ where: { roleId: role.id } });
      await prisma.role.delete({ where: { id: role.id } });
    }
  }

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    const capability = await prisma.grantableCapability.findUniqueOrThrow({
      where: { capabilityKey: CAPABILITY_KEY },
    });
    const role = await prisma.role.create({
      data: { roleKey: ROLE_KEY, name: "Custom config editor", isSystem: false },
    });
    await prisma.roleGrant.create({
      data: { roleId: role.id, grantableCapabilityId: capability.id },
    });
    const user = await prisma.user.create({
      data: {
        userType: "staff",
        name: "Cyra Custom",
        email: EMAIL,
        status: "active",
        identitySubject: SUBJECT,
      },
    });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  });

  afterAll(async () => {
    await removeFixtures();
    await prisma.configuration.updateMany({
      where: { configKey: "feature.flags" },
      data: { valueJson: {} },
    });
    await app.close();
  });

  it("enforces exactly the capability a custom role was granted, and nothing more", async () => {
    const bearer = `Bearer ${await mint(SUBJECT)}`;

    // The custom role alone (no system role) grants the configuration write.
    await request(app.getHttpServer())
      .put("/admin/configurations/feature.flags")
      .set("authorization", bearer)
      .send({ value: { customRole: true } })
      .expect(200);

    // It was granted nothing else: a route whose capability it lacks is absent (denial = absence).
    await request(app.getHttpServer())
      .get("/spike/projects/0192f3a0-7d3e-7b1a-9c2f-0000000000ff/field-notes")
      .set("authorization", bearer)
      .expect(404);
  });
});
