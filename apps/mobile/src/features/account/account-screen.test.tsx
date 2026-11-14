import type { QueryClient } from "@tanstack/react-query";

import type { MeResponse } from "@ampm/core";
import { uiCopy } from "@ampm/ui";

import { getAccessToken, setAccessToken } from "@/lib/session";

import { jsonResponse, renderWithApi } from "../../test/api";
import { fireEvent, screen, within } from "../../test/render";
import { AccountScreen } from "./account-screen";

// The screen opens the other pages and signs out through the router. Variables named mock* may be
// read inside jest.mock.
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

// A phone unless a test widens the window to see the desktop arrangement.
const mockWindow = { width: 390 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWindow.width, height: 900, scale: 2, fontScale: 1 }),
}));

// A signed-in staff principal with a role and a membership — the common `AccountDetails` path.
// projectRole is deliberately "project_lead" so it never collides with the type chip's "Team" when a
// test asserts a single occurrence.
const STAFF: MeResponse = {
  principal: {
    type: "staff",
    userId: "018f0000-0000-7000-8000-00000000cafe",
    name: "Sameer Sales",
    email: "sales@example.com",
    phone: null,
    status: "active",
    lastLoginAt: null,
  },
  roles: ["SM"],
  memberships: [
    {
      projectId: "018f0000-0000-7000-8000-0000000000a1",
      projectRole: "project_lead",
      clientSide: null,
      canViewFinance: false,
      canApprove: false,
    },
  ],
  entitlements: {
    modules: [],
    readOnlyModules: [],
    hotelReach: [],
    financeReach: [],
    requestTypes: { wedding: [], account: [] },
  },
  isDemo: false,
};

// A demo client with no email, no memberships and one entitlement module — the client-facing
// branches of `AccountDetails` (the demo chip, the "No email" fallback, the "None yet." memberships
// empty state, and the entitlements rows). type is "client", so the type chip says "Client" and the
// demo chip says "Demo account" once.
const DEMO_CLIENT: MeResponse = {
  principal: {
    type: "client",
    userId: "018f0000-0000-7000-8000-0000000000d2",
    name: "Priya Prospect",
    email: null,
    phone: "+91 98765 43210",
    status: "active",
    lastLoginAt: null,
  },
  roles: [],
  memberships: [],
  entitlements: {
    modules: ["hotel_discovery", "saved_hotels"],
    readOnlyModules: ["saved_hotels"],
    hotelReach: ["demo_hotels"],
    financeReach: [],
    requestTypes: { wedding: [], account: [] },
  },
  isDemo: true,
};

// Creative: no leads or enquiries, but the Tasks area (the field notes read as incidents).
const CREATIVE: MeResponse = { ...STAFF, roles: ["CD"] };

type FetchFn = typeof fetch;

/** The More screen under the API; the client comes back for the cache spies of the sign-out tests. */
function renderScreen(fetchImpl: FetchFn): Promise<QueryClient> {
  return renderWithApi(<AccountScreen />, fetchImpl);
}

const serves =
  (me: MeResponse): FetchFn =>
  () =>
    Promise.resolve(jsonResponse({ data: me }, 200));

beforeEach(() => {
  mockWindow.width = 390;
  mockPush.mockReset();
  mockReplace.mockReset();
});

describe("AccountScreen", () => {
  it("shows the loading skeleton under the More header while /me is pending", async () => {
    await renderScreen(() => new Promise<Response>(() => {}));
    expect(screen.getByText("More")).toBeOnTheScreen();
    expect(screen.getByTestId("account-loading")).toBeOnTheScreen();
  });

  it("renders a staff principal with its avatar, type, role and membership", async () => {
    await renderScreen(serves(STAFF));
    expect(await screen.findByText("Sameer Sales")).toBeOnTheScreen();
    expect(screen.getByRole("image", { name: "Sameer Sales" })).toBeOnTheScreen();
    // The kind of account in words, not the API's "staff".
    expect(screen.getByText("Team")).toBeOnTheScreen();
    // The role by the name the staff rail gives it, not its code.
    expect(screen.getByText("Sales / Relationship Manager")).toBeOnTheScreen();
    expect(screen.getByText("sales@example.com")).toBeOnTheScreen();
    expect(screen.getByText("project_lead")).toBeOnTheScreen();
    expect(screen.queryByText(uiCopy.error.title)).toBeNull();
  });

  it("renders a demo client: the demo chip, the no-email and no-membership fallbacks, entitlements", async () => {
    await renderScreen(serves(DEMO_CLIENT));
    expect(await screen.findByText("Priya Prospect")).toBeOnTheScreen();
    expect(screen.getByText("Client")).toBeOnTheScreen();
    expect(screen.getAllByText("Demo account")).toHaveLength(1);
    expect(screen.getByText("No email")).toBeOnTheScreen();
    expect(screen.getByText("+91 98765 43210")).toBeOnTheScreen();
    expect(screen.getByText("None yet.")).toBeOnTheScreen();
    // Modules by the names the plan card gives them.
    expect(screen.getByText("Hotel discovery")).toBeOnTheScreen();
    // Only the read-only module carries the chip.
    expect(screen.getAllByText("Read only")).toHaveLength(1);
  });

  it("links staff whose roles open the Tasks area to the field notes, and everyone to the gallery", async () => {
    await renderScreen(serves(CREATIVE));
    await fireEvent.press(await screen.findByRole("link", { name: "Field notes" }));
    await fireEvent.press(screen.getByRole("link", { name: "Component gallery" }));
    expect(mockPush.mock.calls).toEqual([["/field-notes"], ["/gallery"]]);
  });

  it("keeps the field notes from Sales, whose role the API refuses them to", async () => {
    await renderScreen(serves(STAFF));
    expect(await screen.findByRole("link", { name: "Component gallery" })).toBeOnTheScreen();
    expect(screen.queryByRole("link", { name: "Field notes" })).toBeNull();
  });

  it("keeps the field notes from a client", async () => {
    await renderScreen(serves(DEMO_CLIENT));
    expect(await screen.findByRole("link", { name: "Component gallery" })).toBeOnTheScreen();
    expect(screen.queryByRole("link", { name: "Field notes" })).toBeNull();
  });

  it("signs out: drops the token, clears the cache and returns to sign-in", async () => {
    setAccessToken("signed-in-token");
    const queryClient = await renderScreen(serves(STAFF));
    const clear = jest.spyOn(queryClient, "clear");
    await fireEvent.press(await screen.findByRole("button", { name: "Sign out" }));
    expect(getAccessToken()).toBeNull();
    expect(clear).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  });

  it("shows the sign-in empty state when /me is unauthenticated, and drops the refused token", async () => {
    // The token the API refuses (one that has expired) is still held until the way back to sign-in.
    setAccessToken("expired-token");
    const queryClient = await renderScreen(() =>
      Promise.resolve(jsonResponse({ error: { code: "unauthenticated", message: "x" } }, 401)),
    );
    const clear = jest.spyOn(queryClient, "clear");
    expect(await screen.findByText("Sign in to see your account")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(getAccessToken()).toBeNull();
    expect(clear).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  });

  it("shows the offline state on a network failure", async () => {
    await renderScreen(() => Promise.reject(new Error("no network")));
    expect(await screen.findByText(uiCopy.offline.title)).toBeOnTheScreen();
  });

  it("shows the generic error state on a server error, and keeps sign-out in reach", async () => {
    setAccessToken("signed-in-token");
    await renderScreen(() =>
      Promise.resolve(jsonResponse({ error: { code: "internal", message: "x" } }, 500)),
    );
    expect(await screen.findByText(uiCopy.error.title)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(getAccessToken()).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  });
});

type Instance = Parameters<typeof within>[0];

describe("AccountScreen on wider windows", () => {
  const signOutClass = () =>
    String(screen.getByRole("button", { name: "Sign out" }).props.className);

  it("sets the person beside their memberships and entitlements from 1024", async () => {
    mockWindow.width = 1440;
    await renderScreen(serves(DEMO_CLIENT));
    expect(await screen.findByText("Priya Prospect")).toBeOnTheScreen();
    const columns = screen.getByTestId("account-columns");
    expect(String(columns.props.className)).toContain("flex-row");
    // The 384 column at the start: the profile, the links and sign-out.
    const [person, access] = columns.children.filter(
      (child): child is Instance => typeof child !== "string",
    );
    if (!person || !access) throw new Error("expected two columns");
    expect(String(person.props.className)).toContain("w-96");
    expect(within(person).getByText("Priya Prospect")).toBeOnTheScreen();
    expect(within(person).getByRole("link", { name: "Component gallery" })).toBeOnTheScreen();
    expect(within(person).getByRole("button", { name: "Sign out" })).toBeOnTheScreen();
    expect(within(access).getByText("Memberships")).toBeOnTheScreen();
    expect(within(access).getByText("Hotel discovery")).toBeOnTheScreen();
    // The top navigation or the rail shows the person, and sign-out keeps its own width.
    expect(screen.queryByRole("image", { name: "Priya Prospect" })).toBeNull();
    expect(signOutClass()).toContain("self-start");
  });

  it("keeps the phone's stack on a tablet, without the header avatar", async () => {
    mockWindow.width = 768;
    await renderScreen(serves(STAFF));
    expect(await screen.findByText("Sameer Sales")).toBeOnTheScreen();
    expect(screen.queryByTestId("account-columns")).toBeNull();
    expect(screen.queryByRole("image", { name: "Sameer Sales" })).toBeNull();
    expect(signOutClass()).toContain("self-start");
  });

  it("stretches sign-out across a phone", async () => {
    await renderScreen(serves(STAFF));
    expect(await screen.findByRole("button", { name: "Sign out" })).toBeOnTheScreen();
    expect(signOutClass()).toContain("self-stretch");
  });
});
