import type * as ReactModule from "react";

import type { FieldNoteView } from "@ampm/core";

import { ok, renderWithApi } from "../../test/api";
import { act, fireEvent, screen } from "../../test/render";
import { FieldNotesScreen } from "./field-notes-screen";
import { MemoryStore } from "./memory-store";

// The screen runs on the in-memory store (the web export's) instead of expo-sqlite; each test gets a
// fresh one. Variables named mock* may be read inside jest.mock.
const mockStore = { current: new MemoryStore() };

jest.mock("./create-store", () => ({
  createOfflineStore: () => Promise.resolve(mockStore.current),
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

async function resizeTo(width: number): Promise<void> {
  await act(() => {
    mockWindow.width = width;
    mockWindow.listeners.forEach((listener) => listener());
  });
}

const NOTE: FieldNoteView = {
  id: "0192f3a0-7d3e-7b1a-9c2f-bbbbbbbbbbbb",
  projectId: "0192f3a0-7d3e-7b1a-9c2f-aaaaaaaaaaaa",
  version: 1,
  body: "Stage-left riser is wobbling.",
  status: "open",
  clientTimestamp: "2026-11-06T09:30:00.000Z",
  serverTimestamp: "2026-11-06T09:31:00.000Z",
};

/** The notes' read answers with one note (nothing is queued, so it is the only call). */
const notesApi: typeof fetch = () => Promise.resolve(ok({ items: [NOTE], nextCursor: null }));

/** The two columns in reading order: the composer side and the list. */
function columnOrder(): string[] {
  return screen
    .getAllByTestId(/^field-notes-(side|list)$/)
    .map((column) => String(column.props.testID));
}

beforeEach(() => {
  mockStore.current = new MemoryStore();
  mockWindow.width = 1440;
});

describe("FieldNotesScreen from 1024 (M11)", () => {
  it("sets the notes beside the sync status and the composer", async () => {
    await renderWithApi(<FieldNotesScreen />, notesApi);
    expect(await screen.findByText(NOTE.body)).toBeOnTheScreen();
    expect(screen.getByTestId("field-notes-columns").props.className).toContain("flex-row");
    expect(columnOrder()).toEqual(["field-notes-list", "field-notes-side"]);
  });

  it("keeps the phone's order below 1024: the composer, then the notes", async () => {
    mockWindow.width = 390;
    await renderWithApi(<FieldNotesScreen />, notesApi);
    expect(await screen.findByText(NOTE.body)).toBeOnTheScreen();
    expect(screen.getByTestId("field-notes-columns").props.className).toContain("flex-col");
    expect(columnOrder()).toEqual(["field-notes-side", "field-notes-list"]);
  });

  it("keeps a note being typed, and the composer itself, when the window crosses 1024", async () => {
    mockWindow.width = 390;
    await renderWithApi(<FieldNotesScreen />, notesApi);
    expect(await screen.findByText(NOTE.body)).toBeOnTheScreen();
    const input = screen.getByLabelText("New field note");
    await fireEvent.changeText(input, "Mandap lights need a second check");
    await resizeTo(1440);
    expect(columnOrder()).toEqual(["field-notes-list", "field-notes-side"]);
    // The same input instance, moved by the keyed swap rather than remounted, still holding the draft.
    // It does not prove focus: in a browser, moving the column's node after the list blurs the input.
    expect(screen.getByLabelText("New field note")).toBe(input);
    expect(input).toHaveDisplayValue("Mandap lights need a second check");
    await resizeTo(390);
    expect(columnOrder()).toEqual(["field-notes-side", "field-notes-list"]);
    expect(screen.getByLabelText("New field note")).toHaveDisplayValue(
      "Mandap lights need a second check",
    );
  });
});
