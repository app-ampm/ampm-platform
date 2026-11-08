import { fireEvent, screen } from "../../test/render";
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
  mockPush.mockClear();
});

describe("AdminConsoleScreen", () => {
  it("opens the notifications log from its tile", async () => {
    await renderWithApi(<AdminConsoleScreen />, routedFetch({}));
    await fireEvent.press(screen.getByTestId("admin-section-notifications"));
    expect(mockPush).toHaveBeenCalledWith("/admin/notifications");
  });

  it("opens the audit log from its tile", async () => {
    await renderWithApi(<AdminConsoleScreen />, routedFetch({}));
    await fireEvent.press(screen.getByTestId("admin-section-audit"));
    expect(mockPush).toHaveBeenCalledWith("/admin/audit");
  });
});
