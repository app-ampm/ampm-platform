import type { ReactElement } from "react";

import { fireEvent, screen } from "../../test/render";
import { AdminSectionNav } from "./admin-section-nav";
import { AuditLogScreen } from "./audit-log-screen";
import { ConfigurationScreen } from "./configuration-screen";
import { NotificationTemplatesScreen } from "./notification-templates-screen";
import { NotificationsLogScreen } from "./notifications-log-screen";
import { RolesScreen } from "./roles-screen";
import { StaffUsersScreen } from "./staff-users-screen";
import { renderWithApi, routedFetch } from "./admin.test-utils";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), replace: mockReplace, push: jest.fn() }),
}));

const mockWindow = { width: 390 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWindow.width, height: 900, scale: 2, fontScale: 1 }),
}));

jest.mock("./download-csv", () => ({ downloadCsv: jest.fn(() => true) }));

beforeEach(() => {
  mockWindow.width = 390;
  mockReplace.mockClear();
});

describe("AdminSectionNav (T12)", () => {
  it("names every settings section on one tab strip, the current one selected", async () => {
    await renderWithApi(<AdminSectionNav current="roles" />, routedFetch({}));
    const strip = screen.getByTestId("admin-section-nav");
    expect(strip.props.accessibilityRole).toBe("tablist");
    expect(strip.props.accessibilityLabel).toBe("Settings sections");
    const labels = screen.getAllByRole("tab").map((tab) => tab.props.accessibilityLabel);
    expect(labels).toEqual([
      "Users",
      "Roles",
      "Notifications",
      "Templates",
      "Configuration",
      "Audit log",
    ]);
    expect(screen.getByRole("tab", { name: "Roles" })).toBeSelected();
    expect(screen.getByRole("tab", { name: "Users" })).not.toBeSelected();
  });

  it("opens another section in place of this one", async () => {
    await renderWithApi(<AdminSectionNav current="roles" />, routedFetch({}));
    await fireEvent.press(screen.getByRole("tab", { name: "Templates" }));
    expect(mockReplace).toHaveBeenCalledWith("/admin/notification-templates");
    await fireEvent.press(screen.getByRole("tab", { name: "Audit log" }));
    expect(mockReplace).toHaveBeenCalledWith("/admin/audit");
  });

  it("does nothing when the current section is chosen again", async () => {
    await renderWithApi(<AdminSectionNav current="users" />, routedFetch({}));
    await fireEvent.press(screen.getByRole("tab", { name: "Users" }));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("scrolls sideways across a phone's width, and is capped beside a tablet's title", async () => {
    await renderWithApi(<AdminSectionNav current="users" />, routedFetch({}));
    const strip = screen.getByTestId("admin-section-nav");
    expect(strip.props.horizontal).toBe(true);
    expect(strip.props.className).toContain("w-full");
    expect(strip.props.className).toContain("md:max-w-64");
    expect(strip.props.className).toContain("lg:max-w-none");
  });
});

const SECTION_PAGES: readonly [string, ReactElement, string][] = [
  ["the staff directory", <StaffUsersScreen key="users" />, "Users"],
  ["the roles", <RolesScreen key="roles" />, "Roles"],
  ["the notifications log", <NotificationsLogScreen key="notifications" />, "Notifications"],
  ["the templates", <NotificationTemplatesScreen key="templates" />, "Templates"],
  ["the configuration", <ConfigurationScreen key="configuration" />, "Configuration"],
  ["the audit log", <AuditLogScreen key="audit" />, "Audit log"],
];

describe("Every settings page carries the section strip", () => {
  it.each(SECTION_PAGES)("%s, its own section selected", async (_name, page, section) => {
    // A page still loading: the strip is part of its header from the first frame.
    await renderWithApi(page, () => new Promise<Response>(() => {}));
    expect(screen.getByLabelText("Settings sections")).toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: section })).toBeSelected();
  });
});
