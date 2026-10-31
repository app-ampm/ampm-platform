import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const EMAIL = "perm-set-e2e@example.com";
const SUBJECT = "local:perm-set-e2e";

/**
 * The Super-Admin permission-set surface end to end (D-036, slice 6b): a set's capabilities reach a
 * custom role's holder through the attach, and attach/detach/delete each take effect on the next
 * request. The e2e env sets DYNAMIC_ROLES=true.
 */
describe("Permission sets (e2e)", () => {
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
    const sets = await prisma.permissionSet.findMany({
      where: { setKey: { startsWith: "custom_" } },
      select: { id: true },
    });
    for (const set of sets) {
      await prisma.rolePermissionSet.deleteMany({ where: { permissionSetId: set.id } });
      await prisma.permissionSetGrant.deleteMany({ where: { permissionSetId: set.id } });
      await prisma.permissionSet.delete({ where: { id: set.id } });
    }
    const roles = await prisma.role.findMany({
      where: { roleKey: { startsWith: "custom_" } },
      select: { id: true },
    });
    for (const role of roles) {
      await prisma.userRole.deleteMany({ where: { roleId: role.id } });
      await prisma.rolePermissionSet.deleteMany({ where: { roleId: role.id } });
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
        name: "Sam Set",
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
  const holderPutsConfig = (value: unknown) =>
    mint(SUBJECT).then((token) =>
      http()
        .put("/admin/configurations/feature.flags")
        .set("authorization", `Bearer ${token}`)
        .send({ value }),
    );

  it("delivers a set's capabilities to a role holder, through attach, detach and delete", async () => {
    const admin = await sa();

    // A set that grants config editing, and an empty custom role.
    const set = await http()
      .post("/admin/permission-sets")
      .set("authorization", admin)
      .send({
        name: "Config editors",
        description: "Edit configuration",
        capabilityIds: ["admin.configurations.update:all"],
      })
      .expect(201);
    const setId: string = set.body.data.id;
    expect(set.body.data.capabilities.map((c: { id: string }) => c.id)).toEqual([
      "admin.configurations.update:all",
    ]);

    const role = await http()
      .post("/admin/roles")
      .set("authorization", admin)
      .send({ name: "Via set", capabilityIds: [] })
      .expect(201);
    const roleId: string = role.body.data.id;

    const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
    await http()
      .post(`/admin/users/${user.id}/roles`)
      .set("authorization", admin)
      .send({ roleId })
      .expect(201);

    // The empty role grants nothing yet.
    await holderPutsConfig({ before: true }).then((res) => expect(res.status).toBe(404));

    // Attaching the set delivers its capability to the holder on the next request.
    await http()
      .post(`/admin/roles/${roleId}/permission-sets`)
      .set("authorization", admin)
      .send({ setId })
      .expect(201);
    await holderPutsConfig({ viaSet: true }).then((res) => expect(res.status).toBe(200));

    // Detaching withdraws it.
    await http()
      .delete(`/admin/roles/${roleId}/permission-sets/${setId}`)
      .set("authorization", admin)
      .expect(200);
    await holderPutsConfig({ detached: true }).then((res) => expect(res.status).toBe(404));

    // Re-attach, then delete the set: a soft-deleted set grants nothing.
    await http()
      .post(`/admin/roles/${roleId}/permission-sets`)
      .set("authorization", admin)
      .send({ setId })
      .expect(201);
    await holderPutsConfig({ reattached: true }).then((res) => expect(res.status).toBe(200));
    await http().delete(`/admin/permission-sets/${setId}`).set("authorization", admin).expect(200);
    await holderPutsConfig({ afterDelete: true }).then((res) => expect(res.status).toBe(404));
  });

  it("holds the guardrails: non-SA, escalation-locked, and system-role attach", async () => {
    const admin = await sa();

    // A non-SA staff member may read sets (admin.roles.read) but not create one: 403, not absence.
    await http()
      .post("/admin/permission-sets")
      .set("authorization", `Bearer ${await mint("local:pm")}`)
      .send({ name: "x", capabilityIds: [] })
      .expect(403);
    // A client cannot see the surface at all: 404.
    await http()
      .post("/admin/permission-sets")
      .set("authorization", `Bearer ${await mint("local:client")}`)
      .send({ name: "x", capabilityIds: [] })
      .expect(404);

    // A set cannot hold an escalation-locked capability.
    await http()
      .post("/admin/permission-sets")
      .set("authorization", admin)
      .send({ name: "Escalator", capabilityIds: ["admin.roles.update:all"] })
      .expect(403);

    // A set attaches only to a custom role, never a system one.
    const set = await http()
      .post("/admin/permission-sets")
      .set("authorization", admin)
      .send({ name: "Attachable", capabilityIds: [] })
      .expect(201);
    const system = await prisma.role.findFirstOrThrow({ where: { roleKey: "super_admin" } });
    await http()
      .post(`/admin/roles/${system.id}/permission-sets`)
      .set("authorization", admin)
      .send({ setId: set.body.data.id })
      .expect(409);
  });
});
