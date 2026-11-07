import { Text } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import { ME_QUERY_KEY } from "@ampm/api-client";
import type { MeResponse, PrincipalType, StaffRoleCode } from "@ampm/core";
import { uiCopy } from "@ampm/ui";

import { createTestQueryClient, pendingFetch, renderWithApi } from "../test/api";
import { fireEvent, screen } from "../test/render";
import { AppChrome } from "./app-chrome";

// The chrome reads the path and moves between areas through the router; the window class says
// whether the window is wide and the rail expanded. Variables named mock* may be read in jest.mock.
const mockDismissTo = jest.fn();
const mockReplace = jest.fn();
let mockPathname = "/";
let mockWindow = { isWide: true, isRailExpanded: true };

jest.mock("expo-router", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ dismissTo: mockDismissTo, replace: mockReplace }),
}));

jest.mock("./use-window-class", () => ({
  useWindowClass: () => mockWindow,
}));

function me(type: PrincipalType, roles: StaffRoleCode[], name: string): MeResponse {
  return {
    principal: {
      type,
      userId: "018f0000-0000-7000-8000-00000000cafe",
      name,
      email: null,
      phone: null,
      status: "active",
      lastLoginAt: null,
    },
    roles,
    memberships: [],
    entitlements: {
      modules: [],
      readOnlyModules: [],
      hotelReach: [],
      financeReach: [],
      requestTypes: { wedding: [], account: [] },
    },
    isDemo: false,
  };
}

const SALES = me("staff", ["SM"], "Sameer Sales");
const CLIENT = me("client", [], "Rhea Client");

/** What the screens under the chrome are told to keep clear of. */
function InsetsProbe() {
  const { top, left } = useSafeAreaInsets();
  return <Text>{`insets ${top} ${left}`}</Text>;
}

const DEVICE = {
  frame: { x: 0, y: 0, width: 1024, height: 768 },
  insets: { top: 24, left: 44, right: 44, bottom: 20 },
};

/** The chrome around a stand-in for the stack, at a path, with /me in the cache (never refetched). */
async function renderChrome(path: string, seed: MeResponse) {
  mockPathname = path;
  const queryClient = createTestQueryClient({ staleTime: Infinity });
  queryClient.setQueryData(ME_QUERY_KEY, seed);
  await renderWithApi(
    <SafeAreaProvider initialMetrics={DEVICE}>
      <AppChrome>
        <InsetsProbe />
      </AppChrome>
    </SafeAreaProvider>,
    pendingFetch,
    { queryClient },
  );
}

beforeEach(() => {
  mockDismissTo.mockReset();
  mockReplace.mockReset();
  mockWindow = { isWide: true, isRailExpanded: true };
});

describe("AppChrome for staff", () => {
  it("draws the rail of the granted areas beside the stack, the area of the path selected", async () => {
    await renderChrome("/leads/018f0000-0000-7000-8000-0000000000a1", SALES);
    expect(screen.getByTestId("staff-rail")).toBeOnTheScreen();
    expect(screen.getByText("AMPM")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Leads & Clients" })).toBeSelected();
    // Sales holds no incidents key, so the Tasks area (the field notes) stays out of its rail.
    expect(screen.queryByRole("button", { name: "Tasks & Operations" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Hotel enquiries" }));
    expect(mockDismissTo).toHaveBeenCalledWith("/enquiries");
    // The rail keeps the left edge clear, so the screens keep only the top.
    expect(screen.getByText("insets 24 0")).toBeOnTheScreen();
  });

  it("names the person and their roles, and signs out", async () => {
    await renderChrome("/account", SALES);
    expect(screen.getByText("Sameer Sales")).toBeOnTheScreen();
    expect(screen.getByText("Sales / Relationship Manager")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  });

  it("folds the rail to icons below 1200", async () => {
    mockWindow = { isWide: true, isRailExpanded: false };
    await renderChrome("/enquiries", SALES);
    expect(screen.getByText("A")).toBeOnTheScreen();
    expect(screen.queryByText("Sameer Sales")).toBeNull();
    expect(screen.getByRole("button", { name: "Hotel enquiries" })).toBeSelected();
  });
});

describe("AppChrome for a client", () => {
  it("draws the top navigation above the stack, the area of the path selected", async () => {
    await renderChrome("/hotels/saved", CLIENT);
    expect(screen.getByTestId("client-top-nav")).toBeOnTheScreen();
    expect(screen.getByRole("link", { name: "Hotels" })).toBeSelected();
    await fireEvent.press(screen.getByRole("link", { name: "Home" }));
    await fireEvent.press(screen.getByRole("link", { name: "Account, Rhea Client" }));
    expect(mockDismissTo.mock.calls).toEqual([["/portal"], ["/account"]]);
    // The bar keeps the top edge clear, so the screens keep only the sides.
    expect(screen.getByText("insets 0 44")).toBeOnTheScreen();
  });

  it("explains a locked area with a toast instead of navigating", async () => {
    await renderChrome("/portal", CLIENT);
    await fireEvent.press(screen.getByRole("button", { name: "Approvals, Locked" }));
    expect(await screen.findByText("Opens once AMPM is appointed")).toBeOnTheScreen();
    expect(mockDismissTo).not.toHaveBeenCalled();
    // Dismissed here rather than left on its four-second timer, which would hold Jest open.
    await fireEvent.press(screen.getByRole("button", { name: uiCopy.dismiss }));
  });
});

describe("AppChrome draws nothing around the stack", () => {
  it.each([
    ["on a phone", "/leads", SALES, false],
    ["on sign-in", "/sign-in", SALES, true],
    ["on the gallery", "/gallery", CLIENT, true],
    ["on the entry redirect", "/", CLIENT, true],
    ["on the other audience's routes", "/portal", SALES, true],
  ] as const)("%s", async (_case, path, seed, isWide) => {
    mockWindow = { isWide, isRailExpanded: isWide };
    await renderChrome(path, seed);
    expect(screen.queryByTestId("staff-rail")).toBeNull();
    expect(screen.queryByTestId("client-top-nav")).toBeNull();
    expect(screen.getByText("insets 24 44")).toBeOnTheScreen();
  });
});
