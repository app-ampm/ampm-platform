import type { HotelFormSectionConflict, HotelFormSectionSaved } from "@ampm/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTOSAVE_DELAY_MS,
  createSectionAutosave,
  type SaveRefusal,
  type SaveState,
  type SectionPayload,
} from "./section-autosave";

/* A section's autosave (D-190 §5; plan §4.4): when it saves, what it sends, and each refusal's way on. */

type Payload = SectionPayload<"rooms">;

const NOW = Date.parse("2026-11-26T10:00:00.000Z");
const HASH = "a".repeat(64);
const SAVED: Payload = { answers: { totalRooms: 30 }, noChanges: false };
const payload = (totalRooms: number, noChanges = false): Payload => ({
  answers: { totalRooms },
  noChanges,
});
const THEIRS: HotelFormSectionConflict<"rooms"> = {
  section: "rooms",
  version: 5,
  answers: { totalRooms: 44 },
  noChanges: false,
  editedBy: "Synthetic Colleague",
  editedAt: "2026-11-26T09:58:00.000Z",
};

/** A refused save as the test raises it: the refusal the page would read from the API's error. */
class Refused extends Error {
  constructor(readonly refusal: SaveRefusal<"rooms">) {
    super(refusal.kind);
  }
}

interface Call {
  readonly payload: Payload;
  readonly expectedVersion: number;
  readonly resolve: (saved: HotelFormSectionSaved) => void;
  readonly reject: (refused: Refused) => void;
}

/** An autosave whose saves wait for the test to answer them, one by one, with every state it showed. */
function harness(version = 2) {
  const calls: Call[] = [];
  const states: SaveState<"rooms">[] = [];
  const autosave = createSectionAutosave<"rooms">({
    version,
    saved: SAVED,
    send: (sent, expectedVersion) =>
      new Promise<HotelFormSectionSaved>((resolve, reject) =>
        calls.push({ payload: sent, expectedVersion, resolve, reject }),
      ),
    refusalOf: (error) =>
      error instanceof Refused ? error.refusal : { kind: "failed", message: "Unexpected" },
    onState: (state) => states.push(state),
  });
  const last = () => states.at(-1);
  const answer = async (index: number, saved: Partial<HotelFormSectionSaved> = {}) => {
    calls[index]?.resolve({
      version: 3,
      isComplete: false,
      contentHash: HASH,
      lastEditedBy: "Asha Rao",
      lastEditedAt: new Date(NOW).toISOString(),
      ...saved,
    });
    await vi.advanceTimersByTimeAsync(0);
  };
  const refuse = async (index: number, refusal: SaveRefusal<"rooms">) => {
    calls[index]?.reject(new Refused(refusal));
    await vi.advanceTimersByTimeAsync(0);
  };
  return { autosave, calls, states, last, answer, refuse };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => vi.useRealTimers());

describe("when a section saves", () => {
  it("saves 1.5 seconds after typing stops, each keystroke starting the wait again", async () => {
    const { autosave, calls, last } = harness();
    autosave.change(payload(31));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 100);
    autosave.change(payload(32));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 100);
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(100);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.payload).toEqual(payload(32));
    expect(calls[0]?.expectedVersion).toBe(2);
    expect(last()).toEqual({ kind: "saving" });
  });

  it("saves at once on leaving a field or when the page is hidden (flush)", async () => {
    const { autosave, calls } = harness();
    autosave.change(payload(31));
    autosave.flush();
    expect(calls).toHaveLength(1);
    // The wait that was running does not save the same answers again.
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);
    expect(calls).toHaveLength(1);
  });

  it("says Saved, and saves the next change on the version the last save made", async () => {
    const { autosave, calls, last, answer } = harness();
    autosave.change(payload(31));
    autosave.flush();
    await answer(0, { version: 3 });
    expect(last()).toEqual({ kind: "saved" });
    autosave.change(payload(32));
    autosave.flush();
    expect(calls[1]?.expectedVersion).toBe(3);
  });

  it("sends nothing while the answers match what is saved, No changes included", async () => {
    const { autosave, calls } = harness();
    autosave.change(SAVED);
    autosave.flush();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(calls).toHaveLength(0);
    autosave.change(payload(30, true));
    autosave.flush();
    expect(calls).toHaveLength(1);
  });

  it("runs one save at a time, sending what changed meanwhile once the first is answered", async () => {
    const { autosave, calls, answer } = harness();
    autosave.change(payload(31));
    autosave.flush();
    autosave.change(payload(32));
    autosave.flush();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(calls).toHaveLength(1);
    await answer(0, { version: 3 });
    expect(calls).toHaveLength(2);
    expect(calls[1]?.payload).toEqual(payload(32));
    expect(calls[1]?.expectedVersion).toBe(3);
  });

  it("saves what is left when the page goes, then says nothing more", async () => {
    const { autosave, calls, states, answer } = harness();
    autosave.change(payload(31));
    autosave.dispose();
    expect(calls).toHaveLength(1);
    const shown = states.length;
    await answer(0);
    expect(states).toHaveLength(shown);
  });
});

describe("when a save is refused", () => {
  it("says Not saved, and tries again on Retry or the next change", async () => {
    const { autosave, calls, last, refuse } = harness();
    autosave.change(payload(31));
    autosave.flush();
    await refuse(0, { kind: "failed", message: "We couldn't reach AMPM." });
    expect(last()).toEqual({ kind: "failed", message: "We couldn't reach AMPM." });
    expect(autosave.hasUnsaved()).toBe(true);
    autosave.retry();
    expect(calls).toHaveLength(2);
    await refuse(1, { kind: "failed", message: "We couldn't reach AMPM." });
    autosave.change(payload(32));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(calls).toHaveLength(3);
  });

  it("waits out a 429's Retry-After before saving again, keeping changes made meanwhile", async () => {
    const { autosave, calls, last, refuse } = harness();
    autosave.change(payload(31));
    autosave.flush();
    await refuse(0, { kind: "wait", message: "Too many changes in a short time.", seconds: 12 });
    expect(last()).toEqual({
      kind: "waiting",
      message: "Too many changes in a short time.",
      retryAt: NOW + 12_000,
    });
    autosave.change(payload(33));
    autosave.flush();
    await vi.advanceTimersByTimeAsync(11_000);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.payload).toEqual(payload(33));
  });

  it("offers a colleague's save, saving nothing until the person chooses", async () => {
    const { autosave, calls, last, refuse } = harness();
    autosave.change(payload(31));
    autosave.flush();
    await refuse(0, { kind: "conflict", theirs: THEIRS });
    expect(last()).toEqual({ kind: "conflict", theirs: THEIRS });
    autosave.change(payload(32));
    autosave.flush();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(calls).toHaveLength(1);
  });

  it("Keep mine saves the person's answers on their colleague's version", async () => {
    const { autosave, calls, last, refuse, answer } = harness();
    autosave.change(payload(31));
    autosave.flush();
    await refuse(0, { kind: "conflict", theirs: THEIRS });
    autosave.change(payload(32));
    autosave.keepMine();
    expect(calls[1]?.payload).toEqual(payload(32));
    expect(calls[1]?.expectedVersion).toBe(5);
    await answer(1, { version: 6 });
    expect(last()).toEqual({ kind: "saved" });
  });

  it("Take theirs makes the colleague's save the page's, saving nothing", async () => {
    const { autosave, calls, last, refuse } = harness();
    autosave.change(payload(31));
    autosave.flush();
    await refuse(0, { kind: "conflict", theirs: THEIRS });
    expect(autosave.takeTheirs()).toEqual({ answers: { totalRooms: 44 }, noChanges: false });
    expect(last()).toEqual({ kind: "saved" });
    autosave.change(payload(44));
    autosave.flush();
    expect(calls).toHaveLength(1);
    autosave.change(payload(45));
    autosave.flush();
    expect(calls[1]?.expectedVersion).toBe(5);
  });

  it("stops for good on a locked request, keeping what was typed unsaved", async () => {
    const { autosave, calls, last, refuse } = harness();
    autosave.change(payload(31));
    autosave.flush();
    const readOnly = {
      status: "submitted" as const,
      submittedBy: "Synthetic Colleague",
      submittedAt: "2026-11-26T09:59:00.000Z",
    };
    await refuse(0, { kind: "locked", readOnly });
    expect(last()).toEqual({ kind: "locked", readOnly });
    autosave.change(payload(32));
    autosave.flush();
    autosave.retry();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(calls).toHaveLength(1);
    expect(autosave.hasUnsaved()).toBe(true);
  });

  it("holds the save while a new code is asked for, and sends it once the session is back", async () => {
    const { autosave, calls, last, refuse } = harness();
    autosave.change(payload(31));
    autosave.flush();
    await refuse(0, { kind: "session" });
    expect(last()).toEqual({ kind: "session" });
    autosave.change(payload(32));
    autosave.flush();
    expect(calls).toHaveLength(1);
    autosave.resume();
    expect(calls).toHaveLength(2);
    expect(calls[1]?.payload).toEqual(payload(32));
  });
});
