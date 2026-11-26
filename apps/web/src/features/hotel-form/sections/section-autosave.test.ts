import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTOSAVE_DELAY_MS } from "./section-autosave";
import { NOW, SAVED, harness, payload } from "./section-autosave.test-utils";

/* A section's autosave (D-190 §5; plan §4.4): when it saves, what it sends, and when it stops. */

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

  it("keeps saying Saving… when a save lands while newer typing still waits out the delay", async () => {
    const { autosave, calls, last, answer } = harness();
    autosave.change(payload(31));
    autosave.flush();
    // Typed while the first save is on its way: it waits out its own 1.5 seconds.
    autosave.change(payload(32));
    await answer(0, { version: 3 });
    expect(last()).toEqual({ kind: "saving" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(calls[1]?.payload).toEqual(payload(32));
    await answer(1, { version: 4 });
    expect(last()).toEqual({ kind: "saved" });
  });

  it("says Saving… as soon as the person types after Saved, and Saved again if they undo", async () => {
    const { autosave, calls, last, answer } = harness();
    autosave.change(payload(31));
    autosave.flush();
    await answer(0, { version: 3 });
    autosave.change(payload(32));
    expect(last()).toEqual({ kind: "saving" });
    autosave.change(payload(31));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(calls).toHaveLength(1);
    expect(last()).toEqual({ kind: "saved" });
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

  it("takes what waits, read again, in its place: its delay and its place behind the save on its way", async () => {
    const { autosave, calls, answer } = harness();
    autosave.change(payload(31));
    autosave.flush();
    autosave.change(payload(32));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 500);
    autosave.rebase(payload(33));
    // The delay set by the typing ends now: the save waits behind the first.
    await vi.advanceTimersByTimeAsync(500);
    expect(calls).toHaveLength(1);
    await answer(0, { version: 3 });
    expect(calls).toHaveLength(2);
    expect(calls[1]?.payload).toEqual(payload(33));
  });

  it("says what each save stored once it lands, and the version the next one goes on", async () => {
    const { autosave, landed, answer } = harness();
    autosave.change(payload(31));
    autosave.flush();
    expect(landed).toEqual([]);
    await answer(0, { version: 3 });
    expect(landed).toEqual([payload(31)]);
    expect(autosave.version()).toBe(3);
  });

  it("sends a flush with keepalive when asked (the page is hidden), and says how big it is", async () => {
    const { autosave, calls } = harness();
    expect(autosave.pendingBytes()).toBe(0);
    autosave.change(payload(31));
    expect(autosave.pendingBytes()).toBe(
      new TextEncoder().encode(JSON.stringify({ answers: { totalRooms: 31 }, noChanges: false }))
        .length,
    );
    autosave.flush({ keepalive: true });
    expect(calls[0]?.keepalive).toBe(true);
    // On its way already: a flush now only queues the next save, so there is nothing to size.
    autosave.change(payload(32));
    expect(autosave.pendingBytes()).toBe(0);
  });

  it("stops for good once stopped: nothing more is sent or said, nor any refusal handed on", async () => {
    const { autosave, calls, states, refusals, refuse } = harness();
    autosave.change(payload(31));
    autosave.flush();
    autosave.change(payload(32));
    autosave.stop();
    const shown = states.length;
    // The save on its way is answered with an ended session: not the flow's business any more.
    await refuse(0, { kind: "session" });
    autosave.change(payload(33));
    autosave.flush();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);
    expect(calls).toHaveLength(1);
    expect(states).toHaveLength(shown);
    expect(refusals).toEqual([]);
  });

  it("stops a 429's wait too, so nothing goes once its Retry-After is over", async () => {
    const { autosave, calls, refuse } = harness();
    autosave.change(payload(31));
    autosave.flush();
    await refuse(0, { kind: "wait", message: "Too many changes in a short time.", seconds: 3 });
    autosave.change(payload(32));
    autosave.stop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toHaveLength(1);
  });
});
