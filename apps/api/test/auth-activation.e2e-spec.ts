import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { AuthTokenService } from "../src/identity/auth-token.service.js";
import { IDENTITY_ADAPTER } from "../src/identity/identity.types.js";
import type { LocalIdentityAdapter } from "../src/identity/local.adapter.js";
import { startApi } from "./start-api.js";

const DOMAIN = "@activate-e2e.example";

/**
 * Invitation activation end to end (Module A, feature 5.2, D-041): an invited user presents their
 * invite token together with a verified provider access token, and the API links the identity subject
 * and activates them. The e2e env uses the local identity adapter.
 */
describe("Activation (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let authTokens: AuthTokenService;
  let adapter: LocalIdentityAdapter;

  async function removeFixtures(): Promise<void> {
    const users = await prisma.user.findMany({
      where: { email: { endsWith: DOMAIN } },
      select: { id: true },
    });
    for (const user of users) {
      await prisma.authToken.deleteMany({ where: { userId: user.id } });
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  }

  beforeAll(async () => {
    ({ app } = await startApi());
    prisma = app.get(PrismaService);
    authTokens = app.get(AuthTokenService);
    adapter = app.get(IDENTITY_ADAPTER) as LocalIdentityAdapter;
    await removeFixtures();
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  async function invited(handle: string): Promise<{ id: string; email: string }> {
    const email = `${handle}${DOMAIN}`;
    const user = await prisma.user.create({
      data: { userType: "staff", name: handle, email, status: "invited" },
    });
    return { id: user.id, email };
  }

  it("activates an invited user, then refuses to reuse the invite", async () => {
    const user = await invited("pat");
    const token = await authTokens.issueInvite(user.id);
    const access = await adapter.mint("local:pat-activated", { email: user.email });

    const res = await http()
      .post("/auth/activate")
      .set("authorization", `Bearer ${access}`)
      .send({ token })
      .expect(200);
    expect(res.body.data).toMatchObject({ userId: user.id, status: "active" });

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.status).toBe("active");
    expect(after.identitySubject).toBe("local:pat-activated");

    // The invite is single-use.
    await http()
      .post("/auth/activate")
      .set("authorization", `Bearer ${access}`)
      .send({ token })
      .expect(401);
  });

  it("holds the guardrails: email mismatch, bad token, and missing provider token", async () => {
    const user = await invited("dana");
    const token = await authTokens.issueInvite(user.id);

    // The verified email must match the invitation.
    const wrongEmail = await adapter.mint("local:dana-wrong", { email: `other${DOMAIN}` });
    await http()
      .post("/auth/activate")
      .set("authorization", `Bearer ${wrongEmail}`)
      .send({ token })
      .expect(403);

    // An unknown invite token is rejected.
    const access = await adapter.mint("local:dana-ok", { email: user.email });
    await http()
      .post("/auth/activate")
      .set("authorization", `Bearer ${access}`)
      .send({ token: "not-a-real-token" })
      .expect(401);

    // No provider access token at all.
    await http().post("/auth/activate").send({ token }).expect(401);

    // An expired invite is refused.
    const eve = await invited("eve");
    const eveToken = await authTokens.issueInvite(eve.id);
    await prisma.authToken.updateMany({
      where: { userId: eve.id, purpose: "invite" },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const eveAccess = await adapter.mint("local:eve-ok", { email: eve.email });
    await http()
      .post("/auth/activate")
      .set("authorization", `Bearer ${eveAccess}`)
      .send({ token: eveToken })
      .expect(401);
  });
});
