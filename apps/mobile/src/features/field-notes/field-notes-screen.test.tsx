import type { FieldNoteView } from "@ampm/core";
import { uiCopy } from "@ampm/ui";

import { failure, ok, renderWithApi } from "../../test/api";
import { screen } from "../../test/render";
import { FieldNotesScreen } from "./field-notes-screen";
import { MemoryStore } from "./memory-store";

// The screen runs on the in-memory store (the web export's) instead of expo-sqlite; each test gets a
// fresh one. Variables named mock* may be read inside jest.mock.
const mockStore = { current: new MemoryStore() };

jest.mock("./create-store", () => ({
  createOfflineStore: () => Promise.resolve(mockStore.current),
}));

/** The spike's one wedding (use-field-notes), whose notes the API answers with. */
const PROJECT_ID = "0192f3a0-7d3e-7b1a-9c2f-aaaaaaaaaaaa";

const LONG_BODY = [
  "Stage-left riser is wobbling.",
  "Rigging team asked to re-level it before the sangeet rehearsal at 5 pm.",
  "Keep guests off the ramp until then.",
].join("\n");

const NOTE: FieldNoteView = {
  id: "0192f3a0-7d3e-7b1a-9c2f-bbbbbbbbbbbb",
  projectId: PROJECT_ID,
  version: 2,
  body: LONG_BODY,
  status: "acknowledged",
  clientTimestamp: "2026-11-06T09:30:00.000Z",
  serverTimestamp: "2026-11-06T09:31:00.000Z",
};

/** A fetch that answers the notes' read with `reply` (nothing is queued, so it is the only call). */
function notesApi(reply: () => Response): typeof fetch {
  return () => Promise.resolve(reply());
}

beforeEach(() => {
  mockStore.current = new MemoryStore();
});

describe("FieldNotesScreen", () => {
  it("shows a note of several lines in full, with its status and version", async () => {
    await renderWithApi(
      <FieldNotesScreen />,
      notesApi(() => ok({ items: [NOTE], nextCursor: null })),
    );
    const body = await screen.findByText(LONG_BODY);
    // No line limit: the whole note reads on the list, which has no detail screen.
    expect(body.props.numberOfLines).toBeUndefined();
    expect(screen.getByText("Acknowledged")).toBeOnTheScreen();
    expect(screen.getByText("Synced · v2")).toBeOnTheScreen();
    expect(await screen.findByText("Synced")).toBeOnTheScreen();
  });

  it("says a refused sync failed instead of showing Synced", async () => {
    await renderWithApi(
      <FieldNotesScreen />,
      notesApi(() => failure("forbidden", 403)),
    );
    expect(await screen.findByText("Notes could not sync")).toBeOnTheScreen();
    expect(screen.queryByText("Synced")).toBeNull();
    expect(screen.getByText("No field notes yet")).toBeOnTheScreen();
  });

  it("shows the offline banner when the API cannot be reached", async () => {
    await renderWithApi(<FieldNotesScreen />, () => Promise.reject(new Error("no network")));
    expect(await screen.findByText(uiCopy.offlineBanner.title)).toBeOnTheScreen();
    expect(screen.queryByText("Synced")).toBeNull();
    expect(screen.queryByText("Notes could not sync")).toBeNull();
  });
});
