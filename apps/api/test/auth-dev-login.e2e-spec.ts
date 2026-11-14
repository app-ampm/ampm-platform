import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const DOMAIN = "@dev-login-e2e.example";

/**
 * Dev-only local sign-in end to end (feature TW-11 demo): a seeded, active staff user's email is
 * exchanged for a minted local access token that then authorises the API. The e2e env uses the local
 * identity adapter, so the endpoint is live here; the production refusal is covered in env.spec.ts.
 */
describe("Dev sign-in (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  async function removeFixtures(): Promise<void> {
    const users = await prisma.user.findMany({
      where: { email: { endsWith: DOMAIN } },
      select: { id: true },
    });
    for (const user of users) {
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  }

  beforeAll(async () => {
    ({ app } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  async function staff(handle: string, status: "active" | "disabled" = "active"): Promise<string> {
    const email = `${handle}${DOMAIN}`;
    await prisma.user.create({
      data: {
        userType: "staff",
        name: handle,
        email,
        status,
        identitySubject: `local:${handle}-devlogin`,
      },
    });
    return email;
  }

  it("mints a token for an active staff email, and that token authorises the API", async () => {
    const email = await staff("sam");
    const res = await http().post("/auth/dev-login").send({ email }).expect(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({ email });

    const me = await http()
      .get("/me")
      .set("authorization", `Bearer ${res.body.data.accessToken}`)
      .expect(200);
    expect(me.body.data.principal.email).toBe(email);
  });

  it("refuses an unknown email", async () => {
    await http()
      .post("/auth/dev-login")
      .send({ email: `nobody${DOMAIN}` })
      .expect(401);
  });

  it("refuses a disabled staff account", async () => {
    const email = await staff("gone", "disabled");
    await http().post("/auth/dev-login").send({ email }).expect(401);
  });

  it("rejects a malformed email at the edge", async () => {
    await http().post("/auth/dev-login").send({ email: "not-an-email" }).expect(400);
  });

  it("mints a demo session: /me is a demo principal who reaches the demo hotels", async () => {
    // No body: there is one seeded demo prospect (demo-baseline.ts), resolved by user type.
    const res = await http().post("/auth/dev-login/demo").expect(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({ email: "demo@example.com" });

    const token = res.body.data.accessToken as string;
    const me = await http().get("/me").set("authorization", `Bearer ${token}`).expect(200);
    // isDemo is a top-level sibling of `principal` in meResponse (identity.ts), not a principal field.
    expect(me.body.data.principal).toMatchObject({ type: "demo" });
    expect(me.body.data.isDemo).toBe(true);

    // The demo principal reaches hotel discovery (demo_hotels) with indicative price ranges, where an
    // unsubscribed client would be refused — proving the sign-in mints the P-7 demo, not a bare client.
    const hotels = await http().get("/hotels").set("authorization", `Bearer ${token}`).expect(200);
    const items = hotels.body.data.items as { summary: Record<string, unknown> }[];
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]!.summary).toHaveProperty("priceRange");
  });
});
