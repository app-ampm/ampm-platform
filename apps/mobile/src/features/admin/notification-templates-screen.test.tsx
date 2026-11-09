import type { ReactNode } from "react";

import { uiCopy } from "@ampm/ui";

import { fireEvent, screen } from "../../test/render";
import { NotificationTemplatesScreen } from "./notification-templates-screen";
import {
  failure,
  notificationTemplatesConfig,
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

const CONFIG_PATH = "/admin/configurations/notification.templates";

const templatesFetch = (config = notificationTemplatesConfig()): FetchFn =>
  routedFetch({ [CONFIG_PATH]: () => ok(config) });

async function renderScreen(fetchImpl: FetchFn, tabBar?: ReactNode): Promise<void> {
  await renderWithApi(<NotificationTemplatesScreen tabBar={tabBar} />, fetchImpl);
}

beforeEach(() => {
  mockReplace.mockClear();
});

describe("NotificationTemplatesScreen", () => {
  it("shows skeletons while the templates load", async () => {
    await renderScreen(() => new Promise<Response>(() => {}));
    expect(screen.getByTestId("notification-templates-loading")).toBeOnTheScreen();
    expect(screen.getByText("Notification templates")).toBeOnTheScreen();
  });

  it("lists each template with its channels, and counts them", async () => {
    await renderScreen(templatesFetch());
    expect(await screen.findByText("Staff invite")).toBeOnTheScreen();
    expect(screen.getByText("Booking reminder")).toBeOnTheScreen();
    expect(screen.getByText("Email")).toBeOnTheScreen();
    expect(screen.getByText("SMS · Push")).toBeOnTheScreen();
    expect(screen.getByText("Templates · 2")).toBeOnTheScreen();
  });

  it("opens a template's full content and variables from its row", async () => {
    await renderScreen(templatesFetch());
    await fireEvent.press(await screen.findByLabelText(/Staff invite, Email/));
    expect(await screen.findByText("Subject")).toBeOnTheScreen();
    expect(screen.getByText("Your AMPM invitation")).toBeOnTheScreen();
    expect(screen.getByText("name, activationUrl")).toBeOnTheScreen();
  });

  it("says when there are no templates yet", async () => {
    await renderScreen(templatesFetch({ key: "notification.templates", value: {} }));
    expect(await screen.findByText("No templates yet")).toBeOnTheScreen();
  });

  it("shows the error state when the API fails", async () => {
    await renderScreen(routedFetch({ [CONFIG_PATH]: () => failure("internal", 500) }));
    expect(await screen.findByText(uiCopy.error.title)).toBeOnTheScreen();
  });

  it("asks to sign in again once the session has ended", async () => {
    await renderScreen(routedFetch({ [CONFIG_PATH]: () => failure("unauthenticated", 401) }));
    expect(await screen.findByText("Sign in to view templates")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Sign in"));
    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  });
});
