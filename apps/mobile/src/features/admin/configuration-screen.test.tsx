import type { ReactNode } from "react";

import { uiCopy } from "@ampm/ui";

import { fireEvent, screen } from "../../test/render";
import { ConfigurationScreen } from "./configuration-screen";
import {
  configurationsList,
  failure,
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

const CONFIG_PATH = "/admin/configurations";

const configFetch = (list: ReturnType<typeof configurationsList> = configurationsList()): FetchFn =>
  routedFetch({ [CONFIG_PATH]: () => ok(list) });

async function renderScreen(fetchImpl: FetchFn, tabBar?: ReactNode): Promise<void> {
  await renderWithApi(<ConfigurationScreen tabBar={tabBar} />, fetchImpl);
}

beforeEach(() => {
  mockReplace.mockClear();
});

describe("ConfigurationScreen", () => {
  it("shows skeletons while the configuration loads", async () => {
    await renderScreen(() => new Promise<Response>(() => {}));
    expect(screen.getByTestId("configuration-loading")).toBeOnTheScreen();
    expect(screen.getByText("Configuration")).toBeOnTheScreen();
  });

  it("lists each setting with its value, leaves out the notification templates, and counts them", async () => {
    await renderScreen(configFetch());
    expect(await screen.findByText("Session idle timeouts")).toBeOnTheScreen();
    expect(screen.getByText("Hotel verification policy")).toBeOnTheScreen();
    expect(screen.getByText("Feature flags")).toBeOnTheScreen();
    expect(screen.getByText("Max age days: 90")).toBeOnTheScreen();
    // feature.flags is empty → "Not set"; notification templates has its own screen, so it is absent.
    expect(screen.getByText("Not set")).toBeOnTheScreen();
    expect(screen.queryByText("Notification templates")).toBeNull();
    expect(screen.getByText("Settings · 4")).toBeOnTheScreen();
  });

  it("opens a setting's full value from its row, with its description and field values", async () => {
    await renderScreen(configFetch());
    await fireEvent.press(await screen.findByLabelText(/Session idle timeouts, Access/));
    expect(await screen.findByText("session.idle_timeouts")).toBeOnTheScreen();
    expect(screen.getByText("Staff minutes")).toBeOnTheScreen();
    expect(screen.getByText("720")).toBeOnTheScreen();
    expect(
      screen.getByText(
        "How long a signed-in session stays active without activity, in minutes, by audience (staff, client, demo).",
      ),
    ).toBeOnTheScreen();
  });

  it("shows the empty-value state in the sheet for a setting with nothing configured", async () => {
    await renderScreen(configFetch());
    await fireEvent.press(await screen.findByLabelText(/Feature flags, Platform/));
    expect(await screen.findByText("feature.flags")).toBeOnTheScreen();
    expect(screen.getByText("Nothing configured — the default applies.")).toBeOnTheScreen();
  });

  it("says when there is no configuration", async () => {
    await renderScreen(configFetch({ entries: [] }));
    expect(await screen.findByText("No configuration")).toBeOnTheScreen();
  });

  it("shows the error state when the API fails", async () => {
    await renderScreen(routedFetch({ [CONFIG_PATH]: () => failure("internal", 500) }));
    expect(await screen.findByText(uiCopy.error.title)).toBeOnTheScreen();
  });

  it("asks to sign in again once the session has ended", async () => {
    await renderScreen(routedFetch({ [CONFIG_PATH]: () => failure("unauthenticated", 401) }));
    expect(await screen.findByText("Sign in to view configuration")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Sign in"));
    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  });
});
