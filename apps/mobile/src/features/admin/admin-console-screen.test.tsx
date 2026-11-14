import { fireEvent, screen, within } from "../../test/render";
import { AdminConsoleScreen } from "./admin-console-screen";
import { renderWithApi, routedFetch } from "./admin.test-utils";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: mockPush }),
}));

const mockWindow = { width: 1280 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWindow.width, height: 900, scale: 2, fontScale: 1 }),
}));

beforeEach(() => {
  mockWindow.width = 1280;
  mockPush.mockClear();
});

describe("AdminConsoleScreen", () => {
  it("opens the notifications log from its tile", async () => {
    await renderWithApi(<AdminConsoleScreen />, routedFetch({}));
    await fireEvent.press(screen.getByTestId("admin-section-notifications"));
    expect(mockPush).toHaveBeenCalledWith("/admin/notifications");
  });

  it("opens the notification templates from its tile", async () => {
    await renderWithApi(<AdminConsoleScreen />, routedFetch({}));
    await fireEvent.press(screen.getByTestId("admin-section-notification-templates"));
    expect(mockPush).toHaveBeenCalledWith("/admin/notification-templates");
  });

  it("opens the configuration inventory from its tile", async () => {
    await renderWithApi(<AdminConsoleScreen />, routedFetch({}));
    await fireEvent.press(screen.getByTestId("admin-section-configuration"));
    expect(mockPush).toHaveBeenCalledWith("/admin/configuration");
  });

  it("opens the audit log from its tile", async () => {
    await renderWithApi(<AdminConsoleScreen />, routedFetch({}));
    await fireEvent.press(screen.getByTestId("admin-section-audit"));
    expect(mockPush).toHaveBeenCalledWith("/admin/audit");
  });
});

describe("AdminConsoleScreen arrangement", () => {
  it("lists the six sections as rows in one panel on a phone", async () => {
    mockWindow.width = 390;
    await renderWithApi(<AdminConsoleScreen />, routedFetch({}));
    expect(screen.getByTestId("admin-sections")).toBeOnTheScreen();
    expect(screen.queryByTestId("admin-sections-grid")).toBeNull();
    await fireEvent.press(screen.getByTestId("admin-section-users"));
    expect(mockPush).toHaveBeenCalledWith("/admin/users");
  });

  it("sets each section on its own card from 768, two to a row", async () => {
    mockWindow.width = 768;
    await renderWithApi(<AdminConsoleScreen />, routedFetch({}));
    const grid = screen.getByTestId("admin-sections-grid");
    expect(screen.queryByTestId("admin-sections")).toBeNull();
    expect(within(grid).getAllByRole("button")).toHaveLength(6);
    // Three rows of two.
    expect(grid.children).toHaveLength(3);
    const roles = screen.getByLabelText(
      "Roles and permissions: every role and exactly what it can do",
    );
    expect(within(roles).getByText("Every role and exactly what it can do")).toBeOnTheScreen();
    await fireEvent.press(roles);
    expect(mockPush).toHaveBeenCalledWith("/admin/roles");
  });

  it("sets the cards three to a row from 1024", async () => {
    await renderWithApi(<AdminConsoleScreen />, routedFetch({}));
    expect(screen.getByTestId("admin-sections-grid").children).toHaveLength(2);
  });
});
