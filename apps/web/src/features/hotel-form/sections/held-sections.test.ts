import type { HotelFormSectionSaveCall } from "@ampm/api-client";
import {
  AppError,
  errors,
  HOTEL_FORM_ERRORS,
  hotelFormSessionError,
  type HotelFormSectionSaved,
} from "@ampm/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONTACT_MODEL, type ContactFields } from "./contact.form";
import { HeldSections, KEEPALIVE_BUDGET_BYTES, type FormSession } from "./held-sections";
import { PROPERTY_MODEL, type PropertyFields } from "./property.form";
import { ROOMS_MODEL, emptyRoom, type RoomsFields } from "./rooms.form";
import { AUTOSAVE_DELAY_MS } from "./section-autosave";
import { payloadOf } from "./section-payload";

/*
 * The form's held sections (D-190 §5, review fixes E1, E4 and E5): a section left keeps its autosave and
 * what was typed, opens again as it was left, belongs to the person who typed it, and says whether the
 * tab may close. Synthetic answers only.
 */

const PERSON = "0192f3a0-7d3e-7b1a-9c2f-0000000000a5";
const COLLEAGUE = "0192f3a0-7d3e-7b1a-9c2f-0000000000b7";
const SESSION = `hfs_${"y".repeat(43)}`;
const NEW_SESSION = `hfs_${"z".repeat(43)}`;
const SAVED: HotelFormSectionSaved = {
  version: 3,
  isComplete: false,
  contentHash: "a".repeat(64),
  lastEditedBy: "Asha Rao",
  lastEditedAt: "2026-11-26T10:00:00.000Z",
  isLastSaveYours: true,
};
const TOO_MANY = () =>
  new AppError("rate_limited", HOTEL_FORM_ERRORS.writeLimit, undefined, 429, 3);
const ROOMS = { model: ROOMS_MODEL, check: payloadOf };
const PROPERTY = { model: PROPERTY_MODEL, check: payloadOf };

interface Call {
  readonly call: HotelFormSectionSaveCall;
  readonly resolve: (saved: HotelFormSectionSaved) => void;
  readonly reject: (error: unknown) => void;
}

/** Held sections whose saves wait for the test to answer them, under the session the test sets. */
function harness() {
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

const typeTotal = (total: string) => (fields: RoomsFields) => ({ ...fields, totalRooms: total });
const TOTAL_ID = "hf-rooms-totalRooms";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse("2026-11-26T10:00:00.000Z"));
});

afterEach(() => vi.useRealTimers());

describe("leaving a section (review fixes E1 and E4)", () => {
  it("keeps a 429's wait, sends what was typed once it is over, and opens again as it was left", async () => {
    const { sections, calls, openRooms, refuse, answer } = harness();
    const rooms = openRooms();
    rooms.attach();
    rooms.update(typeTotal("41"));
    rooms.leave(TOTAL_ID);
    await refuse(0, TOO_MANY());
    rooms.update(typeTotal("43"));
    rooms.detach();
    expect(sections.statuses()).toEqual({ rooms: "waiting" });
    await vi.advanceTimersByTimeAsync(3_000);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.call.save).toMatchObject({ answers: { totalRooms: 43 }, expectedVersion: 2 });
    await answer(1);
    expect(sections.statuses()).toEqual({});
    const again = openRooms();
    expect(again).toBe(rooms);
    expect(again.snapshot().fields.totalRooms).toBe("43");
    expect(again.snapshot().save).toEqual({ kind: "saved" });
  });

  it("keeps Not saved and its Retry: leaving tries once more, and the overview says it is not saved", async () => {
    const { sections, calls, openRooms, refuse, answer } = harness();
    const rooms = openRooms();
    rooms.attach();
    rooms.update(typeTotal("41"));
    rooms.leave(TOTAL_ID);
    await refuse(0, errors.network());
    rooms.detach();
    expect(calls).toHaveLength(2);
    await refuse(1, errors.network());
    expect(sections.statuses()).toEqual({ rooms: "unsaved" });
    const again = openRooms();
    expect(again).toBe(rooms);
    expect(again.snapshot().save.kind).toBe("failed");
    again.retry();
    await answer(2);
    expect(sections.statuses()).toEqual({});
  });

  it("opens again on the section left with its save on the way, never the draft from before that save", async () => {
    const { calls, openRooms, answer } = harness();
    const rooms = openRooms();
    rooms.attach();
    rooms.update(typeTotal("41"));
    rooms.leave(TOTAL_ID);
    rooms.detach();
    // Back, before the save is answered: the draft still says version 2 and 40 rooms.
    const again = openRooms(2, 40);
    again.attach();
    expect(again).toBe(rooms);
    expect(again.snapshot().fields.totalRooms).toBe("41");
    await answer(0, { version: 3 });
    expect(again.snapshot().save).toEqual({ kind: "saved" });
    again.update(typeTotal("42"));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(calls[1]?.call.save.expectedVersion).toBe(3);
  });

  it("opens a section left all saved from the draft again once a colleague saved it since", async () => {
    const { openRooms, answer } = harness();
    const rooms = openRooms();
    rooms.attach();
    rooms.update(typeTotal("41"));
    rooms.leave(TOTAL_ID);
    await answer(0, { version: 3 });
    // Still open: a newer draft never replaces what the page shows.
    expect(openRooms(5, 52)).toBe(rooms);
    rooms.detach();
    // The same version as held: the held one, which is the same answers.
    expect(openRooms(3, 41)).toBe(rooms);
    const fresh = openRooms(5, 52);
    expect(fresh).not.toBe(rooms);
    expect(fresh.snapshot().fields.totalRooms).toBe("52");
    expect(fresh.version()).toBe(5);
  });

  it("keeps a section left with a refused field, which says it is not saved", () => {
    const { sections, openRooms } = harness();
    const rooms = openRooms();
    rooms.attach();
    rooms.update(typeTotal("forty"));
    rooms.detach();
    expect(sections.statuses()).toEqual({ rooms: "unsaved" });
    expect(openRooms(5, 52)).toBe(rooms);
    expect(rooms.snapshot().fields.totalRooms).toBe("forty");
  });
});

describe("a contact's refused field (review fix E2)", () => {
  it("is sent as its row's last save stored it, the save landed since the page opened", async () => {
    const { sections, calls, answer } = harness();
    const contact = sections.open(
      "contact",
      { model: CONTACT_MODEL, check: payloadOf },
      { version: 0, saved: { answers: {}, noChanges: false } },
      PERSON,
    );
    const typeEmail = (email: string) =>
      contact.update((fields: ContactFields) => ({
        ...fields,
        contacts: fields.contacts.map((row) => ({ ...row, name: "Synthetic Ravi", email })),
      }));
    typeEmail("events@grandhotel.example");
    contact.leave("");
    await answer(0, { version: 1 });
    // Retyping the domain, paused at "events@grandhotel": the stored email still goes, never a blank.
    typeEmail("events@grandhotel");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(calls).toHaveLength(1);
    typeEmail("events@grandhotel");
    contact.update((fields: ContactFields) => ({
      ...fields,
      contacts: fields.contacts.map((row) => ({ ...row, role: "Events" })),
    }));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(calls[1]?.call.save.answers).toEqual({
      contacts: [
        { name: "Synthetic Ravi", role: "Events", phone: null, email: "events@grandhotel.example" },
      ],
      noLongerOffered: null,
    });
  });
});

describe("whose typing it is (review fix E1)", () => {
  it("drops every held section on sign-out: nothing typed is sent after, not even after a 429", async () => {
    const { sections, calls, openRooms, refuse } = harness();
    const rooms = openRooms();
    rooms.update(typeTotal("41"));
    rooms.leave(TOTAL_ID);
    await refuse(0, TOO_MANY());
    rooms.update(typeTotal("43"));
    const before = sections.generation();
    sections.drop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toHaveLength(1);
    expect(sections.statuses()).toEqual({});
    expect(sections.hasPending()).toBe(false);
    expect(sections.generation()).toBe(before + 1);
    expect(openRooms().snapshot().fields.totalRooms).toBe("40");
  });

  it("drops what one person typed when someone else signs in with a new code, sending none of it", async () => {
    const { sections, calls, session, refusedSessions, openRooms, refuse } = harness();
    const rooms = openRooms();
    rooms.update(typeTotal("41"));
    rooms.leave(TOTAL_ID);
    await refuse(0, hotelFormSessionError("session_expired"));
    expect(refusedSessions).toHaveLength(1);
    expect(rooms.snapshot().save).toEqual({ kind: "session" });
    session.current = { token: NEW_SESSION, personId: COLLEAGUE };
    sections.sessionChanged(session.current);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(calls).toHaveLength(1);
    const fresh = openRooms();
    expect(fresh).not.toBe(rooms);
    expect(fresh.snapshot().fields.totalRooms).toBe("40");
  });

  it("sends what waited for the same person's new code, under the new session", async () => {
    const { sections, calls, session, openRooms, refuse } = harness();
    const rooms = openRooms();
    rooms.update(typeTotal("41"));
    rooms.leave(TOTAL_ID);
    await refuse(0, hotelFormSessionError("session_expired"));
    session.current = { token: NEW_SESSION, personId: PERSON };
    sections.sessionChanged(session.current);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.call.sessionToken).toBe(NEW_SESSION);
    expect(calls[1]?.call.save.answers).toMatchObject({ totalRooms: 41 });
  });

  it("belongs to the person the page opened it for, though the session it last heard lags behind", async () => {
    const { sections, calls, session } = harness();
    // A reload: the layout last heard the session before `me` named its person; the page knows them.
    session.current = { token: SESSION, personId: undefined };
    const rooms = sections.open(
      "rooms",
      ROOMS,
      { version: 2, saved: { answers: { totalRooms: 40 }, noChanges: false } },
      PERSON,
    );
    session.current = { token: SESSION, personId: PERSON };
    rooms.update(typeTotal("41"));
    rooms.leave(TOTAL_ID);
    expect(calls).toHaveLength(1);
    expect(rooms.snapshot().save).toEqual({ kind: "saving" });
  });

  it("never sends one person's typing under another's session, even before it hears of the change", async () => {
    const { calls, session, openRooms, refuse } = harness();
    const rooms = openRooms();
    rooms.update(typeTotal("41"));
    rooms.leave(TOTAL_ID);
    await refuse(0, TOO_MANY());
    rooms.update(typeTotal("43"));
    session.current = { token: NEW_SESSION, personId: COLLEAGUE };
    await vi.advanceTimersByTimeAsync(3_000);
    expect(calls).toHaveLength(1);
    expect(rooms.snapshot().save).toEqual({ kind: "session" });
  });
});

describe("the page going (review fix E5)", () => {
  it("says whether any section has typing not saved yet, which the tab asks about before closing", async () => {
    const { sections, openRooms, answer } = harness();
    const rooms = openRooms();
    expect(sections.hasPending()).toBe(false);
    rooms.update(typeTotal("41"));
    expect(sections.hasPending()).toBe(true);
    rooms.leave(TOTAL_ID);
    await answer(0);
    expect(sections.hasPending()).toBe(false);
  });

  it("sends what waits when the page is hidden, with keepalive while the bodies fit its limit", async () => {
    const { sections, calls, openRooms } = harness();
    const property = sections.open(
      "property",
      PROPERTY,
      { version: 0, saved: { answers: {}, noChanges: false } },
      PERSON,
    );
    property.update((fields: PropertyFields) => ({ ...fields, name: "Synthetic Lake Palace" }));
    const rooms = openRooms();
    // Seven room categories with long notes: more than keepalive takes, so it goes without it.
    const rows = Array.from({ length: 7 }, () => ({
      ...emptyRoom(crypto.randomUUID()),
      name: "Synthetic Suite",
      notes: "n".repeat(9_000),
    }));
    rooms.update((fields) => ({ ...fields, rows }));
    expect(rooms.pendingBytes()).toBeGreaterThan(KEEPALIVE_BUDGET_BYTES);
    sections.flushAll({ keepalive: true });
    expect(calls.map(({ call }) => [call.section, call.keepalive ?? false])).toEqual([
      ["property", true],
      ["rooms", false],
    ]);
  });
});
