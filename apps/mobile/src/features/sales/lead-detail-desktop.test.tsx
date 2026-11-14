import type * as ReactModule from "react";

import { act, fireEvent, screen, within } from "../../test/render";
import { LeadDetailScreen } from "./lead-detail-screen";
import {
  LEAD_ID,
  STAFF_USER_ID,
  activityFixture,
  leadDetailFetch,
  leadFixture,
  ok,
  renderWithApi,
  type FetchFn,
} from "./sales.test-utils";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: jest.fn() }),
}));

/**
 * The window, as a store its readers subscribe to: a resize re-renders exactly the components that read
 * the width, as React Native's own hook does (a plain mock would let React Compiler skip the re-render).
 * Its width picks the layout: one column below 1024, T3's two columns from there.
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

const ACTIVITIES_PATH = `/crm/leads/${LEAD_ID}/activities`;

/** An owned lead at `contacted`: Advance shows in the header, the manage card offers Close. */
const OWNED = leadFixture({
  status: "contacted",
  ownerUserId: STAFF_USER_ID,
  ownerName: "Sameer Sales",
});

async function renderDetail(fetchImpl: FetchFn): Promise<void> {
  await renderWithApi(<LeadDetailScreen leadId={LEAD_ID} />, fetchImpl);
}

/** The composition's direction: T3's columns side by side, or stacked. */
const direction = (): string => String(screen.getByTestId("lead-columns").props.className);

/** The lead's panels in reading order. */
const panelOrder = (): unknown[] =>
  screen
    .getAllByTestId(/^lead-(activity|demo|invite|manage|contact)$/)
    .map((panel) => panel.props.testID);

beforeEach(() => {
  mockWindow.width = 1440;
});

describe("LeadDetailScreen layout (T3)", () => {
  it("stacks the actions first below 1024: demo, invite, manage, contact, then the activity", async () => {
    mockWindow.width = 900;
    await renderDetail(leadDetailFetch(leadFixture()));
    await screen.findByTestId("lead-contact");
    expect(screen.getByTestId("lead-columns").props.className).toContain("flex-col");
    expect(panelOrder()).toEqual([
      "lead-demo",
      "lead-invite",
      "lead-manage",
      "lead-contact",
      "lead-activity",
    ]);
  });

  it("sets the activity, filling its column, beside the side panels from 1024", async () => {
    await renderDetail(leadDetailFetch(leadFixture()));
    await screen.findByTestId("lead-contact");
    const columns = screen.getByTestId("lead-columns");
    expect(columns.props.className).toContain("flex-row");
    const [main, side] = columns.children as unknown as Parameters<typeof within>[0][];
    expect(within(main).getByTestId("lead-activity").props.className).toEqual(
      expect.stringContaining("flex-1"),
    );
    expect(
      within(side)
        .getAllByTestId(/^lead-(demo|invite|manage|contact)$/)
        .map((panel) => panel.props.testID),
    ).toEqual(["lead-demo", "lead-invite", "lead-manage", "lead-contact"]);
  });

  it("puts Log activity and Advance in the record header, glass beside the one gold action", async () => {
    await renderDetail(leadDetailFetch(OWNED));
    // Settled: the timeline has loaded and /me says the signed-in rep owns the lead.
    expect(await screen.findByText("No activity logged yet.")).toBeOnTheScreen();
    expect(await screen.findByTestId("lead-unassign")).toBeOnTheScreen();
    const header = within(screen.getByTestId("lead-header"));
    expect(header.getByRole("button", { name: "Log activity" })).toBeOnTheScreen();
    expect(header.getByRole("button", { name: "Advance to Introduction shared" })).toBeTruthy();
    expect(header.queryByText("Create account and invite")).toBeNull();
    expect(
      within(screen.getByTestId("lead-invite")).getByRole("button", {
        name: "Create account and invite",
      }),
    ).toBeOnTheScreen();
  });
});

describe("LeadDetailScreen across 1024", () => {
  it("keeps the log-activity sheet open with its draft when the window narrows and widens", async () => {
    const bodies: unknown[] = [];
    const activities = (init: RequestInit | undefined) => {
      if (init?.method !== "POST") return ok({ items: [] });
      bodies.push(JSON.parse(String(init.body)));
      return ok(activityFixture());
    };
    await renderDetail(leadDetailFetch(OWNED, { [ACTIVITIES_PATH]: activities }));
    await fireEvent.press(await screen.findByTestId("lead-activity-add"));
    await fireEvent.press(await screen.findByText("WhatsApp"));
    await fireEvent.changeText(screen.getByTestId("activity-summary"), "Sent the shortlist");
    // The columns swap places but stay the same instances: moved, never remounted.
    const activity = screen.getByTestId("lead-activity");
    const side = screen.getByTestId("lead-side");
    expect(direction()).toContain("flex-row");
    await resizeTo(900);
    expect(direction()).toContain("flex-col");
    expect(panelOrder().at(-1)).toBe("lead-activity");
    expect(screen.getByTestId("lead-activity")).toBe(activity);
    expect(screen.getByTestId("lead-side")).toBe(side);
    expect(screen.getByTestId("activity-summary")).toHaveDisplayValue("Sent the shortlist");
    await resizeTo(1440);
    expect(direction()).toContain("flex-row");
    expect(panelOrder()[0]).toBe("lead-activity");
    expect(screen.getByTestId("lead-activity")).toBe(activity);
    expect(screen.getByTestId("lead-side")).toBe(side);
    expect(screen.getByTestId("activity-summary")).toHaveDisplayValue("Sent the shortlist");
    await fireEvent.press(screen.getByTestId("lead-activity-submit"));
    expect(await screen.findByText("Activity logged")).toBeOnTheScreen();
    expect(bodies).toEqual([{ activityType: "whatsapp", summary: "Sent the shortlist" }]);
  });

  it("keeps the close-lead sheet and its typed reason across 1024", async () => {
    await renderDetail(leadDetailFetch(OWNED));
    await fireEvent.press(await screen.findByTestId("lead-close"));
    await fireEvent.changeText(await screen.findByTestId("lead-close-reason"), "Chose a planner");
    expect(direction()).toContain("flex-row");
    await resizeTo(900);
    expect(direction()).toContain("flex-col");
    expect(screen.getByTestId("lead-close-reason")).toHaveDisplayValue("Chose a planner");
    await resizeTo(1440);
    expect(direction()).toContain("flex-row");
    expect(screen.getByTestId("lead-close-reason")).toHaveDisplayValue("Chose a planner");
  });
});
