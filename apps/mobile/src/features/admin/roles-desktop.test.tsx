import type * as ReactModule from "react";

import { act, fireEvent, screen, within } from "../../test/render";
import { RolesScreen } from "./roles-screen";
import {
  capabilityViewFixture,
  ok,
  renderWithApi,
  roleViewFixture,
  routedFetch,
} from "./admin.test-utils";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: jest.fn() }),
}));

/**
 * The window, as a store its readers subscribe to: a resize re-renders exactly the components that read
 * the width, as React Native's own hook does (a plain width mock would let the React Compiler skip the
 * re-render and pass falsely).
 */
const mockWindow = { width: 1440, listeners: new Set<() => void>() };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => {
  const react = jest.requireActual<typeof ReactModule>("react");
  const subscribe = (listener: () => void) => {
    mockWindow.listeners.add(listener);
    return () => mockWindow.listeners.delete(listener);
  };
  return {
    __esModule: true,
    default: function useMockWindowDimensions() {
      const width = react.useSyncExternalStore(subscribe, () => mockWindow.width);
      return { width, height: 900, scale: 2, fontScale: 1 };
    },
  };
});

/** Resizes the window, telling every component that reads it (a tablet turning, a window resized). */
async function resizeTo(width: number): Promise<void> {
  await act(() => {
    mockWindow.width = width;
    mockWindow.listeners.forEach((listener) => listener());
  });
}

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

async function renderRoles(): Promise<void> {
  await renderWithApi(
    <RolesScreen />,
    routedFetch({ "/admin/roles/assignable": () => ok([roleViewFixture(), custom]) }),
  );
}

async function pickConfigEditor(): Promise<void> {
  await fireEvent.press(await screen.findByLabelText(/Config editor, custom role/));
}

/** The role's sheet is open: its content is on screen. */
const sheetOpen = (): boolean => screen.queryByTestId("role-detail-content") !== null;

beforeEach(() => {
  mockWindow.width = 1440;
});

describe("RolesScreen from 1024 (T12)", () => {
  it("opens the picked role in the 300 side column instead of a sheet", async () => {
    await renderRoles();
    expect(await screen.findByTestId("role-side-panel-empty")).toBeOnTheScreen();
    await pickConfigEditor();
    const panel = screen.getByTestId("role-side-panel");
    expect(panel.parent?.props.className).toContain("w-72");
    expect(within(panel).getByRole("header", { name: "Config editor" })).toBeOnTheScreen();
    expect(within(panel).getByText("Update — Configuration")).toBeOnTheScreen();
    expect(within(panel).getByTestId("role-manage-edit")).toBeOnTheScreen();
    expect(sheetOpen()).toBe(false);
    // The table says which role the column shows: its row is the current one, the others are not.
    expect(screen.getByLabelText(/Config editor, custom role/)).toHaveProp("aria-current", "true");
    expect(screen.getAllByTestId("data-table-selected-mark")).toHaveLength(1);
  });

  it("clears the pick from the side column's close", async () => {
    await renderRoles();
    await pickConfigEditor();
    await fireEvent.press(screen.getByRole("button", { name: "Close Config editor" }));
    expect(screen.queryByTestId("role-side-panel")).toBeNull();
    expect(screen.queryByTestId("data-table-selected-mark")).toBeNull();
    expect(screen.getByTestId("role-side-panel-empty")).toBeOnTheScreen();
  });

  it("puts New role above the table, leaving the header's right to the section strip", async () => {
    await renderRoles();
    await screen.findByLabelText(/Config editor, custom role/);
    expect(screen.getAllByTestId("role-new")).toHaveLength(1);
    expect(screen.getByRole("tab", { name: "Roles" })).toBeSelected();
  });
});

describe("RolesScreen below 1024", () => {
  it("opens the picked role on a sheet, with no side column", async () => {
    mockWindow.width = 768;
    await renderRoles();
    await pickConfigEditor();
    expect(sheetOpen()).toBe(true);
    expect(screen.queryByTestId("role-side-panel")).toBeNull();
    expect(screen.queryByTestId("role-side-panel-empty")).toBeNull();
  });
});

describe("RolesScreen across 1024", () => {
  it("keeps the picked role open in whichever form fits", async () => {
    await renderRoles();
    await pickConfigEditor();
    expect(screen.getByTestId("role-side-panel")).toBeOnTheScreen();
    await resizeTo(390);
    expect(sheetOpen()).toBe(true);
    expect(
      within(screen.getByTestId("role-detail-content")).getByText("Update — Configuration"),
    ).toBeOnTheScreen();
    await resizeTo(1440);
    expect(sheetOpen()).toBe(false);
    expect(
      within(screen.getByTestId("role-side-panel")).getByText("Update — Configuration"),
    ).toBeOnTheScreen();
  });
});
