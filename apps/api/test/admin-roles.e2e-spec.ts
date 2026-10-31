import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const EMAIL = "role-admin-e2e@example.com";
const SUBJECT = "local:role-admin-e2e";

/**
 * The Super-Admin role administration surface end to end (D-036, slice 6a): create a custom role from
 * the catalog, assign it, the holder enforces exactly it, and the guardrails hold. The e2e env sets
 * DYNAMIC_ROLES=true.
 */
describe("Admin roles (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;

  async function removeFixtures(): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    if (user) {
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.userRole.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    const roles = await prisma.role.findMany({
      where: { roleKey: { startsWith: "custom_" } },
      select: { id: true },
    });
    for (const role of roles) {
      await prisma.userRole.deleteMany({ where: { roleId: role.id } });
      await prisma.roleGrant.deleteMany({ where: { roleId: role.id } });
      await prisma.role.delete({ where: { id: role.id } });
    }
  }

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    await prisma.user.create({
      data: {
        userType: "staff",
        name: "Rhea Role",
        email: EMAIL,
        status: "active",
        identitySubject: SUBJECT,
      },
    });
  });

  afterAll(async () => {
    await removeFixtures();
    await prisma.configuration.updateMany({
      where: { configKey: "feature.flags" },
      data: { valueJson: {} },
    });
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const sa = async () => `Bearer ${await mint("local:admin")}`;

  it("creates a custom role, assigns it, and the holder enforces exactly it", async () => {
    const admin = await sa();

    const created = await http()
      .post("/admin/roles")
      .set("authorization", admin)
      .send({ name: "Config editor", capabilityIds: ["admin.configurations.update:all"] })
      .expect(201);
    const roleId: string = created.body.data.id;
    expect(created.body.data.capabilities.map((c: { id: string }) => c.id)).toEqual([
      "admin.configurations.update:all",
    ]);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
    await http()
      .post(`/admin/users/${user.id}/roles`)
      .set("authorization", admin)
      .send({ roleId })
      .expect(201);

    // The holder (no system role) can now write config, and nothing else.
    const holder = `Bearer ${await mint(SUBJECT)}`;
    await http()
      .put("/admin/configurations/feature.flags")
      .set("authorization", holder)
      .send({ value: { byCustomRole: true } })
      .expect(200);
    await http()
      .get("/spike/projects/0192f3a0-7d3e-7b1a-9c2f-0000000000ff/field-notes")
      .set("authorization", holder)
      .expect(404);

    // Deleting the role removes the capability on the holder's next request.
    await http().delete(`/admin/roles/${roleId}`).set("authorization", admin).expect(200);
    await http()
      .put("/admin/configurations/feature.flags")
      .set("authorization", `Bearer ${await mint(SUBJECT)}`)
      .send({ value: { x: 1 } })
      .expect(404);
  });

  it("holds the guardrails: non-SA, escalation-locked, and system roles", async () => {
    const admin = await sa();

    // Both halves of "denial is absence". A staff role that may read the role catalogue
    // (admin.roles.read reaches every staff role) but not create one can see the surface, so the
    // refusal is a 403, not a 404.
    await http()
      .post("/admin/roles")
      .set("authorization", `Bearer ${await mint("local:pm")}`)
      .send({ name: "x", capabilityIds: [] })
      .expect(403);

    // A principal that cannot see roles at all (a client is not staff) gets the 404 of a missing
    // route: denial equals absence.
    await http()
      .post("/admin/roles")
      .set("authorization", `Bearer ${await mint("local:client")}`)
      .send({ name: "x", capabilityIds: [] })
      .expect(404);

    // An escalation-locked capability cannot be granted to a custom role.
    await http()
      .post("/admin/roles")
      .set("authorization", admin)
      .send({ name: "Escalator", capabilityIds: ["admin.roles.update:all"] })
      .expect(403);

    // A system role cannot be edited.
    const system = await prisma.role.findFirstOrThrow({ where: { roleKey: "super_admin" } });
    await http()
      .patch(`/admin/roles/${system.id}`)
      .set("authorization", admin)
      .send({ name: "Renamed" })
      .expect(409);

    // The escalation-lock also holds on the update path: a custom role cannot be patched into one.
    const made = await http()
      .post("/admin/roles")
      .set("authorization", admin)
      .send({ name: "To escalate", capabilityIds: ["admin.configurations.update:all"] })
      .expect(201);
    await http()
      .patch(`/admin/roles/${made.body.data.id}`)
      .set("authorization", admin)
      .send({ capabilityIds: ["admin.roles.update:all"] })
      .expect(403);
  });
});
