import type { ReactNode } from "react";

import type { MeResponse } from "@ampm/core";
import { uiCopy } from "@ampm/ui";

import { fireEvent, screen, waitFor } from "../../test/render";
import { ConfigurationScreen } from "./configuration-screen";
import {
  configurationsList,
  failure,
  meFixture,
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

const configFetch = (
  list: ReturnType<typeof configurationsList> = configurationsList(),
  me: MeResponse = meFixture(),
): FetchFn => routedFetch({ [CONFIG_PATH]: () => ok(list), "/me": () => ok(me) });

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

  it("lets a Super Admin open the typed editor from a setting", async () => {
    await renderScreen(configFetch());
    await fireEvent.press(await screen.findByLabelText(/Session idle timeouts, Access/));
    await fireEvent.press(await screen.findByTestId("configuration-edit-open"));
    // The read sheet gives way to the editor, with a typed field for the value.
    expect(await screen.findByTestId("config-field-staffMinutes")).toBeOnTheScreen();
    expect(screen.getByTestId("configuration-edit-submit")).toBeOnTheScreen();
  });

  it("offers no Edit action to a reader without the update permission (Finance)", async () => {
    await renderScreen(configFetch(configurationsList(), meFixture(["FA"])));
    await fireEvent.press(await screen.findByLabelText(/Session idle timeouts, Access/));
    // The read sheet opens, but Finance (read-only) gets no Edit action.
    expect(await screen.findByText("session.idle_timeouts")).toBeOnTheScreen();
    expect(screen.queryByTestId("configuration-edit-open")).toBeNull();
  });

  it("refreshes the inventory after a Super Admin saves an edit", async () => {
    let listHits = 0;
    const fetchImpl = routedFetch({
      [CONFIG_PATH]: () => {
        listHits += 1;
        return ok(configurationsList());
      },
      "/me": () => ok(meFixture()),
      "/admin/configurations/session.idle_timeouts": () =>
        ok({
          key: "session.idle_timeouts",
          value: { staffMinutes: 600, clientMinutes: 43200, demoMinutes: 43200 },
        }),
    });
    await renderScreen(fetchImpl);
    await fireEvent.press(await screen.findByLabelText(/Session idle timeouts, Access/));
    await fireEvent.press(await screen.findByTestId("configuration-edit-open"));
    await fireEvent.changeText(await screen.findByTestId("config-field-staffMinutes"), "600");
    const before = listHits;
    await fireEvent.press(screen.getByTestId("configuration-edit-submit"));
    expect(await screen.findByText("Setting saved")).toBeOnTheScreen();
    // Saving invalidates the inventory query, so the active list refetches.
    await waitFor(() => expect(listHits).toBeGreaterThan(before));
  });
});
