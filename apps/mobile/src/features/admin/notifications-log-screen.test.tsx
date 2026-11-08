import type { ReactNode } from "react";

import { uiCopy } from "@ampm/ui";

import { fireEvent, screen } from "../../test/render";
import { NotificationsLogScreen } from "./notifications-log-screen";
import {
  failure,
  notificationFixture,
  ok,
  renderWithApi,
  routedFetch,
  type FetchFn,
} from "./admin.test-utils";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), replace: mockReplace, push: jest.fn() }),
}));

const mockWindow = { width: 1280 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWindow.width, height: 900, scale: 2, fontScale: 1 }),
}));

const notificationsFetch = (
  items = [notificationFixture()],
  nextCursor: string | null = null,
): FetchFn => routedFetch({ "/notifications": () => ok({ items, nextCursor }) });

async function renderLog(fetchImpl: FetchFn, tabBar?: ReactNode): Promise<void> {
  await renderWithApi(<NotificationsLogScreen tabBar={tabBar} />, fetchImpl);
}

beforeEach(() => {
  mockReplace.mockClear();
});

describe("NotificationsLogScreen", () => {
  it("shows skeletons while the log loads", async () => {
    await renderLog(() => new Promise<Response>(() => {}));
    expect(screen.getByTestId("notifications-loading")).toBeOnTheScreen();
    expect(screen.getByText("Notifications")).toBeOnTheScreen();
  });

  it("lists notifications with channel, template and status, and counts them", async () => {
    await renderLog(notificationsFetch());
    expect(await screen.findByText("Client invite")).toBeOnTheScreen();
    expect(screen.getByText("Email")).toBeOnTheScreen();
    expect(screen.getByText("Delivered")).toBeOnTheScreen();
    expect(screen.getByText("Notifications · 1")).toBeOnTheScreen();
  });

  it("marks a longer first page with a + after the count", async () => {
    await renderLog(notificationsFetch([notificationFixture()], "next-cursor"));
    expect(await screen.findByText("Notifications · 1+")).toBeOnTheScreen();
  });

  it("opens a notification's full record from its row", async () => {
    await renderLog(notificationsFetch());
    await fireEvent.press(await screen.findByLabelText(/Client invite by Email/));
    expect(await screen.findByText("Notification")).toBeOnTheScreen();
    expect(screen.getByText("Created")).toBeOnTheScreen();
    expect(screen.getByText("Sent")).toBeOnTheScreen();
  });

  it("says when there are no notifications yet", async () => {
    await renderLog(notificationsFetch([]));
    expect(await screen.findByText("No notifications yet")).toBeOnTheScreen();
  });

  it("shows the error state when the API fails", async () => {
    await renderLog(routedFetch({ "/notifications": () => failure("internal", 500) }));
    expect(await screen.findByText(uiCopy.error.title)).toBeOnTheScreen();
  });

  it("asks to sign in again once the session has ended", async () => {
    await renderLog(routedFetch({ "/notifications": () => failure("unauthenticated", 401) }));
    expect(await screen.findByText("Sign in to view notifications")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Sign in"));
    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  });
});
