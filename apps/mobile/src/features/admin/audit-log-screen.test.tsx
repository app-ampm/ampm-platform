import type { ReactNode } from "react";

import { uiCopy } from "@ampm/ui";

import { fireEvent, screen, waitFor } from "../../test/render";
import { AuditLogScreen } from "./audit-log-screen";
import {
  auditEventFixture,
  failure,
  ok,
  renderWithApi,
  routedFetch,
  type FetchFn,
} from "./admin.test-utils";
import { downloadCsv } from "./download-csv";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), replace: mockReplace, push: jest.fn() }),
}));

jest.mock("./download-csv", () => ({ downloadCsv: jest.fn(() => true) }));

const mockWindow = { width: 1280 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWindow.width, height: 900, scale: 2, fontScale: 1 }),
}));

const eventsFetch = (items = [auditEventFixture()], nextCursor: string | null = null): FetchFn =>
  routedFetch({ "/admin/audit-events": () => ok({ items, nextCursor }) });

async function renderLog(fetchImpl: FetchFn, tabBar?: ReactNode): Promise<void> {
  await renderWithApi(<AuditLogScreen tabBar={tabBar} />, fetchImpl);
}

beforeEach(() => {
  mockReplace.mockClear();
  jest.mocked(downloadCsv).mockClear();
});

describe("AuditLogScreen", () => {
  it("shows skeletons while the log loads", async () => {
    await renderLog(() => new Promise<Response>(() => {}));
    expect(screen.getByTestId("audit-loading")).toBeOnTheScreen();
    expect(screen.getByText("Audit log")).toBeOnTheScreen();
  });

  it("lists events with action, entity and time, and counts them", async () => {
    await renderLog(eventsFetch());
    expect(await screen.findByText("Update")).toBeOnTheScreen();
    expect(screen.getByText("staff_user")).toBeOnTheScreen();
    expect(screen.getByText("Audit log · 1")).toBeOnTheScreen();
  });

  it("opens an event's full record (with before/after) from its row", async () => {
    await renderLog(eventsFetch());
    await fireEvent.press(await screen.findByLabelText(/Update staff_user by Staff/));
    expect(await screen.findByText("Audit event")).toBeOnTheScreen();
    expect(screen.getByText("Before")).toBeOnTheScreen();
    expect(screen.getByText("After")).toBeOnTheScreen();
  });

  it("says when there are no events yet", async () => {
    await renderLog(eventsFetch([]));
    expect(await screen.findByText("No audit events yet")).toBeOnTheScreen();
  });

  it("shows the error state when the API fails", async () => {
    await renderLog(routedFetch({ "/admin/audit-events": () => failure("internal", 500) }));
    expect(await screen.findByText(uiCopy.error.title)).toBeOnTheScreen();
  });

  it("asks to sign in again once the session has ended", async () => {
    await renderLog(routedFetch({ "/admin/audit-events": () => failure("unauthenticated", 401) }));
    expect(await screen.findByText("Sign in to view the audit log")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Sign in"));
    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  });

  it("refetches the log bounded by a chosen date range", async () => {
    const urls: string[] = [];
    const fetchImpl: FetchFn = (input) => {
      urls.push(String(input));
      return Promise.resolve(ok({ items: [auditEventFixture()], nextCursor: null }));
    };
    await renderLog(fetchImpl);
    expect(await screen.findByText("Update")).toBeOnTheScreen();
    // The initial load carries no date bounds.
    expect(urls.some((url) => url.includes("from="))).toBe(false);
    await fireEvent.press(screen.getByTestId("audit-range"));
    await fireEvent.press(screen.getByTestId("audit-range-preset-last_30"));
    await waitFor(() => {
      const url = urls.find((u) => u.includes("from=") && u.includes("to="));
      expect(url).toBeDefined();
      const params = new URLSearchParams(url!.slice(url!.indexOf("?")));
      // from is the day start; to covers the whole end day (inclusive).
      expect(params.get("from")).toMatch(/T00:00:00\.000Z$/);
      expect(params.get("to")).toMatch(/T23:59:59\.999Z$/);
    });
  });

  it("filters the log by action", async () => {
    const urls: string[] = [];
    const fetchImpl: FetchFn = (input) => {
      urls.push(String(input));
      return Promise.resolve(ok({ items: [auditEventFixture()], nextCursor: null }));
    };
    await renderLog(fetchImpl);
    expect(await screen.findByText("Update")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("audit-action"));
    await fireEvent.press(screen.getByTestId("audit-action-option-delete"));
    await waitFor(() => {
      expect(urls.some((url) => url.includes("action=delete"))).toBe(true);
    });
  });

  const exportSnapshot = { generatedAt: "2026-11-05T18:02:00.000Z", truncated: false, filters: {} };

  it("exports the filtered audit log to a CSV download, carrying the current filters", async () => {
    const urls: string[] = [];
    const exportFetch: FetchFn = (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("/admin/audit-events/export")) {
        return Promise.resolve(ok({ ...exportSnapshot, rowCount: 1, rows: [auditEventFixture()] }));
      }
      return Promise.resolve(ok({ items: [auditEventFixture()], nextCursor: null }));
    };
    await renderLog(exportFetch);
    expect(await screen.findByText("Update")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("audit-action"));
    await fireEvent.press(screen.getByTestId("audit-action-option-delete"));
    await fireEvent.press(screen.getByTestId("audit-export"));
    expect(await screen.findByText("Exported 1 events")).toBeOnTheScreen();
    expect(jest.mocked(downloadCsv)).toHaveBeenCalledWith(
      "audit-log.csv",
      expect.stringContaining("When (UTC)"),
    );
    // The export must request the currently-filtered set, not the whole log.
    expect(urls.find((url) => url.includes("/admin/audit-events/export"))).toContain(
      "action=delete",
    );
  });

  it("guides the user to the web when a file cannot be saved (native)", async () => {
    jest.mocked(downloadCsv).mockReturnValueOnce(false);
    const exportFetch: FetchFn = (input) =>
      Promise.resolve(
        String(input).includes("/admin/audit-events/export")
          ? ok({ ...exportSnapshot, rowCount: 1, rows: [auditEventFixture()] })
          : ok({ items: [auditEventFixture()], nextCursor: null }),
      );
    await renderLog(exportFetch);
    expect(await screen.findByText("Update")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("audit-export"));
    expect(await screen.findByText("Export from the web workspace")).toBeOnTheScreen();
    expect(screen.queryByText("Exported 1 events")).toBeNull();
  });

  it("shows an error toast when the export request fails", async () => {
    const exportFetch: FetchFn = (input) =>
      String(input).includes("/admin/audit-events/export")
        ? Promise.resolve(failure("internal", 500))
        : Promise.resolve(ok({ items: [auditEventFixture()], nextCursor: null }));
    await renderLog(exportFetch);
    expect(await screen.findByText("Update")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("audit-export"));
    expect(await screen.findByText("Could not export the audit log")).toBeOnTheScreen();
    expect(jest.mocked(downloadCsv)).not.toHaveBeenCalled();
  });
});
