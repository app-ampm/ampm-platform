import { uiCopy } from "@ampm/ui";

import { fireEvent, screen, waitFor } from "../../test/render";
import {
  ME_DEMO,
  ME_LOCKED,
  ME_SUBSCRIBER,
  PLAN,
  SUBSCRIPTION_ID,
  failure,
  jsonResponse,
  pending,
  portalApi,
  renderPortal,
  type Handler,
} from "./portal.fixtures";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

beforeEach(() => mockPush.mockClear());

/** `POST /crm/portal/subscriptions` answering with a pending subscription and its gateway order. */
const subscribed: Handler = () =>
  jsonResponse(
    {
      data: {
        subscriptionId: SUBSCRIPTION_ID,
        status: "pending_payment",
        order: { provider: "stub", orderId: "order_1", amount: PLAN.price, keyId: "key_test" },
      },
    },
    201,
  );

/**
 * Closes the toast on screen. A toast dismisses itself after four seconds, and that timer would keep
 * Jest's event loop alive after the run; dismissing it clears the timer.
 */
async function dismissToast(): Promise<void> {
  await fireEvent.press(screen.getByRole("button", { name: uiCopy.dismiss }));
}

const PAY = { name: "Pay ₹50,000" } as const;
const COMPLETE = { name: "Complete payment (demo)" } as const;

describe("PortalScreen activation and payment (CP-11)", () => {
  it("shows the steps, then the plan with its price, inclusions, term and terms", async () => {
    await renderPortal(portalApi(ME_LOCKED));
    expect(await screen.findByText("Activate hotel discovery")).toBeOnTheScreen();
    expect(screen.getByText("Hello, Ananya")).toBeOnTheScreen();
    expect(screen.getByTestId("activation-steps")).toBeOnTheScreen();
    expect(screen.getByLabelText("Your wedding, done")).toBeOnTheScreen();
    expect(screen.getByLabelText("Payment, current step")).toBeOnTheScreen();
    expect(screen.getByLabelText("Discovery opens, not started")).toBeOnTheScreen();
    expect(await screen.findByText("Hotel Discovery")).toBeOnTheScreen();
    expect(screen.getByText("₹50,000")).toBeOnTheScreen();
    expect(screen.getByText("One-time")).toBeOnTheScreen();
    expect(screen.getByText("Hotel assistance")).toBeOnTheScreen();
    expect(screen.getByText("30 days from payment")).toBeOnTheScreen();
    expect(screen.getByText(/non-refundable/)).toBeOnTheScreen();
    expect(screen.getByRole("button", PAY)).toBeOnTheScreen();
  });

  it("starts the subscription, completes its payment and opens the subscriber home", async () => {
    let me = ME_LOCKED;
    const completed: Handler = () => {
      me = ME_SUBSCRIBER;
      return jsonResponse({ data: { subscriptionId: SUBSCRIPTION_ID, status: "active" } });
    };
    await renderPortal(
      portalApi(ME_LOCKED, {
        "GET /me": () => jsonResponse({ data: me }),
        "POST /crm/portal/subscriptions": subscribed,
        "POST /crm/portal/complete-payment": completed,
      }),
    );
    await fireEvent.press(await screen.findByRole("button", PAY));
    expect(await screen.findByText("Payment pending")).toBeOnTheScreen();
    expect(
      screen.getByText("Complete the payment to activate your subscription."),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button", PAY)).toBeNull();
    await fireEvent.press(screen.getByRole("button", COMPLETE));
    expect(await screen.findByText("Find your venue")).toBeOnTheScreen();
  });

  it("keeps the payment from being sent twice while it activates", async () => {
    await renderPortal(
      portalApi(ME_LOCKED, {
        "POST /crm/portal/subscriptions": subscribed,
        "POST /crm/portal/complete-payment": pending,
      }),
    );
    await fireEvent.press(await screen.findByRole("button", PAY));
    const complete = await screen.findByRole("button", COMPLETE);
    await fireEvent.press(complete);
    await waitFor(() => expect(complete).toBeDisabled());
  });

  it("says so when the subscription cannot start", async () => {
    await renderPortal(
      portalApi(ME_LOCKED, { "POST /crm/portal/subscriptions": () => failure("internal", 500) }),
    );
    await fireEvent.press(await screen.findByRole("button", PAY));
    expect(await screen.findByText("Could not start the subscription")).toBeOnTheScreen();
    expect(screen.getByRole("button", PAY)).toBeOnTheScreen();
    await dismissToast();
  });

  it("says so when the payment cannot complete", async () => {
    await renderPortal(
      portalApi(ME_LOCKED, {
        "POST /crm/portal/subscriptions": subscribed,
        "POST /crm/portal/complete-payment": () => failure("internal", 500),
      }),
    );
    await fireEvent.press(await screen.findByRole("button", PAY));
    await fireEvent.press(await screen.findByRole("button", COMPLETE));
    expect(await screen.findByText("Could not complete the payment")).toBeOnTheScreen();
    await dismissToast();
  });

  it("lets a principal with a scoped hotel set browse it before subscribing", async () => {
    await renderPortal(portalApi(ME_DEMO));
    await fireEvent.press(await screen.findByRole("button", { name: "Browse hotels" }));
    expect(mockPush).toHaveBeenCalledWith("/hotels");
    expect(screen.getByText("Activate hotel discovery")).toBeOnTheScreen();
  });

  it("offers the hotel requests to a client entitled to hotel assistance", async () => {
    const agreement = {
      ...ME_LOCKED,
      entitlements: { ...ME_LOCKED.entitlements, modules: ["hotel_assistance" as const] },
    };
    await renderPortal(portalApi(agreement));
    await fireEvent.press(await screen.findByRole("button", { name: /Your hotel requests/ }));
    expect(mockPush).toHaveBeenCalledWith("/portal/requests");
  });
});

describe("PortalScreen plan catalogue states", () => {
  it("shows the plans' skeleton while they load", async () => {
    await renderPortal(portalApi(ME_LOCKED, { "GET /crm/plans": pending }));
    expect(await screen.findByTestId("portal-plans-loading")).toBeOnTheScreen();
  });

  it("shows the empty state when no plan is on sale", async () => {
    const none: Handler = () => jsonResponse({ data: { items: [] } });
    await renderPortal(portalApi(ME_LOCKED, { "GET /crm/plans": none }));
    expect(await screen.findByText("No plans available yet")).toBeOnTheScreen();
  });

  it("shows the offline state when the plans cannot load", async () => {
    const offline: Handler = () => Promise.reject(new Error("no network"));
    await renderPortal(portalApi(ME_LOCKED, { "GET /crm/plans": offline }));
    expect(await screen.findByText(uiCopy.offline.title)).toBeOnTheScreen();
  });

  it("shows the error state when the plans fail", async () => {
    await renderPortal(portalApi(ME_LOCKED, { "GET /crm/plans": () => failure("internal", 500) }));
    expect(await screen.findByText(uiCopy.error.title)).toBeOnTheScreen();
  });

  it("shows every plan on sale with its own pay button", async () => {
    const second = { ...PLAN, id: "018f0000-0000-7000-8000-0000000000a2", planKey: "second" };
    const two: Handler = () => jsonResponse({ data: { items: [PLAN, second] } });
    await renderPortal(portalApi(ME_LOCKED, { "GET /crm/plans": two }));
    expect(await screen.findAllByRole("button", PAY)).toHaveLength(2);
  });
});
