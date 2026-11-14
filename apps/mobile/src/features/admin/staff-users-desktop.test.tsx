import type * as ReactModule from "react";

import type { StaffUserView } from "@ampm/core";

import { act, fireEvent, screen, within } from "../../test/render";
import { StaffUsersScreen } from "./staff-users-screen";
import {
  SECOND_STAFF_USER_ID,
  ok,
  renderWithApi,
  routedFetch,
  staffUserFixture,
} from "./admin.test-utils";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: mockPush }),
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

function directory(): StaffUserView[] {
  return [
    staffUserFixture(),
    staffUserFixture({
      id: SECOND_STAFF_USER_ID,
      name: "Imran Qureshi",
      email: "imran@example.com",
      status: "disabled",
      mfaEnabled: false,
      roles: ["sales"],
      lastLoginAt: null,
    }),
  ];
}

async function renderDirectory(): Promise<void> {
  await renderWithApi(
    <StaffUsersScreen />,
    routedFetch({ "/admin/staff-users": () => ok({ items: directory(), nextCursor: null }) }),
  );
}

beforeEach(() => {
  mockWindow.width = 1440;
  mockPush.mockClear();
});

describe("StaffUsersScreen from 768", () => {
  it("sets the directory as a table on glass: name, email, roles, status, authenticator, sign-in", async () => {
    await renderDirectory();
    const table = await screen.findByTestId("staff-users-table");
    expect(screen.queryByTestId("staff-users-list")).toBeNull();
    for (const header of ["Name", "Email", "Roles", "Status", "Authenticator", "Last sign-in"]) {
      expect(within(table).getByText(header)).toBeOnTheScreen();
    }
    const imran = within(table).getByLabelText(
      "Imran Qureshi: Sales / Relationship Manager, Disabled",
    );
    expect(within(imran).getByText("imran@example.com")).toBeOnTheScreen();
    expect(within(imran).getByText("Disabled")).toBeOnTheScreen();
    expect(within(imran).getByText("No authenticator")).toBeOnTheScreen();
    expect(within(imran).getByText("Never")).toBeOnTheScreen();
  });

  it("opens a person's record from their row", async () => {
    await renderDirectory();
    await fireEvent.press(await screen.findByLabelText(/^Imran Qureshi:/));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/admin/users/[userId]",
      params: { userId: SECOND_STAFF_USER_ID },
    });
  });

  it("leaves the header's right to the section strip and puts Invite above the table", async () => {
    await renderDirectory();
    await screen.findByTestId("staff-users-table");
    expect(
      within(screen.getByTestId("staff-users-header")).queryByTestId("invite-staff-open"),
    ).toBeNull();
    expect(screen.getAllByTestId("invite-staff-open")).toHaveLength(1);
    expect(screen.getByRole("tab", { name: "Users" })).toBeSelected();
  });

  it("keeps the phone's rows, with Invite beside the title, below 768", async () => {
    mockWindow.width = 390;
    await renderDirectory();
    expect(await screen.findByTestId("staff-users-list")).toBeOnTheScreen();
    expect(screen.queryByTestId("staff-users-table")).toBeNull();
    expect(screen.getAllByTestId("invite-staff-open")).toHaveLength(1);
  });
});

describe("StaffUsersScreen across breakpoints", () => {
  it("keeps a half-typed invitation when the window crosses 768 and 1024", async () => {
    mockWindow.width = 390;
    await renderDirectory();
    await fireEvent.press(await screen.findByTestId("invite-staff-open"));
    await fireEvent.changeText(screen.getByPlaceholderText("Eva Menon"), "Noor Khan");
    await resizeTo(1440);
    expect(screen.getByTestId("staff-users-table")).toBeOnTheScreen();
    expect(screen.getByDisplayValue("Noor Khan")).toBeOnTheScreen();
    await resizeTo(390);
    expect(screen.getByTestId("staff-users-list")).toBeOnTheScreen();
    expect(screen.getByDisplayValue("Noor Khan")).toBeOnTheScreen();
  });
});
