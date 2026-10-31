import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const DOMAIN = "@client-login-e2e.example";
// The seeded wedding PM is a member of (prisma/seed.ts SEED.projectId); it already has a bride rep.
const SEED_PROJECT = "0192f3a0-7d3e-7b1a-9c2f-0000000000a1";
const PROJECT_A = "0192f3a0-7d3e-7b1a-9c2f-0000000000f1";
const PROJECT_B = "0192f3a0-7d3e-7b1a-9c2f-0000000000f2";
const PROJECT_C = "0192f3a0-7d3e-7b1a-9c2f-0000000000f3";

/**
 * Client-login administration end to end (Module A, feature 5.3): SA manages any wedding's logins,
 * PM only their own; the Q5 cap (two per wedding, one per side) holds; delete is SA-only. The e2e env
 * sets DYNAMIC_ROLES=true.
 */
describe("Client logins (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;

  async function removeFixtures(): Promise<void> {
    const users = await prisma.user.findMany({
      where: { email: { endsWith: DOMAIN } },
      select: { id: true },
    });
    for (const user of users) {
      await prisma.authToken.deleteMany({ where: { userId: user.id } });
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.projectMember.deleteMany({ where: { userId: user.id } });
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
  const body = (email: string, clientSide: "bride" | "groom") => ({
    name: `Rep ${email}`,
    email,
    clientSide,
  });

  it("creates, lists, updates and deletes client logins, holding the Q5 cap", async () => {
    const admin = await sa();
    const url = `/admin/projects/${PROJECT_A}/client-logins`;

    const bride = await http()
      .post(url)
      .set("authorization", admin)
      .send(body(`bride${DOMAIN}`, "bride"))
      .expect(201);
    expect(bride.body.data.clientSide).toBe("bride");
    expect(bride.body.data.userStatus).toBe("invited");
    expect(bride.body.data).not.toHaveProperty("identitySubject");
    const brideUserId: string = bride.body.data.userId;

    // Same side → 409; the groom side is free → 201; a third → 409 (cap).
    await http()
      .post(url)
      .set("authorization", admin)
      .send(body(`bride2${DOMAIN}`, "bride"))
      .expect(409);
    await http()
      .post(url)
      .set("authorization", admin)
      .send(body(`groom${DOMAIN}`, "groom"))
      .expect(201);
    await http()
      .post(url)
      .set("authorization", admin)
      .send(body(`third${DOMAIN}`, "bride"))
      .expect(409);

    const list = await http().get(url).set("authorization", admin).expect(200);
    expect(list.body.data.items).toHaveLength(2);

    const patched = await http()
      .patch(`${url}/${brideUserId}`)
      .set("authorization", admin)
      .send({ canViewFinance: true })
      .expect(200);
    expect(patched.body.data.canViewFinance).toBe(true);
    const refetched = await http()
      .get(`${url}/${brideUserId}`)
      .set("authorization", admin)
      .expect(200);
    expect(refetched.body.data.canViewFinance).toBe(true);

    // The DB backstop (partial unique index) rejects a second live rep on a taken side, even if the
    // application pre-check were bypassed — the race-safety net behind the Q5 cap.
    const ghost = await prisma.user.create({
      data: { userType: "client", name: "Ghost", email: `ghost${DOMAIN}`, status: "invited" },
    });
    await expect(
      prisma.projectMember.create({
        data: {
          projectId: PROJECT_A,
          userId: ghost.id,
          projectRole: "client_representative",
          clientSide: "bride",
          status: "invited",
        },
      }),
    ).rejects.toThrow();

    // A duplicate email on a fresh wedding (cap/side both free) is still a 409.
    await http()
      .post(`/admin/projects/${PROJECT_C}/client-logins`)
      .set("authorization", admin)
      .send(body(`bride${DOMAIN}`, "bride"))
      .expect(409);

    await http().delete(`${url}/${brideUserId}`).set("authorization", admin).expect(200);
    await http().get(`${url}/${brideUserId}`).set("authorization", admin).expect(404);
  });

  it("scopes PM to their own weddings, and delete to the Super Admin", async () => {
    const pm = `Bearer ${await mint("local:pm")}`;

    // PM manages a wedding they are assigned to (the seeded project already has a bride rep).
    await http()
      .post(`/admin/projects/${SEED_PROJECT}/client-logins`)
      .set("authorization", pm)
      .send(body(`pmgroom${DOMAIN}`, "groom"))
      .expect(201);

    // A wedding PM is not a member of is absent to them (404), never 403.
    await http()
      .post(`/admin/projects/${PROJECT_B}/client-logins`)
      .set("authorization", pm)
      .send(body(`pmx${DOMAIN}`, "bride"))
      .expect(404);

    // PM may create but not delete (delete is SA-only): they can see it, so 403.
    const pmGroom = await prisma.user.findFirstOrThrow({ where: { email: `pmgroom${DOMAIN}` } });
    await http()
      .delete(`/admin/projects/${SEED_PROJECT}/client-logins/${pmGroom.id}`)
      .set("authorization", pm)
      .expect(403);

    // A client cannot see the admin surface at all.
    await http()
      .get(`/admin/projects/${SEED_PROJECT}/client-logins`)
      .set("authorization", `Bearer ${await mint("local:client")}`)
      .expect(404);
  });
});
