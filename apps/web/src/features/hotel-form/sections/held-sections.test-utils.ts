import type { HotelFormSectionSaveCall } from "@ampm/api-client";
import { AppError, HOTEL_FORM_ERRORS, type HotelFormSectionSaved } from "@ampm/core";
import { vi } from "vitest";

import type { HotelFormFlow } from "../use-hotel-form-flow";
import { HeldSections, type FormSession } from "./held-sections";
import { ROOMS_MODEL, type RoomsFields } from "./rooms.form";
import { payloadOf } from "./section-payload";
import { formSessionOf } from "./use-held-sections";

/*
 * Held sections for a test: as the layout makes them for a test's site, saving through the test's own
 * `save` inside the session the test's flow holds; or on their own, each save waiting for the test to
 * answer it. Synthetic answers only; imported by tests only.
 */

/** A save the test never expects. */
const NEVER_SAVED = (): Promise<HotelFormSectionSaved> =>
  Promise.reject(new Error("This test saves no section"));

/**
 * Held sections saving through `save`, under whatever session `flow()` holds when a save goes.
 *
 *   const sections = heldSectionsFor(() => site.flow, api.save);
 */
export function heldSectionsFor(
  flow: () => HotelFormFlow,
  save: (call: HotelFormSectionSaveCall) => Promise<HotelFormSectionSaved> = NEVER_SAVED,
): HeldSections {
  return new HeldSections({
    save,
    session: () => formSessionOf(flow()),
    refuseSession: (error) => {
      flow().refuseSession(error);
    },
  });
}

export const PERSON = "0192f3a0-7d3e-7b1a-9c2f-0000000000a5";
export const COLLEAGUE = "0192f3a0-7d3e-7b1a-9c2f-0000000000b7";
export const SESSION = `hfs_${"y".repeat(43)}`;
export const NEW_SESSION = `hfs_${"z".repeat(43)}`;
export const SAVED: HotelFormSectionSaved = {
  version: 3,
  isComplete: false,
  contentHash: "a".repeat(64),
  lastEditedBy: "Asha Rao",
  lastEditedAt: "2026-11-26T10:00:00.000Z",
  isLastSaveYours: true,
};
export const TOO_MANY = () =>
  new AppError("rate_limited", HOTEL_FORM_ERRORS.writeLimit, undefined, 429, 3);
export const ROOMS = { model: ROOMS_MODEL, check: payloadOf };
export const TOTAL_ID = "hf-rooms-totalRooms";

/** The rooms total as the person types it. */
export const typeTotal = (total: string) => (fields: RoomsFields) => ({
  ...fields,
  totalRooms: total,
});

interface Call {
  readonly call: HotelFormSectionSaveCall;
  readonly resolve: (saved: HotelFormSectionSaved) => void;
  readonly reject: (error: unknown) => void;
}

/**
 * Held sections whose saves wait for the test to answer them, under the session the test sets.
 *
 *   const { sections, calls, openRooms, answer } = heldHarness();
 */
export function heldHarness() {
  const calls: Call[] = [];
  const session: { current: FormSession } = { current: { token: SESSION, personId: PERSON } };
  const refusedSessions: unknown[] = [];
  const sections = new HeldSections({
    save: (call) =>
      new Promise<HotelFormSectionSaved>((resolve, reject) =>
        calls.push({ call, resolve, reject }),
      ),
    session: () => session.current,
    refuseSession: (error) => refusedSessions.push(error),
  });
  const openRooms = (version = 2, totalRooms = 40) =>
    sections.open(
      "rooms",
      ROOMS,
      { version, saved: { answers: { totalRooms }, noChanges: false } },
      session.current.personId ?? PERSON,
    );
  const answer = async (index: number, saved: Partial<HotelFormSectionSaved> = {}) => {
    calls[index]?.resolve({ ...SAVED, ...saved });
    await vi.advanceTimersByTimeAsync(0);
  };
  const refuse = async (index: number, error: unknown) => {
    calls[index]?.reject(error);
    await vi.advanceTimersByTimeAsync(0);
  };
  return { sections, calls, session, refusedSessions, openRooms, answer, refuse };
}
