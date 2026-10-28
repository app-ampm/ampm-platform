import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const DOMAIN = "@staff-e2e.example";
const DISABLE_SUBJECT = "local:staff-disable-e2e";

/**
 * Staff-user administration end to end (Module A, feature 5.1): the Super Admin creates, reads,
 * updates, disables and soft-deletes staff; reads are open to every staff role; disabling ends the
 * user's access on the next request.
 */
describe("Staff users (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;

  async function removeFixtures(): Promise<void> {
    const users = await prisma.user.findMany({
      where: { email: { endsWith: DOMAIN } },
      select: { id: true },
    });
    for (const user of users) {
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.userRole.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  }

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const sa = async () => `Bearer ${await mint("local:admin")}`;

  it("creates, reads, updates, and disables a staff user, with the guardrails", async () => {
    const admin = await sa();
    const email = `created-staff${DOMAIN}`;

    // SA creates → invited.
    const created = await http()
      .post("/admin/staff-users")
      .set("authorization", admin)
      .send({ name: "Nina New", email })
      .expect(201);
    const id: string = created.body.data.id;
    expect(created.body.data.status).toBe("invited");
    // The view never carries the identity subject or any token (both RESTRICTED).
    expect(created.body.data).not.toHaveProperty("identitySubject");

    // A non-SA staff member may read but not create; a client cannot see the surface.
    await http()
      .post("/admin/staff-users")
      .set("authorization", `Bearer ${await mint("local:pm")}`)
      .send({ name: "x", email: `pm-made${DOMAIN}` })
      .expect(403);
    await http()
      .post("/admin/staff-users")
      .set("authorization", `Bearer ${await mint("local:client")}`)
      .send({ name: "x", email: `client-made${DOMAIN}` })
      .expect(404);

    // Reads are open to every staff role.
    const asPm = `Bearer ${await mint("local:pm")}`;
    const list = await http().get("/admin/staff-users").set("authorization", asPm).expect(200);
    expect((list.body.data.items as { email: string }[]).some((u) => u.email === email)).toBe(true);

    // Duplicate email → 409.
    await http()
      .post("/admin/staff-users")
      .set("authorization", admin)
      .send({ name: "Dup", email })
      .expect(409);

    // Update, then an illegal status move, then a legal disable.
    await http()
      .patch(`/admin/staff-users/${id}`)
      .set("authorization", admin)
      .send({ name: "Nina Renamed" })
      .expect(200);
    await http()
      .patch(`/admin/staff-users/${id}/status`)
      .set("authorization", admin)
      .send({ status: "active" })
      .expect(409);
    await http()
      .patch(`/admin/staff-users/${id}/status`)
      .set("authorization", admin)
      .send({ status: "disabled" })
      .expect(200);

    // Soft-delete removes it from the surface.
    await http().delete(`/admin/staff-users/${id}`).set("authorization", admin).expect(200);
    await http().get(`/admin/staff-users/${id}`).set("authorization", admin).expect(404);
  });

  it("ends a user's access when they are disabled", async () => {
    const admin = await sa();
    const user = await prisma.user.create({
      data: {
        userType: "staff",
        name: "Della Disable",
        email: `disable-staff${DOMAIN}`,
        status: "active",
        identitySubject: DISABLE_SUBJECT,
      },
    });
    const token = `Bearer ${await mint(DISABLE_SUBJECT)}`;

    // The active user can call the API (this also creates their session).
    await http().get("/me").set("authorization", token).expect(200);

    // Disabling them ends that access on the next request.
    await http()
      .patch(`/admin/staff-users/${user.id}/status`)
      .set("authorization", admin)
      .send({ status: "disabled" })
      .expect(200);
    // Revocation actually happened (not only the status re-check): the session row is revoked.
    const sessions = await prisma.session.findMany({ where: { userId: user.id } });
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);
    await http().get("/me").set("authorization", token).expect(401);
  });

  it("locks out a soft-deleted user", async () => {
    const admin = await sa();
    const subject = "local:staff-delete-e2e";
    const user = await prisma.user.create({
      data: {
        userType: "staff",
        name: "Derek Delete",
        email: `delete-staff${DOMAIN}`,
        status: "active",
        identitySubject: subject,
      },
    });
    const token = `Bearer ${await mint(subject)}`;
    await http().get("/me").set("authorization", token).expect(200);

    await http().delete(`/admin/staff-users/${user.id}`).set("authorization", admin).expect(200);
    // The deletedAt filter in principal resolution (plus revocation) ends their access.
    await http().get("/me").set("authorization", token).expect(401);
  });
});
