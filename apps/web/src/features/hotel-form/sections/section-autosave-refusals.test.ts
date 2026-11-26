import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTOSAVE_DELAY_MS } from "./section-autosave";
import { NOW, THEIRS, harness, payload } from "./section-autosave.test-utils";

/* A section's autosave (D-190 §5; plan §4.4): each refusal's way on. */

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => vi.useRealTimers());

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

  it("Keep mine still saves after the person undid their answers back to their own last save", async () => {
    const { autosave, calls, last, refuse, answer } = harness();
    autosave.change(payload(31));
    autosave.flush();
    await answer(0, { version: 3 });
    autosave.change(payload(32));
    autosave.flush();
    await refuse(1, { kind: "conflict", theirs: THEIRS });
    // Back to what this page saved last: the API holds the colleague's 44, so it still has to go.
    autosave.change(payload(31));
    autosave.keepMine();
    expect(calls).toHaveLength(3);
    expect(calls[2]?.payload).toEqual(payload(31));
    expect(calls[2]?.expectedVersion).toBe(5);
    await answer(2, { version: 6 });
    expect(last()).toEqual({ kind: "saved" });
  });

  it("Keep mine sends nothing when the page's answers are the colleague's already", async () => {
    const { autosave, calls, last, refuse } = harness();
    autosave.change(payload(31));
    autosave.flush();
    await refuse(0, { kind: "conflict", theirs: THEIRS });
    autosave.change(payload(44));
    autosave.keepMine();
    expect(calls).toHaveLength(1);
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
