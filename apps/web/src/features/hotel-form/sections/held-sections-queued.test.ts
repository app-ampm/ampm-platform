import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONTACT_MODEL, type ContactFields } from "./contact.form";
import { PERSON, TOTAL_ID, heldHarness as harness, typeTotal } from "./held-sections.test-utils";
import { AUTOSAVE_DELAY_MS } from "./section-autosave";
import { payloadOf } from "./section-payload";
import { VENUES_MODEL, type VenueRowFields, type VenuesFields } from "./venues.form";

/*
 * Typing that waits behind a save on its way (D-190 §5, review fix F1): it was read against what the API
 * held before that save, so once the save lands it is read again, and a refused field goes as what that
 * save stored, never as the value from before it. Contacts fall back by their row, rooms and venues by
 * their row id. Synthetic answers only.
 */

const ROW_ID = "0192f3a0-7d3e-7b1a-9c2f-00000000c0de";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse("2026-11-26T10:00:00.000Z"));
});

afterEach(() => vi.useRealTimers());

describe("a save queued behind one on its way (review fix F1)", () => {
  it("rooms: a refused total falls back to what the save on its way stored, not the total before it", async () => {
    const { calls, openRooms, answer } = harness();
    const rooms = openRooms();
    rooms.update(typeTotal("41"));
    rooms.leave(TOTAL_ID);
    // Retyped while 41 is on its way, then a note: both wait behind that save.
    rooms.update(typeTotal("41x"));
    rooms.update((fields) => ({ ...fields, noLongerOffered: "The old spa wing" }));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(calls).toHaveLength(1);
    await answer(0, { version: 3 });
    expect(calls[1]?.call.save).toMatchObject({
      answers: { totalRooms: 41, noLongerOffered: "The old spa wing" },
      expectedVersion: 3,
    });
  });

  it("rooms: sends nothing more when a refused total was all that changed since", async () => {
    const { calls, openRooms, answer } = harness();
    const rooms = openRooms();
    rooms.update(typeTotal("41"));
    rooms.leave(TOTAL_ID);
    rooms.update(typeTotal("41x"));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    await answer(0, { version: 3 });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(calls).toHaveLength(1);
    expect(rooms.snapshot().save).toEqual({ kind: "saved" });
  });

  it("contacts: a new row's refused email falls back to the email its first save stored", async () => {
    const { sections, calls, answer } = harness();
    const contact = sections.open(
      "contact",
      { model: CONTACT_MODEL, check: payloadOf },
      { version: 0, saved: { answers: {}, noChanges: false } },
      PERSON,
    );
    const typeRow = (email: string, role = "") =>
      contact.update((fields: ContactFields) => ({
        ...fields,
        contacts: fields.contacts.map((row) => ({ ...row, name: "Synthetic Ravi", email, role })),
      }));
    typeRow("events@grandhotel.example");
    contact.leave("");
    // Retyping the domain while that save is on its way, paused at "events@grandhotel", then a role.
    typeRow("events@grandhotel", "Events");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    await answer(0, { version: 1 });
    expect(calls[1]?.call.save.answers).toEqual({
      contacts: [
        { name: "Synthetic Ravi", role: "Events", phone: null, email: "events@grandhotel.example" },
      ],
      noLongerOffered: null,
    });
  });

  it("venues: a refused theatre count falls back to what the save on its way stored for its row", async () => {
    const { sections, calls, answer } = harness();
    const saved = { rows: [{ rowId: ROW_ID, name: "Synthetic Lawn", theatre: 100 }] };
    const venues = sections.open(
      "venues",
      { model: VENUES_MODEL, check: payloadOf },
      { version: 4, saved: { answers: saved, noChanges: false } },
      PERSON,
    );
    const typeRow = (change: Partial<VenueRowFields>) =>
      venues.update((fields: VenuesFields) => ({
        ...fields,
        rows: fields.rows.map((row) => ({ ...row, ...change })),
      }));
    typeRow({ theatre: "120" });
    venues.leave("");
    typeRow({ theatre: "12o", notes: "Covered in winter" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    await answer(0, { version: 5 });
    expect(calls[1]?.call.save).toMatchObject({
      answers: { rows: [{ rowId: ROW_ID, theatre: 120, notes: "Covered in winter" }] },
      expectedVersion: 5,
    });
  });
});
