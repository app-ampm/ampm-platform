import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { z } from "zod";
import type { Logger } from "@ampm/core";

/**
 * The payment gateway for subscriptions (feature 8.3, AC-02). One adapter interface, one implementation
 * behind it, chosen by configuration: the in-process stub for development and staging, Razorpay for
 * production (env.ts refuses the stub there, the C1 pattern). Business logic never imports a provider
 * SDK (api.md): the only gateway code is here, and it is `node:crypto` (HMAC) plus `fetch`, no SDK.
 *
 * The browser runs Razorpay's hosted checkout, so card data never reaches AMPM; the signed
 * `payment.captured` webhook is what activates the subscription (verified here, processed by an
 * idempotent job).
 */
export const PAYMENT_ADAPTER = Symbol("PAYMENT_ADAPTER");

export interface CreateOrderInput {
  /** Integer minor units (paise) — the gateway and money.ts both work in minor units. */
  readonly amountMinor: number;
  readonly currency: string;
  /** Our own reference echoed back by the gateway (the subscription id). */
  readonly receipt: string;
}

export interface CreatedOrder {
  /** The gateway order id; stored as the payment's `provider_ref` and used to match the webhook. */
  readonly orderId: string;
  /** The gateway's PUBLIC key id, which the browser's hosted checkout needs (never the secret). */
  readonly keyId: string;
}

/** The fields we read from a verified webhook event; the order id links it to the pending payment. */
export interface ParsedWebhookEvent {
  readonly eventType: string;
  readonly orderId: string | null;
  readonly paymentId: string | null;
}

export interface PaymentAdapter {
  /** Create a hosted-checkout order (an HTTPS POST for the real gateway). */
  createOrder(input: CreateOrderInput): Promise<CreatedOrder>;
  /**
   * True when the signature is a genuine HMAC-SHA256 of the RAW request body with the webhook secret.
   * Never throws; a bad or absent signature is false (fail closed), so the webhook route returns 401.
   * Must receive the exact raw bytes — a re-serialised body would not match (AC-02.6).
   */
  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean;
  /** Parse a verified webhook body into its event type and the order/payment references. */
  parseEvent(rawBody: Buffer): ParsedWebhookEvent;
}

/**
 * Constant-time HMAC-SHA256 check of `rawBody` against a hex `signature`. Fail-closed: a missing
 * signature, a length mismatch or any error is `false`. Shared by both adapters so the dev/test path
 * exercises the exact verification AC-02.6 must prove.
 */
export function verifyHmacSha256(
  rawBody: Buffer,
  signature: string | undefined,
  secret: string,
): boolean {
  if (typeof signature !== "string" || signature.length === 0) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const given = Buffer.from(signature, "utf8");
  const want = Buffer.from(expected, "utf8");
  if (given.length !== want.length) return false;
  return timingSafeEqual(given, want);
}

// The slice of a Razorpay webhook event we read; every other field is ignored.
const razorpayEvent = z.object({
  event: z.string(),
  payload: z
    .object({
      payment: z
        .object({
          entity: z
            .object({
              id: z.string().optional(),
              order_id: z.string().nullish(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

/** Parse a Razorpay webhook body (both adapters share it: the stub simulates the same event shape). */
export function parseRazorpayEvent(rawBody: Buffer): ParsedWebhookEvent {
  const json: unknown = JSON.parse(rawBody.toString("utf8"));
  const parsed = razorpayEvent.parse(json);
  const entity = parsed.payload?.payment?.entity;
  return {
    eventType: parsed.event,
    orderId: entity?.order_id ?? null,
    paymentId: entity?.id ?? null,
  };
}

/** The slice of the logger the gateway adapter needs (a transport error is logged, then rethrown). */
type PaymentLogger = Pick<Logger, "warn">;

/**
 * The production gateway: creates an order with an HTTPS POST to Razorpay (HTTP Basic auth, test vs
 * live chosen by the key prefix), verifies the webhook HMAC, and parses the Razorpay event. `fetch` is
 * injectable so the order call has an offline contract test.
 */
export class RazorpayPaymentAdapter implements PaymentAdapter {
  constructor(
    private readonly keyId: string,
    private readonly keySecret: string,
    private readonly webhookSecret: string,
    private readonly logger: PaymentLogger,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
    try {
      const response = await this.fetchImpl("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Basic ${auth}` },
        body: JSON.stringify({
          amount: input.amountMinor,
          currency: input.currency,
          receipt: input.receipt,
        }),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      const order: unknown = await response.json();
      const orderId = (order as { id?: unknown }).id;
      if (typeof orderId !== "string") throw new Error("order response has no id");
      return { orderId, keyId: this.keyId };
    } catch (error) {
      this.logger.warn("crm.payment.create_order_failed", { error: String(error) });
      throw new Error("payment gateway order creation failed", { cause: error });
    }
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
    return verifyHmacSha256(rawBody, signature, this.webhookSecret);
  }

  parseEvent(rawBody: Buffer): ParsedWebhookEvent {
    return parseRazorpayEvent(rawBody);
  }
}

/**
 * The development/test sandbox: deterministic fake orders and a fixed, well-known webhook secret, so an
 * e2e can compute a genuine HMAC and drive the real verify + parse + activation path with no network
 * and no secrets. Refused in production by env.ts. The secret below is a public dev placeholder, never
 * a real credential (security.md).
 */
export class StubPaymentAdapter implements PaymentAdapter {
  static readonly WEBHOOK_SECRET = "stub-not-a-real-secret";
  static readonly KEY_ID = "rzp_test_stub";

  createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
    // A unique order id per call, like a real gateway (so a retried/reused purchase never collides on
    // the payment's unique provider_ref); the receipt is kept in the id for debuggability.
    return Promise.resolve({
      orderId: `order_stub_${input.receipt}_${randomUUID()}`,
      keyId: StubPaymentAdapter.KEY_ID,
    });
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
    return verifyHmacSha256(rawBody, signature, StubPaymentAdapter.WEBHOOK_SECRET);
  }

  parseEvent(rawBody: Buffer): ParsedWebhookEvent {
    return parseRazorpayEvent(rawBody);
  }
}
