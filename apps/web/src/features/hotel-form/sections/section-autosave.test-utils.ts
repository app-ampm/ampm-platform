import type { HotelFormSectionConflict, HotelFormSectionSaved } from "@ampm/core";
import { vi } from "vitest";

import {
  createSectionAutosave,
  type SaveRefusal,
  type SaveState,
  type SectionPayload,
} from "./section-autosave";

/*
 * A section's autosave under test: saves that wait for the test to answer them, one by one, and every
 * state it showed. Synthetic answers only; imported by tests only.
 */

export type Payload = SectionPayload<"rooms">;

export const NOW = Date.parse("2026-11-26T10:00:00.000Z");
const HASH = "a".repeat(64);
export const SAVED: Payload = { answers: { totalRooms: 30 }, noChanges: false };
export const payload = (totalRooms: number, noChanges = false): Payload => ({
  answers: { totalRooms },
  noChanges,
});
export const THEIRS: HotelFormSectionConflict<"rooms"> = {
  section: "rooms",
  version: 5,
  answers: { totalRooms: 44 },
  noChanges: false,
  editedBy: "Synthetic Colleague",
  editedAt: "2026-11-26T09:58:00.000Z",
};

/** A refused save as the test raises it: the refusal the page would read from the API's error. */
export class Refused extends Error {
  constructor(readonly refusal: SaveRefusal<"rooms">) {
    super(refusal.kind);
  }
}

interface Call {
  readonly payload: Payload;
  readonly expectedVersion: number;
  readonly keepalive: boolean;
  readonly resolve: (saved: HotelFormSectionSaved) => void;
  readonly reject: (refused: Refused) => void;
}

/** An autosave whose saves wait for the test to answer them, one by one, with every state it showed. */
export function harness(version = 2) {
  const calls: Call[] = [];
  const states: SaveState<"rooms">[] = [];
  const landed: Payload[] = [];
  const refusals: unknown[] = [];
  const autosave = createSectionAutosave<"rooms">({
    version,
    saved: SAVED,
    send: (sent, expectedVersion, { keepalive }) =>
      new Promise<HotelFormSectionSaved>((resolve, reject) =>
        calls.push({ payload: sent, expectedVersion, keepalive, resolve, reject }),
      ),
    refusalOf: (error) => {
      refusals.push(error);
      return error instanceof Refused ? error.refusal : { kind: "failed", message: "Unexpected" };
    },
    onState: (state) => states.push(state),
    onSaved: (payload) => landed.push(payload),
  });
  const last = () => states.at(-1);
  const answer = async (index: number, saved: Partial<HotelFormSectionSaved> = {}) => {
    calls[index]?.resolve({
      version: 3,
      isComplete: false,
      contentHash: HASH,
      lastEditedBy: "Asha Rao",
      lastEditedAt: new Date(NOW).toISOString(),
      isLastSaveYours: true,
      ...saved,
    });
    await vi.advanceTimersByTimeAsync(0);
  };
  const refuse = async (index: number, refusal: SaveRefusal<"rooms">) => {
    calls[index]?.reject(new Refused(refusal));
    await vi.advanceTimersByTimeAsync(0);
  };
  return { autosave, calls, states, landed, refusals, last, answer, refuse };
}
