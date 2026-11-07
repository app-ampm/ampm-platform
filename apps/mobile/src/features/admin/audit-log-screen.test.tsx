import type { ReactNode } from "react";

import { uiCopy } from "@ampm/ui";

import { fireEvent, screen } from "../../test/render";
import { AuditLogScreen } from "./audit-log-screen";
import {
  auditEventFixture,
  failure,
  ok,
  renderWithApi,
  routedFetch,
  type FetchFn,
} from "./admin.test-utils";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), replace: mockReplace, push: jest.fn() }),
}));

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
});
