import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../db/prisma.service.js";
import { Prisma } from "../../../generated/prisma/client.js";
import type { AuditService } from "../../../policy/audit.service.js";
import { StubPaymentAdapter } from "./payment.adapter.js";
import type { GatewayOrderRow, PaymentsRepository } from "./payments.repository.js";
import type { PlanRow, PlansRepository } from "./plans.repository.js";
import type { SubscriptionActivationService } from "./subscription-activation.service.js";
import type { SubscriptionsRepository } from "./subscriptions.repository.js";
import { SubscriptionsService } from "./subscriptions.service.js";

const MINUTE = 60_000;
const PLAN: PlanRow = {
  id: "plan-1",
  planKey: "discovery",
  name: "Hotel Discovery",
  planType: "hotel_discovery",
  billingType: "one_time",
  priceAmount: new Prisma.Decimal("4999.00"),
  currency: "INR",
  termDays: 365,
  trialDays: null,
  modules: [],
};
const REQUEST = { accountId: "account-1", planId: PLAN.id };

/** The subscription's newest gateway order, `ageMs` old, unpaid and for the plan's price unless told. */
function order(ageMs: number, overrides: Partial<GatewayOrderRow> = {}): GatewayOrderRow {
  return {
    orderId: "order_open",
    status: "initiated",
    amount: PLAN.priceAmount,
    currency: "INR",
    createdAt: new Date(Date.now() - ageMs),
    ...overrides,
  };
}

/** A pending subscription that already exists, whose newest gateway order is `latest`. */
function harness(latest: GatewayOrderRow | null) {
  const adapter = new StubPaymentAdapter();
  const createOrder = vi.spyOn(adapter, "createOrder");
  const payments = {
    latestGatewayOrder: vi.fn(async () => latest),
    create: vi.fn(async () => "payment-1"),
  };
  const service = new SubscriptionsService(
    {
      accountExists: vi.fn(async () => true),
      findPendingForAccountPlan: vi.fn(async () => "subscription-1"),
    } as unknown as SubscriptionsRepository,
    payments as unknown as PaymentsRepository,
    { findActiveById: vi.fn(async () => PLAN) } as unknown as PlansRepository,
    {} as SubscriptionActivationService,
    { record: vi.fn(async () => undefined) } as unknown as AuditService,
    {
      $transaction: vi.fn(async (fn: (tx: object) => Promise<unknown>) => fn({})),
    } as unknown as PrismaService,
    adapter,
  );
  return { service, createOrder, payments };
}

describe("SubscriptionsService.create: one open order per pending subscription (D-149)", () => {
  it("hands back the subscription's open order instead of minting another", async () => {
    const { service, createOrder, payments } = harness(order(5 * MINUTE));
    const result = await service.create(REQUEST, "actor-1");
    expect(result).toMatchObject({
      subscriptionId: "subscription-1",
      status: "pending_payment",
      order: { provider: "stub", orderId: "order_open", keyId: StubPaymentAdapter.KEY_ID },
    });
    expect(createOrder).not.toHaveBeenCalled();
    expect(payments.create).not.toHaveBeenCalled();
  });

  it("hands back an order whose payment attempt failed: the gateway still takes another", async () => {
    const { service, createOrder } = harness(order(MINUTE, { status: "failed" }));
    expect((await service.create(REQUEST, "actor-1")).order.orderId).toBe("order_open");
    expect(createOrder).not.toHaveBeenCalled();
  });

  it.each([
    ["there is no order yet", null],
    ["the open order is an hour old", order(60 * MINUTE + 1)],
    ["the plan's price changed since", order(MINUTE, { amount: new Prisma.Decimal("3999.00") })],
    ["the order was paid", order(MINUTE, { status: "succeeded" })],
  ])("mints a new order and records its payment when %s", async (_case, latest) => {
    const { service, createOrder, payments } = harness(latest);
    const result = await service.create(REQUEST, "actor-1");
    expect(createOrder).toHaveBeenCalledOnce();
    expect(result.order.orderId).toMatch(/^order_stub_subscription-1_/);
    expect(result.order.keyId).toBe(StubPaymentAdapter.KEY_ID);
    expect(payments.create).toHaveBeenCalledWith(
      expect.objectContaining({ providerRef: result.order.orderId, status: "initiated" }),
      expect.anything(),
    );
  });
});
