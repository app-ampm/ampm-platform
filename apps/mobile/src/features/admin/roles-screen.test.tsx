import type { ReactNode } from "react";

import { uiCopy } from "@ampm/ui";

import { fireEvent, screen } from "../../test/render";
import { RolesScreen } from "./roles-screen";
import {
  capabilityViewFixture,
  failure,
  ok,
  renderWithApi,
  roleViewFixture,
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

const sales = roleViewFixture({
  id: "018f0000-0000-7000-8000-0000000006b1",
  roleKey: "sales",
  name: "Sales / Relationship Manager",
  isSystem: true,
  capabilities: [
    capabilityViewFixture({
      id: "weddings.weddings.read:assigned",
      module: "weddings",
      label: "Read — Weddings (assigned)",
    }),
  ],
});

const custom = roleViewFixture({
  id: "018f0000-0000-7000-8000-0000000006c2",
  roleKey: "custom_x",
  name: "Config editor",
  isSystem: false,
  capabilities: [
    capabilityViewFixture({
      id: "admin.configurations.update:all",
      module: "admin",
      label: "Update — Configuration",
    }),
  ],
});

const rolesFetch = (roles = [sales, custom]): FetchFn =>
  routedFetch({ "/admin/roles/assignable": () => ok(roles) });

async function renderRoles(fetchImpl: FetchFn, tabBar?: ReactNode): Promise<void> {
  await renderWithApi(<RolesScreen tabBar={tabBar} />, fetchImpl);
}

beforeEach(() => {
  mockReplace.mockClear();
});

describe("RolesScreen", () => {
  it("shows skeletons while roles load", async () => {
    await renderRoles(() => new Promise<Response>(() => {}));
    expect(screen.getByTestId("roles-loading")).toBeOnTheScreen();
    expect(screen.getByText("Roles and permissions")).toBeOnTheScreen();
  });

  it("lists roles with their type", async () => {
    await renderRoles(rolesFetch());
    expect(await screen.findByText("Sales / Relationship Manager")).toBeOnTheScreen();
    expect(screen.getByText("Config editor")).toBeOnTheScreen();
    expect(screen.getByText("System")).toBeOnTheScreen();
    expect(screen.getByText("Custom")).toBeOnTheScreen();
  });

  it("opens a role's permissions, grouped by module, from its row", async () => {
    await renderRoles(rolesFetch());
    await fireEvent.press(
      await screen.findByLabelText(/Sales \/ Relationship Manager, system role/),
    );
    expect(await screen.findByText("Read — Weddings (assigned)")).toBeOnTheScreen();
    expect(screen.getByText("Weddings")).toBeOnTheScreen();
  });

  it("says when there are no roles", async () => {
    await renderRoles(rolesFetch([]));
    expect(await screen.findByText("No roles yet")).toBeOnTheScreen();
  });

  it("shows the error state when the API fails", async () => {
    await renderRoles(routedFetch({ "/admin/roles/assignable": () => failure("internal", 500) }));
    expect(await screen.findByText(uiCopy.error.title)).toBeOnTheScreen();
  });

  it("asks to sign in again once the session has ended", async () => {
    await renderRoles(
      routedFetch({ "/admin/roles/assignable": () => failure("unauthenticated", 401) }),
    );
    expect(await screen.findByText("Sign in to view roles")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Sign in"));
    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  });
});
