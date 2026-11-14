import { createHmac } from "node:crypto";

import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { StubPaymentAdapter } from "../src/modules/crm/subscriptions/payment.adapter.js";
import { startApi } from "./start-api.js";

/**
 * The client portal's hosted-checkout callback (CP-11, `POST /crm/portal/verify-payment`). A signed-in
 * client confirms their OWN Razorpay payment by posting back the checkout result; the server verifies the
 * signature — HMAC of `<orderId>|<paymentId>` with the key secret, the dev stub using its public key
 * secret — and runs the same idempotent activation the webhook runs. A tampered signature, a foreign order
 * id, or another account's subscription activates nothing.
 */
const TAG = "E2E-PortalPay";
const EMAIL_PREFIX = "e2e-portalpay";

describe("Client portal hosted-checkout callback (e2e)", () => {
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

  /** A fresh prospect account with an active client user, so its portal purchase + /me can be exercised. */
  async function provisionSubscriber(suffix: string): Promise<string> {
    const account = await prisma.clientAccount.create({
      data: { name: `${TAG} ${suffix}`, status: "prospect" },
      select: { id: true },
    });
    const subject = `local:${EMAIL_PREFIX}-${suffix}`;
    const user = await prisma.user.create({
      data: {
        userType: "client",
        name: `${TAG} ${suffix}`,
        email: `${EMAIL_PREFIX}-${suffix}@example.com`,
        status: "active",
        identitySubject: subject,
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
    return subject;
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

  /** The stub gateway's checkout signature: HMAC-SHA256 of `<orderId>|<paymentId>` with its dev key secret. */
  const signature = (orderId: string, paymentId: string): string =>
    createHmac("sha256", StubPaymentAdapter.KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

  async function subscribe(
    subject: string,
  ): Promise<{ subscriptionId: string; orderId: string; provider: string }> {
    const res = await http()
      .post("/crm/portal/subscriptions")
      .set("authorization", await bearer(subject))
      .send({ planId })
      .expect(201);
    const { subscriptionId, order } = res.body.data;
    return { subscriptionId, orderId: order.orderId, provider: order.provider };
  }

  const verify = async (subject: string, body: Record<string, string>) =>
    http()
      .post("/crm/portal/verify-payment")
      .set("authorization", await bearer(subject))
      .send(body);

  const modulesOf = async (subject: string): Promise<string[]> => {
    const res = await http()
      .get("/me")
      .set("authorization", await bearer(subject))
      .expect(200);
    return res.body.data.entitlements.modules as string[];
  };

  it("verifies the checkout signature and activates exactly the purchased modules", async () => {
    const subject = await provisionSubscriber("ok");
    const { subscriptionId, orderId, provider } = await subscribe(subject);
    expect(provider).toBe("stub"); // the dev gateway signals itself so the portal branches correctly

    // A tampered signature activates nothing (400; do NOT mark as paid).
    const bad = await verify(subject, {
      subscriptionId,
      razorpayPaymentId: "pay_ok",
      razorpayOrderId: orderId,
      razorpaySignature: "deadbeef",
    });
    expect(bad.status).toBe(400);
    expect(await modulesOf(subject)).not.toContain("hotel_discovery");

    // A genuine checkout signature verifies and activates.
    const ok = await verify(subject, {
      subscriptionId,
      razorpayPaymentId: "pay_ok",
      razorpayOrderId: orderId,
      razorpaySignature: signature(orderId, "pay_ok"),
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe("active");

    const modules = await modulesOf(subject);
    expect(modules).toContain("hotel_discovery");
    expect(modules).toContain("hotel_assistance");
    expect(modules).not.toContain("wedding_workspace");
    const payment = await prisma.payment.findUniqueOrThrow({ where: { providerRef: orderId } });
    expect(payment.status).toBe("succeeded");
  });

  it("rejects a callback whose order id is not the subscription's (400, activates nothing)", async () => {
    const subject = await provisionSubscriber("mismatch");
    const { subscriptionId } = await subscribe(subject);
    const res = await verify(subject, {
      subscriptionId,
      razorpayPaymentId: "pay_x",
      razorpayOrderId: "order_not_mine",
      razorpaySignature: signature("order_not_mine", "pay_x"),
    });
    expect(res.status).toBe(400);
    expect(await modulesOf(subject)).not.toContain("hotel_discovery");
  });

  it("denies verifying another account's subscription (denial equals absence)", async () => {
    const owner = await provisionSubscriber("owner");
    const intruder = await provisionSubscriber("intruder");
    const { subscriptionId, orderId } = await subscribe(owner);
    const res = await verify(intruder, {
      subscriptionId,
      razorpayPaymentId: "pay_x",
      razorpayOrderId: orderId,
      razorpaySignature: signature(orderId, "pay_x"),
    });
    expect(res.status).toBe(404);
  });
});
