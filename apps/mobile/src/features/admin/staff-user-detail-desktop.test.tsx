import type * as ReactModule from "react";

import { act, fireEvent, screen, waitFor, within } from "../../test/render";
import { StaffUserDetailScreen } from "./staff-user-detail-screen";
import {
  STAFF_USER_ID,
  ok,
  renderWithApi,
  rolesCatalogue,
  routedFetch,
  staffUserFixture,
  type FetchFn,
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

const RECORD = `/admin/staff-users/${STAFF_USER_ID}`;

/** The record and the roles catalogue; a role change answers when `release` is called. */
function recordFetch(gate?: { release?: () => void }): FetchFn {
  const routes = routedFetch({
    [RECORD]: () => ok(staffUserFixture({ roles: ["super_admin", "finance"] })),
    "/admin/roles/assignable": () => ok(rolesCatalogue()),
  });
  return (input, init) => {
    if (!String(input).includes(`/admin/users/${STAFF_USER_ID}/roles`)) return routes(input, init);
    return new Promise<Response>((resolve) => {
      const answer = (): void => resolve(ok(null));
      if (gate) gate.release = answer;
      else answer();
    });
  };
}

beforeEach(() => {
  mockWindow.width = 1440;
});

describe("StaffUserDetailScreen record header (T3)", () => {
  it("sets the name, the status after it and the email and roles under it on its own glass", async () => {
    await renderWithApi(<StaffUserDetailScreen userId={STAFF_USER_ID} />, recordFetch());
    const header = await screen.findByTestId("staff-user-header");
    await screen.findByTestId("role-super_admin");
    expect(header.props.className).toContain("rounded-xl");
    expect(within(header).getByRole("header", { name: "Eva Menon" })).toBeOnTheScreen();
    expect(within(header).getByText("Active")).toBeOnTheScreen();
    expect(
      within(header).getByText("eva@example.com · Super Admin, Finance / Accounts"),
    ).toBeOnTheScreen();
    expect(within(header).getByRole("button", { name: "Back" })).toBeOnTheScreen();
  });
});

describe("StaffUserDetailScreen columns (T3, 1.3 : 1)", () => {
  it("sets the account facts beside the roles and the actions from 1024", async () => {
    await renderWithApi(<StaffUserDetailScreen userId={STAFF_USER_ID} />, recordFetch());
    const columns = await screen.findByTestId("staff-user-columns");
    expect(columns.props.className).toContain("flex-row");
    const [main, side] = columns.children;
    if (typeof main !== "object" || typeof side !== "object") throw new Error("two columns");
    expect(within(main).getByTestId("staff-user-card")).toBeOnTheScreen();
    expect(within(side).getByTestId("staff-user-roles")).toBeOnTheScreen();
    expect(within(side).getByTestId("staff-user-actions")).toBeOnTheScreen();
  });

  it("stacks them below 1024", async () => {
    mockWindow.width = 768;
    await renderWithApi(<StaffUserDetailScreen userId={STAFF_USER_ID} />, recordFetch());
    expect((await screen.findByTestId("staff-user-columns")).props.className).toContain("flex-col");
  });

  it("keeps a role change that is still saving when the window crosses 1024", async () => {
    mockWindow.width = 768;
    const gate: { release?: () => void } = {};
    await renderWithApi(<StaffUserDetailScreen userId={STAFF_USER_ID} />, recordFetch(gate));
    await fireEvent.press(await screen.findByTestId("role-finance"));
    // Saving: the checklist holds still until the server answers.
    await waitFor(() => expect(screen.getByTestId("role-super_admin")).toBeDisabled());
    await resizeTo(1440);
    expect(screen.getByTestId("staff-user-columns").props.className).toContain("flex-row");
    expect(screen.getByTestId("role-super_admin")).toBeDisabled();
    await act(() => gate.release?.());
    expect(await screen.findByText("Finance / Accounts removed")).toBeOnTheScreen();
  });
});
