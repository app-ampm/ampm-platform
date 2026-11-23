import { fireEvent, renderRouter, screen } from "expo-router/testing-library";
import type { ReactNode } from "react";
import { Text } from "react-native";

import { ThemeProvider, ToastProvider } from "@ampm/ui";

import { AppStack } from "./app-stack";
import { CRASH_COPY } from "./screen-crash";

// The chrome reads `/me` to draw the rail; these tests are about the stack inside it.
jest.mock("./app-chrome", () => ({
  AppChrome: ({ children }: { readonly children: ReactNode }) => children,
}));
jest.mock("./crash-log", () => ({ logCrash: jest.fn() }));

function Providers({ children }: { readonly children: ReactNode }) {
  return (
    <ThemeProvider initialPreference="dark">
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  );
}

function BrokenScreen(): ReactNode {
  throw new Error("A screen bug");
}

const ROUTES = {
  _layout: () => <AppStack />,
  index: () => <Text>Home page</Text>,
  broken: BrokenScreen,
};

/*
 * The per-screen boundary is expo-router 58's `unstable_screenErrorBoundary` (D-160): this pins what
 * the app relies on, so an expo-router upgrade that changes it fails here rather than on a device.
 */
describe("AppStack", () => {
  beforeEach(() => {
    // React reports the error the boundary caught; that report is expected here.
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it("keeps a crash inside its screen, showing the crash screen in its place", async () => {
    await renderRouter(ROUTES, { initialUrl: "/broken", wrapper: Providers });
    expect(await screen.findByText(CRASH_COPY.stateTitle)).toBeOnTheScreen();
    expect(screen.queryByText(/A screen bug/)).toBeNull();
  });

  it("leaves the navigator working, so Go to home leads out of the crash", async () => {
    await renderRouter(ROUTES, { initialUrl: "/broken", wrapper: Providers });
    await fireEvent.press(await screen.findByRole("button", { name: CRASH_COPY.home }));
    expect(await screen.findByText("Home page")).toBeOnTheScreen();
  });
});
