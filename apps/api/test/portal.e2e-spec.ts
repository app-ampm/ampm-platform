import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const TAG = "E2E-Portal";
const EMAIL_PREFIX = "e2e-portal";

/**
 * The client portal end to end (feature CP-11): an active client signs in via the dev-login, starts with
 * empty entitlements, buys the Hotel Discovery plan for their own account (the account is derived from the
 * principal, never the body), completes the stub gateway payment, and `/me` then grants hotel discovery.
 * The purchase route is client-only; the completion is dev-only.
 */
describe("Client portal (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let planId: string;

  async function removeFixtures(): Promise<void> {
    const accounts = await prisma.clientAccount.findMany({
      where: { name: { startsWith: TAG } },
      select: { id: true },
    });
    const accountIds = accounts.map((account) => account.id);
    const users = await prisma.user.findMany({
      where: { email: { startsWith: EMAIL_PREFIX } },
      select: { id: true },
    });
    const userIds = users.map((user) => user.id);
    await prisma.notification.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.payment.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.subscription.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.accountContact.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.clientAccount.deleteMany({ where: { id: { in: accountIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  /** An active client with a prospect account — empty entitlements until a subscription is bought. */
  async function provisionClient(suffix: string): Promise<string> {
    const account = await prisma.clientAccount.create({
      data: { name: `${TAG} ${suffix}`, status: "prospect" },
      select: { id: true },
    });
    const email = `${EMAIL_PREFIX}-${suffix}@example.com`;
    const user = await prisma.user.create({
      data: {
        userType: "client",
        name: `${TAG} ${suffix}`,
        email,
        status: "active",
        identitySubject: `local:${EMAIL_PREFIX}-${suffix}`,
      },
      select: { id: true },
    });
    await prisma.accountContact.create({
      data: {
        accountId: account.id,
        name: `${TAG} ${suffix}`,
        relation: "primary",
        userId: user.id,
      },
    });
    return email;
  }

  beforeAll(async () => {
    ({ app } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    planId = (await prisma.plan.findUniqueOrThrow({ where: { planKey: "discovery" } })).id;
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  async function devLogin(email: string): Promise<string> {
    const res = await http().post("/auth/dev-login").send({ email }).expect(200);
    return res.body.data.accessToken as string;
  }

  const modulesOf = async (token: string): Promise<string[]> => {
    const res = await http().get("/me").set("authorization", `Bearer ${token}`).expect(200);
    return res.body.data.entitlements.modules as string[];
  };

  it("takes a client from locked to hotel discovery through buy + complete-payment", async () => {
    const token = await devLogin(await provisionClient("buyer")); // the client dev-login relax

    expect(await modulesOf(token)).toEqual([]); // before: nothing

    // Buy for the caller's own account — no accountId in the body.
    const purchase = await http()
      .post("/crm/portal/subscriptions")
      .set("authorization", `Bearer ${token}`)
      .send({ planId })
      .expect(201);
    expect(purchase.body.data.status).toBe("pending_payment");
    const subscriptionId = purchase.body.data.subscriptionId as string;

    expect(await modulesOf(token)).toEqual([]); // still locked while pending (AC-02.3)

    // Complete the stub gateway payment (dev-only); activation runs inline.
    const done = await http()
      .post("/crm/portal/complete-payment")
      .set("authorization", `Bearer ${token}`)
      .send({ subscriptionId })
      .expect(200);
    expect(done.body.data.status).toBe("active");

    expect(await modulesOf(token)).toContain("hotel_discovery"); // after: unlocked
  });

  it("refuses the client purchase route for a staff principal (denial equals absence)", async () => {
    const staff = await devLogin("sales@example.com");
    await http()
      .post("/crm/portal/subscriptions")
      .set("authorization", `Bearer ${staff}`)
      .send({ planId })
      .expect(404);
  });

  it("refuses completing another client's subscription (scoped to the caller's account)", async () => {
    const buyer = await devLogin(await provisionClient("owner"));
    const purchase = await http()
      .post("/crm/portal/subscriptions")
      .set("authorization", `Bearer ${buyer}`)
      .send({ planId })
      .expect(201);
    const other = await devLogin(await provisionClient("intruder"));
    await http()
      .post("/crm/portal/complete-payment")
      .set("authorization", `Bearer ${other}`)
      .send({ subscriptionId: purchase.body.data.subscriptionId })
      .expect(404);
  });
});
