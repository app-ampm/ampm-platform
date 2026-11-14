import { focusManager } from "@tanstack/react-query";
import { Text } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiProvider, ME_QUERY_KEY } from "@ampm/api-client";
import type { MeResponse, PrincipalType, StaffRoleCode } from "@ampm/core";

import { setAccessToken } from "@/lib/session";

import { createTestQueryClient, ok, pendingFetch, renderWithApi, TEST_API_BASE } from "../test/api";
import { act, fireEvent, screen, within } from "../test/render";
import { AppChrome } from "./app-chrome";

// The chrome reads the path and moves between areas through the router; the window class says
// whether the window is wide and the rail expanded. Variables named mock* may be read in jest.mock.
const mockDismissTo = jest.fn();
const mockReplace = jest.fn();
let mockPathname = "/";
let mockWindow = { isWide: true, isDesktop: true, isRailExpanded: true };

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

/** The chrome around a stand-in for the stack. */
function chrome() {
  return (
    <SafeAreaProvider initialMetrics={DEVICE}>
      <AppChrome>
        <InsetsProbe />
      </AppChrome>
    </SafeAreaProvider>
  );
}

/** The chrome at a path, with /me in the cache (never refetched). */
async function renderChrome(path: string, seed: MeResponse) {
  mockPathname = path;
  const queryClient = createTestQueryClient({ staleTime: Infinity });
  queryClient.setQueryData(ME_QUERY_KEY, seed);
  await renderWithApi(chrome(), pendingFetch, { queryClient });
}

beforeEach(() => {
  mockDismissTo.mockReset();
  mockReplace.mockReset();
  mockWindow = { isWide: true, isDesktop: true, isRailExpanded: true };
  setAccessToken("signed-in-token");
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
    // The rail floats over the screens' left edge: they keep clear of it (44 + 16 + 232) and the top.
    expect(screen.getByText("insets 24 292")).toBeOnTheScreen();
  });

  it("names the person and their roles, and signs out", async () => {
    await renderChrome("/account", SALES);
    expect(screen.getByText("Sameer Sales")).toBeOnTheScreen();
    expect(screen.getByText("Sales / Relationship Manager")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  });

  it("folds the rail to icons below 1200", async () => {
    mockWindow = { isWide: true, isDesktop: true, isRailExpanded: false };
    await renderChrome("/enquiries", SALES);
    expect(screen.getByText("A")).toBeOnTheScreen();
    expect(screen.queryByText("Sameer Sales")).toBeNull();
    expect(screen.getByRole("button", { name: "Hotel enquiries" })).toBeSelected();
    // Folded, the rail is 80 wide.
    expect(screen.getByText("insets 24 140")).toBeOnTheScreen();
  });

  it("draws the rail's frame from the first paint, before /me answers", async () => {
    mockPathname = "/leads";
    await renderWithApi(chrome(), pendingFetch);
    expect(screen.getByTestId("staff-rail")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Leads & Clients" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    expect(screen.getByText("insets 24 292")).toBeOnTheScreen();
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
    // The bar floats over the screens' top edge: they keep clear of it (24 + 20 + 20 + 44) and the sides.
    expect(screen.getByText("insets 108 44")).toBeOnTheScreen();
  });

  it("draws the bar from the first paint, keeping the avatar's place until /me answers", async () => {
    mockPathname = "/hotels";
    await renderWithApi(chrome(), pendingFetch);
    expect(screen.getByTestId("client-top-nav")).toBeOnTheScreen();
    expect(screen.getByRole("link", { name: "Hotels" })).toBeSelected();
    expect(screen.queryByRole("link", { name: /^Account/ })).toBeNull();
    expect(screen.getByText("insets 108 44")).toBeOnTheScreen();
  });

  it("waits for /me on the account, a route of both audiences", async () => {
    mockPathname = "/account";
    await renderWithApi(chrome(), pendingFetch);
    expect(screen.queryByTestId("client-top-nav")).toBeNull();
    expect(screen.queryByTestId("staff-rail")).toBeNull();
  });

  it("shows D4's five areas, More marked current on the account, locked ones tagged", async () => {
    await renderChrome("/account", CLIENT);
    const bar = within(screen.getByTestId("client-top-nav"));
    expect(bar.getByRole("link", { name: "More" })).toBeSelected();
    expect(bar.getByRole("link", { name: "More" })).toHaveProp("aria-current", "page");
    // The avatar opens the account too, but only one item says it is the current page.
    expect(bar.getByRole("link", { name: "Account, Rhea Client" })).not.toHaveProp("aria-current");
    expect(within(bar.getByTestId("client-top-nav-wedding")).getByText("Locked")).toBeOnTheScreen();
  });

  it("leaves the avatar out below 1024, where More opens the account and the five areas fill the bar", async () => {
    mockWindow = { isWide: true, isDesktop: false, isRailExpanded: false };
    await renderChrome("/portal", CLIENT);
    expect(screen.getByRole("link", { name: "More" })).toBeOnTheScreen();
    expect(screen.queryByRole("link", { name: /^Account/ })).toBeNull();
  });

  it("explains a locked area with a toast instead of navigating", async () => {
    await renderChrome("/portal", CLIENT);
    await fireEvent.press(screen.getByRole("button", { name: "Approvals, Locked" }));
    expect(await screen.findByText("Opens once AMPM is appointed")).toBeOnTheScreen();
    expect(mockDismissTo).not.toHaveBeenCalled();
  });
});

const ME_URL = `${TEST_API_BASE}/me`;

/** The API answering /me for Sales, recording each URL it is asked. */
function recordingApi(asked: string[]): typeof fetch {
  return (input) => {
    asked.push(String(input));
    return Promise.resolve(ok(SALES));
  };
}

/** The window loses and regains focus: React Query refetches what is stale, a tick later. */
async function regainFocus(): Promise<void> {
  await act(async () => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("AppChrome and the session", () => {
  afterEach(() => {
    focusManager.setFocused(undefined);
  });

  it("asks nothing for /me on sign-in, then draws the rail once signing in navigates", async () => {
    setAccessToken(null);
    mockPathname = "/sign-in";
    const asked: string[] = [];
    const api = recordingApi(asked);
    const queryClient = await renderWithApi(chrome(), api);
    expect(asked).toEqual([]);
    // Signing in stores the token and clears the cache, then navigates; the navigation renders the
    // chrome again (features/auth/sign-in-screen.tsx).
    await act(() => {
      setAccessToken("signed-in-token");
      queryClient.clear();
    });
    mockPathname = "/leads";
    await screen.rerender(
      <ApiProvider baseUrl={TEST_API_BASE} fetch={api} queryClient={queryClient}>
        {chrome()}
      </ApiProvider>,
    );
    expect(await screen.findByTestId("staff-rail")).toBeOnTheScreen();
    expect(asked).toEqual([ME_URL]);
  });

  it("takes the rail away on signing out, and asks /me no more when the window regains focus", async () => {
    mockPathname = "/leads";
    const asked: string[] = [];
    await renderWithApi(chrome(), recordingApi(asked));
    expect(await screen.findByTestId("staff-rail")).toBeOnTheScreen();
    await regainFocus();
    expect(asked).toEqual([ME_URL, ME_URL]);
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.queryByTestId("staff-rail")).toBeNull();
    await regainFocus();
    expect(asked).toEqual([ME_URL, ME_URL]);
  });

  it.each<[string, string, boolean]>([
    ["on sign-in, with a refused token still held", "/sign-in", true],
    ["on the gallery", "/gallery", true],
    ["on the entry redirect", "/", true],
    ["on a phone, where it draws nothing", "/leads", false],
  ])("asks nothing for /me %s, even on a regained focus", async (_case, path, isWide) => {
    mockPathname = path;
    mockWindow = { isWide, isDesktop: isWide, isRailExpanded: isWide };
    const asked: string[] = [];
    await renderWithApi(chrome(), recordingApi(asked));
    await regainFocus();
    expect(asked).toEqual([]);
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
    mockWindow = { isWide, isDesktop: isWide, isRailExpanded: isWide };
    await renderChrome(path, seed);
    expect(screen.queryByTestId("staff-rail")).toBeNull();
    expect(screen.queryByTestId("client-top-nav")).toBeNull();
    expect(screen.getByText("insets 24 44")).toBeOnTheScreen();
  });
});
