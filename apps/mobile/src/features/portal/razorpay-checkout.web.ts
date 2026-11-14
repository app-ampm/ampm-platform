import {
  RazorpayCheckoutDismissedError,
  RazorpayCheckoutFailedError,
  type RazorpayCheckoutOptions,
  type RazorpayCheckoutResult,
} from "./razorpay-checkout.types";

export {
  RazorpayCheckoutDismissedError,
  RazorpayCheckoutFailedError,
  type RazorpayCheckoutOptions,
  type RazorpayCheckoutResult,
} from "./razorpay-checkout.types";

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

/** Web build: Razorpay's hosted checkout is the browser script, so it is available in the web export. */
export const isRazorpayCheckoutAvailable = true;

interface RazorpayInstance {
  open: () => void;
  on: (event: "payment.failed", handler: (response: unknown) => void) => void;
}
interface RazorpayConstructor {
  new (options: Record<string, unknown>): RazorpayInstance;
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

/** Inject Razorpay's checkout script once; resolve when it is ready (or already present). */
function loadCheckoutScript(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const fail = (): void => reject(new RazorpayCheckoutFailedError("Checkout failed to load"));
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", fail);
    if (!existing) {
      script.src = CHECKOUT_SRC;
      document.body.appendChild(script);
    }
  });
}

/** Read Razorpay's success payload, failing closed if any of the three fields is missing. */
function readResult(response: unknown): RazorpayCheckoutResult {
  const r = response as {
    razorpay_payment_id?: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
  };
  if (!r.razorpay_payment_id || !r.razorpay_order_id || !r.razorpay_signature) {
    throw new RazorpayCheckoutFailedError("Razorpay returned an incomplete result");
  }
  return {
    razorpayPaymentId: r.razorpay_payment_id,
    razorpayOrderId: r.razorpay_order_id,
    razorpaySignature: r.razorpay_signature,
  };
}

/**
 * Open Razorpay Standard Checkout for an order and resolve with the success result (to verify server-side).
 * Rejects with RazorpayCheckoutDismissedError when the client closes the modal, or
 * RazorpayCheckoutFailedError on a failed payment or a script-load failure. The key secret never reaches
 * here — only the PUBLIC key and the order id, which Razorpay's hosted checkout needs.
 */
export async function openRazorpayCheckout(
  options: RazorpayCheckoutOptions,
): Promise<RazorpayCheckoutResult> {
  await loadCheckoutScript();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new RazorpayCheckoutFailedError("Razorpay checkout is unavailable");
  return new Promise<RazorpayCheckoutResult>((resolve, reject) => {
    const rzp = new Razorpay({
      key: options.keyId,
      order_id: options.orderId,
      amount: options.amount.minor,
      currency: options.amount.currency,
      name: "AMPM",
      description: options.description,
      handler: (response: unknown) => {
        try {
          resolve(readResult(response));
        } catch (error) {
          reject(
            error instanceof Error ? error : new RazorpayCheckoutFailedError("Checkout failed"),
          );
        }
      },
      modal: { ondismiss: () => reject(new RazorpayCheckoutDismissedError()) },
    });
    rzp.on("payment.failed", (response: unknown) => {
      const failure = response as { error?: { description?: string } };
      reject(new RazorpayCheckoutFailedError(failure.error?.description ?? "Payment failed"));
    });
    rzp.open();
  });
}
