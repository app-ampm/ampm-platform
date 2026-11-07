import { fireEvent, screen, within } from "../../test/render";
import { StaffUserDetailScreen } from "./staff-user-detail-screen";
import {
  STAFF_USER_ID,
  failure,
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

const mockWindow = { width: 390 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWindow.width, height: 900, scale: 2, fontScale: 1 }),
}));

const detailFetch = (fetchImpl?: FetchFn): FetchFn =>
  fetchImpl ??
  routedFetch({ [`/admin/staff-users/${STAFF_USER_ID}`]: () => ok(staffUserFixture()) });

async function renderDetail(fetchImpl?: FetchFn): Promise<void> {
  await renderWithApi(<StaffUserDetailScreen userId={STAFF_USER_ID} />, detailFetch(fetchImpl));
}

beforeEach(() => {
  mockWindow.width = 390;
});

describe("StaffUserDetailScreen", () => {
  it("shows a skeleton while the record loads", async () => {
    await renderDetail(() => new Promise<Response>(() => {}));
    expect(screen.getByTestId("staff-user-loading")).toBeOnTheScreen();
  });

  it("shows the record: name, contact, roles, status and authenticator", async () => {
    await renderDetail();
    expect(await screen.findByText("Eva Menon")).toBeOnTheScreen();
    const card = within(screen.getByTestId("staff-user-card"));
    expect(card.getByText("Account")).toBeOnTheScreen();
    expect(card.getByText("eva@example.com")).toBeOnTheScreen();
    expect(card.getByText("+919900000000")).toBeOnTheScreen();
    expect(card.getByText("Super Admin")).toBeOnTheScreen();
    expect(card.getByText("Active")).toBeOnTheScreen();
    expect(card.getByText("Authenticator on")).toBeOnTheScreen();
  });

  it("says when the staff user is not found", async () => {
    await renderDetail(
      routedFetch({ [`/admin/staff-users/${STAFF_USER_ID}`]: () => failure("not_found", 404) }),
    );
    expect(await screen.findByText("Staff user not found")).toBeOnTheScreen();
  });

  it("asks to sign in again once the session has ended", async () => {
    await renderDetail(
      routedFetch({
        [`/admin/staff-users/${STAFF_USER_ID}`]: () => failure("unauthenticated", 401),
      }),
    );
    expect(await screen.findByText("Sign in to view this staff user")).toBeOnTheScreen();
  });
});

describe("StaffUserDetailScreen — management actions", () => {
  it("offers disable and reset for an active user, and disables after confirming", async () => {
    await renderDetail(
      routedFetch({
        [`/admin/staff-users/${STAFF_USER_ID}`]: () => ok(staffUserFixture()),
        [`/admin/staff-users/${STAFF_USER_ID}/status`]: () =>
          ok(staffUserFixture({ status: "disabled" })),
      }),
    );
    expect(await screen.findByTestId("reset-authenticator")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("disable-account"));
    await fireEvent.press(await screen.findByTestId("confirm-disable-confirm"));
    expect(await screen.findByText("Account disabled")).toBeOnTheScreen();
  });

  it("offers enable for a disabled user", async () => {
    await renderDetail(
      routedFetch({
        [`/admin/staff-users/${STAFF_USER_ID}`]: () => ok(staffUserFixture({ status: "disabled" })),
      }),
    );
    expect(await screen.findByTestId("enable-account")).toBeOnTheScreen();
  });

  it("offers resend for an invited user", async () => {
    await renderDetail(
      routedFetch({
        [`/admin/staff-users/${STAFF_USER_ID}`]: () => ok(staffUserFixture({ status: "invited" })),
      }),
    );
    expect(await screen.findByTestId("resend-invite")).toBeOnTheScreen();
  });
});

describe("StaffUserDetailScreen — roles", () => {
  it("lists the roles catalogue and assigns one the user lacks", async () => {
    await renderDetail(
      routedFetch({
        [`/admin/staff-users/${STAFF_USER_ID}`]: () => ok(staffUserFixture()),
        "/admin/roles/assignable": () => ok(rolesCatalogue()),
        [`/admin/users/${STAFF_USER_ID}/roles`]: () => ok(null),
      }),
    );
    expect(await screen.findByTestId("role-super_admin")).toBeOnTheScreen();
    expect(screen.getByTestId("role-finance")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("role-finance"));
    expect(await screen.findByText("Finance / Accounts added")).toBeOnTheScreen();
  });
});
