import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

/** This suite's accounts share this name prefix, so its cleanup touches nothing else. */
const TAG = "E2E-PayRoles";

/**
 * Who may record a manual (off-gateway) payment for a subscription awaiting one (D-125). Recording
 * activates the subscription, so it changes the status alone: Super Admin and Sales hold that update
 * outright, Finance for the status only ("RU status", permission-matrix §5.2). A reader of
 * subscriptions without it, the hotel team, is refused with 403 and nothing is written. Sales'
 * recording is covered by the purchase and activation suite.
 */
describe("Recording a manual subscription payment, by role (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;
  let planId: string;

  async function removeFixtures(): Promise<void> {
    const accounts = await prisma.clientAccount.findMany({
      where: { name: { startsWith: TAG } },
      select: { id: true },
    });
    const accountIds = accounts.map((account) => account.id);
    await prisma.payment.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.subscription.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.clientAccount.deleteMany({ where: { id: { in: accountIds } } });
  }

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    planId = (await prisma.plan.findUniqueOrThrow({ where: { planKey: "discovery" } })).id;
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const bearer = async (subject: string) => `Bearer ${await mint(subject)}`;

  /** A prospect account with a subscription awaiting payment, bought by Sales. */
  async function pendingSubscription(suffix: string): Promise<string> {
    const account = await prisma.clientAccount.create({
      data: { name: `${TAG} ${suffix}`, status: "prospect" },
      select: { id: true },
    });
    const res = await http()
      .post("/crm/subscriptions")
      .set("authorization", await bearer("local:sm"))
      .send({ accountId: account.id, planId })
      .expect(201);
    return res.body.data.subscriptionId as string;
  }

  const record = async (subscriptionId: string, subject: string, reference: string) =>
    http()
      .post(`/crm/subscriptions/${subscriptionId}/record-payment`)
      .set("authorization", await bearer(subject))
      .send({ reference, method: "bank_transfer" });

  it("lets Finance record it: the status-only update is all recording takes", async () => {
    const subscriptionId = await pendingSubscription("finance");
    const res = await record(subscriptionId, "local:fa", "NEFT-ROLES-0001");
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("active");
    expect(res.body.data.activationSource).toBe("manual");
  });

  it("refuses the hotel team, who read subscriptions but may not change one, writing nothing", async () => {
    const subscriptionId = await pendingSubscription("hotel-team");
    const res = await record(subscriptionId, "local:ht", "NEFT-ROLES-0002");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("forbidden");
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    expect(sub.status).toBe("pending_payment");
    expect(
      await prisma.payment.count({ where: { relatedId: subscriptionId, method: "bank_transfer" } }),
    ).toBe(0);
  });
});
