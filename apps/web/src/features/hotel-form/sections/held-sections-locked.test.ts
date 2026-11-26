import {
  AppError,
  HOTEL_FORM_ERRORS,
  hotelFormReadOnlyDetails,
  hotelFormSectionConflictDetails,
} from "@ampm/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TOTAL_ID, heldHarness as harness, typeTotal } from "./held-sections.test-utils";

/*
 * A section a save found locked (D-190 §5, review fix F4): a colleague submitted while the person typed,
 * so the section turned read-only with their text kept. When AMPM asks for changes the request takes
 * answers again: a draft read after that submit says so, and the section opens for editing again, its
 * text kept, and saves it, or gets a colleague's save to choose over. Synthetic answers only.
 */

const SUBMITTED_AT = "2026-11-26T10:00:30.000Z";

/** The 409 readOnly a save gets once a colleague submitted. */
const locked = () =>
  new AppError(
    "conflict",
    HOTEL_FORM_ERRORS.readOnly,
    hotelFormReadOnlyDetails({
      status: "submitted",
      submittedBy: "Ravi Kumar",
      submittedAt: SUBMITTED_AT,
    }),
  );

/** The 409 sectionConflict a save gets when a colleague saved the section since. */
const colleagueSaved = () =>
  new AppError(
    "conflict",
    HOTEL_FORM_ERRORS.sectionConflict,
    hotelFormSectionConflictDetails({
      section: "rooms",
      version: 6,
      answers: { totalRooms: 52 },
      noChanges: false,
      editedBy: "Ravi Kumar",
      editedAt: "2026-11-26T10:40:00.000Z",
    }),
  );

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse("2026-11-26T10:00:00.000Z"));
});

afterEach(() => vi.useRealTimers());

/** Rooms typed in, then its save refused because a colleague submitted the form. */
async function lockedRooms() {
  const held = harness();
  const rooms = held.openRooms();
  rooms.update(typeTotal("41"));
  rooms.leave(TOTAL_ID);
  await held.refuse(0, locked());
  return { ...held, rooms };
}

describe("a section a save found locked (review fix F4)", () => {
  it("opens again, its text kept, once a read after the submit says AMPM asked for changes", async () => {
    const { sections, calls, rooms, answer } = await lockedRooms();
    expect(rooms.snapshot().save.kind).toBe("locked");
    expect(sections.statuses()).toEqual({ rooms: "unsaved" });
    // A read from before the submit that lands late, then one after it while AMPM has the form.
    sections.draftRead({ readAt: "2026-11-26T10:00:10.000Z", isEditable: true });
    sections.draftRead({ readAt: "2026-11-26T10:05:00.000Z", isEditable: false });
    expect(rooms.snapshot().save.kind).toBe("locked");
    expect(calls).toHaveLength(1);
    // AMPM asks for changes: the next read says the request takes answers again.
    sections.draftRead({ readAt: "2026-11-26T11:00:00.000Z", isEditable: true });
    expect(rooms.snapshot().fields.totalRooms).toBe("41");
    expect(calls[1]?.call.save).toMatchObject({ answers: { totalRooms: 41 }, expectedVersion: 2 });
    await answer(1, { version: 3 });
    expect(rooms.snapshot().save).toEqual({ kind: "saved" });
    expect(sections.statuses()).toEqual({});
  });

  it("offers Keep mine when a colleague saved the section meanwhile, which saves on their version", async () => {
    const { sections, calls, rooms, refuse } = await lockedRooms();
    sections.draftRead({ readAt: "2026-11-26T11:00:00.000Z", isEditable: true });
    await refuse(1, colleagueSaved());
    expect(rooms.snapshot().save.kind).toBe("conflict");
    rooms.keepMine();
    expect(calls[2]?.call.save).toMatchObject({ answers: { totalRooms: 41 }, expectedVersion: 6 });
  });

  it("without the submit's time, opens again only on a read heard of after the refusal", async () => {
    const { sections, calls, openRooms, refuse } = harness();
    sections.draftRead({ readAt: "2026-11-26T09:59:00.000Z", isEditable: true });
    const rooms = openRooms();
    rooms.update(typeTotal("41"));
    rooms.leave(TOTAL_ID);
    await refuse(0, new AppError("conflict", HOTEL_FORM_ERRORS.readOnly));
    expect(rooms.snapshot().save).toEqual({ kind: "locked", readOnly: null });
    // The same read again (another section's save changed the cached draft, nothing was read): locked.
    sections.draftRead({ readAt: "2026-11-26T09:59:00.000Z", isEditable: true });
    expect(calls).toHaveLength(1);
    sections.draftRead({ readAt: "2026-11-26T11:00:00.000Z", isEditable: true });
    expect(calls).toHaveLength(2);
  });
});
