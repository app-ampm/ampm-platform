import { isAppError, type FieldNoteUpsert } from "@ampm/core";
import type { PolicyPrincipal, StaffRole } from "@ampm/policy";
import { describe, expect, it } from "vitest";

import type { RecordScope } from "../../db/scoping.js";
import { FieldNoteService } from "./field-note.service.js";

const PROJECT = "0192f3a0-7d3e-7b1a-9c2f-aaaaaaaaaaaa";
const OTHER_PROJECT = "0192f3a0-7d3e-7b1a-9c2f-bbbbbbbbbbbb";
const NOTE_ID = "0192f3a0-7d3e-7b1a-9c2f-000000000001";
const AT = "2026-10-27T05:00:00.000Z";
const EVERY_PROJECT: RecordScope = { where: { deletedAt: null }, isDemo: false };
const MEMBER_OF_OTHER: RecordScope = {
  where: { projectId: { in: [OTHER_PROJECT] }, deletedAt: null },
  isDemo: false,
};

function member(role: StaffRole): PolicyPrincipal {
  return { type: "staff", userId: `u-${role}`, roles: [role], projectIds: [PROJECT] };
}

/** A project manager of the wedding: CRUA (a) on incidents (permission-matrix §5.13 line 296). */
const PM = member("PM");

function write(overrides: Partial<FieldNoteUpsert> = {}): FieldNoteUpsert {
  return {
    id: NOTE_ID,
    baseVersion: 0,
    body: "Catering van at gate 3",
    status: "open",
    clientTimestamp: AT,
    ...overrides,
  };
}

/** The status of the typed error a write is refused with, or undefined when it applies. */
function refusedWith(service: FieldNoteService, writer: PolicyPrincipal, input: FieldNoteUpsert) {
  try {
    service.upsert(PROJECT, input, writer);
    return undefined;
  } catch (error) {
    return isAppError(error) ? error.status : error;
  }
}

describe("FieldNoteService (offline spike)", () => {
  it("creates at version 1, then applies the next edit in order", () => {
    const service = new FieldNoteService();
    const created = service.upsert(PROJECT, write({ baseVersion: 0 }), PM);
    expect(created.outcome).toBe("applied");
    expect(created.note.version).toBe(1);

    const edited = service.upsert(PROJECT, write({ baseVersion: 1, body: "Van unloaded" }), PM);
    expect(edited.outcome).toBe("applied");
    expect(edited.note.version).toBe(2);
    expect(edited.note.body).toBe("Van unloaded");
  });

  it("is idempotent: replaying the same write never applies twice", () => {
    const service = new FieldNoteService();
    service.upsert(PROJECT, write({ baseVersion: 0 }), PM);
    const replay = service.upsert(
      PROJECT,
      write({ baseVersion: 0, body: "ignored on replay" }),
      PM,
    );
    expect(replay.outcome).toBe("duplicate");
    expect(replay.note.version).toBe(1);
    expect(replay.note.body).toBe("Catering van at gate 3");
    expect(service.list(PROJECT, EVERY_PROJECT).items).toHaveLength(1);
  });

  it("rejects a stale base version: the server wins and the record is unchanged", () => {
    const service = new FieldNoteService();
    service.upsert(PROJECT, write({ baseVersion: 0, body: "Original" }), PM);
    const stale = service.upsert(
      PROJECT,
      write({ baseVersion: 2, body: "From an out-of-date device" }),
      PM,
    );
    expect(stale.outcome).toBe("conflict");
    expect(stale.note.version).toBe(1);
    expect(stale.note.body).toBe("Original");
  });

  it("keeps notes isolated per project", () => {
    const service = new FieldNoteService();
    service.upsert(PROJECT, write({ baseVersion: 0 }), PM);
    expect(service.list(OTHER_PROJECT, EVERY_PROJECT).items).toHaveLength(0);
  });

  it("reads nothing outside the request's scope (step 5), even on a project that has notes", () => {
    const service = new FieldNoteService();
    service.upsert(PROJECT, write({ baseVersion: 0 }), PM);
    expect(service.list(PROJECT, MEMBER_OF_OTHER).items).toHaveLength(0);
    expect(service.list(PROJECT, EVERY_PROJECT).items).toHaveLength(1);
  });

  it("§5.13 line 296: CD (a) creates notes, but changing one needs the update key, a 403", () => {
    const service = new FieldNoteService();
    const creative = member("CD");
    expect(service.upsert(PROJECT, write({ baseVersion: 0 }), creative).outcome).toBe("applied");
    const change = write({ baseVersion: 1, body: "Replaced", status: "resolved" });
    expect(refusedWith(service, creative, change)).toBe(403);
    // A stale write is still a write to the note: refused the same way, never a conflict.
    expect(refusedWith(service, creative, write({ baseVersion: 5 }))).toBe(403);
    expect(service.list(PROJECT, EVERY_PROJECT).items[0]).toMatchObject({
      version: 1,
      body: "Catering van at gate 3",
      status: "open",
    });
  });

  it("test-cases.md line 212: a writer who may not see the notes is refused as absent, a 404", () => {
    const service = new FieldNoteService();
    service.upsert(PROJECT, write({ baseVersion: 0 }), PM);
    expect(refusedWith(service, member("SM"), write({ baseVersion: 1 }))).toBe(404);
  });

  it("offline.md line 11: another writer's change from the same base is not taken for a replay", () => {
    const service = new FieldNoteService();
    service.upsert(PROJECT, write({ baseVersion: 0 }), PM);
    service.upsert(PROJECT, write({ baseVersion: 1, body: "PM edited" }), PM);
    // CD (a) creates and reads incidents only (§5.13 line 296): its change is refused, not dropped.
    const offline = write({ baseVersion: 1, body: "CD offline change", status: "resolved" });
    expect(refusedWith(service, member("CD"), offline)).toBe(403);
    // A writer who may change the note gets the conflict to show, not a silent "duplicate".
    const admin = { type: "staff", userId: "u-SA", roles: ["SA"] } as const;
    expect(service.upsert(PROJECT, write({ baseVersion: 1, body: "SA edit" }), admin).outcome).toBe(
      "conflict",
    );
    // PM's own replay of its edit is still recognised as one.
    const replay = service.upsert(PROJECT, write({ baseVersion: 1, body: "PM edited" }), PM);
    expect(replay).toMatchObject({ outcome: "duplicate", note: { version: 2, body: "PM edited" } });
  });

  it("a create-only writer's replay of its own create is still a duplicate, not a refusal", () => {
    const service = new FieldNoteService();
    const creative = member("CD");
    service.upsert(PROJECT, write({ baseVersion: 0 }), creative);
    expect(service.upsert(PROJECT, write({ baseVersion: 0 }), creative).outcome).toBe("duplicate");
  });
});
