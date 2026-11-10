import type { ReactNode } from "react";
import { Text } from "react-native";

import type { StaffUserView } from "@ampm/core";
import { uiCopy } from "@ampm/ui";

import { fireEvent, screen, within } from "../../test/render";
import { StaffUsersScreen } from "./staff-users-screen";
import {
  SECOND_STAFF_USER_ID,
  STAFF_USER_ID,
  failure,
  ok,
  renderWithApi,
  routedFetch,
  staffUserFixture,
  type FetchFn,
} from "./admin.test-utils";

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), replace: mockReplace, push: mockPush }),
}));

const mockWindow = { width: 390 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWindow.width, height: 900, scale: 2, fontScale: 1 }),
}));

/** An active Super Admin and a disabled Sales person with no authenticator. */
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

const usersFetch = (items: StaffUserView[], nextCursor: string | null = null): FetchFn =>
  routedFetch({ "/admin/staff-users": () => ok({ items, nextCursor }) });

async function renderList(fetchImpl: FetchFn, tabBar?: ReactNode): Promise<void> {
  await renderWithApi(<StaffUsersScreen tabBar={tabBar} />, fetchImpl);
}

beforeEach(() => {
  mockWindow.width = 390;
  mockPush.mockClear();
  mockReplace.mockClear();
});

describe("StaffUsersScreen", () => {
  it("shows skeleton rows while the directory loads", async () => {
    await renderList(() => new Promise<Response>(() => {}));
    expect(screen.getByTestId("staff-users-loading")).toBeOnTheScreen();
    expect(screen.getByText("Users and roles")).toBeOnTheScreen();
  });

  it("lists each staff user with roles, status and authenticator, and counts them", async () => {
    await renderList(usersFetch(directory()));
    expect(await screen.findByText("Eva Menon")).toBeOnTheScreen();
    expect(screen.getByText("Staff users · 2")).toBeOnTheScreen();
    const sa = within(screen.getByTestId(`staff-user-row-${STAFF_USER_ID}`));
    expect(sa.getByText("eva@example.com")).toBeOnTheScreen();
    expect(sa.getByText(/Super Admin/)).toBeOnTheScreen();
    expect(sa.getByText("Active")).toBeOnTheScreen();
    expect(sa.getByText("Authenticator on")).toBeOnTheScreen();
    const sales = within(screen.getByTestId(`staff-user-row-${SECOND_STAFF_USER_ID}`));
    expect(sales.getByText(/Sales \/ Relationship Manager/)).toBeOnTheScreen();
    expect(sales.getByText("Disabled")).toBeOnTheScreen();
    expect(sales.getByText("No authenticator")).toBeOnTheScreen();
  });

  it("marks the count as a floor while more pages wait", async () => {
    await renderList(usersFetch(directory(), SECOND_STAFF_USER_ID));
    expect(await screen.findByText("Staff users · 2+")).toBeOnTheScreen();
  });

  it("opens a staff user's record from their row", async () => {
    await renderList(usersFetch(directory()));
    await fireEvent.press(await screen.findByTestId(`staff-user-row-${SECOND_STAFF_USER_ID}`));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/admin/users/[userId]",
      params: { userId: SECOND_STAFF_USER_ID },
    });
  });

  it("keeps the app's tab bar", async () => {
    await renderList(usersFetch(directory()), <Text testID="app-tab-bar">Tabs</Text>);
    expect(await screen.findByText("Eva Menon")).toBeOnTheScreen();
    expect(screen.getByTestId("app-tab-bar")).toBeOnTheScreen();
  });

  it("says how to add the team when there are no staff users", async () => {
    await renderList(usersFetch([]));
    expect(await screen.findByText("No staff users yet")).toBeOnTheScreen();
  });

  it("shows the offline state on a network failure", async () => {
    await renderList(() => Promise.reject(new Error("no network")));
    expect(await screen.findByText(uiCopy.offline.title)).toBeOnTheScreen();
  });

  it("shows the error state with a retry when the API fails", async () => {
    await renderList(routedFetch({ "/admin/staff-users": () => failure("internal", 500) }));
    expect(await screen.findByText(uiCopy.error.title)).toBeOnTheScreen();
  });

  it("asks to sign in again once the session has ended", async () => {
    await renderList(routedFetch({ "/admin/staff-users": () => failure("unauthenticated", 401) }));
    expect(await screen.findByText("Sign in to view staff users")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Sign in"));
    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  });
});

describe("StaffUsersScreen — invite", () => {
  it("invites a staff member and confirms by toast", async () => {
    const fetchImpl: FetchFn = routedFetch({
      "/admin/staff-users": (init) =>
        init?.method === "POST"
          ? ok(staffUserFixture({ status: "invited", email: "noor@example.com" }))
          : ok({ items: directory(), nextCursor: null }),
    });
    await renderList(fetchImpl);
    await fireEvent.press(await screen.findByTestId("invite-staff-open"));
    await fireEvent.changeText(screen.getByPlaceholderText("Eva Menon"), "Noor Khan");
    await fireEvent.changeText(screen.getByPlaceholderText("eva@example.com"), "noor@example.com");
    await fireEvent.press(screen.getByTestId("invite-staff-submit"));
    expect(await screen.findByText("Invitation sent to noor@example.com")).toBeOnTheScreen();
  });

  it("blocks the invite until a name and a valid email are given", async () => {
    await renderList(usersFetch(directory()));
    await fireEvent.press(await screen.findByTestId("invite-staff-open"));
    await fireEvent.press(screen.getByTestId("invite-staff-submit"));
    expect(await screen.findByText("Enter the person's name")).toBeOnTheScreen();
    expect(screen.getByText("Enter a valid email address")).toBeOnTheScreen();
  });
});
