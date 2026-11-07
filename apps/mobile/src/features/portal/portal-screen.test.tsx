import { Text } from "react-native";

import { uiCopy } from "@ampm/ui";

import { getAccessToken, setAccessToken } from "@/lib/session";

import { fireEvent, screen } from "../../test/render";
import {
  ME_LOCKED,
  ME_SUBSCRIBER,
  apiFetch,
  failure,
  pending,
  portalApi,
  renderPortal,
} from "./portal.fixtures";

// The screen navigates with the router (search, the shortlist, requests, sign-in); a stub records it.
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
});

describe("PortalScreen while /me loads or fails", () => {
  it("shows the loading skeleton while /me is pending", async () => {
    await renderPortal(apiFetch({ "GET /me": pending }));
    expect(screen.getByTestId("portal-loading")).toBeOnTheScreen();
  });

  it("asks a signed-out client to sign in, and goes to sign-in", async () => {
    await renderPortal(apiFetch({ "GET /me": () => failure("unauthenticated", 401) }));
    expect(await screen.findByText("Sign in to view your plan")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  });

  it("shows the offline state on a network failure", async () => {
    await renderPortal(() => Promise.reject(new Error("no network")));
    expect(await screen.findByText(uiCopy.offline.title)).toBeOnTheScreen();
  });

  it("shows the generic error state on a server error, and keeps sign-out in reach", async () => {
    setAccessToken("signed-in-token");
    await renderPortal(apiFetch({ "GET /me": () => failure("internal", 500) }));
    expect(await screen.findByText(uiCopy.error.title)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(getAccessToken()).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  });

  it("floats the tab bar the route gives it, in every state", async () => {
    await renderPortal(apiFetch({ "GET /me": pending }), <Text>Tab bar</Text>);
    expect(screen.getByText("Tab bar")).toBeOnTheScreen();
  });
});

describe("PortalScreen subscriber home (CP-01)", () => {
  it("greets the subscriber by first name and shows the plan as active", async () => {
    await renderPortal(portalApi(ME_SUBSCRIBER));
    expect(await screen.findByText("Find your venue")).toBeOnTheScreen();
    expect(screen.getByText("Hello, Ananya")).toBeOnTheScreen();
    // A phone-sized window: the header carries the client's avatar (P2).
    expect(screen.getByRole("image", { name: "Ananya Sharma" })).toBeOnTheScreen();
    expect(screen.getByText("Active")).toBeOnTheScreen();
    // The activation page and its payment are gone once discovery is active.
    expect(screen.queryByText("Activate hotel discovery")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Pay / })).toBeNull();
  });

  it("opens search, the shortlist and the hotel requests", async () => {
    await renderPortal(portalApi(ME_SUBSCRIBER));
    await fireEvent.press(await screen.findByRole("button", { name: "Search hotels" }));
    expect(mockPush).toHaveBeenLastCalledWith("/hotels");
    await fireEvent.press(screen.getByRole("button", { name: /Saved hotels/ }));
    expect(mockPush).toHaveBeenLastCalledWith("/hotels/saved");
    await fireEvent.press(screen.getByRole("button", { name: /Your hotel requests/ }));
    expect(mockPush).toHaveBeenLastCalledWith("/portal/requests");
  });

  it("keeps the hotel requests for clients entitled to hotel assistance", async () => {
    const withoutAssistance = {
      ...ME_SUBSCRIBER,
      entitlements: { ...ME_SUBSCRIBER.entitlements, modules: ["hotel_discovery" as const] },
    };
    await renderPortal(portalApi(withoutAssistance));
    expect(await screen.findByText("Find your venue")).toBeOnTheScreen();
    expect(screen.queryByText("Your hotel requests")).toBeNull();
  });

  it("shows My Wedding and Approvals as locked, and no sign-out of its own", async () => {
    await renderPortal(portalApi(ME_SUBSCRIBER));
    expect(await screen.findByText("Planning the whole wedding?")).toBeOnTheScreen();
    expect(
      screen.getByText("My Wedding and Approvals open once AMPM is appointed."),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText("Locked")).toBeOnTheScreen();
    // Sign-out lives on the account (More) screen.
    expect(screen.queryByText("Sign out")).toBeNull();
  });

  it("does not load the plan catalogue once discovery is active", async () => {
    const plans = jest.fn(() => failure("internal", 500));
    await renderPortal(portalApi(ME_SUBSCRIBER, { "GET /crm/plans": plans }));
    expect(await screen.findByText("Find your venue")).toBeOnTheScreen();
    expect(plans).not.toHaveBeenCalled();
  });
});

describe("PortalScreen for a client still locked out", () => {
  it("shows the activation page, not the subscriber home", async () => {
    await renderPortal(portalApi(ME_LOCKED));
    expect(await screen.findByText("Activate hotel discovery")).toBeOnTheScreen();
    expect(screen.queryByText("Find your venue")).toBeNull();
  });
});
