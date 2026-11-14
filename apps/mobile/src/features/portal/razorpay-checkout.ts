import {
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

/**
 * Native build: Razorpay Standard Checkout is the browser hosted-checkout script, so it runs only in the
 * web export of the client portal. The native app reports it unavailable; native in-app payment
 * (react-native-razorpay) is a separate decision. The web implementation is in razorpay-checkout.web.ts.
 */
export const isRazorpayCheckoutAvailable = false;

export function openRazorpayCheckout(
  _options: RazorpayCheckoutOptions,
): Promise<RazorpayCheckoutResult> {
  return Promise.reject(
    new RazorpayCheckoutFailedError("Razorpay checkout is only available in the web portal"),
  );
}
