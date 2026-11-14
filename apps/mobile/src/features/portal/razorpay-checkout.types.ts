import type { Money } from "@ampm/core";

/** What the browser's Razorpay Standard Checkout needs: the PUBLIC key, the order, and display details. */
export interface RazorpayCheckoutOptions {
  readonly keyId: string;
  readonly orderId: string;
  readonly amount: Money;
  readonly description: string;
}

/** The success result the browser posts back, for the server to verify and activate (CP-11). */
export interface RazorpayCheckoutResult {
  readonly razorpayPaymentId: string;
  readonly razorpayOrderId: string;
  readonly razorpaySignature: string;
}

/** The client closed the Razorpay modal without paying — expected, surfaced quietly (not an error). */
export class RazorpayCheckoutDismissedError extends Error {
  constructor() {
    super("Payment cancelled");
    this.name = "RazorpayCheckoutDismissedError";
  }
}

/** Razorpay reported a failed payment, or the checkout script could not load. */
export class RazorpayCheckoutFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RazorpayCheckoutFailedError";
  }
}
