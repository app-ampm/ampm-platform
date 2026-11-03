import { QueryClient } from "@tanstack/react-query";

import { ApiProvider } from "@ampm/api-client";
import type { MeResponse } from "@ampm/core";
import { uiCopy } from "@ampm/ui";

import { renderWithProviders, screen } from "../../test/render";
import { AccountScreen } from "./account-screen";

// A signed-in staff principal with a role and a membership — the common `AccountDetails` path.
// projectRole is deliberately "project_lead" (not "staff") so it never collides with the type chip
// text "staff" when a test asserts a single occurrence.
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
// empty state, and the entitlements row). type is "client" so the demo chip's "demo" text stays the
// only "demo" on screen.
const DEMO_CLIENT: MeResponse = {
  principal: {
    type: "client",
    userId: "018f0000-0000-7000-8000-0000000000d2",
    name: "Priya Prospect",
    email: null,
    phone: null,
    status: "active",
    lastLoginAt: null,
  },
  roles: [],
  memberships: [],
  entitlements: {
    modules: ["hotel_discovery"],
    readOnlyModules: [],
    hotelReach: ["demo_hotels"],
    financeReach: [],
    requestTypes: { wedding: [], account: [] },
  },
  isDemo: true,
};

type FetchFn = typeof fetch;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status });
}

// Retries off so the error states resolve immediately; gcTime Infinity so React Query schedules no
// cache-GC timer (its 5-minute default keeps Jest's event loop alive after the tests pass, stalling
// the run before the process exits) — the same harness the hotel-detail test uses.
async function renderScreen(fetchImpl: FetchFn): Promise<void> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  await renderWithProviders(
    <ApiProvider baseUrl="http://api.test" fetch={fetchImpl} queryClient={queryClient}>
      <AccountScreen />
    </ApiProvider>,
  );
}

describe("AccountScreen", () => {
  it("shows the loading skeleton while /me is pending", async () => {
    await renderScreen(() => new Promise<Response>(() => {}));
    expect(screen.getByTestId("account-loading")).toBeOnTheScreen();
  });

  it("renders a staff principal with its type, role and membership", async () => {
    await renderScreen(() => Promise.resolve(jsonResponse({ data: STAFF }, 200)));
    expect(await screen.findByText("Sameer Sales")).toBeOnTheScreen();
    expect(screen.getByText("staff")).toBeOnTheScreen();
    expect(screen.getByText("SM")).toBeOnTheScreen();
    expect(screen.getByText("sales@example.com")).toBeOnTheScreen();
    expect(screen.getByText("project_lead")).toBeOnTheScreen();
    expect(screen.queryByText(uiCopy.error.title)).toBeNull();
  });

  it("renders a demo client: the demo chip, the no-email and no-membership fallbacks, entitlements", async () => {
    await renderScreen(() => Promise.resolve(jsonResponse({ data: DEMO_CLIENT }, 200)));
    expect(await screen.findByText("Priya Prospect")).toBeOnTheScreen();
    expect(screen.getByText("client")).toBeOnTheScreen();
    expect(screen.getByText("demo")).toBeOnTheScreen();
    expect(screen.getByText("No email")).toBeOnTheScreen();
    expect(screen.getByText("None yet.")).toBeOnTheScreen();
    expect(screen.getByText("hotel_discovery")).toBeOnTheScreen();
  });

  it("shows the sign-in empty state when /me is unauthenticated", async () => {
    await renderScreen(() =>
      Promise.resolve(jsonResponse({ error: { code: "unauthenticated", message: "x" } }, 401)),
    );
    expect(await screen.findByText("Sign in to see your account")).toBeOnTheScreen();
  });

  it("shows the offline state on a network failure", async () => {
    await renderScreen(() => Promise.reject(new Error("no network")));
    expect(await screen.findByText(uiCopy.offline.title)).toBeOnTheScreen();
  });

  it("shows the generic error state on a server error", async () => {
    await renderScreen(() =>
      Promise.resolve(jsonResponse({ error: { code: "internal", message: "x" } }, 500)),
    );
    expect(await screen.findByText(uiCopy.error.title)).toBeOnTheScreen();
  });
});
