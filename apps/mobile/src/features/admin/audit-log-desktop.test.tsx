import type * as ReactModule from "react";

import { act, fireEvent, screen, within } from "../../test/render";
import { AuditLogScreen } from "./audit-log-screen";
import { auditEventFixture, ok, renderWithApi, type FetchFn } from "./admin.test-utils";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: jest.fn() }),
}));

jest.mock("./download-csv", () => ({ downloadCsv: jest.fn(() => true) }));

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

const SNAPSHOT = { generatedAt: "2026-11-05T18:02:00.000Z", truncated: false, filters: {} };

/** The log, and its export; every requested URL is kept. */
function logFetch(urls: string[]): FetchFn {
  return (input) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("/admin/audit-events/export")) {
      return Promise.resolve(ok({ ...SNAPSHOT, rowCount: 1, rows: [auditEventFixture()] }));
    }
    return Promise.resolve(ok({ items: [auditEventFixture()], nextCursor: null }));
  };
}

async function renderLog(urls: string[] = []): Promise<void> {
  await renderWithApi(<AuditLogScreen />, logFetch(urls));
  await screen.findByText("Update");
}

beforeEach(() => {
  mockWindow.width = 1440;
});

describe("AuditLogScreen filters from 768", () => {
  it("keeps the filters at fixed widths on one row, Export closing it at the right", async () => {
    await renderLog();
    const row = screen.getByTestId("audit-filters");
    expect(row.props.className).toContain("items-end");
    const exportButton = within(row).getByTestId("audit-export");
    expect(exportButton.props.className).toContain("ml-auto");
    // The row's children in order: the date range, the action and Export.
    const [range, action] = row.children.map((child) =>
      typeof child === "string" ? "" : String(child.props.className),
    );
    expect(range).toContain("md:w-64 md:flex-none");
    expect(action).toContain("md:w-48 md:flex-none");
  });

  it("gives Export its own line on a phone, the filters sharing the width", async () => {
    mockWindow.width = 390;
    await renderLog();
    const row = screen.getByTestId("audit-filters");
    expect(within(row).queryByTestId("audit-export")).toBeNull();
    expect(screen.getByTestId("audit-export")).toBeOnTheScreen();
  });
});

describe("AuditLogScreen across 768", () => {
  it("keeps the chosen action when the window widens, and exports with it", async () => {
    mockWindow.width = 390;
    const urls: string[] = [];
    await renderLog(urls);
    await fireEvent.press(screen.getByTestId("audit-action"));
    await fireEvent.press(screen.getByTestId("audit-action-option-delete"));
    await resizeTo(1440);
    expect(
      within(screen.getByTestId("audit-filters")).getByTestId("audit-export"),
    ).toBeOnTheScreen();
    expect(within(screen.getByTestId("audit-filters")).getByText("Delete")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("audit-export"));
    expect(await screen.findByText("Exported 1 events")).toBeOnTheScreen();
    expect(urls.find((url) => url.includes("/admin/audit-events/export"))).toContain(
      "action=delete",
    );
  });
});
