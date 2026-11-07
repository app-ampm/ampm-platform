import type { QueryClient } from "@tanstack/react-query";

import { ME_QUERY_KEY } from "@ampm/api-client";
import type { MeResponse, PrincipalType, StaffRoleCode } from "@ampm/core";

import { setAccessToken } from "@/lib/session";

import {
  createTestQueryClient,
  failure,
  ok,
  pendingFetch,
  renderWithApi,
  TEST_API_BASE,
} from "../test/api";
import { act, fireEvent, screen } from "../test/render";
import { AppTabBar } from "./app-tab-bar";

// The bar reads the path and moves between areas through the router; the window class decides
// whether a phone tab bar is drawn at all. Variables named mock* may be read inside jest.mock.
const mockDismissTo = jest.fn();
let mockPathname = "/";
let mockIsWide = false;

jest.mock("expo-router", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ dismissTo: mockDismissTo }),
}));

jest.mock("./use-window-class", () => ({
  useWindowClass: () => ({ isWide: mockIsWide, isRailExpanded: false }),
}));

function me(type: PrincipalType, roles: StaffRoleCode[]): MeResponse {
  return {
    principal: {
      type,
      userId: "018f0000-0000-7000-8000-00000000cafe",
      name: type === "staff" ? "Sameer Sales" : "Rhea Client",
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

type FetchFn = typeof fetch;
/**
 * Renders the bar at a path, with /me already in the cache (seeded) or left to the fetch; staleTime
 * Infinity so React Query never refetches the seed.
 */
async function renderBar(
  path: string,
  seed?: MeResponse,
  fetchImpl: FetchFn = pendingFetch,
): Promise<QueryClient> {
  mockPathname = path;
  const queryClient = createTestQueryClient({ staleTime: Infinity });
  if (seed) queryClient.setQueryData(ME_QUERY_KEY, seed);
  return renderWithApi(<AppTabBar />, fetchImpl, { queryClient });
}

beforeEach(() => {
  mockDismissTo.mockReset();
  mockIsWide = false;
  setAccessToken("signed-in-token");
});

describe("AppTabBar for a client", () => {
  it("shows the five client tabs with the area of the path selected", async () => {
    await renderBar("/portal/requests/018f0000-0000-7000-8000-0000000000e1", me("client", []));
    const labels = screen.getAllByRole("tab").map((tab) => tab.props.accessibilityLabel);
    expect(labels).toEqual(["Home", "Hotels", "Wedding, Locked", "Approvals, Locked", "More"]);
    expect(screen.getByRole("tab", { name: "Home" })).toBeSelected();
  });

  it("selects Hotels on the saved hotels", async () => {
    await renderBar("/hotels/saved", me("client", []));
    expect(screen.getByRole("tab", { name: "Hotels" })).toBeSelected();
  });

  it("gives a demo prospect the client tabs, More selected on the account", async () => {
    await renderBar("/account", me("demo", []));
    expect(screen.getByRole("tab", { name: "More" })).toBeSelected();
  });

  it("opens an area through the router", async () => {
    await renderBar("/portal", me("client", []));
    await fireEvent.press(screen.getByRole("tab", { name: "Hotels" }));
    await fireEvent.press(screen.getByRole("tab", { name: "More" }));
    expect(mockDismissTo.mock.calls).toEqual([["/hotels"], ["/account"]]);
  });

  it("explains a locked tab with a toast instead of navigating", async () => {
    await renderBar("/portal", me("client", []));
    await fireEvent.press(screen.getByRole("tab", { name: "Wedding, Locked" }));
    expect(await screen.findByText("Opens once AMPM is appointed")).toBeOnTheScreen();
    expect(mockDismissTo).not.toHaveBeenCalled();
  });
});

describe("AppTabBar for staff", () => {
  it("shows Sales its areas with the area of the path selected", async () => {
    await renderBar("/leads/018f0000-0000-7000-8000-0000000000a1", me("staff", ["SM"]));
    const labels = screen.getAllByRole("tab").map((tab) => tab.props.accessibilityLabel);
    // No Tasks: its field notes need the incidents key, which Sales does not hold.
    expect(labels).toEqual(["Leads", "Enquiries", "More"]);
    expect(screen.getByRole("tab", { name: "Leads" })).toBeSelected();
    await fireEvent.press(screen.getByRole("tab", { name: "Enquiries" }));
    expect(mockDismissTo).toHaveBeenCalledWith("/enquiries");
  });

  it("gives a role without leads or enquiries only Tasks and More", async () => {
    await renderBar("/field-notes", me("staff", ["CD"]));
    const labels = screen.getAllByRole("tab").map((tab) => tab.props.accessibilityLabel);
    expect(labels).toEqual(["Tasks", "More"]);
    expect(screen.getByRole("tab", { name: "Tasks" })).toBeSelected();
    await fireEvent.press(screen.getByRole("tab", { name: "Tasks" }));
    expect(mockDismissTo).toHaveBeenCalledWith("/field-notes");
  });
});

describe("AppTabBar when /me fails", () => {
  const fails: FetchFn = () => Promise.resolve(failure("internal", 500));

  it.each([
    ["on a phone", false],
    ["on a window 768 or wider, where the layout draws no navigation either", true],
  ] as const)("keeps only More, the way to retry and sign out, %s", async (_case, isWide) => {
    mockIsWide = isWide;
    await renderBar("/leads", undefined, fails);
    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual(["More"]);
    await fireEvent.press(screen.getByRole("tab", { name: "More" }));
    expect(mockDismissTo).toHaveBeenCalledWith("/account");
  });

  it("selects More on the account screen", async () => {
    await renderBar("/account", undefined, fails);
    expect(await screen.findByRole("tab", { name: "More" })).toBeSelected();
  });
});

describe("AppTabBar without a session", () => {
  it.each<[string, boolean]>([
    ["on a phone", false],
    ["on a window 768 or wider", true],
  ])("never asks for /me and keeps only More, the way to sign in, %s", async (_case, isWide) => {
    setAccessToken(null);
    mockIsWide = isWide;
    const asked: string[] = [];
    const recording: FetchFn = (input) => {
      asked.push(String(input));
      return Promise.resolve(failure("unauthenticated", 401));
    };
    await renderBar("/leads", undefined, recording);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual(["More"]);
    await fireEvent.press(screen.getByRole("tab", { name: "More" }));
    expect(mockDismissTo).toHaveBeenCalledWith("/account");
    expect(asked).toEqual([]);
  });
});

describe("AppTabBar follows the session while it stays mounted", () => {
  /** The API answering /me with `body`, recording each URL it is asked. */
  const answering =
    (asked: string[], body: MeResponse): FetchFn =>
    (input) => {
      asked.push(String(input));
      return Promise.resolve(ok(body));
    };

  it("drops to More and asks nothing for /me once signing out drops the session", async () => {
    const asked: string[] = [];
    const queryClient = await renderBar(
      "/portal",
      me("client", []),
      answering(asked, me("client", [])),
    );
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    // Signing out drops the token and clears the cache (navigation/sign-out.ts).
    await act(() => {
      setAccessToken(null);
      queryClient.clear();
    });
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual(["More"]);
    expect(asked).toEqual([]);
  });

  it("asks for /me once signing in stores a token, and shows the person's tabs", async () => {
    setAccessToken(null);
    const asked: string[] = [];
    await renderBar("/leads", undefined, answering(asked, me("staff", ["SM"])));
    expect(screen.getAllByRole("tab")).toHaveLength(1);
    await act(() => setAccessToken("signed-in-token"));
    expect(await screen.findByRole("tab", { name: "Leads" })).toBeSelected();
    expect(asked).toEqual([`${TEST_API_BASE}/me`]);
  });
});

describe("AppTabBar draws nothing", () => {
  it("on a window 768 or wider, where the layout draws the navigation", async () => {
    mockIsWide = true;
    await renderBar("/portal", me("client", []));
    expect(screen.queryByTestId("app-tab-bar")).toBeNull();
  });

  it("while /me loads", async () => {
    const queryClient = await renderBar("/portal");
    expect(queryClient.getQueryState(ME_QUERY_KEY)?.status).toBe("pending");
    expect(screen.queryByTestId("app-tab-bar")).toBeNull();
  });
});
