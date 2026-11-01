import { createHmac } from "node:crypto";

import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { StubPaymentAdapter } from "../src/modules/crm/subscriptions/payment.adapter.js";
import { SubscriptionExpiryService } from "../src/modules/crm/subscriptions/subscription-expiry.service.js";
import { startApi } from "./start-api.js";

/** Test fixtures share this account-name prefix and this contact-email prefix, so cleanup is self-contained. */
const TAG = "E2E-Sub";
const EMAIL_PREFIX = "e2e-sub";
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Subscription purchase → Razorpay (sandbox stub) → activation → entitlement gating end to end
 * (Module B CRM, feature 8.3, AC-02). A signed `payment.captured` webhook (or a manual bank transfer)
 * activates exactly the purchased modules — hotel discovery open, the wedding workspace locked — once
 * per transaction whatever the number of deliveries, with a bad signature rejected and expiry removing
 * only the subscription modules while deleting nothing.
 */
describe("Subscription purchase and activation (e2e)", () => {
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
    await prisma.webhookEvent.deleteMany({ where: { eventId: { startsWith: EMAIL_PREFIX } } });
    await prisma.payment.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.subscription.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.accountContact.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.clientAccount.deleteMany({ where: { id: { in: accountIds } } });
    // The subscriber users sign in (via /me) during the tests, which opens sessions that reference them.
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  /** A fresh prospect account with an active client user attached, so its /me entitlements can be read. */
  async function provisionSubscriber(
    suffix: string,
  ): Promise<{ accountId: string; userId: string; subject: string }> {
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
    return { accountId: account.id, userId: user.id, subject };
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

  async function purchase(accountId: string): Promise<{ subscriptionId: string; orderId: string }> {
    const res = await http()
      .post("/crm/subscriptions")
      .set("authorization", await bearer("local:sm"))
      .send({ accountId, planId })
      .expect(201);
    return { subscriptionId: res.body.data.subscriptionId, orderId: res.body.data.order.orderId };
  }

  function webhook(eventType: string, orderId: string, eventId: string, signature?: string) {
    const body = JSON.stringify({
      event: eventType,
      payload: { payment: { entity: { id: `pay_${eventId}`, order_id: orderId } } },
    });
    const sig =
      signature ??
      createHmac("sha256", StubPaymentAdapter.WEBHOOK_SECRET).update(body).digest("hex");
    return http()
      .post("/crm/webhooks/razorpay")
      .set("content-type", "application/json")
      .set("x-razorpay-signature", sig)
      .set("x-razorpay-event-id", eventId)
      .send(body);
  }

  const modulesOf = async (subject: string): Promise<string[]> => {
    const res = await http()
      .get("/me")
      .set("authorization", await bearer(subject))
      .expect(200);
    return res.body.data.entitlements.modules as string[];
  };

  it("lists the public plan catalogue with the price as integer paise (AC-02.9)", async () => {
    const res = await http().get("/crm/plans").expect(200);
    const discovery = res.body.data.items.find(
      (plan: { planKey: string }) => plan.planKey === "discovery",
    );
    expect(discovery).toBeDefined();
    expect(discovery.price).toEqual({ minor: 5_000_000, currency: "INR" });
    expect(discovery.modules.map((m: { moduleKey: string }) => m.moduleKey).sort()).toEqual([
      "hotel_assistance",
      "hotel_discovery",
    ]);
  });

  it("activates only the purchased modules through the signed webhook (AC-02.1/02.2)", async () => {
    const { accountId, subject } = await provisionSubscriber("activate");
    const { subscriptionId, orderId } = await purchase(accountId);

    // Before payment the subscriber has no subscription modules.
    expect(await modulesOf(subject)).not.toContain("hotel_discovery");

    await webhook("payment.captured", orderId, `${EMAIL_PREFIX}-evt-activate`).expect(200);

    const sub = await http()
      .get(`/crm/subscriptions/${subscriptionId}`)
      .set("authorization", await bearer("local:sm"))
      .expect(200);
    expect(sub.body.data.status).toBe("active");
    expect(sub.body.data.startsAt).not.toBeNull();
    expect(sub.body.data.endsAt).not.toBeNull();
    expect(sub.body.data.activationSource).toBe("gateway_webhook");

    const payment = await prisma.payment.findUniqueOrThrow({ where: { providerRef: orderId } });
    expect(payment.status).toBe("succeeded");
    const account = await prisma.clientAccount.findUniqueOrThrow({ where: { id: accountId } });
    expect(account.status).toBe("active");
    expect(
      await prisma.auditEvent.count({
        where: { entityType: "subscription", entityId: subscriptionId, action: "update" },
      }),
    ).toBe(1);

    // The subscriber now reaches hotel discovery + assistance, but never the wedding workspace (AC-02.2).
    const modules = await modulesOf(subject);
    expect(modules).toContain("hotel_discovery");
    expect(modules).toContain("hotel_assistance");
    expect(modules).not.toContain("wedding_workspace");
    const me = await http()
      .get("/me")
      .set("authorization", await bearer(subject))
      .expect(200);
    expect(me.body.data.memberships).toHaveLength(0);
  });

  it("processes a duplicate webhook exactly once (AC-02.5)", async () => {
    const { accountId, userId } = await provisionSubscriber("dup");
    const { subscriptionId, orderId } = await purchase(accountId);
    const eventId = `${EMAIL_PREFIX}-evt-dup`;
    await webhook("payment.captured", orderId, eventId).expect(200);
    await webhook("payment.captured", orderId, eventId).expect(200);
    await webhook("payment.captured", orderId, eventId).expect(200);

    expect(
      await prisma.subscription.count({ where: { id: subscriptionId, status: "active" } }),
    ).toBe(1);
    expect(
      await prisma.payment.count({ where: { providerRef: orderId, status: "succeeded" } }),
    ).toBe(1);
    expect(
      await prisma.auditEvent.count({
        where: { entityType: "subscription", entityId: subscriptionId, action: "update" },
      }),
    ).toBe(1);
    expect(
      await prisma.notification.count({
        where: { recipientId: userId, templateKey: "subscription.activated" },
      }),
    ).toBe(1);
  });

  it("rejects a bad webhook signature with 401 and writes nothing (AC-02.6)", async () => {
    const { accountId } = await provisionSubscriber("badsig");
    const { subscriptionId, orderId } = await purchase(accountId);
    await webhook("payment.captured", orderId, `${EMAIL_PREFIX}-evt-badsig`, "deadbeef").expect(
      401,
    );

    const payment = await prisma.payment.findUniqueOrThrow({ where: { providerRef: orderId } });
    expect(payment.status).toBe("initiated");
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    expect(sub.status).toBe("pending_payment");
  });

  it("grants nothing on a failed payment (AC-02.3)", async () => {
    const { accountId, subject } = await provisionSubscriber("failed");
    const { subscriptionId, orderId } = await purchase(accountId);
    await webhook("payment.failed", orderId, `${EMAIL_PREFIX}-evt-failed`).expect(200);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { providerRef: orderId } });
    expect(payment.status).toBe("failed");
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    expect(sub.status).toBe("pending_payment");
    expect(await modulesOf(subject)).not.toContain("hotel_discovery");
  });

  it("activates through the same step for a manual bank transfer (AC-02.4)", async () => {
    const { accountId } = await provisionSubscriber("manual");
    const { subscriptionId } = await purchase(accountId);
    const res = await http()
      .post(`/crm/subscriptions/${subscriptionId}/record-payment`)
      .set("authorization", await bearer("local:sm"))
      .send({ reference: "NEFT-TEST-0001", method: "bank_transfer" })
      .expect(200);
    expect(res.body.data.status).toBe("active");
    expect(res.body.data.activationSource).toBe("manual");

    const payment = await prisma.payment.findFirstOrThrow({
      where: { relatedType: "subscription", relatedId: subscriptionId, method: "bank_transfer" },
    });
    expect(payment.status).toBe("succeeded");
    expect(
      await prisma.auditEvent.count({
        where: { entityType: "subscription", entityId: subscriptionId, action: "update" },
      }),
    ).toBe(1);
  });

  it("reuses an existing pending subscription for the same account and plan (idempotent purchase)", async () => {
    const { accountId } = await provisionSubscriber("reuse");
    const first = await purchase(accountId);
    const second = await purchase(accountId);
    expect(second.subscriptionId).toBe(first.subscriptionId);
    expect(
      await prisma.subscription.count({ where: { accountId, status: "pending_payment" } }),
    ).toBe(1);
  });

  it("re-drives a stored-but-unprocessed webhook event, recovering a failed enqueue (review fix)", async () => {
    const { accountId } = await provisionSubscriber("redrive");
    const { subscriptionId, orderId } = await purchase(accountId);
    // Simulate a first delivery that stored the event but never enqueued the job (status stays received).
    const eventId = `${EMAIL_PREFIX}-evt-redrive`;
    await prisma.webhookEvent.create({
      data: {
        provider: "razorpay",
        eventId,
        eventType: "payment.captured",
        providerRef: orderId,
        payload: {},
        status: "received",
      },
    });
    // The provider redelivers; the duplicate is still `received`, so ingest re-enqueues and activates.
    await webhook("payment.captured", orderId, eventId).expect(200);
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    expect(sub.status).toBe("active");
  });

  it("audits the payment create and the succeeded transition (RESTRICTED-FINANCE, §9) (review fix)", async () => {
    const { accountId } = await provisionSubscriber("payaudit");
    const { orderId } = await purchase(accountId);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { providerRef: orderId } });
    expect(
      await prisma.auditEvent.count({
        where: { entityType: "payment", entityId: payment.id, action: "create" },
      }),
    ).toBe(1);
    await webhook("payment.captured", orderId, `${EMAIL_PREFIX}-evt-payaudit`).expect(200);
    expect(
      await prisma.auditEvent.count({
        where: { entityType: "payment", entityId: payment.id, action: "update" },
      }),
    ).toBe(1);
  });

  it("removes only the subscription modules on expiry and deletes nothing (AC-02.7)", async () => {
    const { accountId, subject } = await provisionSubscriber("expiry");
    const { subscriptionId, orderId } = await purchase(accountId);
    await webhook("payment.captured", orderId, `${EMAIL_PREFIX}-evt-expiry`).expect(200);
    expect(await modulesOf(subject)).toContain("hotel_discovery");

    // Sweep well past the term end; the subscription expires but every row survives (AC-02.7).
    await app.get(SubscriptionExpiryService).runSweep(new Date(Date.now() + 40 * DAY_MS));

    const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    expect(sub.status).toBe("expired");
    expect(await prisma.payment.count({ where: { providerRef: orderId } })).toBe(1);
    const modules = await modulesOf(subject);
    expect(modules).not.toContain("hotel_discovery");
    expect(modules).toContain("hotel_assistance"); // lapsed keeps read-only access, deletes nothing
  });

  it("denies a purchase to a principal without crm.subscriptions.create (AC-12)", async () => {
    const { accountId } = await provisionSubscriber("denied");
    await http()
      .post("/crm/subscriptions")
      .set("authorization", await bearer("local:pm"))
      .send({ accountId, planId })
      .expect(404);
  });

  it("has no self-registration route (AC-02.10)", async () => {
    for (const path of ["/auth/register", "/register", "/signup", "/auth/signup"]) {
      await http().post(path).send({ email: "intruder@example.com" }).expect(404);
    }
  });

  it("rejects a malformed subscription list cursor with 400 (review fix)", async () => {
    await http()
      .get("/crm/subscriptions?cursor=not-a-uuid")
      .set("authorization", await bearer("local:sm"))
      .expect(400);
  });
});
