import type { HotelEnquiryClientView } from "@ampm/core";

import { fireEvent, screen, within } from "../../test/render";
import { ENQUIRY } from "../consultancy/consultancy.fixtures";
import { ME_LOCKED, ME_SUBSCRIBER, jsonResponse, portalApi, renderPortal } from "./portal.fixtures";
import type * as RouterStub from "./portal.test-router";

const mockPush = jest.fn();
jest.mock("expo-router", () =>
  jest
    .requireActual<typeof RouterStub>("./portal.test-router")
    .expoRouterStub({ push: (href) => mockPush(href), replace: jest.fn(), back: jest.fn() }),
);

// The window's width decides between the phone composition (P2) and the desktop artboards (D2, D4).
const mockWindow = { width: 1440 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWindow.width, height: 900, scale: 2, fontScale: 1 }),
}));

beforeEach(() => {
  mockWindow.width = 1440;
  mockPush.mockClear();
});

const className = (testID: string) => String(screen.getByTestId(testID).props.className);

type Instance = Parameters<typeof within>[0];
/** The cells a layout component wraps its children in, in order. */
const cellsOf = (testID: string): Instance[] =>
  screen
    .getByTestId(testID)
    .children.filter((child): child is Instance => typeof child !== "string");

/** Four of the client's enquiries, so the home's preview has more than its three to show. */
const ENQUIRIES: HotelEnquiryClientView[] = ["e1", "e2", "e3", "e4"].map((suffix) => ({
  ...ENQUIRY,
  id: `018f0000-0000-7000-8000-0000000000${suffix}`,
}));

const withEnquiries = {
  "GET /consultancy/enquiries": () =>
    jsonResponse({ data: { items: ENQUIRIES, nextCursor: null } }),
};

/** Before the subscription, with hotel assistance already held (an agreement client, say). */
const ASSISTED_LOCKED = {
  ...ME_LOCKED,
  entitlements: { ...ME_LOCKED.entitlements, modules: ["hotel_assistance" as const] },
};

const withoutAssistance = {
  ...ME_SUBSCRIBER,
  entitlements: { ...ME_SUBSCRIBER.entitlements, modules: ["hotel_discovery" as const] },
};

describe("Subscriber home on a desktop (D4)", () => {
  it("puts the greeting, title and search on one card beside the plan", async () => {
    await renderPortal(portalApi(ME_SUBSCRIBER, withEnquiries));
    expect(await screen.findByText("Where shall we look today?")).toBeOnTheScreen();
    expect(screen.queryByText("Find your venue")).toBeNull();
    const card = within(screen.getByTestId("home-search-card"));
    expect(card.getByText("Hello, Ananya")).toBeOnTheScreen();
    expect(card.getByRole("button", { name: "Search hotels" })).toBeOnTheScreen();
    expect(className("home-search-row")).toContain("flex-row");
    // The top navigation carries the avatar on a desktop.
    expect(screen.queryByRole("image", { name: "Ananya Sharma" })).toBeNull();
  });

  it("sets My selection, the latest three enquiries and the locked card side by side", async () => {
    await renderPortal(portalApi(ME_SUBSCRIBER, withEnquiries));
    const preview = within(await screen.findByTestId("enquiries-preview"));
    expect(preview.getAllByText("Your decision")).toHaveLength(3);
    expect(className("home-panels")).toContain("flex-row");
    expect(screen.getByTestId("home-panels").children).toHaveLength(3);
    await fireEvent.press(preview.getByRole("link", { name: "All hotel requests" }));
    expect(mockPush).toHaveBeenLastCalledWith("/portal/requests");
    await fireEvent.press(preview.getByTestId(`request-${ENQUIRIES[1]?.id ?? ""}`));
    expect(mockPush).toHaveBeenLastCalledWith(`/portal/requests/${ENQUIRIES[1]?.id ?? ""}`);
    // The fourth waits on the requests page.
    expect(preview.queryByTestId(`request-${ENQUIRIES[3]?.id ?? ""}`)).toBeNull();
  });

  it("keeps the requests entry row when there are none to list", async () => {
    await renderPortal(portalApi(ME_SUBSCRIBER));
    expect(await screen.findByText("Your hotel requests")).toBeOnTheScreen();
    expect(screen.queryByTestId("enquiries-preview")).toBeNull();
  });

  it("drops the enquiries column for a client without hotel assistance", async () => {
    await renderPortal(portalApi(withoutAssistance));
    expect(await screen.findByText("Where shall we look today?")).toBeOnTheScreen();
    expect(screen.getByTestId("home-panels").children).toHaveLength(2);
    expect(screen.queryByText("Enquiries")).toBeNull();
  });

  it("keeps P2's stacked header, plan and pill on a phone", async () => {
    mockWindow.width = 390;
    await renderPortal(portalApi(ME_SUBSCRIBER, withEnquiries));
    expect(await screen.findByText("Find your venue")).toBeOnTheScreen();
    expect(screen.queryByTestId("home-search-row")).toBeNull();
    expect(className("home-panels")).toContain("flex-col");
    // The phone keeps the single entry row into the requests.
    expect(screen.getByText("Your hotel requests")).toBeOnTheScreen();
    expect(screen.queryByTestId("enquiries-preview")).toBeNull();
  });
});

describe("Activation on a desktop (D2)", () => {
  it("sets the header, steps and requests beside the payment card", async () => {
    await renderPortal(portalApi(ASSISTED_LOCKED));
    expect(await screen.findByText("Activate hotel discovery")).toBeOnTheScreen();
    expect(className("activation-columns")).toContain("flex-row");
    const [left, right] = cellsOf("activation-columns");
    if (!left || !right) throw new Error("expected two columns");
    expect(within(left).getByTestId("activation-steps")).toBeOnTheScreen();
    expect(within(left).getByText("Your hotel requests")).toBeOnTheScreen();
    expect(await within(right).findByRole("button", { name: "Pay ₹50,000" })).toBeOnTheScreen();
  });

  it("stacks them on a phone, the requests under the plans", async () => {
    mockWindow.width = 390;
    await renderPortal(portalApi(ASSISTED_LOCKED));
    expect(await screen.findByText("Activate hotel discovery")).toBeOnTheScreen();
    expect(className("activation-columns")).toContain("flex-col");
    const columns = screen.getByTestId("activation-columns");
    expect(within(columns).queryByText("Your hotel requests")).toBeNull();
    expect(screen.getByText("Your hotel requests")).toBeOnTheScreen();
  });
});
