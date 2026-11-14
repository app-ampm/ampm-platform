import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  parseRazorpayEvent,
  RazorpayPaymentAdapter,
  StubPaymentAdapter,
  verifyHmacSha256,
} from "./payment.adapter.js";

const SECRET = "contract-test-secret";
const logger = { warn: () => undefined };

describe("verifyHmacSha256 (webhook signature)", () => {
  const body = Buffer.from('{"event":"payment.captured"}');
  const good = createHmac("sha256", SECRET).update(body).digest("hex");

  it("accepts a genuine HMAC over the raw body", () => {
    expect(verifyHmacSha256(body, good, SECRET)).toBe(true);
  });

  it("rejects a tampered body, a wrong signature and an absent one (fail closed)", () => {
    expect(verifyHmacSha256(Buffer.from('{"event":"x"}'), good, SECRET)).toBe(false);
    expect(verifyHmacSha256(body, "deadbeef", SECRET)).toBe(false);
    expect(verifyHmacSha256(body, undefined, SECRET)).toBe(false);
  });
});

describe("parseRazorpayEvent", () => {
  it("extracts the event type and the order/payment references", () => {
    const body = Buffer.from(
      JSON.stringify({
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_1", order_id: "order_1" } } },
      }),
    );
    expect(parseRazorpayEvent(body)).toEqual({
      eventType: "payment.captured",
      orderId: "order_1",
      paymentId: "pay_1",
    });
  });
});

describe("RazorpayPaymentAdapter.createOrder (contract against the sandbox API shape)", () => {
  it("POSTs an integer-paise order with HTTP Basic auth and returns the order id and public key", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = ((url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return Promise.resolve(new Response(JSON.stringify({ id: "order_test_1" }), { status: 200 }));
    }) as typeof fetch;
    const adapter = new RazorpayPaymentAdapter(
      "rzp_test_key",
      "secret",
      "whsecret",
      logger,
      fetchImpl,
    );

    const order = await adapter.createOrder({
      amountMinor: 5_000_000,
      currency: "INR",
      receipt: "sub-1",
    });

    expect(order).toEqual({ orderId: "order_test_1", keyId: "rzp_test_key" });
    expect(calls[0]!.url).toBe("https://api.razorpay.com/v1/orders");
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe(
      `Basic ${Buffer.from("rzp_test_key:secret").toString("base64")}`,
    );
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({
      amount: 5_000_000,
      currency: "INR",
      receipt: "sub-1",
    });
  });

  it("fails closed when the gateway returns an error", async () => {
    const fetchImpl = (() =>
      Promise.resolve(new Response("nope", { status: 500 }))) as typeof fetch;
    const adapter = new RazorpayPaymentAdapter("k", "s", "w", logger, fetchImpl);
    await expect(
      adapter.createOrder({ amountMinor: 1, currency: "INR", receipt: "r" }),
    ).rejects.toThrow(/gateway/);
  });
});

describe("StubPaymentAdapter", () => {
  it("makes a deterministic order and verifies a webhook signed with its dev secret (no network)", async () => {
    const adapter = new StubPaymentAdapter();
    const order = await adapter.createOrder({
      amountMinor: 100,
      currency: "INR",
      receipt: "sub-42",
    });
    expect(order.orderId).toMatch(/^order_stub_sub-42_/); // unique per call, keyed by the receipt

    const body = Buffer.from('{"event":"payment.captured"}');
    const sig = createHmac("sha256", StubPaymentAdapter.WEBHOOK_SECRET).update(body).digest("hex");
    expect(adapter.verifyWebhookSignature(body, sig)).toBe(true);
    expect(adapter.verifyWebhookSignature(body, "wrong")).toBe(false);
  });
});

describe("verifyCheckoutSignature (Razorpay Standard Checkout callback)", () => {
  it("accepts a genuine HMAC of `<orderId>|<paymentId>` with the KEY SECRET, fails closed otherwise", () => {
    const adapter = new RazorpayPaymentAdapter("rzp_test_key", "secret", "whsecret", logger);
    const good = createHmac("sha256", "secret").update("order_1|pay_1").digest("hex");
    expect(adapter.verifyCheckoutSignature("order_1", "pay_1", good)).toBe(true);
    expect(adapter.verifyCheckoutSignature("order_1", "pay_1", "deadbeef")).toBe(false);
    expect(adapter.verifyCheckoutSignature("order_1", "pay_1", undefined)).toBe(false);
    // The signature binds BOTH ids: a different order id (or payment id) does not verify.
    expect(adapter.verifyCheckoutSignature("order_2", "pay_1", good)).toBe(false);
  });

  it("the stub verifies a signature made with its public dev key secret (no network)", () => {
    const adapter = new StubPaymentAdapter();
    const good = createHmac("sha256", StubPaymentAdapter.KEY_SECRET).update("o1|p1").digest("hex");
    expect(adapter.verifyCheckoutSignature("o1", "p1", good)).toBe(true);
    expect(adapter.verifyCheckoutSignature("o1", "p1", "wrong")).toBe(false);
  });
});

describe("adapter.provider", () => {
  it("names the active gateway so the client portal branches between checkout and the dev endpoint", () => {
    expect(new RazorpayPaymentAdapter("k", "s", "w", logger).provider).toBe("razorpay");
    expect(new StubPaymentAdapter().provider).toBe("stub");
  });
});
